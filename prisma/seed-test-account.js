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
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const bcrypt = require('bcrypt');

const _dbUrl = process.env.DATABASE_URL;
if (!_dbUrl) throw new Error('DATABASE_URL environment variable is required');
const _adapter = new PrismaLibSql({ url: _dbUrl });
const prisma = new PrismaClient({ adapter: _adapter });

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
  // decisions
  decCppDefer:        'seed-dec-001',
  decRrspMeltdown:    'seed-dec-002',
  decWithdrawalOrder: 'seed-dec-003',
  decAssetAlloc:      'seed-dec-004',
  decSarahCpp:        'seed-dec-005',
  decDownsize:        'seed-dec-006',
  decEstate:          'seed-dec-007',
  decInsurance:       'seed-dec-008',
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

  // ── 10. Decision Records ────────────────────────────────────────────────────
  // Create all records first (without cross-references), then wire up relatedTo.
  const decisions = [
    {
      id:           IDS.decCppDefer,
      householdId:  IDS.household,
      title:        'Defer CPP to Age 70',
      status:       'DECIDED',
      category:     'CPP_OAS_TIMING',
      context:      'David is 58 and approaching the CPP eligibility window. CPP can be started as early as 60 (reduced) or deferred past 65 to increase the benefit by 8.4% per year. With a projected portfolio of ~$1M and both spouses still earning income, there is no cash-flow pressure to claim early.',
      decision:     'Defer David\'s CPP to age 70 to maximize the lifetime monthly benefit.',
      rationale:    'The CPP break-even vs age 65 is approximately age 81. Based on family health history and the longevity assumptions in our base-case scenario (age 92), deferring is strongly favoured. With RRSP, TFSA, and non-registered assets available for bridge income, deferring CPP is feasible without lifestyle compromise.',
      alternatives: JSON.stringify([
        { title: 'Start CPP at 60',   description: 'Receive a reduced benefit (36% less than age 65 amount) immediately.', whyRejected: 'Lowers lifetime income substantially; break-even vs age 65 is only age 72.' },
        { title: 'Start CPP at 65',  description: 'Standard start age with no adjustment.', whyRejected: 'Leaves the 42% enhancement from deferring to 70 on the table.' },
      ]),
      consequences: 'Will need bridge income from RRSP withdrawals or non-registered accounts between ages 65–70. CPP income at 70 will be approximately $20,000/yr (indexed), reducing portfolio draw-down rate significantly.',
      tags:         JSON.stringify(['cpp', 'government-benefits', 'longevity', 'bridge-income']),
      decisionDate: new Date('2025-11-15'),
      reviewDate:   new Date('2027-04-01'),
      linkedScenarioIds: JSON.stringify([IDS.scenBase, IDS.scenConservative]),
    },
    {
      id:           IDS.decRrspMeltdown,
      householdId:  IDS.household,
      title:        'RRSP Meltdown Strategy (Ages 65–71)',
      status:       'DECIDED',
      category:     'TAX_PLANNING',
      context:      'David\'s RRSP balance is $425K and growing. At age 71 the RRSP must be converted to a RRIF with mandatory minimum withdrawals that will likely push income into higher tax brackets. By deliberately drawing down the RRSP between ages 65 and 71 — while employment income has stopped — we can fill lower tax brackets and reduce the future RRIF impact.',
      decision:     'Execute a structured RRSP meltdown by withdrawing $40,000–$50,000 per year from age 65 to 71, staying within the second federal bracket.',
      rationale:    'Ontario tax modelling shows marginal rates jump significantly once RRIF minimum withdrawals kick in alongside CPP and OAS at 70. Melting the RRSP early reduces OAS clawback risk and overall lifetime tax payable by an estimated $28,000–$45,000 in present value.',
      alternatives: JSON.stringify([
        { title: 'No meltdown — let RRIF minimums dictate withdrawals', description: 'Simpler to manage.', whyRejected: 'Results in forced high withdrawals at 71+ pushing income into 33%+ marginal bracket and triggering partial OAS clawback.' },
        { title: 'Accelerate meltdown before 65', description: 'Begin withdrawals while still employed.', whyRejected: 'Employment income at $120K would stack with RRSP withdrawals, making marginal rates unfavourable.' },
      ]),
      consequences: 'RRSP balance reduced to an estimated $150K–$200K by RRIF conversion at 71. TFSA contributions should run in parallel to shelter the withdrawn amounts from future growth taxation.',
      tags:         JSON.stringify(['rrsp', 'rrif', 'meltdown', 'tax-planning', 'bracket-management']),
      decisionDate: new Date('2025-11-20'),
      reviewDate:   new Date('2026-11-01'),
      linkedScenarioIds: JSON.stringify([IDS.scenBase]),
    },
    {
      id:           IDS.decWithdrawalOrder,
      householdId:  IDS.household,
      title:        'Establish Tax-Efficient Withdrawal Order',
      status:       'DECIDED',
      category:     'WITHDRAWAL_STRATEGY',
      context:      'Smith family holds $215K in a joint non-registered account, $610K combined RRSP, and $174.5K combined TFSA. The order in which accounts are drawn down has material tax consequences over a 25-year retirement.',
      decision:     'Follow a three-phase withdrawal order: (1) Non-registered first to crystalize capital gains at low rates and reduce future ACB complexity. (2) RRSP/RRIF to fill lower tax brackets. (3) TFSA last as the tax-free growth reservoir for late-stage retirement and estate transfer.',
      rationale:    'This order minimises lifetime taxes by: reducing RRSP/RRIF balance via meltdown strategy, using non-reg to take advantage of the 50% capital gains inclusion, and preserving TFSA for tax-free legacy or late-life care costs.',
      alternatives: JSON.stringify([
        { title: 'RRSP first', description: 'Draw RRSP down before non-registered assets.', whyRejected: 'Wastes low-bracket capacity earlier and grows non-reg assets that generate ongoing taxable investment income.' },
        { title: 'TFSA first', description: 'Use TFSA as the primary spending account.', whyRejected: 'Sacrifices future tax-free compounding unnecessarily while RRSP balance continues to grow.' },
      ]),
      consequences: 'Requires annual tax modelling to recalibrate withdrawal amounts. Coordinated with RRSP meltdown strategy and TFSA maximization.',
      tags:         JSON.stringify(['withdrawal-order', 'tfsa', 'non-registered', 'tax-efficiency']),
      decisionDate: new Date('2025-12-01'),
      reviewDate:   new Date('2026-12-01'),
      linkedScenarioIds: JSON.stringify([IDS.scenBase, IDS.scenEarly, IDS.scenConservative]),
    },
    {
      id:           IDS.decAssetAlloc,
      householdId:  IDS.household,
      title:        'Glide to 60/40 Portfolio at Retirement',
      status:       'DECIDED',
      category:     'ASSET_ALLOCATION',
      context:      'Currently holding approximately 75% equities / 25% bonds across all accounts at age 58. A life-cycle approach suggests de-risking toward retirement. The chosen base scenario already uses 60/40; this decision locks in the transition schedule.',
      decision:     'Shift from 75/25 to 60/40 equities/bonds over the 7 years to David\'s retirement at 65, reducing equity by ~2.1 percentage points per year.',
      rationale:    'Monte Carlo simulations show the 60/40 split still achieves a 91% success rate to age 92 while significantly reducing the worst-case drawdown in early retirement (sequence-of-returns risk). The conservative scenario models 40/60 as a stress test.',
      alternatives: JSON.stringify([
        { title: 'Maintain 75/25 through retirement', description: 'Higher expected return, more volatile.', whyRejected: 'Sequence-of-returns risk is too high in years 1–5 of retirement when the portfolio is at peak value.' },
        { title: 'Target 50/50 at retirement', description: 'More conservative.', whyRejected: 'Monte Carlo success rate drops to 84% — below our 90% threshold — due to insufficient real growth.' },
      ]),
      consequences: 'Annual rebalancing required. Tax-efficient rebalancing by directing new contributions toward bonds in RRSP where bond income is sheltered.',
      tags:         JSON.stringify(['asset-allocation', 'glide-path', 'rebalancing', 'sequence-risk']),
      decisionDate: new Date('2025-12-01'),
      reviewDate:   new Date('2027-01-01'),
      linkedScenarioIds: JSON.stringify([IDS.scenBase, IDS.scenConservative]),
    },
    {
      id:           IDS.decSarahCpp,
      householdId:  IDS.household,
      title:        'Determine Sarah\'s CPP Start Age',
      status:       'PROPOSED',
      category:     'CPP_OAS_TIMING',
      context:      'Sarah (age 55) will stop part-time work at 62. Her CPP entitlement is lower than David\'s due to part-time contributions. This decision needs to be finalized before age 60 but can be revisited annually. Spousal income-splitting and pension credit strategies interact with this choice.',
      decision:     null,
      rationale:    null,
      alternatives: JSON.stringify([
        { title: 'Start CPP at 60 (reduced)',   description: 'Provides income immediately after stopping work at 62.' },
        { title: 'Start CPP at 65 (standard)', description: 'Standard amount with no adjustment.' },
        { title: 'Defer CPP to 70 (enhanced)',  description: 'Same strategy as David — 42% higher monthly benefit.' },
      ]),
      consequences: 'Affects whether bridge income is needed at 62–65 and how much income-splitting opportunity exists at that stage.',
      tags:         JSON.stringify(['cpp', 'sarah', 'spousal', 'income-splitting']),
      decisionDate: null,
      reviewDate:   new Date('2026-09-01'),
      linkedScenarioIds: JSON.stringify([IDS.scenBase]),
    },
    {
      id:           IDS.decDownsize,
      householdId:  IDS.household,
      title:        'Consider Downsizing Primary Residence at Age 68',
      status:       'PROPOSED',
      category:     'HOUSING',
      context:      'The Smiths\' primary residence in Ontario is estimated at $950K. Maintaining a large home on retirement income involves property tax (~$8K/yr), insurance ($3K/yr), and maintenance (~$12K/yr). Downsizing at age 68 to a $500K condo could free up ~$450K of equity (principal-residence-exempt) for investment.',
      decision:     null,
      rationale:    null,
      alternatives: JSON.stringify([
        { title: 'Stay in current home indefinitely', description: 'Preserves lifestyle and familiar community.' },
        { title: 'Downsize at 68 to smaller house/condo', description: 'Frees $400–500K of equity, reduces ongoing costs ~$15K/yr.' },
        { title: 'Rent out portion of home', description: 'Generates rental income but adds complexity and loss of principal residence designation on rented portion.' },
      ]),
      consequences: 'A $450K equity release invested at 60/40 could generate an additional $18K–$22K/yr of spending capacity. Reduces estate value by approximately the same amount.',
      tags:         JSON.stringify(['housing', 'downsizing', 'equity-release', 'estate']),
      decisionDate: null,
      reviewDate:   new Date('2027-06-01'),
      linkedScenarioIds: null,
    },
    {
      id:           IDS.decEstate,
      householdId:  IDS.household,
      title:        'Update Will & Beneficiary Designations',
      status:       'PROPOSED',
      category:     'ESTATE',
      context:      'The Smiths\' wills were last updated in 2015, before significant RRSP and TFSA accumulation. With a combined registered asset base of ~$785K, improper beneficiary designations could result in the entire RRSP being included as income on the year of death, generating a substantial tax liability for the estate. Both spouses should be named as successor subscribers on TFSAs.',
      decision:     null,
      rationale:    null,
      alternatives: JSON.stringify([
        { title: 'Update wills and beneficiary designations now', description: 'Immediate action to protect estate from unnecessary tax.' },
        { title: 'Defer until retirement', description: 'Risk remaining in the meantime.' },
      ]),
      consequences: 'Naming spouse as beneficiary on RRSP defers income inclusion until survivor\'s death. TFSA successor subscriber avoids probate and immediate withdrawal. Estimated tax saving of $80K–$120K for estate.',
      tags:         JSON.stringify(['estate', 'will', 'beneficiary', 'rrsp', 'tfsa', 'probate']),
      decisionDate: null,
      reviewDate:   new Date('2026-06-01'),
      linkedScenarioIds: null,
    },
    {
      id:           IDS.decInsurance,
      householdId:  IDS.household,
      title:        'Cancel Term Life Insurance at Retirement',
      status:       'DECIDED',
      category:     'INSURANCE',
      context:      'David holds a 20-year term life policy ($750K coverage, $2,800/yr premium) expiring at age 68. Sarah holds a 15-year term ($450K, $1,600/yr) expiring at age 63. By the time these policies expire, the mortgage will be paid off (age 63 per milestones), both children will be financially independent, and the portfolio will be fully self-sustaining.',
      decision:     'Allow both term life policies to lapse at natural expiry. Do not renew or convert to permanent insurance.',
      rationale:    'The primary need for life insurance — income replacement and mortgage coverage — disappears at retirement. The portfolio size at that point ($900K+ projected) is self-insuring. Permanent insurance premiums would be prohibitive and offer poor ROI vs investing the premiums.',
      alternatives: JSON.stringify([
        { title: 'Convert David\'s term to whole life at expiry (age 68)', description: 'Guarantees death benefit for estate.', whyRejected: 'Estimated premium $12K–$18K/yr for equivalent coverage; provides marginal estate benefit given the projected portfolio size.' },
        { title: 'Purchase critical illness rider instead', description: 'Targeted protection against major illness costs.', whyRejected: 'Long-term care reserve within TFSA is a more tax-efficient vehicle for this risk.' },
      ]),
      consequences: 'Annual premium savings of $4,400/yr from age 63. Redirected to TFSA contributions.',
      tags:         JSON.stringify(['insurance', 'term-life', 'premium-savings', 'retirement']),
      decisionDate: new Date('2026-01-10'),
      reviewDate:   new Date('2028-01-01'),
      linkedScenarioIds: null,
    },
  ];

  for (const dec of decisions) {
    await prisma.decisionRecord.create({ data: dec });
  }

  // ── 10b. Wire up mind-map relations ────────────────────────────────────────
  // CPP Defer ↔ RRSP Meltdown (deferring CPP creates need for RRSP bridge income)
  await prisma.decisionRecord.update({
    where: { id: IDS.decCppDefer },
    data: { relatedTo: { connect: [{ id: IDS.decRrspMeltdown }] } },
  });
  // RRSP Meltdown ↔ Withdrawal Order (both are withdrawal strategy components)
  await prisma.decisionRecord.update({
    where: { id: IDS.decRrspMeltdown },
    data: { relatedTo: { connect: [{ id: IDS.decWithdrawalOrder }] } },
  });
  // Withdrawal Order ↔ Asset Allocation (allocation affects draw-down mechanics)
  await prisma.decisionRecord.update({
    where: { id: IDS.decWithdrawalOrder },
    data: { relatedTo: { connect: [{ id: IDS.decAssetAlloc }] } },
  });
  // David CPP Defer ↔ Sarah CPP (spouse coordination)
  await prisma.decisionRecord.update({
    where: { id: IDS.decCppDefer },
    data: { relatedTo: { connect: [{ id: IDS.decSarahCpp }] } },
  });
  // Downsize ↔ Estate (home equity is a key estate asset)
  await prisma.decisionRecord.update({
    where: { id: IDS.decDownsize },
    data: { relatedTo: { connect: [{ id: IDS.decEstate }] } },
  });
  // Insurance ↔ Estate (life insurance is part of estate plan)
  await prisma.decisionRecord.update({
    where: { id: IDS.decInsurance },
    data: { relatedTo: { connect: [{ id: IDS.decEstate }] } },
  });

  console.log(`  Decisions:  ${decisions.length} records (${decisions.filter(d => d.status === 'DECIDED').length} decided, ${decisions.filter(d => d.status === 'PROPOSED').length} proposed)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
