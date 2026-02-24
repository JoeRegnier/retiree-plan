import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

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

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { accessToken: token, user: { id: user.id, email: user.email, name: user.name } };
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
      const all = await this.prisma.user.findMany({ select: { id: true, email: true, password: true, name: true, createdAt: true, updatedAt: true } });
      user = all.find((u) => u.email.toLowerCase() === normalised) || null;
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { accessToken: token, user: { id: user.id, email: user.email, name: user.name } };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
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
      return { id: user.id, email: user.email, name: user.name };
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updates,
      select: { id: true, email: true, name: true },
    });

    return updated;
  }
}
