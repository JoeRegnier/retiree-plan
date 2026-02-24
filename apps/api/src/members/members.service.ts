import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateMemberDto {
  name: string;
  dateOfBirth: string;
  province: string;
  householdId: string;
}

export interface UpdateMemberDto {
  name?: string;
  dateOfBirth?: string;
  province?: string;
}

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateMemberDto) {
    return this.prisma.householdMember.create({
      data: {
        name: data.name,
        dateOfBirth: new Date(data.dateOfBirth),
        province: data.province,
        householdId: data.householdId,
      },
      include: { incomeSources: true },
    });
  }

  async findByHousehold(householdId: string) {
    return this.prisma.householdMember.findMany({
      where: { householdId },
      include: { incomeSources: true },
    });
  }

  async findOne(id: string) {
    const member = await this.prisma.householdMember.findUnique({
      where: { id },
      include: { incomeSources: true },
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  async update(id: string, data: UpdateMemberDto) {
    await this.findOne(id);
    return this.prisma.householdMember.update({
      where: { id },
      data: {
        ...data,
        ...(data.dateOfBirth ? { dateOfBirth: new Date(data.dateOfBirth) } : {}),
      },
      include: { incomeSources: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.householdMember.delete({ where: { id } });
  }
}
