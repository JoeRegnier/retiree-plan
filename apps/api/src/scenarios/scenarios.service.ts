import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScenariosService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; description?: string; householdId: string; parameters: Record<string, unknown> }) {
    return this.prisma.scenario.create({
      data: {
        name: data.name,
        description: data.description,
        householdId: data.householdId,
        parameters: JSON.stringify(data.parameters),
      },
    });
  }

  async findByHousehold(householdId: string) {
    return this.prisma.scenario.findMany({ where: { householdId } });
  }

  async findOne(id: string) {
    const scenario = await this.prisma.scenario.findUnique({ where: { id } });
    if (!scenario) throw new NotFoundException('Scenario not found');
    return scenario;
  }

  async update(id: string, data: { name?: string; description?: string; parameters?: Record<string, unknown> }) {
    await this.findOne(id);
    const updateData: { name?: string; description?: string; parameters?: string } = {
      name: data.name,
      description: data.description,
    };
    if (data.parameters !== undefined) {
      updateData.parameters = JSON.stringify(data.parameters);
    }
    return this.prisma.scenario.update({ where: { id }, data: updateData });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.scenario.delete({ where: { id } });
  }
}
