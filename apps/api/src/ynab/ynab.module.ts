import { Module } from '@nestjs/common';
import { YnabService } from './ynab.service';
import { YnabController } from './ynab.controller';
import { YnabSyncScheduler } from './ynab.scheduler';

@Module({
  imports: [],
  providers: [YnabService, YnabSyncScheduler],
  controllers: [YnabController],
  exports: [YnabService],
})
export class YnabModule {}
