/**
 * Rule-based automated insights engine.
 * Generates contextual retirement planning recommendations sorted by dollar impact.
 */

export interface InsightInput {
  currentAge: number;
  retirementAge: number;
  annualIncome: number;
  province: string;
  rrspBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  unusedTfsaRoom: number;
  unusedRrspRoom: number;
  cppStartAge: number;
  oasStartAge: number;
  oasClawbackYears: number[];
  projectedIncomeAtRetirement: number;
  hasSpouse: boolean;
  spouseIncome?: number;
  meltdownSavings?: number;
  rrifConversionAge: number;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  dollarImpact: number;
  priority: 'high' | 'medium' | 'low';
  linkTo: string;
  category: 'tax' | 'benefits' | 'investment' | 'estate';
}

function formatDollar(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-CA')}`;
}

/**
 * Generate contextual retirement insights based on household data.
 * Returns max 5 insights sorted by dollar impact (highest first).
 */
export function generateInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];

  // Rule 1: RRSP Meltdown suggestion
  if (
    input.rrspBalance > 2 * input.annualIncome &&
    input.currentAge >= 55 &&
    input.currentAge <= 68
  ) {
    const estimatedSavings = input.meltdownSavings ?? input.rrspBalance * 0.08;
    insights.push({
      id: 'rrsp-meltdown',
      title: 'Consider RRSP Meltdown Strategy',
      description: `You have ${formatDollar(input.rrspBalance)} in RRSP, more than 2x your annual income. A meltdown withdrawal strategy from now to age 71 could save an estimated ${formatDollar(estimatedSavings)} in lifetime taxes.`,
      dollarImpact: estimatedSavings,
      priority: 'high',
      linkTo: '/simulations',
      category: 'tax',
    });
  }

  // Rule 2: OAS Clawback warning
  if (input.oasClawbackYears.length > 0) {
    const clawbackYears = input.oasClawbackYears.length;
    // Approximate: average OAS is ~$8,000/yr, clawback reduces it
    const estimatedLoss = clawbackYears * 4000;
    insights.push({
      id: 'oas-clawback',
      title: 'OAS Clawback Detected',
      description: `Your projected income triggers OAS clawback for ${clawbackYears} year${clawbackYears > 1 ? 's' : ''}. Shifting RRSP withdrawals earlier could preserve your full OAS benefit.`,
      dollarImpact: estimatedLoss,
      priority: 'high',
      linkTo: '/tax-analytics',
      category: 'benefits',
    });
  }

  // Rule 3: Unused TFSA room
  if (input.unusedTfsaRoom > 10_000 && input.nonRegBalance > 0) {
    const taxFreeSavings = Math.min(input.unusedTfsaRoom, input.nonRegBalance) * 0.02;
    insights.push({
      id: 'tfsa-room',
      title: 'Unused TFSA Contribution Room',
      description: `You have ${formatDollar(input.unusedTfsaRoom)} in unused TFSA room. Moving non-registered assets could generate ${formatDollar(taxFreeSavings)}/yr in tax-free growth.`,
      dollarImpact: taxFreeSavings * 10, // 10-year impact estimate
      priority: 'medium',
      linkTo: '/accounts',
      category: 'investment',
    });
  }

  // Rule 4: RRIF conversion reminder
  const yearsToRrif = input.rrifConversionAge - input.currentAge;
  if (yearsToRrif > 0 && yearsToRrif <= 3) {
    insights.push({
      id: 'rrif-reminder',
      title: 'RRIF Conversion Approaching',
      description: `You turn ${input.rrifConversionAge} in ${yearsToRrif} year${yearsToRrif > 1 ? 's' : ''}. RRIF conversion is mandatory with minimum annual withdrawals. Plan your pre-conversion strategy now.`,
      dollarImpact: input.rrspBalance * 0.05,
      priority: yearsToRrif <= 1 ? 'high' : 'medium',
      linkTo: '/projections',
      category: 'tax',
    });
  }

  // Rule 5: CPP timing
  if (input.currentAge >= 58 && input.currentAge <= 70 && input.cppStartAge > input.currentAge) {
    // Delaying CPP from 60 to 70 increases benefit by 42% vs age-60 start
    const cppGainEstimate = 3000; // approximate annual gain from optimal timing
    insights.push({
      id: 'cpp-timing',
      title: 'Optimize CPP Start Age',
      description: `You're eligible for CPP. Each year of deferral past 65 increases your benefit by 8.4%. Run the CPP Timing analysis to find your optimal start age.`,
      dollarImpact: cppGainEstimate,
      priority: 'medium',
      linkTo: '/projections',
      category: 'benefits',
    });
  }

  // Rule 6: Pension splitting for couples
  if (input.hasSpouse && input.spouseIncome != null) {
    const incomeGap = Math.abs(input.annualIncome - input.spouseIncome);
    if (incomeGap > 20_000) {
      const estimatedSplittingSavings = incomeGap * 0.1;
      insights.push({
        id: 'pension-splitting',
        title: 'Pension Income Splitting Opportunity',
        description: `Your household has a ${formatDollar(incomeGap)} income gap between spouses. Pension splitting could save up to ${formatDollar(estimatedSplittingSavings)}/yr in taxes.`,
        dollarImpact: estimatedSplittingSavings,
        priority: 'medium',
        linkTo: '/tax-analytics',
        category: 'tax',
      });
    }
  }

  // Rule 7: Unused RRSP room
  if (input.unusedRrspRoom > 20_000 && input.currentAge < input.retirementAge) {
    const taxDeduction = input.unusedRrspRoom * 0.3; // approximate marginal benefit
    insights.push({
      id: 'rrsp-room',
      title: 'Maximize RRSP Contributions',
      description: `You have ${formatDollar(input.unusedRrspRoom)} in unused RRSP room. Using it could generate an immediate tax deduction of up to ${formatDollar(taxDeduction)}.`,
      dollarImpact: taxDeduction,
      priority: 'medium',
      linkTo: '/accounts',
      category: 'tax',
    });
  }

  // Sort by dollarImpact descending, return max 5
  return insights
    .sort((a, b) => b.dollarImpact - a.dollarImpact)
    .slice(0, 5);
}
