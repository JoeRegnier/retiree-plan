import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseOFX, OFXAccountData } from './ofx-parser';

// ── OFX / QFX types ───────────────────────────────────────────────────────────

export type OFXPreviewAccount = OFXAccountData & {
  matchedLocalAccount: { id: string; name: string } | null;
  action: 'create' | 'update';
};

export interface OFXPreviewResult {
  accounts: OFXPreviewAccount[];
}

export interface OFXApplyResult {
  created: number;
  updated: number;
}

export interface ApplyOFXAccount {
  accountId: string;
  localAccountType: string;
  balance: number;
  currency: string;
  description?: string;
  institution?: string;
  bankId?: string;
  /** ID of an existing local Account to update; null = create new */
  matchedLocalAccountId?: string | null;
  /** true = skip this account entirely */
  skip?: boolean;
}

// ── CSV / Monarch types ───────────────────────────────────────────────────────

export interface MonarchExpensePreview {
  category: string;
  monthlyAvg: number;
  annualAmount: number;
}

export interface MonarchPreviewResult {
  expenses: MonarchExpensePreview[];
  totalCategories: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ImportService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // Access control
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Verify the given userId is a member of the household.
   * Throws ForbiddenException if the household does not exist or the user is
   * not a member — indistinguishable on purpose to avoid enumeration.
   */
  async assertHouseholdOwnership(userId: string, householdId: string): Promise<void> {
    const row = await this.prisma.household.findFirst({
      where: { id: householdId, userId },
      select: { id: true },
    });
    if (!row) throw new ForbiddenException('You do not have access to this household');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OFX / QFX
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Parse an OFX/QFX buffer and return a preview without writing to the DB.
   * Attempts to match each parsed account against existing local accounts via
   * brokerageAccountId.
   */
  async previewOFX(householdId: string, buffer: Buffer): Promise<OFXPreviewResult> {
    let parsed: OFXAccountData[];
    try {
      parsed = parseOFX(buffer);
    } catch (err: any) {
      throw new BadRequestException(err.message ?? 'Failed to parse OFX/QFX file');
    }

    const existingAccounts = await this.prisma.account.findMany({ where: { householdId } });

    const accounts: OFXPreviewAccount[] = parsed.map((acc) => {
      const matched =
        existingAccounts.find((a) => a.brokerageAccountId === acc.accountId) ?? null;
      return {
        ...acc,
        matchedLocalAccount: matched ? { id: matched.id, name: matched.name } : null,
        action: (matched ? 'update' : 'create') as 'create' | 'update',
      };
    });

    return { accounts };
  }

  /**
   * Apply previewed OFX accounts to the database.
   * Updates existing matched accounts or creates new ones.
   */
  async applyOFX(
    householdId: string,
    accountsToImport: ApplyOFXAccount[],
  ): Promise<OFXApplyResult> {
    if (!accountsToImport.length) throw new BadRequestException('No accounts to import');

    let created = 0;
    let updated = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const acc of accountsToImport) {
        if (acc.skip) continue;

        const description = (acc.description ?? '').slice(0, 255);
        const accountId   = acc.accountId.slice(0, 100);
        const institution = (acc.institution ?? '').slice(0, 100);

        if (acc.matchedLocalAccountId) {
          await tx.account.update({
            where: { id: acc.matchedLocalAccountId },
            data: {
              balance: acc.balance,
              brokerageAccountId: accountId,
            },
          });
          updated++;
        } else {
          const name =
            description.trim() ||
            `${acc.localAccountType} ···${accountId.slice(-4)}`;

          await tx.account.create({
            data: {
              householdId,
              name:                 name.slice(0, 255),
              type:                 acc.localAccountType as any,
              balance:              acc.balance,
              currency:             (acc.currency || 'CAD').slice(0, 10),
              annualContribution:   0,
              brokerageAccountId:   accountId,
              brokerageProvider:    institution.toUpperCase() || null,
              brokerageAccountName: description || null,
            },
          });
          created++;
        }
      }
    });

    return { created, updated };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Wealthsimple Activity CSV
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Parse a Wealthsimple Activity CSV export.
   *
   * Expected header (flexible column order):
   *   Activity Date, Type, Symbol, Quantity, Price, [Commission|Market Price],
   *   Currency, Account, Net Amount, …
   *
   * Strategy:
   *  1. Uses "EOD Balance" or "Balance" rows to determine account balances.
   *     Currently requires explicit balance rows; no fallback to a running
   *     sum of Net Amount is implemented.
   */
  async previewWealthsimpleCSV(householdId: string, buffer: Buffer): Promise<OFXPreviewResult> {
    const parsed = this._parseWealthsimpleCSV(buffer);
    const existingAccounts = await this.prisma.account.findMany({ where: { householdId } });

    const accounts: OFXPreviewAccount[] = parsed.map(({ accountId, accountType, localAccountType, balance, currency, description, institution }) => {
      const accountName = accountId;
      const matched =
        existingAccounts.find(
          (a) =>
            a.brokerageProvider === 'WEALTHSIMPLE' &&
            (a.brokerageAccountName?.toLowerCase() === accountName.toLowerCase() ||
              a.name.toLowerCase().includes(accountName.toLowerCase())),
        ) ?? null;

      return {
        accountId,
        accountType,
        localAccountType,
        balance,
        currency,
        description,
        institution,
        matchedLocalAccount: matched ? { id: matched.id, name: matched.name } : null,
        action: (matched ? 'update' : 'create') as 'create' | 'update',
      };
    });

    return { accounts };
  }

  /**
   * Pure parsing helper for Wealthsimple Activity CSV — no DB access.
   * Exposed with a _ prefix so unit tests can call it directly.
   */
  _parseWealthsimpleCSV(buffer: Buffer): Array<{
    accountId: string;
    accountType: string;
    localAccountType: string;
    balance: number;
    currency: string;
    description: string;
    institution: string;
  }> {
    const lines = buffer
      .toString('utf-8')
      .replace(/\r/g, '')
      .split('\n')
      .filter(Boolean);

    if (lines.length < 2) {
      throw new BadRequestException(
        'Wealthsimple CSV must contain a header row and at least one data row',
      );
    }

    const headers = this.parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

    const col = (names: string[]): number =>
      names.map((n) => headers.indexOf(n.toLowerCase())).find((i) => i !== -1) ?? -1;

    const idxDate    = col(['activity date', 'date']);
    const idxType    = col(['type']);
    const idxAmount  = col(['net amount', 'amount', 'credit', 'debit']);
    const idxAccount = col(['account']);
    const idxCurr    = col(['currency']);

    if (idxAccount === -1) {
      throw new BadRequestException(
        'Wealthsimple CSV is missing an "Account" column. ' +
        'Download the Activity export from the Wealthsimple web app (Activity tab → Export).',
      );
    }

    // Attempt 1: find explicit balance rows
    const balanceRows = new Map<string, { balance: number; date: string; currency: string }>();
    const runningSum  = new Map<string, { balance: number; currency: string }>();

    for (const line of lines.slice(1)) {
      const cols     = this.parseCSVLine(line);
      const account  = (cols[idxAccount] ?? '').trim();
      if (!account) continue;

      const type     = idxType !== -1 ? (cols[idxType] ?? '').toLowerCase().trim() : '';
      const amountRaw = idxAmount !== -1 ? (cols[idxAmount] ?? '').replace(/[$,\s]/g, '') : '0';
      const amount   = parseFloat(amountRaw) || 0;
      const date     = idxDate !== -1 ? (cols[idxDate] ?? '').trim() : '';
      const currency = idxCurr !== -1 ? (cols[idxCurr] ?? 'CAD').trim().toUpperCase() : 'CAD';

      if (type === 'balance' || type === 'eod balance' || type === 'closing balance') {
        const prev = balanceRows.get(account);
        // M6: use numeric timestamp comparison instead of string comparison
        if (!prev || new Date(date).getTime() > new Date(prev.date).getTime()) {
          balanceRows.set(account, { balance: amount, date, currency });
        }
      }

      // Always track running sum as fallback — but WS running sum is NOT reliable
      // (dividends, fees, FX conversions distort the net) so we do NOT use it as a
      // final balance source.  Only used to detect non-empty files.
      const prev = runningSum.get(account);
      if (!prev) {
        runningSum.set(account, { balance: amount, currency });
      } else {
        prev.balance += amount;
      }
    }

    // M4: require explicit balance rows — running-sum semantics are incorrect for
    // multi-currency / mixed-activity exports.
    if (balanceRows.size === 0) {
      throw new BadRequestException(
        'No balance rows found in the Wealthsimple CSV. ' +
        'Ensure the export includes "EOD Balance" or "Balance" rows. ' +
        'Download the Activity export from the Wealthsimple web app (Activity tab → Export).',
      );
    }

    const sourceMap = balanceRows;

    if (sourceMap.size === 0) {
      throw new BadRequestException('No accounts found in Wealthsimple CSV');
    }

    return Array.from(sourceMap.entries()).map(([accountName, { balance, currency }]) => {
      const upper = accountName.toUpperCase();
      let localAccountType = 'NON_REGISTERED';
      let accountType      = 'NON_REGISTERED';
      if (upper.includes('RRSP'))      { localAccountType = 'RRSP';  accountType = 'RRSP'; }
      else if (upper.includes('TFSA')) { localAccountType = 'TFSA';  accountType = 'TFSA'; }
      else if (upper.includes('RRIF')) { localAccountType = 'RRIF';  accountType = 'RRIF'; }
      else if (upper.includes('RESP')) { localAccountType = 'RESP';  accountType = 'RESP'; }
      else if (upper.includes('LIRA')) { localAccountType = 'LIRA';  accountType = 'LIRA'; }
      else if (upper.includes('CASH')) { localAccountType = 'CASH';  accountType = 'CASH'; }

      return {
        accountId:       accountName.slice(0, 255),
        accountType,
        localAccountType,
        balance:         Math.max(0, balance),
        currency:        (currency || 'CAD').slice(0, 10),
        description:     accountName.slice(0, 255),
        institution:     'WEALTHSIMPLE',
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Monarch Money Transaction CSV
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Parse a Monarch Money transaction CSV export and derive annual expense
   * estimates per category from the transaction history.
   *
   * Delegates to _parseMonarchCSV for pure parsing.
   */
  async previewMonarchCSV(householdId: string, buffer: Buffer): Promise<MonarchPreviewResult> {
    return this._parseMonarchCSV(buffer);
  }

  /**
   * Pure parsing helper for Monarch Money CSV — no DB access.
   * Exposed with a _ prefix so unit tests can call it directly.
   */
  _parseMonarchCSV(buffer: Buffer): MonarchPreviewResult {
    const lines = buffer
      .toString('utf-8')
      .replace(/\r/g, '')
      .split('\n')
      .filter(Boolean);

    if (lines.length < 2) {
      throw new BadRequestException(
        'Monarch Money CSV must contain a header row and at least one data row',
      );
    }

    const headers = this.parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
    const col = (names: string[]): number =>
      names.map((n) => headers.indexOf(n)).find((i) => i !== -1) ?? -1;

    const idxDate     = col(['date']);
    const idxCategory = col(['category']);
    const idxAmount   = col(['amount']);

    if (idxDate === -1 || idxCategory === -1 || idxAmount === -1) {
      throw new BadRequestException(
        'Monarch Money CSV is missing required columns (Date, Category, Amount). ' +
        'Export from Settings → Export Data in the Monarch Money web app.',
      );
    }

    interface CatEntry {
      totalAbsAmount: number;
      months: Set<string>;
    }
    const catMap = new Map<string, CatEntry>();

    for (const line of lines.slice(1)) {
      const cols     = this.parseCSVLine(line);
      const date     = (cols[idxDate] ?? '').trim();
      const category = (cols[idxCategory] ?? 'Other').trim() || 'Other';
      const raw      = (cols[idxAmount] ?? '0').replace(/[$,\s]/g, '');
      const amount   = parseFloat(raw) || 0;

      // Monarch Money: expenses are negative values
      if (amount >= 0) continue;

      const monthKey = date.slice(0, 7); // YYYY-MM
      const prev = catMap.get(category) ?? { totalAbsAmount: 0, months: new Set<string>() };
      prev.totalAbsAmount += Math.abs(amount);
      prev.months.add(monthKey);
      catMap.set(category, prev);
    }

    if (catMap.size === 0) {
      throw new BadRequestException(
        'No expense transactions found in the Monarch Money CSV. ' +
        'Ensure you are exporting a transaction history file (not an account summary).',
      );
    }

    const expenses: MonarchExpensePreview[] = Array.from(catMap.entries())
      .filter(([, v]) => v.totalAbsAmount > 0 && v.months.size > 0)
      .map(([category, { totalAbsAmount, months }]) => {
        const monthlyAvg  = totalAbsAmount / months.size;
        const annualAmount = Math.round(monthlyAvg * 12);
        return { category, monthlyAvg: Math.round(monthlyAvg), annualAmount };
      })
      .sort((a, b) => b.annualAmount - a.annualAmount);

    return { expenses, totalCategories: expenses.length };
  }

  /**
   * Persist Monarch Money expense category averages as Expense rows.
   */
  async applyMonarchCSV(
    householdId: string,
    expenses: Array<{ category: string; annualAmount: number }>,
  ): Promise<{ created: number; updated: number }> {
    if (!expenses.length) throw new BadRequestException('No expenses to import');

    let created = 0;
    let updated = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const e of expenses) {
        const name     = e.category.slice(0, 255);
        const category = this.mapMonarchCategory(e.category);

        // M3: upsert to prevent duplicate rows on re-import
        const result = await tx.expense.upsert({
          where:  { householdId_name: { householdId, name } },
          update: { annualAmount: e.annualAmount, category },
          create: {
            householdId,
            name,
            category,
            annualAmount:     e.annualAmount,
            indexToInflation: true,
          },
        });
        // Determine whether this was a create or an update by checking existence
        // before the upsert (Prisma upsert doesn't expose which branch executed).
        const existing = await tx.expense.findUnique({
          where: { householdId_name: { householdId, name } },
          select: { id: true },
        });
        if (existing) {
          updated++;
        } else {
          created++;
        }
        void result;
      }
    });
    return { created, updated };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * RFC 4180-compliant CSV line parser that handles quoted fields containing commas.
   */
  parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let cur       = '';
    let inQuotes  = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped double-quote inside quoted field
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }

  private mapMonarchCategory(raw: string): string {
    const lower = raw.toLowerCase();
    if (/food|restaurant|dining|groceri/i.test(lower)) return 'Food & Dining';
    if (/housing|rent|mortgage/i.test(lower))           return 'Housing';
    if (/transport|gas|parking|auto|car/i.test(lower))  return 'Transportation';
    if (/health|medical|dental|pharma/i.test(lower))    return 'Healthcare';
    if (/entertain|stream|subscription/i.test(lower))   return 'Entertainment';
    if (/travel|hotel|flight|vacation/i.test(lower))    return 'Travel';
    if (/shop|cloth|apparel/i.test(lower))              return 'Shopping';
    if (/util|internet|phone|cable/i.test(lower))       return 'Utilities';
    if (/educat|tuition|school/i.test(lower))           return 'Education';
    if (/personal|hair|beauty|wellness/i.test(lower))   return 'Personal Care';
    if (/pet|vet/i.test(lower))                         return 'Pets';
    if (/gift|charity|donat/i.test(lower))              return 'Gifts & Charity';
    // L4: strip leading CSV injection characters before storing the raw value
    return raw.replace(/^[=+\-@\t\r]+/, '').slice(0, 255);
  }
}
