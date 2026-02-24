import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HistoricalReturnsService } from './historical-returns.service';

@UseGuards(AuthGuard('jwt'))
@Controller('historical-returns')
export class HistoricalReturnsController {
  constructor(private service: HistoricalReturnsService) {}

  @Get()
  findAll(
    @Query('asset') asset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findAll(
      asset,
      from ? parseInt(from, 10) : undefined,
      to ? parseInt(to, 10) : undefined,
    );
  }

  @Get('summary')
  summary(@Query('asset') asset?: string) {
    return this.service.summary(asset);
  }

  @Post('seed')
  seed() {
    return this.service.seed();
  }
}
