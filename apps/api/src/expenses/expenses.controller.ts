import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExpensesService, CreateExpenseDto, UpdateExpenseDto } from './expenses.service';

@Controller('expenses')
@UseGuards(AuthGuard('jwt'))
export class ExpensesController {
  constructor(private expensesService: ExpensesService) {}

  @Post()
  create(@Body() body: CreateExpenseDto) {
    return this.expensesService.create(body);
  }

  @Get('household/:householdId')
  findByHousehold(@Param('householdId') householdId: string) {
    return this.expensesService.findByHousehold(householdId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateExpenseDto) {
    return this.expensesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.expensesService.remove(id);
  }
}
