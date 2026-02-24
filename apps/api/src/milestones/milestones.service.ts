import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateMilestoneDto {
  name: string;
  description?: string;
  age: number;
  amount: number;
  type: string;
  householdId: string;
}

export interface UpdateMilestoneDto {
  name?: string;
  description?: string;
  age?: number;
  amount?: number;
  type?: string;
}

@Injectable()
export class MilestonesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMilestoneDto) {
    return this.prisma.milestoneEvent.create({ data: dto });
  }

  async findByHousehold(householdId: string) {
    return this.prisma.milestoneEvent.findMany({
      where: { householdId },
      orderBy: { age: 'asc' },
    });
  }

  async findOne(id: string) {
    const m = await this.prisma.milestoneEvent.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Milestone not found');
    return m;
  }

  async update(id: string, dto: UpdateMilestoneDto) {
    await this.findOne(id);
    return this.prisma.milestoneEvent.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.milestoneEvent.delete({ where: { id } });
  }
}
