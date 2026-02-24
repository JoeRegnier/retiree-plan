import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; type: string; balance: number; annualContribution?: number; currency?: string; householdId: string; ynabAccountId?: string; ynabAccountName?: string }) {
    return this.prisma.account.create({
      data: {
        name: data.name,
        type: data.type as any,
        balance: data.balance,
        annualContribution: data.annualContribution ?? 0,
        currency: data.currency ?? 'CAD',
        householdId: data.householdId,
        ynabAccountId: data.ynabAccountId ?? null,
        ynabAccountName: data.ynabAccountName ?? null,
      },
    });
  }

  async findByHousehold(householdId: string) {
    return this.prisma.account.findMany({ where: { householdId } });
  }

  async findOne(id: string) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async update(id: string, data: { name?: string; type?: string; balance?: number; annualContribution?: number; ynabAccountId?: string | null; ynabAccountName?: string | null }) {
    await this.findOne(id);
    return this.prisma.account.update({ where: { id }, data: data as any });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.account.delete({ where: { id } });
  }
}
