import { Module } from '@nestjs/common';
import { BrokerageService } from './brokerage.service';
import { BrokerageController } from './brokerage.controller';

@Module({
  providers: [BrokerageService],
  controllers: [BrokerageController],
  exports: [BrokerageService],
})
export class BrokerageModule {}
