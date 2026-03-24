import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  optimizeRrspMeltdown,
  MeltdownInput,
  compareWithdrawalStrategies,
  analyzeSpousalRrsp,
  runBucketProjection,
} from '@retiree-plan/finance-engine';
import type { SpousalRrspInput } from '@retiree-plan/shared';
import type { BucketProjectionInput, CashFlowInput } from '@retiree-plan/finance-engine';

@UseGuards(AuthGuard('jwt'))
@Controller('optimization')
export class OptimizationController {
  @Post('rrsp-meltdown')
  rrspMeltdown(@Body() body: MeltdownInput) {
    return optimizeRrspMeltdown(body);
  }

  /**
   * POST /optimization/withdrawal-comparison
   * Runs the cash-flow projection with every built-in withdrawal strategy
   * and returns a ranked comparison.
   */
  @Post('withdrawal-comparison')
  withdrawalComparison(@Body() body: CashFlowInput) {
    return compareWithdrawalStrategies(body);
  }

  /**
   * POST /optimization/spousal-rrsp
   * Analyses the tax benefit and attribution risk of a spousal RRSP contribution.
   */
  @Post('spousal-rrsp')
  spousalRrsp(@Body() body: SpousalRrspInput) {
    return analyzeSpousalRrsp(body);
  }

  /**
   * POST /optimization/bucket-strategy
   * Runs a deterministic 3-bucket projection.
   */
  @Post('bucket-strategy')
  bucketStrategy(@Body() body: BucketProjectionInput) {
    return runBucketProjection(body);
  }
}

