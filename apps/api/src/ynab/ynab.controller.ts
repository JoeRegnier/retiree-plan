import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { YnabService } from './ynab.service';

@Controller('ynab')
export class YnabController {
  constructor(private ynab: YnabService) {}

  // ── Token ──────────────────────────────────────────────────────────────────

  /**
   * Save (or replace) the user's YNAB Personal Access Token.
   * Generate the token at: https://app.youneedabudget.com/settings/developer
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('token')
  @HttpCode(204)
  async saveToken(@Req() req: any, @Body() body: { token: string }) {
    await this.ynab.saveToken(req.user.id, body.token);
  }

  // ── Status & disconnect ───────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @Get('status')
  async getStatus(@Req() req: any) {
    return this.ynab.getStatus(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('disconnect')
  @HttpCode(204)
  async disconnect(@Req() req: any) {
    await this.ynab.disconnect(req.user.id);
  }

  // ── Budgets ────────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @Get('budgets')
  async getBudgets(@Req() req: any) {
    return this.ynab.getBudgets(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('budgets/:budgetId/select')
  async selectBudget(@Req() req: any, @Param('budgetId') budgetId: string) {
    return this.ynab.selectBudget(req.user.id, budgetId);
  }

  // ── Accounts ──────────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @Get('accounts')
  async getAccounts(@Req() req: any) {
    return this.ynab.getYnabAccounts(req.user.id);
  }

  /** Reconstruct historical monthly net-worth snapshots from YNAB transactions. */
  @UseGuards(AuthGuard('jwt'))
  @Get('net-worth-history')
  async getNetWorthHistory(
    @Req() req: any,
    @Query('householdId') householdId: string,
  ) {
    return this.ynab.getNetWorthHistory(req.user.id, householdId);
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @Get('categories')
  async getCategories(@Req() req: any) {
    return this.ynab.getYnabCategories(req.user.id);
  }

  // ── Category Mappings ──────────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @Get('mappings')
  async getMappings(@Query('householdId') householdId: string) {
    return this.ynab.getMappings(householdId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mappings')
  async upsertMapping(
    @Body()
    body: {
      householdId: string;
      ynabCategoryId: string;
      ynabCategoryName: string;
      localCategory: string;
      startAge?: number | null;
      endAge?: number | null;
    },
  ) {
    return this.ynab.upsertMapping(
      body.householdId,
      body.ynabCategoryId,
      body.ynabCategoryName,
      body.localCategory,
      body.startAge,
      body.endAge,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('mappings/:id')
  @HttpCode(204)
  async deleteMapping(@Param('id') id: string) {
    await this.ynab.deleteMapping(id);
  }

  // ── Sync ───────────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @Post('sync')
  async sync(@Req() req: any, @Body() body: { householdId: string }) {
    return this.ynab.sync(req.user.id, body.householdId);
  }
}
