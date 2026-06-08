import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HouseholdsService {
  constructor(private prisma: PrismaService) {}

  private readonly accountInclude = {
    taxAttributionHistory: {
      orderBy: { effectiveYear: 'asc' as const },
    },
  } as const;

  async create(userId: string, data: { name: string; members: { name: string; dateOfBirth: string; province: string }[] }) {
    return this.prisma.household.create({
      data: {
        name: data.name,
        userId,
        members: {
          create: data.members.map((m) => ({
            name: m.name,
            dateOfBirth: new Date(m.dateOfBirth),
            province: m.province,
          })),
        },
      },
      include: { members: true },
    });
  }

  private readonly memberInclude = { incomeSources: true } as const;

  async findAllByUser(userId: string) {
    return this.prisma.household.findMany({
      where: { userId },
      include: {
        members: { include: this.memberInclude },
        accounts: { include: this.accountInclude },
        scenarios: true,
      },
    });
  }

  async findOne(id: string, userId: string) {
    const household = await this.prisma.household.findFirst({
      where: { id, userId },
      include: {
        members: { include: this.memberInclude },
        accounts: { include: this.accountInclude },
        scenarios: true,
      },
    });
    if (!household) throw new NotFoundException('Household not found');
    return household;
  }

  async update(id: string, userId: string, data: { name?: string }) {
    await this.findOne(id, userId); // ensure exists & owned
    return this.prisma.household.update({
      where: { id },
      data,
      include: { members: { include: this.memberInclude } },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.household.delete({ where: { id } });
  }

  async importHousehold(userId: string, exportedData: any[]) {
    const imported: any[] = [];
    for (const hh of exportedData) {
      const created = await this.prisma.household.create({
        data: {
          name: `${hh.name} (imported)`,
          userId,
          members: {
            create: (hh.members ?? []).map((m: any) => ({
              name: m.name,
              dateOfBirth: new Date(m.dateOfBirth),
              province: m.province ?? 'ON',
            })),
          },
          accounts: {
            create: (hh.accounts ?? []).map((a: any) => ({
              name: a.name,
              type: a.type,
              balance: a.balance,
              annualContribution: a.annualContribution ?? 0,
            })),
          },
          scenarios: {
            create: (hh.scenarios ?? []).map((s: any) => ({
              name: s.name,
              description: s.description,
              parameters: typeof s.parameters === 'string' ? s.parameters : JSON.stringify(s.parameters),
            })),
          },
        },
        include: { members: true, accounts: true, scenarios: true },
      });
      imported.push(created);
    }
    return imported;
  }
}
