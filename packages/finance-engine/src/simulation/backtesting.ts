/**
 * Historical Backtesting Engine (WBS 3.3)
 *
 * Runs sequential historical return windows through the cash-flow model
 * to assess plan durability against real market data (1970–2024).
 */

export interface HistoricalReturnRow {
  year: number;
  asset: string;
  returnRate: number;
}

export interface BacktestInput {
  /** Current age of primary member */
  currentAge: number;
  /** Target retirement age */
  retirementAge: number;
  /** Life expectancy (end of analysis) */
  lifeExpectancy: number;
  /** Annual expenses in retirement */
  annualExpensesInRetirement: number;
  /** Pre-retirement annual income (used for savings accumulation phase) */
  annualIncome?: number;
  /** RRSP/RRIF balance today */
  rrspBalance: number;
  /** TFSA balance today */
  tfsaBalance: number;
  /** Non-registered balance today */
  nonRegBalance: number;
  /** Annual contribution while working */
  annualSavings?: number;
  /** Asset allocation: fraction in equities (rest in bonds) */
  equityFraction?: number;
  /** Historical return rows from DB */
  historicalReturns: HistoricalReturnRow[];
}

export interface BacktestWindow {
  startYear: number;
  endYear: number;
  survived: boolean;
  finalPortfolioValue: number;
  yearsMoneyLasted: number;
  balanceByYear: { year: number; age: number; balance: number }[];
}

export interface BacktestResult {
  successRate: number;
  numWindows: number;
  successfulWindows: number;
  windows: BacktestWindow[];
  medianFinalBalance: number;
  worstCase: BacktestWindow | null;
  bestCase: BacktestWindow | null;
}

function blendReturn(
  equityReturn: number,
  bondReturn: number,
  equityFraction: number,
): number {
  return equityReturn * equityFraction + bondReturn * (1 - equityFraction);
}

function getReturn(
  returnsByYear: Map<string, number>,
  year: number,
  asset: string,
  fallback: number,
): number {
  return returnsByYear.get(`${year}:${asset}`) ?? fallback;
}

export function runBacktest(input: BacktestInput): BacktestResult {
  const {
    currentAge,
    retirementAge,
    lifeExpectancy,
    annualExpensesInRetirement,
    annualIncome = 0,
    rrspBalance,
    tfsaBalance,
    nonRegBalance,
    annualSavings = Math.max(0, annualIncome * 0.15),
    equityFraction = 0.6,
    historicalReturns,
  } = input;

  const retirementYears = Math.max(1, lifeExpectancy - retirementAge);
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);

  // Build lookup: year:asset -> returnRate
  const returnsByYear = new Map<string, number>();
  for (const row of historicalReturns) {
    returnsByYear.set(`${row.year}:${row.asset}`, row.returnRate);
  }

  // Find range of available data years
  const tsxYears = historicalReturns
    .filter((r) => r.asset === 'TSX')
    .map((r) => r.year)
    .sort((a, b) => a - b);

  if (tsxYears.length === 0) {
    return { successRate: 0, numWindows: 0, successfulWindows: 0, windows: [], medianFinalBalance: 0, worstCase: null, bestCase: null };
  }

  const firstYear = tsxYears[0];
  const lastYear = tsxYears[tsxYears.length - 1];
  const totalYearsNeeded = yearsToRetirement + retirementYears;
  const maxStartYear = lastYear - totalYearsNeeded;

  const windows: BacktestWindow[] = [];

  for (let startYear = firstYear; startYear <= maxStartYear; startYear++) {
    let totalBalance = rrspBalance + tfsaBalance + nonRegBalance;
    const balanceByYear: { year: number; age: number; balance: number }[] = [];

    // Accumulation phase: grow savings until retirement
    for (let i = 0; i < yearsToRetirement; i++) {
      const yr = startYear + i;
      const equityRet = getReturn(returnsByYear, yr, 'TSX', 0.07);
      const bondRet = getReturn(returnsByYear, yr, 'CA_BOND', 0.04);
      const blended = blendReturn(equityRet, bondRet, equityFraction);
      totalBalance = totalBalance * (1 + blended) + annualSavings;
    }

    // Distribution phase: retirement drawdown
    let survived = true;
    for (let i = 0; i < retirementYears; i++) {
      const yr = startYear + yearsToRetirement + i;
      const age = retirementAge + i;
      const equityRet = getReturn(returnsByYear, yr, 'TSX', 0.05);
      const bondRet = getReturn(returnsByYear, yr, 'CA_BOND', 0.03);
      const blended = blendReturn(equityRet, bondRet, equityFraction);

      // Withdraw at start of year, then grow remaining
      totalBalance = Math.max(0, totalBalance - annualExpensesInRetirement);
      totalBalance *= 1 + blended;

      balanceByYear.push({ year: yr, age, balance: parseFloat(totalBalance.toFixed(2)) });

      if (totalBalance <= 0) {
        survived = false;
        // Fill remaining years with 0
        for (let j = i + 1; j < retirementYears; j++) {
          balanceByYear.push({
            year: startYear + yearsToRetirement + j,
            age: retirementAge + j,
            balance: 0,
          });
        }
        break;
      }
    }

    const yearsMoneyLasted = survived
      ? retirementYears
      : balanceByYear.findIndex((b) => b.balance <= 0);

    windows.push({
      startYear,
      endYear: startYear + totalYearsNeeded - 1,
      survived,
      finalPortfolioValue: parseFloat(Math.max(0, totalBalance).toFixed(2)),
      yearsMoneyLasted: survived ? retirementYears : Math.max(0, yearsMoneyLasted),
      balanceByYear,
    });
  }

  if (windows.length === 0) {
    return { successRate: 0, numWindows: 0, successfulWindows: 0, windows: [], medianFinalBalance: 0, worstCase: null, bestCase: null };
  }

  const successfulWindows = windows.filter((w) => w.survived).length;
  const successRate = (successfulWindows / windows.length) * 100;

  const sorted = [...windows].sort((a, b) => a.finalPortfolioValue - b.finalPortfolioValue);
  const medianFinalBalance = sorted[Math.floor(sorted.length / 2)].finalPortfolioValue;

  return {
    successRate: parseFloat(successRate.toFixed(1)),
    numWindows: windows.length,
    successfulWindows,
    windows,
    medianFinalBalance,
    worstCase: sorted[0],
    bestCase: sorted[sorted.length - 1],
  };
}
