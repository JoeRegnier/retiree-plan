import { calcAge } from './age';

interface Expense {
  annualAmount: number;
  startAge?: number | null;
  endAge?: number | null;
  indexToInflation?: boolean;
}

type AttributionMode = 'JOINT_UNSPECIFIED' | 'SINGLE_MEMBER' | 'JOINT_PERCENTAGE';

interface AttributionHistoryEntry {
  effectiveYear: number;
  mode?: AttributionMode | string;
  primaryMemberId?: string | null;
  secondaryMemberId?: string | null;
  primaryPercentage?: number | null;
  secondaryPercentage?: number | null;
}

function resolveAccountSharesForYear(
  account: any,
  year: number,
  memberIds: string[],
): Record<string, number> {
  if (!memberIds.length) return {};

  const history = ((account.taxAttributionHistory ?? []) as AttributionHistoryEntry[])
    .filter((h) => Number.isFinite(h.effectiveYear))
    .sort((a, b) => a.effectiveYear - b.effectiveYear);

  const active = [...history].reverse().find((h) => h.effectiveYear <= year);
  const mode = (active?.mode ?? 'JOINT_UNSPECIFIED') as AttributionMode;
  const equalShare = 1 / memberIds.length;
  const shares = Object.fromEntries(memberIds.map((id) => [id, 0])) as Record<string, number>;

  if (mode === 'SINGLE_MEMBER' && active?.primaryMemberId && memberIds.includes(active.primaryMemberId)) {
    shares[active.primaryMemberId] = 1;
    return shares;
  }

  if (mode === 'JOINT_PERCENTAGE' && active?.primaryMemberId && memberIds.includes(active.primaryMemberId)) {
    const p1 = active.primaryPercentage ?? 0.5;
    const p2 = active.secondaryPercentage ?? (1 - p1);
    shares[active.primaryMemberId] = Math.max(0, p1);
    if (active.secondaryMemberId && memberIds.includes(active.secondaryMemberId)) {
      shares[active.secondaryMemberId] = Math.max(0, p2);
    }
    const total = Object.values(shares).reduce((s, v) => s + v, 0);
    if (total > 0) {
      for (const id of memberIds) shares[id] = shares[id] / total;
      return shares;
    }
  }

  for (const id of memberIds) shares[id] = equalShare;
  return shares;
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
  const currentYear = new Date().getFullYear();
  const accounts = household.accounts ?? [];
  const memberIds = members.map((m: any) => m.id).filter(Boolean);

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

  const memberIncomeSources = members.flatMap((m: any) =>
    (m.incomeSources ?? [])
      .filter((src: any) => !ENGINE_EXCLUDED.has(src.type))
      .map((src: any) => ({
        memberId: m.id,
        annualAmount: src.annualAmount as number,
        startAge: src.startAge as number | undefined,
        endAge: src.endAge as number | undefined,
        indexToInflation: src.indexToInflation !== false,
      })),
  );

  const timelineYears = new Set<number>([currentYear]);
  for (const account of accounts) {
    for (const h of account.taxAttributionHistory ?? []) {
      if (Number.isFinite(h.effectiveYear)) timelineYears.add(h.effectiveYear);
    }
  }

  const rrspLike = (a: any) => a.type === 'RRSP' || a.type === 'RRIF';
  const tfsaLike = (a: any) => a.type === 'TFSA';
  const nonRegLike = (a: any) => a.type === 'NON_REG' || a.type === 'NON_REGISTERED';
  const cashLike = (a: any) => a.type === 'CASH';

  const memberTypeShareTimeline = [...timelineYears]
    .sort((a, b) => a - b)
    .flatMap((year) => {
      const typeBalances = {
        rrsp: accounts.filter(rrspLike).reduce((s: number, a: any) => s + (a.balance ?? 0), 0),
        tfsa: accounts.filter(tfsaLike).reduce((s: number, a: any) => s + (a.balance ?? 0), 0),
        nonReg: accounts.filter(nonRegLike).reduce((s: number, a: any) => s + (a.balance ?? 0), 0),
        cash: accounts.filter(cashLike).reduce((s: number, a: any) => s + (a.balance ?? 0), 0),
      };

      const totalsByMember = Object.fromEntries(
        memberIds.map((id) => [id, { rrsp: 0, tfsa: 0, nonReg: 0, cash: 0 }]),
      ) as Record<string, { rrsp: number; tfsa: number; nonReg: number; cash: number }>;

      for (const account of accounts) {
        const shares = resolveAccountSharesForYear(account, year, memberIds);
        for (const id of memberIds) {
          const weighted = (account.balance ?? 0) * (shares[id] ?? 0);
          if (rrspLike(account)) totalsByMember[id].rrsp += weighted;
          if (tfsaLike(account)) totalsByMember[id].tfsa += weighted;
          if (nonRegLike(account)) totalsByMember[id].nonReg += weighted;
          if (cashLike(account)) totalsByMember[id].cash += weighted;
        }
      }

      return members.map((m: any) => ({
        effectiveYear: year,
        memberId: m.id,
        memberName: m.name,
        province: m.province,
        rrspShare: typeBalances.rrsp > 0 ? totalsByMember[m.id].rrsp / typeBalances.rrsp : (memberIds.length ? 1 / memberIds.length : 0),
        tfsaShare: typeBalances.tfsa > 0 ? totalsByMember[m.id].tfsa / typeBalances.tfsa : (memberIds.length ? 1 / memberIds.length : 0),
        nonRegShare: typeBalances.nonReg > 0 ? totalsByMember[m.id].nonReg / typeBalances.nonReg : (memberIds.length ? 1 / memberIds.length : 0),
        cashShare: typeBalances.cash > 0 ? totalsByMember[m.id].cash / typeBalances.cash : (memberIds.length ? 1 / memberIds.length : 0),
      }));
    });

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
    members: members.map((m: any) => ({ id: m.id, name: m.name, province: m.province })),
    memberIncomeSources,
    memberTypeShareTimeline,
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
