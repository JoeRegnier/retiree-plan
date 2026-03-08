import { Injectable, Logger } from '@nestjs/common';
import YahooFinance from 'yahoo-finance2';
import { PrismaService } from '../prisma/prisma.service';

export interface AnnualReturn {
  year: number;
  returnRate: number;
}

export interface SeriesInfo {
  asset: string;
  ticker: string;
  source: string;
  count: number;
  yearFrom: number;
  yearTo: number;
  meanReturn: number;
  fetchedAt: string | null;
  methodology: string;
}

/**
 * MarketDataService
 *
 * DATA SOURCES & METHODOLOGY
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Yahoo Finance (unofficial v8 JSON chart API)
 *    - Provides adjusted-close monthly prices for any ticker
 *    - Annual return = (Dec_AdjClose_Y / Dec_AdjClose_{Y-1}) – 1
 *    - Adjusted close accounts for dividends and stock splits, making it a
 *      proxy for total return (price + income reinvested)
 *    - Start date limited by ETF inception (e.g. XIC.TO ≈ 2001, XBB.TO ≈ 2000)
 *    - Yahoo Finance is an unofficial, unguaranteed data source and may change
 *      without notice. Returns should be validated against fund fact sheets.
 *
 * 2. Bank of Canada Valet API (https://www.bankofcanada.ca/valet/docs/)
 *    - Official public API, free, no authentication required
 *    - V122514: Bank of Canada Overnight Target Rate (since 1994-02)
 *      Used as GIC / cash equivalent proxy — actual GIC rates track overnight
 *      closely with a 30–100 bp premium depending on term
 *    - BD.CDN.10YR.DQ.YLD: GoC 10-year benchmark bond yield (daily, since 2001-01-02)
 *      Replaces the retired V39056 series.
 *      Annual observations averaged to get the year-end yield.
 *      Bond total return approximation:
 *        TR ≈ avg_yield − 8 × (yield_end − yield_start)
 *      where 8 is the approximate modified duration of the Canada Universe
 *      Bond Index. This is an approximation; for accurate data use XBB.TO.
 *
 * 3. Fallback seed data (asset = 'TSX', 'CA_BOND', 'GIC')
 *    - Hardcoded 1970–2024 series used when no market-data-fetched series is
 *      available for a given year range. Values are manually curated from
 *      academic and industry sources and are approximate.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });

  constructor(private prisma: PrismaService) {}

  // ─── Yahoo Finance ─────────────────────────────────────────────────────────

  /**
   * Fetch monthly adjusted-close prices via yahoo-finance2, then compute
   * calendar-year total returns.  yahoo-finance2 handles session auth internally.
   *
   * @param ticker  Yahoo Finance ticker symbol (e.g. 'XIC.TO', 'XBB.TO')
   * @param years   Number of years of history to request (default 30)
   */
  async fetchYahooAnnualReturns(ticker: string, years = 30): Promise<AnnualReturn[]> {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - years - 1);

    this.logger.log(`Fetching Yahoo Finance via yahoo-finance2: ${ticker} (${years}y)`);

    const result = await this.yf.chart(ticker, {
      period1: period1.toISOString().slice(0, 10),
      interval: '1mo',
    });

    const quotes = result?.quotes ?? [];
    if (quotes.length === 0) {
      throw new Error(`No data returned from Yahoo Finance for "${ticker}"`);
    }

    // Find the last adjclose for each calendar year (overwrite each month => December close)
    const yearEndClose = new Map<number, number>();
    for (const q of quotes) {
      const price = q.adjclose;
      if (price == null || isNaN(price)) continue;
      const year = new Date(q.date).getFullYear();
      yearEndClose.set(year, price);
    }

    // Compute year-over-year returns
    const sortedYears = [...yearEndClose.keys()].sort((a, b) => a - b);
    const returns: AnnualReturn[] = [];
    for (let i = 1; i < sortedYears.length; i++) {
      const prev = yearEndClose.get(sortedYears[i - 1])!;
      const curr = yearEndClose.get(sortedYears[i])!;
      if (prev <= 0) continue;
      returns.push({
        year: sortedYears[i],
        returnRate: parseFloat(((curr / prev) - 1).toFixed(4)),
      });
    }
    return returns;
  }

  // ─── Bank of Canada Valet ──────────────────────────────────────────────────

  /**
   * Fetch Bank of Canada overnight target rate (series V122514).
   * Returns annual averages of the daily/monthly policy rate.
   * Used as a GIC / cash / short-term proxy.
   *
   * Note: actual GIC rates typically run 0.3–1.0% above overnight rate.
   */
  async fetchBoCOvernightRate(): Promise<AnnualReturn[]> {
    const url =
      'https://www.bankofcanada.ca/valet/observations/V122514/json' +
      '?start_date=1990-01-01&order_dir=asc';

    this.logger.log(`Fetching BoC overnight rate: ${url}`);
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`BoC Valet request failed: ${resp.status}`);

    const json: any = await resp.json();
    const observations: { d: string; V122514: { v: string } }[] = json.observations ?? [];

    // Average observations by year → as decimal (e.g. 5.0% → 0.05)
    const yearSums = new Map<number, { sum: number; count: number }>();
    for (const obs of observations) {
      const rate = parseFloat(obs.V122514?.v ?? 'NaN');
      if (isNaN(rate)) continue;
      const year = parseInt(obs.d.slice(0, 4));
      const existing = yearSums.get(year);
      if (existing) { existing.sum += rate; existing.count++; }
      else yearSums.set(year, { sum: rate, count: 1 });
    }

    return [...yearSums.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, { sum, count }]) => ({
        year,
        returnRate: parseFloat((sum / count / 100).toFixed(4)), // percent → decimal
      }));
  }

  /**
   * Fetch GoC 10-year benchmark bond yield (series V39056) from BoC Valet.
   * Converts year-end yield to approximate total return using modified duration:
   *
   *   total_return ≈ avg_yield_t − D_mod × (yield_end_t − yield_end_{t-1})
   *
   * where D_mod ≈ 8 years (canonical duration for FTSE Canada Universe Bond).
   * This is an approximation suitable for planning purposes.
   */
  async fetchBoCBondApproximation(): Promise<AnnualReturn[]> {
    const SERIES = 'BD.CDN.10YR.DQ.YLD';
    const url =
      `https://www.bankofcanada.ca/valet/observations/${SERIES}/json` +
      '?start_date=2001-01-01&order_dir=asc';

    this.logger.log(`Fetching BoC 10-year yield: ${url}`);
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`BoC Valet (${SERIES}) failed: ${resp.status}`);

    const json: any = await resp.json();
    const observations: { d: string; [key: string]: any }[] = json.observations ?? [];

    // Compute year-average and year-end yields
    const yearData = new Map<number, { sum: number; count: number; last: number }>();
    for (const obs of observations) {
      const rate = parseFloat(obs[SERIES]?.v ?? 'NaN');
      if (isNaN(rate)) continue;
      const year = parseInt(obs.d.slice(0, 4));
      const existing = yearData.get(year);
      if (existing) { existing.sum += rate; existing.count++; existing.last = rate; }
      else yearData.set(year, { sum: rate, count: 1, last: rate });
    }

    const sortedYears = [...yearData.keys()].sort((a, b) => a - b);
    const DURATION = 8; // approximate modified duration of universe bond index
    const returns: AnnualReturn[] = [];

    for (let i = 1; i < sortedYears.length; i++) {
      const yr = sortedYears[i];
      const prev = yearData.get(sortedYears[i - 1])!;
      const curr = yearData.get(yr)!;
      const avgYield = (curr.sum / curr.count) / 100; // percent → decimal
      const yieldChange = (curr.last - prev.last) / 100;
      const totalReturn = avgYield - DURATION * yieldChange;
      returns.push({
        year: yr,
        returnRate: parseFloat(totalReturn.toFixed(4)),
      });
    }
    return returns;
  }

  // ─── Storage ───────────────────────────────────────────────────────────────

  /**
   * Fetch a Yahoo Finance ticker and upsert all annual returns into the DB.
   * asset = ticker symbol (stored as-is, e.g. 'XIC.TO').
   */
  async fetchAndStoreYahoo(ticker: string): Promise<{
    ticker: string;
    asset: string;
    count: number;
    yearFrom: number;
    yearTo: number;
    methodology: string;
  }> {
    const returns = await this.fetchYahooAnnualReturns(ticker.toUpperCase());
    if (!returns.length) throw new Error(`No annual returns computed for "${ticker}"`);

    const asset = ticker.toUpperCase();
    const now = new Date();

    // Upsert each year (update if already exists, create if not)
    await Promise.all(
      returns.map((r) =>
        this.prisma.historicalReturn.upsert({
          where: { year_asset: { year: r.year, asset } },
          update: { returnRate: r.returnRate, source: 'YAHOO', ticker: asset, fetchedAt: now },
          create: { year: r.year, asset, returnRate: r.returnRate, source: 'YAHOO', ticker: asset, fetchedAt: now },
        }),
      ),
    );

    const years = returns.map((r) => r.year);
    return {
      ticker: asset,
      asset,
      count: returns.length,
      yearFrom: Math.min(...years),
      yearTo: Math.max(...years),
      methodology:
        'Yahoo Finance adjusted-close monthly prices; annual return = (Dec close Y / Dec close Y-1) - 1. ' +
        'Adjusted close incorporates dividends and splits (total return proxy). Data is unofficial.',
    };
  }

  /**
   * Fetch Bank of Canada data and upsert:
   * - 'BOC_OVERNIGHT' — annual average overnight rate (GIC proxy)
   * - 'BOC_10Y_BOND'  — approximate bond total return from 10-year GoC yields
   */
  async fetchAndStoreBoc(): Promise<{
    series: Array<{ asset: string; count: number; yearFrom: number; yearTo: number }>;
    methodology: string;
  }> {
    const now = new Date();
    const results: Array<{ asset: string; count: number; yearFrom: number; yearTo: number }> = [];

    // Overnight rate
    const overnight = await this.fetchBoCOvernightRate();
    if (overnight.length) {
      await Promise.all(
        overnight.map((r) =>
          this.prisma.historicalReturn.upsert({
            where: { year_asset: { year: r.year, asset: 'BOC_OVERNIGHT' } },
            update: { returnRate: r.returnRate, source: 'BOC', ticker: 'V122514', fetchedAt: now },
            create: { year: r.year, asset: 'BOC_OVERNIGHT', returnRate: r.returnRate, source: 'BOC', ticker: 'V122514', fetchedAt: now },
          }),
        ),
      );
      const yrs = overnight.map((r) => r.year);
      results.push({ asset: 'BOC_OVERNIGHT', count: overnight.length, yearFrom: Math.min(...yrs), yearTo: Math.max(...yrs) });
    }

    // 10-year bond approximation
    const bond = await this.fetchBoCBondApproximation();
    if (bond.length) {
      await Promise.all(
        bond.map((r) =>
          this.prisma.historicalReturn.upsert({
            where: { year_asset: { year: r.year, asset: 'BOC_10Y_BOND' } },
            update: { returnRate: r.returnRate, source: 'BOC', ticker: 'BD.CDN.10YR.DQ.YLD', fetchedAt: now },
            create: { year: r.year, asset: 'BOC_10Y_BOND', returnRate: r.returnRate, source: 'BOC', ticker: 'BD.CDN.10YR.DQ.YLD', fetchedAt: now },
          }),
        ),
      );
      const yrs = bond.map((r) => r.year);
      results.push({ asset: 'BOC_10Y_BOND', count: bond.length, yearFrom: Math.min(...yrs), yearTo: Math.max(...yrs) });
    }

    return {
      series: results,
      methodology:
        'Bank of Canada Valet API (official). ' +
        'BOC_OVERNIGHT: annual average of policy overnight rate (series V122514); GIC proxy (actual GIC rates +30–100bp). ' +
        'BOC_10Y_BOND: approximate bond total return from 10-year GOC yield (series BD.CDN.10YR.DQ.YLD, daily since 2001) ' +
        'using modified-duration approximation TR ≈ avg_yield − 8 × Δyield.',
    };
  }

  // ─── Query ─────────────────────────────────────────────────────────────────

  /**
   * List all distinct series currently stored in the DB with summary statistics.
   */
  async listSources(): Promise<SeriesInfo[]> {
    const rows = await this.prisma.historicalReturn.findMany({
      orderBy: [{ asset: 'asc' }, { year: 'asc' }],
    });

    const byAsset = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!byAsset.has(row.asset)) byAsset.set(row.asset, []);
      byAsset.get(row.asset)!.push(row);
    }

    const methodologyMap: Record<string, string> = {
      TSX: 'Manually curated S&P/TSX Composite total return approximation 1970–2024. Academic reconstruction for pre-1990; subsequent years from industry data.',
      CA_BOND: 'Manually curated FTSE Canada Universe Bond Index total return approximation 1970–2024.',
      GIC: 'Manually curated average chartered-bank 1-year GIC deposit rate 1970–2024.',
      BOC_OVERNIGHT: 'Bank of Canada Valet API (V122514) — annual average overnight target rate. GIC proxy; actual GIC rates +30–100bp.',
      BOC_10Y_BOND: 'Bank of Canada Valet API (V39056) — GOC 10-year yield converted to approximate total return via modified-duration (D≈8).',
    };

    return [...byAsset.entries()].map(([asset, data]) => {
      const rates = data.map((r) => r.returnRate);
      const mean = rates.reduce((s, r) => s + r, 0) / rates.length;
      const years = data.map((r) => r.year);
      return {
        asset,
        ticker: data[0].ticker,
        source: data[0].source,
        count: data.length,
        yearFrom: Math.min(...years),
        yearTo: Math.max(...years),
        meanReturn: parseFloat(mean.toFixed(4)),
        fetchedAt: data[data.length - 1].fetchedAt?.toISOString() ?? null,
        methodology:
          methodologyMap[asset] ??
          `Yahoo Finance adjusted-close total return proxy for ${asset}. Annual return = (Dec close Y / Dec close Y-1) - 1.`,
      };
    });
  }

  /**
   * Fetch annual returns for a given asset from the DB.
   * If the DB has no rows for that asset, returns an empty array
   * allowing the caller to fall back to seeded data.
   */
  async getStoredReturns(asset: string): Promise<AnnualReturn[]> {
    const rows = await this.prisma.historicalReturn.findMany({
      where: { asset },
      orderBy: { year: 'asc' },
    });
    return rows.map((r) => ({ year: r.year, returnRate: r.returnRate }));
  }

  getCurrentAssumptions() {
    return {
      equity: { expectedReturn: 0.07, label: 'Canadian Equity (TSX Composite)' },
      fixedIncome: { expectedReturn: 0.035, label: '10-Year GoC Bond' },
      alternatives: { expectedReturn: 0.055, label: 'Real Estate / REITs' },
      cash: { expectedReturn: 0.025, label: 'HISA / GIC (1-Year)' },
      inflation: 0.02,
      tfsaAnnualLimit: 7_000,
      rrspMaxContribution: 31_560,
      cppMaxMonthlyAt65: 1_364.60,
      oasMaxMonthly: 713.34,
      oasClawbackThreshold: 90_997,
      federalBasicPersonalAmount: 15_705,
      lastUpdated: '2026-01-01',
    };
  }
}
