import { Module } from '@nestjs/common';
import { IncomesService } from './incomes.service';
import { IncomesController } from './incomes.controller';

@Module({
  providers: [IncomesService],
  controllers: [IncomesController],
  exports: [IncomesService],
})
export class IncomesModule {}
