import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { encryptToken, decryptToken } from '../crypto/token-cipher';

const YNAB_API = 'https://api.youneedabudget.com/v1';

@Injectable()
export class YnabService {
  private readonly logger = new Logger(YnabService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // ── Personal Access Token ─────────────────────────────────────────────────

  /**
   * Store (or update) the user's YNAB Personal Access Token.
   * Users generate this token in YNAB → Account Settings → Developer Settings.
   * The token is stored server-side so it never needs to leave the backend
   * after being submitted once.
   */
  async saveToken(userId: string, token: string): Promise<void> {
    const encrypted = encryptToken(token);
    await this.prisma.ynabConnection.upsert({
      where: { userId },
      create: { userId, accessToken: encrypted, refreshToken: null },
      update: { accessToken: encrypted },
    });
    this.logger.log(`YNAB token saved (encrypted) for user ${userId}`);
  }

  /** Return current connection status for a user. */
  async getStatus(userId: string) {
    const conn = await this.prisma.ynabConnection.findUnique({ where: { userId } });
    if (!conn) return { connected: false };
    return {
      connected: true,
      budgetId: conn.budgetId,
      budgetName: conn.budgetName,
      lastSyncedAt: conn.lastSyncedAt,
    };
  }

  /** Disconnect YNAB — delete stored tokens. */
  async disconnect(userId: string) {
    await this.prisma.ynabConnection.deleteMany({ where: { userId } });
  }

  // ── YNAB API helpers ───────────────────────────────────────────────────────

  private async ynabGet<T>(userId: string, path: string): Promise<T> {
    const conn = await this.requireConnection(userId);
    const bearerToken = decryptToken(conn.accessToken);
    const resp = await fetch(`${YNAB_API}${path}`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (!resp.ok) {
      const text = await resp.text();
      this.logger.error(`YNAB API error ${resp.status}: ${text}`);
      throw new Error(`YNAB API error: ${resp.status}`);
    }
    return resp.json() as Promise<T>;
  }

  private async requireConnection(userId: string) {
    const conn = await this.prisma.ynabConnection.findUnique({ where: { userId } });
    if (!conn) throw new NotFoundException('YNAB account not connected');
    return conn;
  }

  // ── Budgets ────────────────────────────────────────────────────────────────

  async getBudgets(userId: string) {
    const data = await this.ynabGet<{ data: { budgets: any[] } }>(userId, '/budgets');
    return data.data.budgets.map((b) => ({ id: b.id, name: b.name, currencyFormat: b.currency_format }));
  }

  async selectBudget(userId: string, budgetId: string) {
    const budgets = await this.getBudgets(userId);
    const budget = budgets.find((b) => b.id === budgetId);
    if (!budget) throw new NotFoundException('Budget not found');
    await this.prisma.ynabConnection.update({
      where: { userId },
      data: { budgetId, budgetName: budget.name },
    });
    return budget;
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  async getYnabCategories(userId: string) {
    const conn = await this.requireConnection(userId);
    if (!conn.budgetId) throw new NotFoundException('No budget selected');
    const data = await this.ynabGet<{ data: { category_groups: any[] } }>(
      userId,
      `/budgets/${conn.budgetId}/categories`,
    );
    // Flatten groups → categories
    return data.data.category_groups.flatMap((g) =>
      (g.categories ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        groupName: g.name,
        budgeted: c.budgeted / 1000, // YNAB stores milliunits
        activity: c.activity / 1000,
      })),
    );
  }

  // ── Accounts ───────────────────────────────────────────────────────────────

  async getYnabAccounts(userId: string) {
    const conn = await this.requireConnection(userId);
    if (!conn.budgetId) throw new NotFoundException('No budget selected');
    const data = await this.ynabGet<{ data: { accounts: any[] } }>(
      userId,
      `/budgets/${conn.budgetId}/accounts`,
    );
    return data.data.accounts
      .filter((a: any) => !a.deleted && !a.closed)
      .map((a: any) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: a.balance / 1000, // milliunits → dollars
        onBudget: a.on_budget,
      }));
  }

  // ── Historical Net Worth ───────────────────────────────────────────────────

  /**
   * Reconstruct monthly net worth snapshots for all YNAB-linked local accounts
   * by fetching ALL transactions (no since_date) and walking forward from the
   * opening balance. Returns one entry per month from earliest transaction to today.
   */
  async getNetWorthHistory(userId: string, householdId: string) {
    const conn = await this.requireConnection(userId);
    if (!conn.budgetId) throw new NotFoundException('No budget selected');

    // Find all local accounts that are linked to a YNAB account
    const linkedAccounts = await this.prisma.account.findMany({
      where: { householdId, ynabAccountId: { not: null } },
    });
    if (linkedAccounts.length === 0) return [];

    // For each linked account, fetch ALL transactions and reconstruct monthly balances
    const monthlyTotals = new Map<string, number>(); // key = 'YYYY-MM'

    for (const localAcc of linkedAccounts) {
      const data = await this.ynabGet<{ data: { transactions: any[]; account?: any } }>(
        userId,
        `/budgets/${conn.budgetId}/accounts/${localAcc.ynabAccountId}/transactions`,
      );

      const txs: any[] = (data.data.transactions ?? []).filter((t: any) => !t.deleted);

      if (txs.length === 0) continue;

      // Sort ascending by date
      txs.sort((a, b) => a.date.localeCompare(b.date));

      // Opening balance = current balance minus the sum of all transaction amounts
      const currentBalance = localAcc.balance; // already in dollars
      const txSum = txs.reduce((s: number, t: any) => s + t.amount, 0) / 1000;
      let runningBalance = currentBalance - txSum;

      // Group transactions by month
      const byMonth = new Map<string, number>();
      for (const tx of txs) {
        const monthKey = tx.date.slice(0, 7); // 'YYYY-MM'
        byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + tx.amount / 1000);
      }

      // Walk through every month from first to last and emit end-of-month balance
      const sortedMonths = Array.from(byMonth.keys()).sort();
      const firstMonth = sortedMonths[0];
      const today = new Date();
      const lastMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

      let cursor = firstMonth;
      while (cursor <= lastMonthKey) {
        runningBalance += byMonth.get(cursor) ?? 0;
        monthlyTotals.set(cursor, (monthlyTotals.get(cursor) ?? 0) + runningBalance);
        // Advance one month
        const [y, m] = cursor.split('-').map(Number);
        const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
        cursor = next;
      }
    }

    // Convert to sorted array of snapshots
    return Array.from(monthlyTotals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, netWorth]) => {
        const [year, month] = monthKey.split('-').map(Number);
        return { year, month, monthKey, netWorth: Math.round(netWorth * 100) / 100 };
      });
  }

  // ── Category Mappings ──────────────────────────────────────────────────────

  async getMappings(householdId: string) {
    return this.prisma.ynabCategoryMapping.findMany({ where: { householdId } });
  }

  async upsertMapping(
    householdId: string,
    ynabCategoryId: string,
    ynabCategoryName: string,
    localCategory: string,
    startAge?: number | null,
    endAge?: number | null,
  ) {
    return this.prisma.ynabCategoryMapping.upsert({
      where: { householdId_ynabCategoryId: { householdId, ynabCategoryId } },
      create: { householdId, ynabCategoryId, ynabCategoryName, localCategory, startAge, endAge },
      update: { localCategory, ynabCategoryName, startAge, endAge },
    });
  }

  async deleteMapping(id: string) {
    await this.prisma.ynabCategoryMapping.delete({ where: { id } });
  }

  // ── Sync ───────────────────────────────────────────────────────────────────

  /**
   * Sync YNAB transactions to expenses.
   * Groups transactions by YNAB category, applies mappings, then
   * upserts an Expense row for the household for each mapped category.
   */
  async sync(userId: string, householdId: string): Promise<{ synced: number; skipped: number }> {
    const conn = await this.requireConnection(userId);
    if (!conn.budgetId) throw new NotFoundException('No budget selected — choose a budget first');

    // Fetch the current month's budgeted amounts per category (monthly, in dollars)
    const categoriesData = await this.ynabGet<{ data: { category_groups: any[] } }>(
      userId,
      `/budgets/${conn.budgetId}/categories`,
    );
    const budgetedByCategory = new Map<string, { name: string; monthly: number }>();
    for (const group of categoriesData.data.category_groups ?? []) {
      for (const cat of group.categories ?? []) {
        budgetedByCategory.set(cat.id, { name: cat.name, monthly: cat.budgeted / 1000 });
      }
    }

    const mappings = await this.getMappings(householdId);
    // Keyed by ynabCategoryId for fast lookup — preserves full mapping (including age range)
    const mappingMap = new Map(mappings.map((m) => [m.ynabCategoryId, m]));

    let synced = 0;
    let skipped = 0;

    // Build the rows to insert for all mapped categories
    const rows: Array<{
      id: string; name: string; category: string; annualAmount: number;
      householdId: string; startAge?: number; endAge?: number;
    }> = [];

    for (const [categoryId, { name, monthly }] of budgetedByCategory) {
      const mapping = mappingMap.get(categoryId);
      const localCategory = mapping?.localCategory;
      if (!localCategory) { skipped++; continue; }

      rows.push({
        id: `ynab-${householdId}-${categoryId}`,
        name: `YNAB: ${name}`,
        category: localCategory,
        annualAmount: monthly * 12,
        householdId,
        ...(mapping?.startAge != null ? { startAge: mapping.startAge } : {}),
        ...(mapping?.endAge   != null ? { endAge:   mapping.endAge   } : {}),
      });
      synced++;
    }

    // Wipe all previous YNAB-synced expenses for this household, then repopulate cleanly.
    // Wrapped in a transaction to prevent a unique-constraint race condition when two
    // concurrent sync requests delete-then-insert the same set of IDs.
    await this.prisma.$transaction(async (tx) => {
      await tx.expense.deleteMany({
        where: { householdId, id: { startsWith: `ynab-${householdId}-` } },
      });
      if (rows.length > 0) {
        await tx.expense.createMany({ data: rows });
      }
    });

    await this.prisma.ynabConnection.update({
      where: { userId },
      data: { lastSyncedAt: new Date() },
    });

    // ── Sync linked account balances ──────────────────────────────────────────
    const linkedAccounts = await this.prisma.account.findMany({
      where: { householdId, ynabAccountId: { not: null } },
    });
    if (linkedAccounts.length > 0) {
      const ynabAccounts = await this.getYnabAccounts(userId);
      const ynabMap = new Map(ynabAccounts.map((a) => [a.id, a]));
      for (const localAcc of linkedAccounts) {
        const ynabAcc = ynabMap.get(localAcc.ynabAccountId!);
        if (ynabAcc) {
          await this.prisma.account.update({
            where: { id: localAcc.id },
            data: { balance: ynabAcc.balance, ynabAccountName: ynabAcc.name },
          });
          this.logger.debug(`Updated account ${localAcc.name} balance → $${ynabAcc.balance}`);
        }
      }
    }

    this.logger.log(`YNAB sync complete: ${synced} synced, ${skipped} skipped`);
    return { synced, skipped };
  }

  /** Run sync for ALL connected users — called by the scheduler. */
  async syncAll() {
    const connections = await this.prisma.ynabConnection.findMany({
      where: { budgetId: { not: null } },
    });
    this.logger.log(`Scheduled YNAB sync: ${connections.length} connections`);
    for (const conn of connections) {
      try {
        // Find the user's first household
        const household = await this.prisma.household.findFirst({
          where: { userId: conn.userId },
        });
        if (household) {
          await this.sync(conn.userId, household.id);
        }
      } catch (err: any) {
        this.logger.error(`Sync failed for user ${conn.userId}: ${err?.message}`);
      }
    }
  }
}
