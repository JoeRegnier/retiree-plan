import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IncomesService, CreateIncomeDto, UpdateIncomeDto } from './incomes.service';

@Controller('incomes')
@UseGuards(AuthGuard('jwt'))
export class IncomesController {
  constructor(private incomesService: IncomesService) {}

  @Post()
  create(@Body() body: CreateIncomeDto) {
    return this.incomesService.create(body);
  }

  @Get('member/:memberId')
  findByMember(@Param('memberId') memberId: string) {
    return this.incomesService.findByMember(memberId);
  }

  @Get('household/:householdId')
  findByHousehold(@Param('householdId') householdId: string) {
    return this.incomesService.findByHousehold(householdId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.incomesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateIncomeDto) {
    return this.incomesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.incomesService.remove(id);
  }
}
