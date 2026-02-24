import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { YnabService } from './ynab.service';
import { YnabController } from './ynab.controller';
import { YnabSyncScheduler } from './ynab.scheduler';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [YnabService, YnabSyncScheduler],
  controllers: [YnabController],
  exports: [YnabService],
})
export class YnabModule {}
