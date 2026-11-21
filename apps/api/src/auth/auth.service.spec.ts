import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { encryptToken } from '../crypto/token-cipher';
import { PrismaService } from '../prisma/prisma.service';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(secret: string): Buffer {
  const cleanSecret = secret.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of cleanSecret) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateTotp(secret: string, epochMillis: number): string {
  const secretBytes = base32Decode(secret);
  const counter = Math.floor(epochMillis / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBytes).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** 6).padStart(6, '0');
}

describe('AuthService MFA', () => {
  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  });

  it('returns an MFA challenge for password-valid users with MFA enabled', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 4);
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'u1',
          email: 'user@example.com',
          password: passwordHash,
          name: 'User',
          mfaEnabled: true,
          mfaSecret: encryptToken('JBSWY3DPEHPK3PXP'),
        }),
      },
    };
    const jwt = new JwtService({ secret: 'jwt-test-secret' });
    const service = new AuthService(prisma as unknown as PrismaService, jwt);

    const result = await service.login('user@example.com', 'Password123!');

    expect(result).toHaveProperty('requiresMfa', true);
    expect(result).toHaveProperty('mfaToken');
  });

  it('verifies MFA login with a valid authenticator code', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'u1',
          email: 'user@example.com',
          name: 'User',
          mfaEnabled: true,
          mfaSecret: encryptToken(secret),
          mfaRecoveryCodes: null,
        }),
        update: vi.fn(),
      },
    };
    const jwt = new JwtService({ secret: 'jwt-test-secret' });
    const service = new AuthService(prisma as unknown as PrismaService, jwt);
    const mfaToken = jwt.sign({ sub: 'u1', email: 'user@example.com', purpose: 'mfa-login' }, { expiresIn: '5m' });
    const code = generateTotp(secret, now);

    const result = await service.verifyMfaLogin(mfaToken, code);

    expect(result).toHaveProperty('accessToken');
    expect(result.user).toEqual({ id: 'u1', email: 'user@example.com', name: 'User' });
    expect(prisma.user.update).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
