import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { decryptToken, encryptToken } from '../crypto/token-cipher';

const MFA_TOKEN_PURPOSE = 'mfa-login';
const MFA_STEP_SECONDS = 30;
const MFA_DIGITS = 6;
const MFA_WINDOW_STEPS = 1;
const MFA_RECOVERY_CODES_COUNT = 8;
const TOTP_ISSUER = 'RetireePlan';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(email: string, password: string, name?: string) {
    const normalised = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalised } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: { email: normalised, password: hashedPassword, name },
    });

    return this.issueAccessToken(user.id, user.email, user.name);
  }

  async login(email: string, password: string) {
    const normalised = email.trim().toLowerCase();
    // Try a normalized lookup first (new users), but fall back to the
    // original-cased email so existing accounts created before normalization
    // still work.
    let user = await this.prisma.user.findUnique({ where: { email: normalised } });
    if (!user) {
      // Try an exact trimmed lookup using the provided casing
      user = await this.prisma.user.findUnique({ where: { email: email.trim() } });
    }

    if (!user) {
      // As a final fallback, perform a case-insensitive match in JS for
      // legacy accounts that were created with different email casing.
      const all = await this.prisma.user.findMany();
      user = all.find((u) => u.email.toLowerCase() === normalised) || null;
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.mfaEnabled) {
      if (!user.mfaSecret) {
        throw new UnauthorizedException('MFA is enabled but not configured for this account');
      }
      const mfaToken = this.jwtService.sign(
        { sub: user.id, email: user.email, purpose: MFA_TOKEN_PURPOSE },
        { expiresIn: '5m' },
      );
      return { requiresMfa: true, mfaToken };
    }

    return this.issueAccessToken(user.id, user.email, user.name);
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, mfaEnabled: true },
    });
  }

  async updateProfile(
    userId: string,
    dto: { name?: string; currentPassword?: string; newPassword?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const updates: { name?: string; password?: string } = {};

    if (dto.name !== undefined && dto.name.trim() !== '') {
      updates.name = dto.name.trim();
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required to set a new password');
      }
      const valid = await bcrypt.compare(dto.currentPassword, user.password);
      if (!valid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      if (dto.newPassword.length < 8) {
        throw new BadRequestException('New password must be at least 8 characters');
      }
      updates.password = await bcrypt.hash(dto.newPassword, 12);
    }

    if (Object.keys(updates).length === 0) {
      return { id: user.id, email: user.email, name: user.name, mfaEnabled: user.mfaEnabled };
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updates,
      select: { id: true, email: true, name: true, mfaEnabled: true },
    });

    return updated;
  }

  async getMfaStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaEnabledAt: true, mfaPendingSecret: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      enabled: user.mfaEnabled,
      enabledAt: user.mfaEnabledAt,
      pendingSetup: Boolean(user.mfaPendingSecret),
    };
  }

  async beginMfaSetup(userId: string, email: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.mfaEnabled) {
      throw new ConflictException('MFA is already enabled');
    }

    const secret = this.generateBase32Secret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaPendingSecret: encryptToken(secret) },
    });

    return {
      manualEntryKey: secret,
      otpAuthUrl: this.buildOtpAuthUrl(email, secret),
      issuer: TOTP_ISSUER,
    };
  }

  async enableMfa(userId: string, verificationCode: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaPendingSecret: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (!user.mfaPendingSecret) {
      throw new BadRequestException('No MFA setup is pending');
    }

    const secret = decryptToken(user.mfaPendingSecret);
    if (!this.verifyTotpCode(secret, verificationCode)) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const recoveryCodes = this.generateRecoveryCodes(MFA_RECOVERY_CODES_COUNT);
    const hashedRecoveryCodes = await Promise.all(
      recoveryCodes.map(async (code) => bcrypt.hash(code, 12)),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecret: encryptToken(secret),
        mfaPendingSecret: null,
        mfaRecoveryCodes: JSON.stringify(hashedRecoveryCodes),
        mfaEnabledAt: new Date(),
      },
    });

    return {
      recoveryCodes,
    };
  }

  async disableMfa(userId: string, currentPassword: string, verificationCode: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, mfaEnabled: true, mfaSecret: true, mfaRecoveryCodes: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled');
    }

    const passwordValid = await bcrypt.compare(currentPassword, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.assertValidMfaChallenge(user.mfaSecret, user.mfaRecoveryCodes, verificationCode, userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaPendingSecret: null,
        mfaRecoveryCodes: null,
        mfaEnabledAt: null,
      },
    });
  }

  async regenerateRecoveryCodes(userId: string, currentPassword: string, verificationCode: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, mfaEnabled: true, mfaSecret: true, mfaRecoveryCodes: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled');
    }

    const passwordValid = await bcrypt.compare(currentPassword, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.assertValidMfaChallenge(user.mfaSecret, user.mfaRecoveryCodes, verificationCode, userId);

    const recoveryCodes = this.generateRecoveryCodes(MFA_RECOVERY_CODES_COUNT);
    const hashedRecoveryCodes = await Promise.all(
      recoveryCodes.map(async (code) => bcrypt.hash(code, 12)),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaRecoveryCodes: JSON.stringify(hashedRecoveryCodes) },
    });

    return { recoveryCodes };
  }

  async verifyMfaLogin(mfaToken: string, verificationCode: string) {
    let payload: { sub: string; email: string; purpose?: string };
    try {
      payload = this.jwtService.verify<{ sub: string; email: string; purpose?: string }>(mfaToken);
    } catch {
      throw new UnauthorizedException('MFA session expired. Please sign in again.');
    }

    if (payload.purpose !== MFA_TOKEN_PURPOSE) {
      throw new UnauthorizedException('Invalid MFA session');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaRecoveryCodes: true,
      },
    });
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException('MFA is not configured for this account');
    }

    await this.assertValidMfaChallenge(user.mfaSecret, user.mfaRecoveryCodes, verificationCode, user.id);
    return this.issueAccessToken(user.id, user.email, user.name);
  }

  private issueAccessToken(userId: string, email: string, name?: string | null) {
    const token = this.jwtService.sign({ sub: userId, email });
    return { accessToken: token, user: { id: userId, email, name } };
  }

  private generateBase32Secret(bytes = 20): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const data = crypto.randomBytes(bytes);
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of data) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }

    return output;
  }

  private buildOtpAuthUrl(email: string, secret: string) {
    const label = `${TOTP_ISSUER}:${email}`;
    const params = new URLSearchParams({
      secret,
      issuer: TOTP_ISSUER,
      algorithm: 'SHA1',
      digits: String(MFA_DIGITS),
      period: String(MFA_STEP_SECONDS),
    });
    return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
  }

  private base32Decode(secret: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanSecret = secret.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (const char of cleanSecret) {
      const index = alphabet.indexOf(char);
      if (index === -1) {
        throw new BadRequestException('Stored MFA secret is invalid');
      }
      value = (value << 5) | index;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }

  private generateTotp(secret: string, epochMillis: number): string {
    const secretBytes = this.base32Decode(secret);
    const counter = Math.floor(epochMillis / 1000 / MFA_STEP_SECONDS);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    const hmac = crypto.createHmac('sha1', secretBytes).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return String(code % 10 ** MFA_DIGITS).padStart(MFA_DIGITS, '0');
  }

  private verifyTotpCode(secret: string, code: string): boolean {
    const normalizedCode = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(normalizedCode)) {
      return false;
    }
    const now = Date.now();
    for (let offset = -MFA_WINDOW_STEPS; offset <= MFA_WINDOW_STEPS; offset += 1) {
      const expected = this.generateTotp(secret, now + offset * MFA_STEP_SECONDS * 1000);
      if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalizedCode))) {
        return true;
      }
    }
    return false;
  }

  private generateRecoveryCodes(count: number): string[] {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: count }, () => {
      const chars = Array.from(crypto.randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join('');
      return `${chars.slice(0, 4)}-${chars.slice(4)}`;
    });
  }

  private parseRecoveryCodeHashes(value: string | null): string[] {
    if (!value) {
      return [];
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new BadRequestException('Stored MFA recovery codes are invalid');
    }
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      throw new BadRequestException('Stored MFA recovery codes are invalid');
    }
    return parsed;
  }

  private async assertValidMfaChallenge(
    encryptedSecret: string,
    recoveryCodeHashes: string | null,
    verificationCode: string,
    userId: string,
  ) {
    const secret = decryptToken(encryptedSecret);
    if (this.verifyTotpCode(secret, verificationCode)) {
      return;
    }

    const normalizedRecoveryCode = verificationCode.trim().toUpperCase();
    const hashes = this.parseRecoveryCodeHashes(recoveryCodeHashes);
    for (const hash of hashes) {
      const matches = await bcrypt.compare(normalizedRecoveryCode, hash);
      if (!matches) {
        continue;
      }
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          mfaRecoveryCodes: JSON.stringify(hashes.filter((item) => item !== hash)),
        },
      });
      return;
    }

    throw new UnauthorizedException('Invalid verification code');
  }
}
