import { Module } from '@nestjs/common';
import { ProjectionsService } from './projections.service';
import { ProjectionsController } from './projections.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [PrismaModule, MarketDataModule],
  providers: [ProjectionsService],
  controllers: [ProjectionsController],
  exports: [ProjectionsService],
})
export class ProjectionsModule {}
