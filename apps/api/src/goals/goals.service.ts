import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateGoalDto {
  name: string;
  description?: string | null;
  targetAmount: number;
  targetAge?: number | null;
  priority?: string;
  category?: string;
  householdId: string;
}

export interface UpdateGoalDto {
  name?: string;
  description?: string | null;
  targetAmount?: number;
  targetAge?: number | null;
  priority?: string;
  category?: string;
}

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGoalDto) {
    return this.prisma.goal.create({ data: dto });
  }

  async findByHousehold(householdId: string) {
    return this.prisma.goal.findMany({
      where: { householdId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, householdId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, householdId },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    return goal;
  }

  async update(id: string, householdId: string, dto: UpdateGoalDto) {
    await this.findOne(id, householdId);
    return this.prisma.goal.update({ where: { id }, data: dto });
  }

  async remove(id: string, householdId: string) {
    await this.findOne(id, householdId);
    return this.prisma.goal.delete({ where: { id } });
  }
}
