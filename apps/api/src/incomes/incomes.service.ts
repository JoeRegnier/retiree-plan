import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateIncomeDto {
  name: string;
  type: string;
  annualAmount: number;
  startAge?: number;
  endAge?: number;
  indexToInflation?: boolean;
  memberId: string;
}

export interface UpdateIncomeDto {
  name?: string;
  type?: string;
  annualAmount?: number;
  startAge?: number | null;
  endAge?: number | null;
  indexToInflation?: boolean;
}

@Injectable()
export class IncomesService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateIncomeDto) {
    return this.prisma.incomeSource.create({ data });
  }

  async findByMember(memberId: string) {
    return this.prisma.incomeSource.findMany({ where: { memberId } });
  }

  async findByHousehold(householdId: string) {
    return this.prisma.incomeSource.findMany({
      where: { member: { householdId } },
      include: { member: { select: { id: true, name: true } } },
    });
  }

  async findOne(id: string) {
    const income = await this.prisma.incomeSource.findUnique({ where: { id } });
    if (!income) throw new NotFoundException('Income source not found');
    return income;
  }

  async update(id: string, data: UpdateIncomeDto) {
    await this.findOne(id);
    return this.prisma.incomeSource.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.incomeSource.delete({ where: { id } });
  }
}
