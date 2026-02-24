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
      stdDevReturn: body.stdDevReturn ?? body.volatility,
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
    return this.projectionsService.runGKSimulation(normalized);
  }

  @Post('estate')
  runEstate(@Body() body: any) {
    return this.projectionsService.runEstateCalculation(body);
  }
}
