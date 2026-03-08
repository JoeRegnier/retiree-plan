import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encryptToken, decryptToken } from '../crypto/token-cipher';

const QUESTRADE_TOKEN_URL = 'https://login.questrade.com/oauth2/token';
const WEALTHSIMPLE_API = 'https://api.production.wealthsimple.com/v1';

export type BrokerageProvider = 'QUESTRADE' | 'WEALTHSIMPLE' | 'TD';

export interface BrokerageAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

@Injectable()
export class BrokerageService {
  private readonly logger = new Logger(BrokerageService.name);

  constructor(private prisma: PrismaService) {}

  // ── Connection management ─────────────────────────────────────────────────

  /**
   * Store the initial token for a brokerage provider.
   * For Questrade: the user supplies a refresh_token from their API access settings.
   * For Wealthsimple: the user supplies a Bearer access token.
   * For TD: no token needed; we just create a placeholder connection record.
   */
  async connect(userId: string, provider: BrokerageProvider, token?: string): Promise<void> {
    const encryptedToken = token ? encryptToken(token) : null;
    await this.prisma.brokerageConnection.upsert({
      where: { userId_provider: { userId, provider } },
      create: {
        userId,
        provider,
        refreshToken: encryptedToken,   // Questrade refresh token, or null for TD
        accessToken:  null,
        apiServer:    null,
      },
      update: {
        refreshToken: encryptedToken,
        accessToken:  null,   // force re-exchange on next API call
        apiServer:    null,
        lastSyncedAt: null,
      },
    });
    this.logger.log(`Brokerage ${provider} connected for user ${userId}`);
  }

  async disconnect(userId: string, provider: BrokerageProvider): Promise<void> {
    await this.prisma.brokerageConnection.deleteMany({ where: { userId, provider } });
    this.logger.log(`Brokerage ${provider} disconnected for user ${userId}`);
  }

