import { BadRequestException, Injectable } from '@nestjs/common';
import {
  runCashFlowProjection,
  runMonteCarloSimulation,
  runBacktest,
  runGuytonKlinger,
  calculateEstate,
  runHistoricalBootstrapSimulation,
  calculateReadinessScore,
} from '@retiree-plan/finance-engine';
import type { CashFlowInput, MonteCarloInput, BacktestInput, GKInput, EstateInput, HistoricalBootstrapInput } from '@retiree-plan/finance-engine';
import { PrismaService } from '../prisma/prisma.service';
import { MarketDataService } from '../market-data/market-data.service';

@Injectable()
export class ProjectionsService {
  constructor(
    private prisma: PrismaService,
    private marketData: MarketDataService,
  ) {}

  runProjection(input: CashFlowInput) {
    return runCashFlowProjection(input);
  }

  runMonteCarlo(input: MonteCarloInput) {
    const result = runMonteCarloSimulation(input);

    // Transform distributionByYear to front-end expected shape with age included
    const percentilesByYear = result.distributionByYear.map((d, i) => ({
      year: d.year,
      age: input.currentAge + i,
      p5: d.p5,
      p25: d.p25,
      p50: d.median,
      p75: d.p75,
      p95: d.p95,
    }));

    return {
      successRate: result.successRate * 100,
      trials: result.trials,
      percentilesByYear,
    };
  }

  async runBacktest(input: Omit<BacktestInput, 'historicalReturns'>) {
    const historicalReturns = await this.prisma.historicalReturn.findMany({
      where: { asset: { in: ['TSX', 'CA_BOND'] } },
      orderBy: [{ asset: 'asc' }, { year: 'asc' }],
    });
    return runBacktest({ ...input, historicalReturns } as BacktestInput);
  }

  runGKSimulation(input: GKInput) {
    return runGuytonKlinger(input);
  }

  runEstateCalculation(input: EstateInput) {
    return calculateEstate(input);
  }

  computeReadinessScore(input: CashFlowInput) {
    const projection = runCashFlowProjection(input);
    if (!projection || projection.length === 0) {
      throw new BadRequestException('Cannot compute readiness score: projection returned no data');
    }

    const monteCarlo = runMonteCarloSimulation({
      ...input,
      trials: 500,
    });

    const preRetirementYear =
      [...projection].reverse().find((year) => year.age < input.retirementAge) ??
      projection.find((year) => year.age === input.retirementAge) ??
      projection[projection.length - 1];

    const retirementYear =
      projection.find((year) => year.age === input.retirementAge) ??
      preRetirementYear ??
      projection[projection.length - 1];

    const preRetirementGrossIncome = preRetirementYear?.grossIncome ?? 0;
    const retirementYearGrossIncome = retirementYear?.grossIncome ?? 0;
    const actualEffectiveTaxRate =
      retirementYearGrossIncome > 0 ? (retirementYear?.totalTax ?? 0) / retirementYearGrossIncome : 0;

    return calculateReadinessScore({
      monteCarloSuccessRate: monteCarlo.successRate,
      preRetirementGrossIncome,
      retirementYearGrossIncome,
      actualEffectiveTaxRate,
      optimalEffectiveTaxRate: 0,
      rrspBalance: retirementYear?.rrspBalance ?? 0,
      tfsaBalance: retirementYear?.tfsaBalance ?? 0,
      nonRegBalance: retirementYear?.nonRegBalance ?? 0,
    });
  }

  async runHistoricalBootstrap(
    input: Omit<HistoricalBootstrapInput, 'historicalReturns'> & {
      equityFraction?: number;
      /** Asset key for equities — ticker or 'TSX'. Falls back to 'TSX' if no DB data found. */
      equityAsset?: string;
      /** Asset key for bonds — ticker or 'CA_BOND'. Falls back to 'CA_BOND' if no DB data found. */
      bondAsset?: string;
      /** Human-readable label for this run (used in overlay charts) */
      label?: string;
    },
  ) {
    const equityFraction = input.equityFraction ?? 0.6;
    const equityAsset = input.equityAsset ?? 'TSX';
    const bondAsset = input.bondAsset ?? 'CA_BOND';

    // Resolve equity series: use requested asset, fall back to TSX
    let equityRows = await this.marketData.getStoredReturns(equityAsset);
    if (equityRows.length < 10) {
      equityRows = await this.marketData.getStoredReturns('TSX');
    }

    // Resolve bond series: use requested asset, fall back to CA_BOND
    let bondRows = await this.marketData.getStoredReturns(bondAsset);
    if (bondRows.length < 10) {
      bondRows = await this.marketData.getStoredReturns('CA_BOND');
    }

    // Build a blended return series from overlapping years
    const bondMap = new Map(bondRows.map((b) => [b.year, b.returnRate]));
    const historicalReturns = equityRows
      .filter((t) => bondMap.has(t.year))
      .map((t) => equityFraction * t.returnRate + (1 - equityFraction) * bondMap.get(t.year)!);

    if (historicalReturns.length < 5) {
      throw new Error(
        `Insufficient overlapping historical data between equity asset "${equityAsset}" ` +
          `and bond asset "${bondAsset}". Try fetching those tickers first via POST /market-data/fetch.`,
      );
    }

    const result = runHistoricalBootstrapSimulation({ ...input, historicalReturns } as HistoricalBootstrapInput);

    // Strip trialPaths (too large) — keep metadata
    const { trialPaths: _paths, ...rest } = result;
    return {
      ...rest,
      label: input.label ?? `${equityAsset} / ${bondAsset}`,
      equityAsset,
      bondAsset,
      equityFraction,
      dataYears: historicalReturns.length,
    };
  }
}
