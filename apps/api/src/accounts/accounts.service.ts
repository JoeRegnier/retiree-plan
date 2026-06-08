import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  private normalizeHistoryEntries(
    entries: Array<{
      effectiveYear: number;
      mode?: string;
      primaryMemberId?: string | null;
      secondaryMemberId?: string | null;
      primaryPercentage?: number | null;
      secondaryPercentage?: number | null;
    }> | undefined,
  ) {
    const currentYear = new Date().getFullYear();
    const source = entries && entries.length
      ? entries
      : [{ effectiveYear: currentYear, mode: 'JOINT_UNSPECIFIED' }];

    const dedup = new Map<number, {
      effectiveYear: number;
      mode: string;
      primaryMemberId: string | null;
      secondaryMemberId: string | null;
      primaryPercentage: number | null;
      secondaryPercentage: number | null;
    }>();

    for (const entry of source) {
      const year = Number(entry.effectiveYear);
      if (!Number.isFinite(year)) continue;
      dedup.set(year, {
        effectiveYear: year,
        mode: entry.mode ?? 'JOINT_UNSPECIFIED',
        primaryMemberId: entry.primaryMemberId ?? null,
        secondaryMemberId: entry.secondaryMemberId ?? null,
        primaryPercentage: entry.primaryPercentage ?? null,
        secondaryPercentage: entry.secondaryPercentage ?? null,
      });
    }

    return [...dedup.values()].sort((a, b) => a.effectiveYear - b.effectiveYear);
  }

  async create(data: {
    name: string;
    type: string;
    balance: number;
    annualContribution?: number;
    estimatedReturnRate?: number | null;
    equityPercent?: number | null;
    fixedIncomePercent?: number | null;
    alternativesPercent?: number | null;
    cashPercent?: number | null;
    currency?: string;
    householdId: string;
    ynabAccountId?: string;
    ynabAccountName?: string;
    brokerageAccountId?: string | null;
    brokerageProvider?: string | null;
    brokerageAccountName?: string | null;
    taxAttributionHistory?: Array<{
      effectiveYear: number;
      mode?: string;
      primaryMemberId?: string | null;
      secondaryMemberId?: string | null;
      primaryPercentage?: number | null;
      secondaryPercentage?: number | null;
    }>;
  }) {
    const normalizedHistory = this.normalizeHistoryEntries(data.taxAttributionHistory);
    return this.prisma.account.create({
      data: {
        name: data.name,
        type: data.type as any,
        balance: data.balance,
        annualContribution: data.annualContribution ?? 0,
        estimatedReturnRate: data.estimatedReturnRate ?? null,
        equityPercent: data.equityPercent ?? null,
        fixedIncomePercent: data.fixedIncomePercent ?? null,
        alternativesPercent: data.alternativesPercent ?? null,
        cashPercent: data.cashPercent ?? null,
        currency: data.currency ?? 'CAD',
        householdId: data.householdId,
        ynabAccountId: data.ynabAccountId ?? null,
        ynabAccountName: data.ynabAccountName ?? null,
        brokerageAccountId:   data.brokerageAccountId ?? null,
        brokerageProvider:    data.brokerageProvider ?? null,
        brokerageAccountName: data.brokerageAccountName ?? null,
        taxAttributionHistory: {
          create: normalizedHistory,
        },
      },
      include: {
        taxAttributionHistory: {
          orderBy: { effectiveYear: 'asc' },
        },
      },
    });
  }

  async findByHousehold(householdId: string) {
    return this.prisma.account.findMany({
      where: { householdId },
      include: {
        taxAttributionHistory: {
          orderBy: { effectiveYear: 'asc' },
        },
      },
    });
  }

  async findOne(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        taxAttributionHistory: {
          orderBy: { effectiveYear: 'asc' },
        },
      },
    });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async update(id: string, data: {
    name?: string;
    type?: string;
    balance?: number;
    annualContribution?: number;
    estimatedReturnRate?: number | null;
    equityPercent?: number | null;
    fixedIncomePercent?: number | null;
    alternativesPercent?: number | null;
    cashPercent?: number | null;
    ynabAccountId?: string | null;
    ynabAccountName?: string | null;
    brokerageAccountId?: string | null;
    brokerageProvider?: string | null;
    brokerageAccountName?: string | null;
    taxAttributionHistory?: Array<{
      effectiveYear: number;
      mode?: string;
      primaryMemberId?: string | null;
      secondaryMemberId?: string | null;
      primaryPercentage?: number | null;
      secondaryPercentage?: number | null;
    }>;
  }) {
    await this.findOne(id);
    const { taxAttributionHistory, ...rest } = data;
    const updateData: any = { ...rest };
    if (taxAttributionHistory) {
      updateData.taxAttributionHistory = {
        deleteMany: {},
        create: this.normalizeHistoryEntries(taxAttributionHistory),
      };
    }
    return this.prisma.account.update({
      where: { id },
      data: updateData,
      include: {
        taxAttributionHistory: {
          orderBy: { effectiveYear: 'asc' },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.account.delete({ where: { id } });
  }
}
