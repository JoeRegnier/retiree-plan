export interface ReadinessScoreInput {
  monteCarloSuccessRate: number; // 0-1 (e.g., 0.87 = 87%)
  preRetirementGrossIncome: number; // last working year gross
  retirementYearGrossIncome: number; // first retirement year gross
  actualEffectiveTaxRate: number; // from projection (0-1)
  optimalEffectiveTaxRate: number; // theoretical minimum (0-1)
  rrspBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
}

export interface ReadinessScoreResult {
  score: number; // 0-100 rounded to 1 decimal
  monteCarloComponent: number; // 0-40
  incomeReplacementComponent: number; // 0-25
  taxEfficiencyComponent: number; // 0-20
  diversificationComponent: number; // 0-15
  issues: ReadinessIssue[]; // max 3, sorted by impact
}

export interface ReadinessIssue {
  label: string;
  impact: 'high' | 'medium' | 'low';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatPercent(decimal: number): string {
  const pct = round1(decimal * 100);
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
}

function sortIssuesByImpact(issues: ReadinessIssue[]): ReadinessIssue[] {
  const rank: Record<ReadinessIssue['impact'], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return [...issues].sort((a, b) => rank[a.impact] - rank[b.impact]);
}

export function calculateReadinessScore(
  input: ReadinessScoreInput,
): ReadinessScoreResult {
  const issues: ReadinessIssue[] = [];

  // 1) Monte Carlo component (0-40)
  const monteCarloComponent = clamp(input.monteCarloSuccessRate * 40, 0, 40);
  if (input.monteCarloSuccessRate < 0.8) {
    issues.push({
      label: `Monte Carlo success rate is only ${formatPercent(input.monteCarloSuccessRate)}% - consider reducing spending or delaying retirement`,
      impact: monteCarloComponent < 20 ? 'high' : 'medium',
    });
  }

  // 2) Income replacement component (0-25)
  const incomeRatio =
    input.preRetirementGrossIncome > 0
      ? input.retirementYearGrossIncome / input.preRetirementGrossIncome
      : 0;

  let incomeReplacementComponent = 0;
  if (input.preRetirementGrossIncome <= 0) {
    incomeReplacementComponent = 0;
  } else if (incomeRatio >= 0.7) {
    incomeReplacementComponent = 25;
  } else if (incomeRatio >= 0.5) {
    incomeReplacementComponent =
      12.5 + ((incomeRatio - 0.5) / 0.2) * (25 - 12.5);
  } else {
    incomeReplacementComponent = (incomeRatio / 0.5) * 12.5;
  }
  incomeReplacementComponent = clamp(incomeReplacementComponent, 0, 25);

  if (incomeRatio < 0.7) {
    issues.push({
      label: `Retirement income replaces only ${formatPercent(incomeRatio)}% of pre-retirement income`,
      impact: incomeRatio < 0.5 ? 'high' : 'medium',
    });
  }

  // 3) Tax efficiency component (0-20)
  const taxGap = input.actualEffectiveTaxRate - input.optimalEffectiveTaxRate;
  const taxEfficiencyComponent = clamp(Math.max(0, 1 - taxGap * 5) * 20, 0, 20);

  if (taxGap > 0.05) {
    issues.push({
      label: `Your effective tax rate is ${formatPercent(taxGap)}% above optimum - consider RRSP meltdown or TFSA rebalancing`,
      impact: 'medium',
    });
  }

  // 4) Diversification component (0-15) using HHI across account types
  const rrsp = Math.max(0, input.rrspBalance);
  const tfsa = Math.max(0, input.tfsaBalance);
  const nonReg = Math.max(0, input.nonRegBalance);
  const total = rrsp + tfsa + nonReg;

  let diversificationComponent = 0;
  let maxShare = 0;
  let maxShareLabel = '';

  if (total > 0) {
    const rrspShare = rrsp / total;
    const tfsaShare = tfsa / total;
    const nonRegShare = nonReg / total;

    const hhi = rrspShare ** 2 + tfsaShare ** 2 + nonRegShare ** 2;
    const idealHhi = 1 / 3;
    const worstHhi = 1;
    const concentration = (hhi - idealHhi) / (worstHhi - idealHhi);
    diversificationComponent = clamp((1 - concentration) * 15, 0, 15);

    const shares = [
      { label: 'RRSP', share: rrspShare },
      { label: 'TFSA', share: tfsaShare },
      { label: 'non-registered accounts', share: nonRegShare },
    ];
    const dominant = shares.reduce((acc, current) =>
      current.share > acc.share ? current : acc,
    );
    maxShare = dominant.share;
    maxShareLabel = dominant.label;

    if (maxShare > 0.8) {
      issues.push({
        label: `Over ${formatPercent(maxShare)}% of your portfolio is in ${maxShareLabel} - diversifying across account types improves tax flexibility`,
        impact: maxShare > 0.9 ? 'medium' : 'low',
      });
    }
  }

  const score = clamp(
    monteCarloComponent +
      incomeReplacementComponent +
      taxEfficiencyComponent +
      diversificationComponent,
    0,
    100,
  );

  return {
    score: round1(score),
    monteCarloComponent: round1(monteCarloComponent),
    incomeReplacementComponent: round1(incomeReplacementComponent),
    taxEfficiencyComponent: round1(taxEfficiencyComponent),
    diversificationComponent: round1(diversificationComponent),
    issues: sortIssuesByImpact(issues).slice(0, 3),
  };
}
