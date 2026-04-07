import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateDecisionRecordDto {
  householdId: string;
  title: string;
  status?: string;
  context: string;
  decision?: string | null;
  rationale?: string | null;
  alternatives?: string | null; // JSON string
  consequences?: string | null;
  category?: string;
  tags?: string | null; // JSON string
  decisionDate?: string | null;
  reviewDate?: string | null;
  supersededById?: string | null;
  linkedScenarioIds?: string | null; // JSON string
  linkedGoalIds?: string | null; // JSON string
  relatedDecisionIds?: string[];
}

export interface UpdateDecisionRecordDto
  extends Partial<Omit<CreateDecisionRecordDto, 'householdId'>> {}

export interface DecisionGraphResponse {
  nodes: DecisionNode[];
  edges: DecisionEdge[];
}

interface DecisionNode {
  id: string;
  title: string;
  status: string;
  category: string;
  decisionDate: string | null;
}

interface DecisionEdge {
  source: string;
  target: string;
  type: 'SUPERSEDES' | 'RELATED_TO';
}

@Injectable()
export class DecisionRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDecisionRecordDto) {
    const { relatedDecisionIds, ...rest } = dto;
    const record = await this.prisma.decisionRecord.create({
      data: {
        ...rest,
        decisionDate: rest.decisionDate ? new Date(rest.decisionDate) : null,
        reviewDate: rest.reviewDate ? new Date(rest.reviewDate) : null,
        ...(relatedDecisionIds?.length
          ? {
              relatedTo: {
                connect: relatedDecisionIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      include: { relatedTo: true, relatedFrom: true, supersededBy: true },
    });
    return record;
  }

  async findByHousehold(
    householdId: string,
    filters: { status?: string; category?: string },
  ) {
    return this.prisma.decisionRecord.findMany({
      where: {
        householdId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.category ? { category: filters.category } : {}),
      },
      include: { relatedTo: true, supersededBy: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, householdId: string) {
    const record = await this.prisma.decisionRecord.findFirst({
      where: { id, householdId },
      include: {
        relatedTo: true,
        relatedFrom: true,
        supersededBy: true,
        supersedes: true,
      },
    });
    if (!record) throw new NotFoundException('Decision record not found');
    return record;
  }

  async update(id: string, householdId: string, dto: UpdateDecisionRecordDto) {
    await this.findOne(id, householdId);
    const { relatedDecisionIds, ...rest } = dto;
    return this.prisma.decisionRecord.update({
      where: { id },
      data: {
        ...rest,
        decisionDate:
          rest.decisionDate !== undefined
            ? rest.decisionDate
              ? new Date(rest.decisionDate)
              : null
            : undefined,
        reviewDate:
          rest.reviewDate !== undefined
            ? rest.reviewDate
              ? new Date(rest.reviewDate)
              : null
            : undefined,
        ...(relatedDecisionIds !== undefined
          ? {
              relatedTo: {
                set: relatedDecisionIds.map((rid) => ({ id: rid })),
              },
            }
          : {}),
      },
      include: { relatedTo: true, relatedFrom: true, supersededBy: true },
    });
  }

  async remove(id: string, householdId: string) {
    await this.findOne(id, householdId);
    return this.prisma.decisionRecord.delete({ where: { id } });
  }

  /**
   * Mark an existing record as SUPERSEDED and optionally create a new record
   * that takes its place. Returns { superseded, replacement }.
   */
  async supersede(
    id: string,
    householdId: string,
    replacementDto?: CreateDecisionRecordDto,
  ) {
    const existing = await this.findOne(id, householdId);
    if (existing.status === 'SUPERSEDED') {
      throw new BadRequestException('Record is already superseded');
    }

    let replacement = null;
    if (replacementDto) {
      replacement = await this.create({
        ...replacementDto,
        householdId,
      });
    }

    const superseded = await this.prisma.decisionRecord.update({
      where: { id },
      data: {
        status: 'SUPERSEDED',
        ...(replacement ? { supersededById: replacement.id } : {}),
      },
    });

    return { superseded, replacement };
  }

  /** Returns adjacency lists for the mind-map visualisation. */
  async getGraph(householdId: string): Promise<DecisionGraphResponse> {
    const records = await this.prisma.decisionRecord.findMany({
      where: { householdId },
      include: { relatedTo: true, supersedes: true },
    });

    const nodes: DecisionNode[] = records.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      category: r.category,
      decisionDate: r.decisionDate ? r.decisionDate.toISOString() : null,
    }));

    const edges: DecisionEdge[] = [];
    const seenEdges = new Set<string>();

    for (const r of records) {
      // SUPERSEDES edges (directional)
      for (const child of r.supersedes) {
        const key = `${r.id}>${child.id}`;
        if (!seenEdges.has(key)) {
          seenEdges.add(key);
          edges.push({ source: r.id, target: child.id, type: 'SUPERSEDES' });
        }
      }
      // RELATED_TO edges (de-duplicated)
      for (const rel of r.relatedTo) {
        const key = [r.id, rel.id].sort().join('-');
        if (!seenEdges.has(key)) {
          seenEdges.add(key);
          edges.push({ source: r.id, target: rel.id, type: 'RELATED_TO' });
        }
      }
    }

    return { nodes, edges };
  }

  /** All records with a reviewDate on or before today. */
  async getDueForReview(householdId: string) {
    return this.prisma.decisionRecord.findMany({
      where: {
        householdId,
        reviewDate: { lte: new Date() },
        status: { in: ['PROPOSED', 'DECIDED'] },
      },
      orderBy: { reviewDate: 'asc' },
    });
  }
}