  async getStatus(userId: string, provider: BrokerageProvider) {
    const conn = await this.prisma.brokerageConnection.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!conn) return { connected: false, provider };
    return { connected: true, provider, lastSyncedAt: conn.lastSyncedAt };
  }

  async getAllStatuses(userId: string) {
    const providers: BrokerageProvider[] = ['QUESTRADE', 'WEALTHSIMPLE', 'TD'];
    return Promise.all(providers.map((p) => this.getStatus(userId, p)));
  }

  // ── Questrade ─────────────────────────────────────────────────────────────

  /**
   * Exchange the stored refresh_token for a fresh access_token + api_server.
   * Questrade refresh tokens are single-use — we persist the new one immediately.
   */
  private async exchangeQuestradeToken(
    userId: string,
  ): Promise<{ accessToken: string; apiServer: string }> {
    const conn = await this.prisma.brokerageConnection.findUnique({
      where: { userId_provider: { userId, provider: 'QUESTRADE' } },
    });
    if (!conn?.refreshToken) throw new NotFoundException('Questrade not connected');

    const refreshToken = decryptToken(conn.refreshToken);
    const url = `${QUESTRADE_TOKEN_URL}?grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`;
    const resp = await fetch(url, { method: 'POST' });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new BadRequestException(
        `Questrade token exchange failed (${resp.status}): ${body}. ` +
        'Please reconnect with a fresh API token from your Questrade account settings.',
      );
    }
    const data = (await resp.json()) as {
      access_token: string;
      refresh_token: string;
      api_server: string;
      expires_in: number;
    };

    // Persist the new (rotated) refresh token immediately
    await this.prisma.brokerageConnection.update({
      where: { userId_provider: { userId, provider: 'QUESTRADE' } },
      data: {
        refreshToken: encryptToken(data.refresh_token),
        accessToken:  encryptToken(data.access_token),
        apiServer:    data.api_server,
      },
    });

    return { accessToken: data.access_token, apiServer: data.api_server };
  }

  async getQuestradeAccounts(userId: string): Promise<BrokerageAccount[]> {
    const { accessToken, apiServer } = await this.exchangeQuestradeToken(userId);

    // Fetch account list
    const accResp = await fetch(`${apiServer}v1/accounts`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!accResp.ok) throw new BadRequestException(`Questrade accounts API failed: ${accResp.status}`);
    const accData = (await accResp.json()) as { accounts: any[] };

    // Fetch balances in parallel
    const accounts = await Promise.all(
      (accData.accounts ?? []).map(async (acc: any) => {
        let balance = 0;
        try {
          const balResp = await fetch(`${apiServer}v1/accounts/${acc.number}/balances`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (balResp.ok) {
            const balData = (await balResp.json()) as { combinedBalances: any[] };
            const cad = (balData.combinedBalances ?? []).find((b: any) => b.currency === 'CAD');
            balance = cad?.totalEquity ?? 0;
          }
        } catch { /* balance stays 0 */ }
        return {
          id:       acc.number,
          name:     `${acc.type} (${acc.number})`,
          type:     acc.clientAccountType ?? acc.type,
          balance,
          currency: 'CAD',
        };
      }),
    );

    return accounts;
  }

  // ── Wealthsimple ─────────────────────────────────────────────────────────

  async getWealthsimpleAccounts(userId: string): Promise<BrokerageAccount[]> {
    const conn = await this.prisma.brokerageConnection.findUnique({
      where: { userId_provider: { userId, provider: 'WEALTHSIMPLE' } },
    });
    if (!conn?.refreshToken) throw new NotFoundException('Wealthsimple not connected');

    const token = decryptToken(conn.refreshToken);

    // Wealthsimple uses an internal GraphQL + REST API.
    // The /v1/accounts endpoint returns investment + cash account details.
    const resp = await fetch(`${WEALTHSIMPLE_API}/accounts`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    if (!resp.ok) {
      throw new BadRequestException(
        `Wealthsimple API request failed (${resp.status}). ` +
        'The token may have expired — please reconnect with a fresh session token.',
      );
    }

    const data = (await resp.json()) as { results?: any[] };
    return (data.results ?? []).map((acc: any) => ({
      id:       acc.id,
      name:     acc.description ?? acc.account_type ?? acc.id,
      type:     acc.account_type ?? 'unknown',
      balance:  acc.current_balance?.amount ?? 0,
      currency: acc.base_currency ?? 'CAD',
    }));
  }

  // ── Unified getAccounts ───────────────────────────────────────────────────

  async getAccounts(userId: string, provider: BrokerageProvider): Promise<BrokerageAccount[]> {
    switch (provider) {
      case 'QUESTRADE':   return this.getQuestradeAccounts(userId);
      case 'WEALTHSIMPLE': return this.getWealthsimpleAccounts(userId);
      case 'TD':
        throw new BadRequestException('TD does not offer a public API. Update account balances manually.');
    }
  }

  // ── Balance sync ──────────────────────────────────────────────────────────

  async syncBalances(
    userId: string,
    householdId: string,
    provider: BrokerageProvider,
  ): Promise<{ synced: number; provider: BrokerageProvider }> {
    if (provider === 'TD') {
      return { synced: 0, provider };
    }

    const brokerageAccounts = await this.getAccounts(userId, provider);
    const remoteMap = new Map(brokerageAccounts.map((a) => [a.id, a]));

    const linkedLocals = await this.prisma.account.findMany({
      where: { householdId, brokerageProvider: provider, brokerageAccountId: { not: null } },
    });

    let synced = 0;
    for (const local of linkedLocals) {
      const remote = remoteMap.get(local.brokerageAccountId!);
      if (remote) {
        await this.prisma.account.update({
          where: { id: local.id },
          data: { balance: remote.balance, brokerageAccountName: remote.name },
        });
        this.logger.debug(`Synced ${provider} account ${local.name}: $${remote.balance}`);
        synced++;
      }
    }

    await this.prisma.brokerageConnection.update({
      where: { userId_provider: { userId, provider } },
      data: { lastSyncedAt: new Date() },
    });

    this.logger.log(`${provider} sync complete: ${synced} accounts updated`);
    return { synced, provider };
  }
}
