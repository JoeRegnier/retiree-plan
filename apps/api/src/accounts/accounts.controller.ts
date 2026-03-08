import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AccountsService } from './accounts.service';

@Controller('accounts')
@UseGuards(AuthGuard('jwt'))
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Post()
  create(@Body() body: {
    name: string;
    type: string;
    balance: number;
    annualContribution?: number;
    estimatedReturnRate?: number | null;
    currency?: string;
    householdId: string;
    ynabAccountId?: string;
    ynabAccountName?: string;
    brokerageAccountId?: string | null;
    brokerageProvider?: string | null;
    brokerageAccountName?: string | null;
  }) {
    return this.accountsService.create(body);
  }

  @Get('household/:householdId')
  findByHousehold(@Param('householdId') householdId: string) {
    return this.accountsService.findByHousehold(householdId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accountsService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: {
    name?: string;
    type?: string;
    balance?: number;
    annualContribution?: number;
    estimatedReturnRate?: number | null;
    ynabAccountId?: string | null;
    ynabAccountName?: string | null;
    brokerageAccountId?: string | null;
    brokerageProvider?: string | null;
    brokerageAccountName?: string | null;
  }) {
    return this.accountsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.accountsService.remove(id);
  }
}
