import { Controller, Post, Get, Body, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MarketDataService } from './market-data.service';

@Controller('market-data')
@UseGuards(AuthGuard('jwt'))
export class MarketDataController {
  constructor(private service: MarketDataService) {}

  /**
   * GET /market-data/sources
   * List all return series stored in the DB with metadata and methodology notes.
   */
  @Get('sources')
  listSources() {
    return this.service.listSources();
  }

  /**
   * POST /market-data/fetch
   * Fetch a Yahoo Finance ticker and upsert annual returns into the DB.
   * Body: { ticker: string }
   *
   * Examples: { "ticker": "XIC.TO" }, { "ticker": "XBB.TO" }, { "ticker": "ZAG.TO" }
   */
  @Post('fetch')
  async fetchYahoo(@Body() body: { ticker: string }) {
    if (!body?.ticker) {
      throw new HttpException('ticker is required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.service.fetchAndStoreYahoo(body.ticker);
    } catch (err: any) {
      const msg: string = err.message ?? 'Failed to fetch ticker data';
      const status = msg.includes('rate-limited') || msg.includes('429')
        ? HttpStatus.TOO_MANY_REQUESTS
        : HttpStatus.BAD_GATEWAY;
      throw new HttpException(msg, status);
    }
  }

  /**
   * POST /market-data/fetch-boc
   * Fetch Bank of Canada Valet API data:
   *   - BOC_OVERNIGHT (policy rate → GIC proxy)
   *   - BOC_10Y_BOND  (10-year GoC yield → approximate bond total return)
   */
  @Post('fetch-boc')
  async fetchBoC() {
    try {
      return await this.service.fetchAndStoreBoc();
    } catch (err: any) {
      throw new HttpException(
        err.message ?? 'Failed to fetch Bank of Canada data',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * GET /market-data/assumptions
   * Return current capital market assumptions and CRA limits.
   */
  @Get('assumptions')
  getCurrentAssumptions() {
    return this.service.getCurrentAssumptions();
  }
}
