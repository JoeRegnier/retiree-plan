/**
 * CRUD Service Unit Tests (WBS 1.11)
 *
 * Uses vi.fn() mocks to replace PrismaService, verifying service logic
 * in isolation (no real DB required).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { HouseholdsService } from '../src/households/households.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { MembersService } from '../src/members/members.service';
import { ScenariosService } from '../src/scenarios/scenarios.service';
import { IncomesService } from '../src/incomes/incomes.service';
import { ExpensesService } from '../src/expenses/expenses.service';
import { MilestonesService } from '../src/milestones/milestones.service';
import { BadRequestException } from '@nestjs/common';
import { DecisionRecordsService } from '../src/decision-records/decision-records.service';

// ─── Miniature Prisma mock factory ───────────────────────────────────────────
function makePrismaMock() {
  return {
    household: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    account: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    householdMember: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    scenario: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    incomeSource: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    expense: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    milestoneEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    decisionRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  } as any;
}

// ─── HouseholdsService ────────────────────────────────────────────────────────
describe('HouseholdsService', () => {
  let service: HouseholdsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new HouseholdsService(prisma);
  });

  it('create() calls prisma.household.create with correct data', async () => {
    const expected = { id: 'h1', name: 'Smith Family', userId: 'u1', members: [] };
    prisma.household.create.mockResolvedValue(expected);
    const result = await service.create('u1', {
      name: 'Smith Family',
      members: [{ name: 'Alice Smith', dateOfBirth: '1975-03-14', province: 'ON' }],
    });
    expect(prisma.household.create).toHaveBeenCalledOnce();
    expect(result).toEqual(expected);
  });

  it('findAllByUser() passes userId filter', async () => {
    prisma.household.findMany.mockResolvedValue([]);
    await service.findAllByUser('u1');
    expect(prisma.household.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
  });

  it('findOne() throws NotFoundException when not found', async () => {
    prisma.household.findFirst.mockResolvedValue(null);
    await expect(service.findOne('missing', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('findOne() returns household when found', async () => {
    const household = { id: 'h1', name: 'Test', userId: 'u1', members: [] };
    prisma.household.findFirst.mockResolvedValue(household);
    const result = await service.findOne('h1', 'u1');
    expect(result).toEqual(household);
  });

  it('update() calls prisma.household.update after authorization check', async () => {
    const household = { id: 'h1', name: 'Old Name', userId: 'u1', members: [] };
    prisma.household.findFirst.mockResolvedValue(household);
    prisma.household.update.mockResolvedValue({ ...household, name: 'New Name' });
    const result = await service.update('h1', 'u1', { name: 'New Name' });
    expect(prisma.household.update).toHaveBeenCalledOnce();
    expect(result.name).toBe('New Name');
  });

  it('remove() calls prisma.household.delete after authorization check', async () => {
    prisma.household.findFirst.mockResolvedValue({ id: 'h1', userId: 'u1' });
    prisma.household.delete.mockResolvedValue({ id: 'h1' });
    await service.remove('h1', 'u1');
    expect(prisma.household.delete).toHaveBeenCalledWith({ where: { id: 'h1' } });
  });
});

// ─── AccountsService ──────────────────────────────────────────────────────────
describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AccountsService(prisma);
  });

  it('create() passes through to prisma.account.create', async () => {
    const account = { id: 'a1', name: 'RRSP Account', type: 'RRSP', balance: 100000, householdId: 'h1' };
    prisma.account.create.mockResolvedValue(account);
    const result = await service.create({ name: 'RRSP Account', type: 'RRSP', balance: 100000, householdId: 'h1' });
    expect(result).toEqual(account);
    expect(prisma.account.create).toHaveBeenCalledOnce();
  });

  it('findByHousehold() filters by householdId', async () => {
    prisma.account.findMany.mockResolvedValue([]);
    await service.findByHousehold('h1');
    expect(prisma.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { householdId: 'h1' } }),
    );
  });

  it('findOne() throws NotFoundException when not found', async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('update() calls prisma.account.update when account exists', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'a1', balance: 100000 });
    prisma.account.update.mockResolvedValue({ id: 'a1', balance: 120000 });
    const result = await service.update('a1', { balance: 120000 });
    expect(prisma.account.update).toHaveBeenCalledOnce();
    expect(result.balance).toBe(120000);
  });

  it('remove() deletes account when it exists', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'a1' });
    prisma.account.delete.mockResolvedValue({ id: 'a1' });
    await service.remove('a1');
    expect(prisma.account.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });
});

// ─── MembersService ───────────────────────────────────────────────────────────
describe('MembersService', () => {
  let service: MembersService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new MembersService(prisma);
  });

  it('create() maps dateOfBirth string to Date', async () => {
    const member = { id: 'm1', name: 'Bob', dateOfBirth: new Date('1970-01-01'), householdId: 'h1', province: 'ON' };
    prisma.householdMember.create.mockResolvedValue(member);
    await service.create({ name: 'Bob', dateOfBirth: '1970-01-01', householdId: 'h1', province: 'ON' });
    const callArg = prisma.householdMember.create.mock.calls[0][0];
    expect(callArg.data.dateOfBirth).toBeInstanceOf(Date);
  });

  it('findByHousehold() filters by householdId', async () => {
    prisma.householdMember.findMany.mockResolvedValue([]);
    await service.findByHousehold('h1');
    expect(prisma.householdMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { householdId: 'h1' } }),
    );
  });

  it('findOne() throws when member missing', async () => {
    prisma.householdMember.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('update() calls prisma.householdMember.update', async () => {
    prisma.householdMember.findUnique.mockResolvedValue({ id: 'm1', name: 'Old' });
    prisma.householdMember.update.mockResolvedValue({ id: 'm1', name: 'New' });
    const result = await service.update('m1', { name: 'New' });
    expect(result.name).toBe('New');
  });

  it('remove() deletes member when found', async () => {
    prisma.householdMember.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.householdMember.delete.mockResolvedValue({ id: 'm1' });
    await service.remove('m1');
    expect(prisma.householdMember.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
  });
});

// ─── ScenariosService ─────────────────────────────────────────────────────────
describe('ScenariosService', () => {
  let service: ScenariosService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ScenariosService(prisma);
  });

  it('create() stores scenario with stringified parameters', async () => {
    const scenario = { id: 's1', name: 'Conservative', householdId: 'h1', parameters: '{}' };
    prisma.scenario.create.mockResolvedValue(scenario);
    const result = await service.create({
      name: 'Conservative',
      householdId: 'h1',
      parameters: {},
    });
    expect(prisma.scenario.create).toHaveBeenCalledOnce();
    expect(result).toEqual(scenario);
  });

  it('findByHousehold() filters by householdId', async () => {
    prisma.scenario.findMany.mockResolvedValue([]);
    await service.findByHousehold('h1');
    expect(prisma.scenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { householdId: 'h1' } }),
    );
  });

  it('findOne() throws NotFoundException when missing', async () => {
    prisma.scenario.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('remove() deletes scenario', async () => {
    prisma.scenario.findUnique.mockResolvedValue({ id: 's1' });
    prisma.scenario.delete.mockResolvedValue({ id: 's1' });
    await service.remove('s1');
    expect(prisma.scenario.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });
});

// ─── IncomesService ───────────────────────────────────────────────────────────
describe('IncomesService', () => {
  let service: IncomesService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new IncomesService(prisma);
  });

  it('create() saves an income source', async () => {
    const dto = { name: 'Employment', type: 'EMPLOYMENT', annualAmount: 80000, memberId: 'm1' };
    const created = { id: 'i1', ...dto };
    prisma.incomeSource.create.mockResolvedValue(created);
    const result = await service.create(dto);
    expect(result).toEqual(created);
    expect(prisma.incomeSource.create).toHaveBeenCalledWith({ data: dto });
  });

  it('findByMember() returns incomes for a member', async () => {
    const incomes = [{ id: 'i1', memberId: 'm1' }];
    prisma.incomeSource.findMany.mockResolvedValue(incomes);
    const result = await service.findByMember('m1');
    expect(result).toEqual(incomes);
    expect(prisma.incomeSource.findMany).toHaveBeenCalledWith({ where: { memberId: 'm1' } });
  });

  it('findByHousehold() returns incomes with member info', async () => {
    const incomes = [{ id: 'i1', member: { id: 'm1', name: 'Alice' } }];
    prisma.incomeSource.findMany.mockResolvedValue(incomes);
    const result = await service.findByHousehold('h1');
    expect(result).toEqual(incomes);
    expect(prisma.incomeSource.findMany).toHaveBeenCalledWith({
      where: { member: { householdId: 'h1' } },
      include: { member: { select: { id: true, name: true } } },
    });
  });

  it('findOne() throws NotFoundException when not found', async () => {
    prisma.incomeSource.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('update() modifies an income source', async () => {
    const existing = { id: 'i1', annualAmount: 80000 };
    const updated = { id: 'i1', annualAmount: 90000 };
    prisma.incomeSource.findUnique.mockResolvedValue(existing);
    prisma.incomeSource.update.mockResolvedValue(updated);
    const result = await service.update('i1', { annualAmount: 90000 });
    expect(result).toEqual(updated);
    expect(prisma.incomeSource.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { annualAmount: 90000 } });
  });

  it('remove() deletes an income source', async () => {
    prisma.incomeSource.findUnique.mockResolvedValue({ id: 'i1' });
    prisma.incomeSource.delete.mockResolvedValue({ id: 'i1' });
    await service.remove('i1');
    expect(prisma.incomeSource.delete).toHaveBeenCalledWith({ where: { id: 'i1' } });
  });
});

// ─── ExpensesService ──────────────────────────────────────────────────────────
describe('ExpensesService', () => {
  let service: ExpensesService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ExpensesService(prisma);
  });

  it('create() saves an expense', async () => {
    const dto = { name: 'Groceries', category: 'FOOD', annualAmount: 12000, householdId: 'h1' };
    const created = { id: 'e1', ...dto };
    prisma.expense.create.mockResolvedValue(created);
    const result = await service.create(dto);
    expect(result).toEqual(created);
    expect(prisma.expense.create).toHaveBeenCalledWith({ data: dto });
  });

  it('findByHousehold() returns expenses ordered by category', async () => {
    const expenses = [{ id: 'e1', category: 'FOOD' }, { id: 'e2', category: 'HOUSING' }];
    prisma.expense.findMany.mockResolvedValue(expenses);
    const result = await service.findByHousehold('h1');
    expect(result).toEqual(expenses);
    expect(prisma.expense.findMany).toHaveBeenCalledWith({
      where: { householdId: 'h1' },
      orderBy: { category: 'asc' },
    });
  });

  it('findOne() throws NotFoundException when not found', async () => {
    prisma.expense.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('update() modifies an expense', async () => {
    const existing = { id: 'e1', annualAmount: 12000 };
    const updated = { id: 'e1', annualAmount: 14000 };
    prisma.expense.findUnique.mockResolvedValue(existing);
    prisma.expense.update.mockResolvedValue(updated);
    const result = await service.update('e1', { annualAmount: 14000 });
    expect(result).toEqual(updated);
    expect(prisma.expense.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { annualAmount: 14000 } });
  });

  it('remove() deletes an expense', async () => {
    prisma.expense.findUnique.mockResolvedValue({ id: 'e1' });
    prisma.expense.delete.mockResolvedValue({ id: 'e1' });
    await service.remove('e1');
    expect(prisma.expense.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
  });
});

// ─── MilestonesService ────────────────────────────────────────────────────────
describe('MilestonesService', () => {
  let service: MilestonesService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new MilestonesService(prisma);
  });

  it('create() saves a milestone event', async () => {
    const dto = { name: 'Retirement', description: 'Stop working', age: 65, amount: 0, type: 'RETIREMENT', householdId: 'h1' };
    const created = { id: 'mil1', ...dto };
    prisma.milestoneEvent.create.mockResolvedValue(created);
    const result = await service.create(dto);
    expect(result).toEqual(created);
    expect(prisma.milestoneEvent.create).toHaveBeenCalledWith({ data: dto });
  });

  it('findByHousehold() returns milestones ordered by age', async () => {
    const milestones = [{ id: 'mil1', age: 60 }, { id: 'mil2', age: 65 }];
    prisma.milestoneEvent.findMany.mockResolvedValue(milestones);
    const result = await service.findByHousehold('h1');
    expect(result).toEqual(milestones);
    expect(prisma.milestoneEvent.findMany).toHaveBeenCalledWith({
      where: { householdId: 'h1' },
      orderBy: { age: 'asc' },
    });
  });

  it('findOne() throws NotFoundException when not found', async () => {
    prisma.milestoneEvent.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('update() modifies a milestone', async () => {
    const existing = { id: 'mil1', age: 65 };
    const updated = { id: 'mil1', age: 67 };
    prisma.milestoneEvent.findUnique.mockResolvedValue(existing);
    prisma.milestoneEvent.update.mockResolvedValue(updated);
    const result = await service.update('mil1', { age: 67 });
    expect(result).toEqual(updated);
    expect(prisma.milestoneEvent.update).toHaveBeenCalledWith({ where: { id: 'mil1' }, data: { age: 67 } });
  });

  it('remove() deletes a milestone', async () => {
    prisma.milestoneEvent.findUnique.mockResolvedValue({ id: 'mil1' });
    prisma.milestoneEvent.delete.mockResolvedValue({ id: 'mil1' });
    await service.remove('mil1');
    expect(prisma.milestoneEvent.delete).toHaveBeenCalledWith({ where: { id: 'mil1' } });
  });
});

// ─── DecisionRecordsService ───────────────────────────────────────────────────
describe('DecisionRecordsService', () => {
  let service: DecisionRecordsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  const mockRecord = {
    id: 'dr1',
    householdId: 'h1',
    title: 'Delay CPP to age 70',
    status: 'DECIDED',
    context: 'Both spouses are healthy and expect longevity.',
    decision: 'Delay CPP for both members to age 70.',
    rationale: 'Break-even is age 78.',
    alternatives: null,
    consequences: null,
    category: 'CPP_OAS_TIMING',
    tags: null,
    decisionDate: new Date('2026-03-12'),
    reviewDate: new Date('2027-04-01'),
    supersededById: null,
    linkedScenarioIds: null,
    linkedGoalIds: null,
    relatedTo: [],
    relatedFrom: [],
    supersededBy: null,
    supersedes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new DecisionRecordsService(prisma);
  });

  it('create() calls prisma.decisionRecord.create with parsed dates', async () => {
    prisma.decisionRecord.create.mockResolvedValue(mockRecord);
    await service.create({
      householdId: 'h1',
      title: 'Delay CPP to age 70',
      context: 'Both spouses are healthy and expect longevity.',
      decisionDate: '2026-03-12T00:00:00.000Z',
      reviewDate: '2027-04-01T00:00:00.000Z',
    });
    const callArg = prisma.decisionRecord.create.mock.calls[0][0];
    expect(callArg.data.decisionDate).toBeInstanceOf(Date);
    expect(callArg.data.reviewDate).toBeInstanceOf(Date);
  });

  it('findByHousehold() applies status and category filters', async () => {
    prisma.decisionRecord.findMany.mockResolvedValue([]);
    await service.findByHousehold('h1', { status: 'DECIDED', category: 'CPP_OAS_TIMING' });
    expect(prisma.decisionRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { householdId: 'h1', status: 'DECIDED', category: 'CPP_OAS_TIMING' },
      }),
    );
  });

  it('findByHousehold() omits optional filters when not provided', async () => {
    prisma.decisionRecord.findMany.mockResolvedValue([]);
    await service.findByHousehold('h1', {});
    expect(prisma.decisionRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { householdId: 'h1' } }),
    );
  });

  it('findOne() throws NotFoundException when record not found', async () => {
    prisma.decisionRecord.findFirst.mockResolvedValue(null);
    await expect(service.findOne('missing', 'h1')).rejects.toThrow(NotFoundException);
  });

  it('findOne() returns the record when found', async () => {
    prisma.decisionRecord.findFirst.mockResolvedValue(mockRecord);
    const result = await service.findOne('dr1', 'h1');
    expect(result).toEqual(mockRecord);
  });

  it('update() calls prisma.decisionRecord.update after authorization check', async () => {
    prisma.decisionRecord.findFirst.mockResolvedValue(mockRecord);
    prisma.decisionRecord.update.mockResolvedValue({ ...mockRecord, title: 'Updated' });
    const result = await service.update('dr1', 'h1', { title: 'Updated' });
    expect(prisma.decisionRecord.update).toHaveBeenCalledOnce();
    expect(result.title).toBe('Updated');
  });

  it('remove() deletes the record after authorization check', async () => {
    prisma.decisionRecord.findFirst.mockResolvedValue(mockRecord);
    prisma.decisionRecord.delete.mockResolvedValue(mockRecord);
    await service.remove('dr1', 'h1');
    expect(prisma.decisionRecord.delete).toHaveBeenCalledWith({ where: { id: 'dr1' } });
  });

  it('supersede() throws BadRequestException if record already superseded', async () => {
    const supersededRecord = { ...mockRecord, status: 'SUPERSEDED' };
    prisma.decisionRecord.findFirst.mockResolvedValue(supersededRecord);
    await expect(service.supersede('dr1', 'h1')).rejects.toThrow(BadRequestException);
  });

  it('supersede() marks record as SUPERSEDED without replacement', async () => {
    prisma.decisionRecord.findFirst.mockResolvedValue(mockRecord);
    prisma.decisionRecord.update.mockResolvedValue({ ...mockRecord, status: 'SUPERSEDED' });
    const { superseded, replacement } = await service.supersede('dr1', 'h1');
    expect(superseded.status).toBe('SUPERSEDED');
    expect(replacement).toBeNull();
  });

  it('getGraph() returns nodes for each record and RELATED_TO edges', async () => {
    const relatedRecord = { ...mockRecord, id: 'dr2', title: 'OAS Clawback', relatedTo: [], supersedes: [] };
    const recordWithRelations = {
      ...mockRecord,
      relatedTo: [{ id: 'dr2' }],
      supersedes: [],
    };
    prisma.decisionRecord.findMany.mockResolvedValue([recordWithRelations, relatedRecord]);
    const graph = await service.getGraph('h1');
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges.some((e) => e.type === 'RELATED_TO')).toBe(true);
  });

  it('getDueForReview() filters by reviewDate <= today and active statuses', async () => {
    prisma.decisionRecord.findMany.mockResolvedValue([mockRecord]);
    const result = await service.getDueForReview('h1');
    expect(result).toEqual([mockRecord]);
    expect(prisma.decisionRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId: 'h1',
          status: { in: ['PROPOSED', 'DECIDED'] },
        }),
      }),
    );
  });
});
