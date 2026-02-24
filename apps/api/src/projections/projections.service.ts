import { Injectable } from '@nestjs/common';
import {
  runCashFlowProjection,
  runMonteCarloSimulation,
  runBacktest,
  runGuytonKlinger,
  calculateEstate,
} from '@retiree-plan/finance-engine';
import type { CashFlowInput, MonteCarloInput, BacktestInput, GKInput, EstateInput } from '@retiree-plan/finance-engine';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectionsService {
  constructor(private prisma: PrismaService) {}

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
}
