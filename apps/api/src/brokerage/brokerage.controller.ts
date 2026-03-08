import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BrokerageService, BrokerageProvider } from './brokerage.service';

@Controller('brokerage')
@UseGuards(AuthGuard('jwt'))
export class BrokerageController {
  constructor(private brokerage: BrokerageService) {}

  // ── All statuses ──────────────────────────────────────────────────────────

  @Get('status')
  getAllStatuses(@Req() req: any) {
    return this.brokerage.getAllStatuses(req.user.id);
  }

  // ── Per-provider endpoints ────────────────────────────────────────────────

  /**
   * Connect a brokerage.
   * body.token:
   *   - Questrade: The refresh token from Questrade API Access settings
   *   - Wealthsimple: A Bearer access token
   *   - TD: omit (no API token needed)
   */
  @Post(':provider/connect')
  @HttpCode(204)
  async connect(
    @Req() req: any,
    @Param('provider') provider: string,
    @Body() body: { token?: string },
  ) {
    await this.brokerage.connect(
      req.user.id,
      provider.toUpperCase() as BrokerageProvider,
      body.token,
    );
  }

  @Get(':provider/status')
  async getStatus(@Req() req: any, @Param('provider') provider: string) {
    return this.brokerage.getStatus(
      req.user.id,
      provider.toUpperCase() as BrokerageProvider,
    );
  }

  @Delete(':provider/disconnect')
  @HttpCode(204)
  async disconnect(@Req() req: any, @Param('provider') provider: string) {
    await this.brokerage.disconnect(
      req.user.id,
      provider.toUpperCase() as BrokerageProvider,
    );
  }

  /**
   * List accounts available at this brokerage for the authenticated user.
   * Returns an array of { id, name, type, balance, currency }.
   * Not supported for TD (no public API).
   */
  @Get(':provider/accounts')
  async getAccounts(@Req() req: any, @Param('provider') provider: string) {
    return this.brokerage.getAccounts(
      req.user.id,
      provider.toUpperCase() as BrokerageProvider,
    );
  }

  /**
   * Sync balances for all local accounts linked to this brokerage provider.
   */
  @Post(':provider/sync')
  async syncBalances(
    @Req() req: any,
    @Param('provider') provider: string,
    @Body() body: { householdId: string },
  ) {
    return this.brokerage.syncBalances(
      req.user.id,
      body.householdId,
      provider.toUpperCase() as BrokerageProvider,
    );
  }
}
