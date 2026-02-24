import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';

@Module({
  providers: [ExpensesService],
  controllers: [ExpensesController],
  exports: [ExpensesService],
})
export class ExpensesModule {}
