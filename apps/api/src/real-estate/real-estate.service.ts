import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateRealEstateDto {
  name: string;
  propertyType: string;
  currentValue: number;
  purchasePrice?: number;
  annualAppreciation?: number;
  grossRentalIncome?: number | null;
  rentalExpenses?: number | null;
  sellAtAge?: number | null;
  netProceedsPercent?: number;
  householdId: string;
}

export interface UpdateRealEstateDto {
  name?: string;
  propertyType?: string;
  currentValue?: number;
  purchasePrice?: number;
  annualAppreciation?: number;
  grossRentalIncome?: number | null;
  rentalExpenses?: number | null;
  sellAtAge?: number | null;
  netProceedsPercent?: number;
}

@Injectable()
export class RealEstateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRealEstateDto) {
    return this.prisma.realEstate.create({ data: dto });
  }

  async findByHousehold(householdId: string) {
    return this.prisma.realEstate.findMany({
      where: { householdId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, householdId: string) {
    const property = await this.prisma.realEstate.findFirst({
      where: { id, householdId },
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async update(id: string, householdId: string, dto: UpdateRealEstateDto) {
    await this.findOne(id, householdId);
    return this.prisma.realEstate.update({ where: { id }, data: dto });
  }

  async remove(id: string, householdId: string) {
    await this.findOne(id, householdId);
    return this.prisma.realEstate.delete({ where: { id } });
  }
}
