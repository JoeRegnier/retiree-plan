import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { optimizeRrspMeltdown, MeltdownInput } from '@retiree-plan/finance-engine';

@UseGuards(AuthGuard('jwt'))
@Controller('optimization')
export class OptimizationController {
  @Post('rrsp-meltdown')
  rrspMeltdown(@Body() body: MeltdownInput) {
    return optimizeRrspMeltdown(body);
  }
}
