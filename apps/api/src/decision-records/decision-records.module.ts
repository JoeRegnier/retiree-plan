import { Module } from '@nestjs/common';
import { DecisionRecordsController } from './decision-records.controller';
import { DecisionRecordsService } from './decision-records.service';

@Module({
  controllers: [DecisionRecordsController],
  providers: [DecisionRecordsService],
  exports: [DecisionRecordsService],
})
export class DecisionRecordsModule {}
