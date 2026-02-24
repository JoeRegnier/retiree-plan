import { Module } from '@nestjs/common';
import { HistoricalReturnsService } from './historical-returns.service';
import { HistoricalReturnsController } from './historical-returns.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [HistoricalReturnsService],
  controllers: [HistoricalReturnsController],
  exports: [HistoricalReturnsService],
})
export class HistoricalReturnsModule {}
