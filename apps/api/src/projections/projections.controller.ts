import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectionsService } from './projections.service';

@Controller('projections')
@UseGuards(AuthGuard('jwt'))
export class ProjectionsController {
  constructor(private projectionsService: ProjectionsService) {}

  @Post('cash-flow')
  runProjection(@Body() body: any) {
    return this.projectionsService.runProjection(body);
  }

  @Post('monte-carlo')
  runMonteCarlo(@Body() body: any) {
    // Accept both naming conventions from the frontend
    const normalized = {
      ...body,
      // Core field aliases
      endAge: body.endAge ?? body.lifeExpectancy ?? 90,
      annualExpenses: body.annualExpenses ?? body.annualExpensesInRetirement ?? 60_000,
      employmentIncome: body.employmentIncome ?? body.annualIncome ?? 0,
      nominalReturnRate: body.nominalReturnRate ?? body.expectedReturn ?? 0.06,
      // Government benefit defaults
      cppStartAge: body.cppStartAge ?? 65,
      oasStartAge: body.oasStartAge ?? 65,
      province: body.province ?? 'ON',
      // Simulation params
      stdDevReturn: body.stdDevReturn ?? body.volatility ?? 0.12,
      trials: body.trials ?? body.numSimulations ?? 1000,
    };
    return this.projectionsService.runMonteCarlo(normalized);
  }

  @Post('backtest')
  runBacktest(@Body() body: any) {
    return this.projectionsService.runBacktest(body);
  }

  @Post('guyton-klinger')
  runGuytonKlinger(@Body() body: any) {
    const normalized = {
      ...body,
      stdDevReturn: body.stdDevReturn ?? body.volatility ?? 0.12,
    };
    const result = this.projectionsService.runGKSimulation(normalized);
    // Normalise response to match frontend expectations
    return {
      ...result,
      portfolioSurvived: result.finalPortfolio > 0,
      initialWithdrawal: body.initialWithdrawal ?? 0,
      totalWithdrawn: result.totalWithdrawals,
      years: result.years.map((y: any, i: number) => ({
        ...y,
        portfolioBalance: y.portfolioValue ?? y.portfolioBalance ?? 0,
        age: body.retirementAge != null ? body.retirementAge + i : undefined,
      })),
    };
  }

  @Post('estate')
  runEstate(@Body() body: any) {
    return this.projectionsService.runEstateCalculation(body);
  }

  @Post('readiness-score')
  computeReadinessScore(@Body() body: any) {
    return this.projectionsService.computeReadinessScore(body);
  }

  @Post('historical-scenarios')
  runHistoricalScenarios(@Body() body: any) {
    const normalized = {
      ...body,
      endAge: body.endAge ?? body.lifeExpectancy ?? 90,
      annualExpenses: body.annualExpenses ?? body.annualExpensesInRetirement ?? 60_000,
      employmentIncome: body.employmentIncome ?? body.annualIncome ?? 0,
      nominalReturnRate: body.nominalReturnRate ?? body.expectedReturn ?? 0.06,
      cppStartAge: body.cppStartAge ?? 65,
      oasStartAge: body.oasStartAge ?? 65,
      province: body.province ?? 'ON',
      trials: body.trials ?? 500,
      equityFraction: body.equityFraction ?? 0.6,
      equityAsset: body.equityAsset ?? 'TSX',
      bondAsset: body.bondAsset ?? 'CA_BOND',
      label: body.label,
    };
    return this.projectionsService.runHistoricalBootstrap(normalized);
  }

  @Post('insights')
  generateInsights(@Body() body: any) {
    return this.projectionsService.generateInsights(body);
  }
}
