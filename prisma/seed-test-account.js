/**
 * Regression Test Account Seed
 * ─────────────────────────────
 * Creates a deterministic, fully-populated test account that exercises every
 * feature of RetireePlan.  Run with:
 *
 *   npm run db:seed-test
 *
 * Credentials (used by all e2e regression specs):
 *   Email:    test@retireeplan.dev
 *   Password: TestPassword123!
 *
 * Safe to re-run — existing test account is dropped and recreated cleanly.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const TEST_EMAIL    = 'test@retireeplan.dev';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME     = 'David Smith';

// Deterministic IDs so e2e tests can reference by ID if needed
const IDS = {
  user:      'seed-user-001',
  household: 'seed-hh-001',
  memberA:   'seed-mbr-001',   // David Smith (primary, age 58)
  memberB:   'seed-mbr-002',   // Sarah Smith  (spouse, age 55)
  // income sources
  incDavidJob:  'seed-inc-001',
  incDavidCpp:  'seed-inc-002',
  incDavidOas:  'seed-inc-003',
  incSarahJob:  'seed-inc-004',
  incSarahCpp:  'seed-inc-005',
  incSarahOas:  'seed-inc-006',
  // accounts
  accRrspD:  'seed-acc-001',
  accTfsaD:  'seed-acc-002',
  accNrD:    'seed-acc-003',
  accRrspS:  'seed-acc-004',
  accTfsaS:  'seed-acc-005',
  // expenses
  expHousing:    'seed-exp-001',
  expFood:       'seed-exp-002',
  expTransport:  'seed-exp-003',
  expHealthcare: 'seed-exp-004',
  expLeisure:    'seed-exp-005',
  expTravel:     'seed-exp-006',
  // scenarios
  scenBase:       'seed-scn-001',
  scenEarly:      'seed-scn-002',
  scenConservative: 'seed-scn-003',
  // milestones
  milRetireD:  'seed-mil-001',
  milRetireS:  'seed-mil-002',
  milRrspConv: 'seed-mil-003',
  milMortgage: 'seed-mil-004',
  milInherit:  'seed-mil-005',
};

async function main() {
  console.log('Seeding regression test account…');

  // ── 1. Clean previous test account ─────────────────────────────────────────
  await prisma.aiMessage.deleteMany({ where: { userId: IDS.user } });
  await prisma.ynabConnection.deleteMany({ where: { userId: IDS.user } });
  await prisma.user.deleteMany({ where: { id: IDS.user } });
  // Cascade handles household / members / accounts / etc.

  // ── 2. Create user ──────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
  await prisma.user.create({
    data: {
      id:       IDS.user,
      email:    TEST_EMAIL,
      password: hashedPassword,
      name:     TEST_NAME,
    },
  });
  console.log(`Created user ${TEST_EMAIL}`);

  // ── 3. Household ────────────────────────────────────────────────────────────
  await prisma.household.create({
    data: {
      id:     IDS.household,
      name:   'Smith Family',
      userId: IDS.user,
    },
  });

  // ── 4. Members ──────────────────────────────────────────────────────────────
  // David Smith — born 1967-06-15 → age 58
  await prisma.householdMember.create({
    data: {
      id:          IDS.memberA,
      name:        'David Smith',
      dateOfBirth: new Date('1967-06-15'),
      province:    'ON',
      householdId: IDS.household,
    },
  });

  // Sarah Smith — born 1970-09-20 → age 55
  await prisma.householdMember.create({
    data: {
      id:          IDS.memberB,
      name:        'Sarah Smith',
      dateOfBirth: new Date('1970-09-20'),
      province:    'ON',
      householdId: IDS.household,
    },
  });

  // ── 5. Income Sources ───────────────────────────────────────────────────────
  const incomes = [
    // David — employment (ends at 65)
    { id: IDS.incDavidJob,  memberId: IDS.memberA, name: 'Employment Income',    type: 'Employment',    annualAmount: 120_000, startAge: null, endAge: 65,   indexToInflation: true  },
    // David — CPP (starts at 65)
    { id: IDS.incDavidCpp,  memberId: IDS.memberA, name: 'CPP Pension',          type: 'Government',    annualAmount: 14_500,  startAge: 65,  endAge: null, indexToInflation: true  },
    // David — OAS (starts at 65)
    { id: IDS.incDavidOas,  memberId: IDS.memberA, name: 'OAS Benefit',          type: 'Government',    annualAmount: 8_700,   startAge: 65,  endAge: null, indexToInflation: true  },
    // Sarah — part-time employment
    { id: IDS.incSarahJob,  memberId: IDS.memberB, name: 'Part-Time Employment', type: 'Employment',    annualAmount: 48_000,  startAge: null, endAge: 62,  indexToInflation: true  },
    // Sarah — CPP
    { id: IDS.incSarahCpp,  memberId: IDS.memberB, name: 'CPP Pension',          type: 'Government',    annualAmount: 9_800,   startAge: 65,  endAge: null, indexToInflation: true  },
    // Sarah — OAS
    { id: IDS.incSarahOas,  memberId: IDS.memberB, name: 'OAS Benefit',          type: 'Government',    annualAmount: 8_700,   startAge: 65,  endAge: null, indexToInflation: true  },
  ];
  for (const inc of incomes) {
    await prisma.incomeSource.create({ data: inc });
  }

  // ── 6. Accounts ─────────────────────────────────────────────────────────────
  const accounts = [
    { id: IDS.accRrspD, name: "David's RRSP",         type: 'RRSP',    balance: 425_000, annualContribution: 18_000, householdId: IDS.household },
    { id: IDS.accTfsaD, name: "David's TFSA",         type: 'TFSA',    balance: 98_500,  annualContribution: 7_000,  householdId: IDS.household },
    { id: IDS.accNrD,   name: "Joint Non-Registered", type: 'NON_REG', balance: 215_000, annualContribution: 12_000, householdId: IDS.household },
    { id: IDS.accRrspS, name: "Sarah's RRSP",         type: 'RRSP',    balance: 185_000, annualContribution: 10_000, householdId: IDS.household },
    { id: IDS.accTfsaS, name: "Sarah's TFSA",         type: 'TFSA',    balance: 76_000,  annualContribution: 7_000,  householdId: IDS.household },
  ];
  for (const acc of accounts) {
    await prisma.account.create({ data: acc });
  }

  // ── 7. Expenses ─────────────────────────────────────────────────────────────
  const expenses = [
    { id: IDS.expHousing,    name: 'Housing & Property Tax',  category: 'Housing',     annualAmount: 28_000, householdId: IDS.household, indexToInflation: true  },
    { id: IDS.expFood,       name: 'Groceries & Dining',      category: 'Food',        annualAmount: 14_400, householdId: IDS.household, indexToInflation: true  },
    { id: IDS.expTransport,  name: 'Transportation',          category: 'Transport',   annualAmount: 9_600,  householdId: IDS.household, indexToInflation: true  },
    { id: IDS.expHealthcare, name: 'Healthcare & Dental',     category: 'Healthcare',  annualAmount: 4_800,  householdId: IDS.household, indexToInflation: true  },
    { id: IDS.expLeisure,    name: 'Hobbies & Entertainment', category: 'Leisure',     annualAmount: 6_000,  householdId: IDS.household, indexToInflation: true  },
    { id: IDS.expTravel,     name: 'Annual Travel',           category: 'Travel',      annualAmount: 10_000, householdId: IDS.household, indexToInflation: true  },
  ];
  for (const exp of expenses) {
    await prisma.expense.create({ data: exp });
  }

  // ── 8. Scenarios ────────────────────────────────────────────────────────────
  const baseParams = {
    retirementAge: 65,
    lifeExpectancy: 92,
    expectedReturn: 0.06,
    inflationRate: 0.025,
    volatility: 0.12,
    equityFraction: 0.6,
    annualExpenses: 72_800,
    province: 'ON',
    annualSavings: 54_000,
    equityAllocation: 60,
  };

  const scenarios = [
    {
      id:          IDS.scenBase,
      name:        'Base Case',
      description: 'Retire at 65 with moderate 60/40 portfolio',
      householdId: IDS.household,
      parameters:  JSON.stringify(baseParams),
    },
    {
      id:          IDS.scenEarly,
      name:        'Early Retirement',
      description: 'Retire at 60 with reduced spending',
      householdId: IDS.household,
      parameters:  JSON.stringify({ ...baseParams, retirementAge: 60, annualExpenses: 65_000, equityFraction: 0.7, expectedReturn: 0.065 }),
    },
    {
      id:          IDS.scenConservative,
      name:        'Conservative',
      description: 'Late retirement at 68, bonds-heavy, low return assumption',
      householdId: IDS.household,
      parameters:  JSON.stringify({ ...baseParams, retirementAge: 68, expectedReturn: 0.045, volatility: 0.08, equityFraction: 0.40, annualExpenses: 68_000 }),
    },
  ];
  for (const scn of scenarios) {
    await prisma.scenario.create({ data: scn });
  }

  // ── 9. Milestone Events ─────────────────────────────────────────────────────
  const milestones = [
    { id: IDS.milRetireD,  name: 'David Retires',           description: 'End of full-time employment',        age: 65, amount: 0,         type: 'lump_sum_out', householdId: IDS.household },
    { id: IDS.milRetireS,  name: 'Sarah Retires',           description: 'End of part-time employment',        age: 62, amount: 0,         type: 'lump_sum_out', householdId: IDS.household },
    { id: IDS.milRrspConv, name: 'RRSP to RRIF Conversion', description: 'Mandatory RRIF conversion at 71',    age: 71, amount: 0,         type: 'lump_sum_in',  householdId: IDS.household },
    { id: IDS.milMortgage, name: 'Mortgage Paid Off',       description: 'Final mortgage payment',             age: 63, amount: 14_400,    type: 'income',       householdId: IDS.household },
    { id: IDS.milInherit,  name: 'Inheritance Received',    description: 'Expected inheritance from estate',   age: 70, amount: 150_000,   type: 'lump_sum_in',  householdId: IDS.household },
  ];
  for (const m of milestones) {
    await prisma.milestoneEvent.create({ data: m });
  }

  console.log('Test account seeded successfully.');
  console.log('');
  console.log('  Email:    test@retireeplan.dev');
  console.log('  Password: TestPassword123!');
  console.log('');
  console.log('  Household:  Smith Family');
  console.log('  Members:    David Smith (58), Sarah Smith (55)');
  console.log(`  Accounts:   ${accounts.length} accounts, $${(accounts.reduce((s, a) => s + a.balance, 0)).toLocaleString()} total`);
  console.log(`  Expenses:   ${expenses.length} categories, $${(expenses.reduce((s, e) => s + e.annualAmount, 0)).toLocaleString()}/yr`);
  console.log(`  Scenarios:  ${scenarios.length} (Base Case, Early Retirement, Conservative)`);
  console.log(`  Milestones: ${milestones.length} events`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
