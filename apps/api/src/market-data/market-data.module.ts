import { Module } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { MarketDataController } from './market-data.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MarketDataService],
  controllers: [MarketDataController],
  exports: [MarketDataService],
})
export class MarketDataModule {}
