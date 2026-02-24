import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateExpenseDto {
  name: string;
  category: string;
  annualAmount: number;
  startAge?: number;
  endAge?: number;
  indexToInflation?: boolean;
  householdId: string;
}

export interface UpdateExpenseDto {
  name?: string;
  category?: string;
  annualAmount?: number;
  startAge?: number | null;
  endAge?: number | null;
  indexToInflation?: boolean;
}

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateExpenseDto) {
    return this.prisma.expense.create({ data });
  }

  async findByHousehold(householdId: string) {
    return this.prisma.expense.findMany({ where: { householdId }, orderBy: { category: 'asc' } });
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async update(id: string, data: UpdateExpenseDto) {
    await this.findOne(id);
    return this.prisma.expense.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.expense.delete({ where: { id } });
  }
}
