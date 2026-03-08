import { calcAge } from './age';

interface Expense {
  annualAmount: number;
  startAge?: number | null;
  endAge?: number | null;
  indexToInflation?: boolean;
}

/**
 * Builds the CashFlowInput payload for /projections/cash-flow from household
 * data and a parsed scenario-parameters object.
 *
 * Shared by ProjectionsPage, ComparePage, and any other page that needs to
 * run a projection directly from household + scenario data.
 */
export function buildProjectionPayload(
  household: { members: any[]; accounts: any[] },
  parsedParams: Record<string, any>,
  expenseItems?: Expense[],
): object | null {
  const members = household.members ?? [];
  if (!members.length) return null;

  // Primary member = highest total income earner (drives currentAge / province)
  const primaryMember = [...members].sort(
    (a: any, b: any) =>
      (b.incomeSources?.reduce((s: number, i: any) => s + i.annualAmount, 0) ?? 0) -
      (a.incomeSources?.reduce((s: number, i: any) => s + i.annualAmount, 0) ?? 0),
  )[0] as any;

  if (!primaryMember) return null;

  const p = parsedParams;
  const currentAge = calcAge(primaryMember.dateOfBirth);
  const accounts = household.accounts ?? [];

  const rrsp    = accounts.filter((a: any) => a.type === 'RRSP' || a.type === 'RRIF').reduce((s: number, a: any) => s + a.balance, 0);
  const tfsa    = accounts.filter((a: any) => a.type === 'TFSA').reduce((s: number, a: any) => s + a.balance, 0);
  const nonReg  = accounts.filter((a: any) => a.type === 'NON_REG').reduce((s: number, a: any) => s + a.balance, 0);
  const cashBal = accounts.filter((a: any) => a.type === 'CASH').reduce((s: number, a: any) => s + a.balance, 0);

  const weightedRate = (accs: any[]): number | undefined => {
    const rated = accs.filter((a: any) => a.estimatedReturnRate != null);
    if (!rated.length) return undefined;
    const totalBal = rated.reduce((s: number, a: any) => s + a.balance, 0);
    if (totalBal <= 0) return rated[0].estimatedReturnRate as number;
    return rated.reduce((s: number, a: any) => s + a.balance * a.estimatedReturnRate, 0) / totalBal;
  };

  const rrspRate   = weightedRate(accounts.filter((a: any) => a.type === 'RRSP' || a.type === 'RRIF'));
  const tfsaRate   = weightedRate(accounts.filter((a: any) => a.type === 'TFSA'));
  const nonRegRate = weightedRate(accounts.filter((a: any) => a.type === 'NON_REG'));
  const cashRate   = weightedRate(accounts.filter((a: any) => a.type === 'CASH'));

  const ENGINE_EXCLUDED = new Set(['CPP', 'OAS']);
  const incomeSources = members.flatMap((m: any) =>
    (m.incomeSources ?? [])
      .filter((src: any) => !ENGINE_EXCLUDED.has(src.type))
      .map((src: any) => ({
        annualAmount: src.annualAmount as number,
        startAge: src.startAge as number | undefined,
        endAge: src.endAge as number | undefined,
        indexToInflation: src.indexToInflation !== false,
      })),
  );

  const expenseEntries =
    expenseItems && expenseItems.length > 0
      ? expenseItems.map((e) => ({
          annualAmount: e.annualAmount,
          ...(e.startAge != null ? { startAge: e.startAge } : {}),
          ...(e.endAge != null ? { endAge: e.endAge } : {}),
          indexToInflation: e.indexToInflation !== false,
        }))
      : undefined;

  return {
    currentAge,
    endAge: p.lifeExpectancy ?? 90,
    province: primaryMember.province ?? 'ON',
    employmentIncome: 0,
    incomeSources,
    retirementAge: p.retirementAge ?? 65,
    annualExpenses:
      expenseItems && expenseItems.length > 0
        ? expenseItems.reduce((s, e) => s + e.annualAmount, 0)
        : p.annualExpenses ?? 60_000,
    expenseEntries,
    inflationRate: p.inflationRate ?? 0.02,
    nominalReturnRate: p.expectedReturnRate ?? 0.06,
    cppStartAge: p.cppStartAge ?? 65,
    oasStartAge: p.oasStartAge ?? 65,
    rrspBalance: rrsp,
    tfsaBalance: tfsa,
    nonRegBalance: nonReg,
    cashBalance: cashBal,
    rrspContribution: accounts.find((a: any) => a.type === 'RRSP')?.annualContribution ?? 0,
    tfsaContribution: accounts.find((a: any) => a.type === 'TFSA')?.annualContribution ?? 0,
    rrifConversionAge: p.rrifStartAge ?? 71,
    nonRegTaxDragRate: p.nonRegTaxDragRate ?? 0,
    investSurplus: p.investSurplus ?? false,
    cashSavingsRate: cashRate ?? p.cashSavingsRate ?? 0.025,
    ...(rrspRate != null ? { rrspReturnRate: rrspRate } : {}),
    ...(tfsaRate != null ? { tfsaReturnRate: tfsaRate } : {}),
    ...(nonRegRate != null ? { nonRegReturnRate: nonRegRate } : {}),
    ...(p.glidePathSteps?.length ? { glidePathSteps: p.glidePathSteps } : {}),
    ...(p.spendingPhases?.length ? { spendingPhases: p.spendingPhases } : {}),
  };
}
