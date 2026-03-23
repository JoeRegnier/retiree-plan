# Guide 16 — Integrations Roadmap

**Document purpose:** Comprehensive analysis of Canadian financial data integrations — where we are, what gaps exist, and the technical plan to close them. The goal is zero-friction onboarding: a new user should be able to connect their existing tools (bank, broker, budgeting app) and have a fully populated retirement plan in under 5 minutes.

---

## Current Integration State

| Integration | Type | Status | Data pulled |
|---|---|---|---|
| **YNAB** | Budgeting | ✅ Full | Category budgets → expenses, account balances, net-worth history |
| **Questrade** | Brokerage | ✅ Partial | Account balances only; no positions/holdings |
| **Wealthsimple** | Brokerage | ⚠️ Fragile | Account balances via internal API, no OAuth, tokens expire |
| **TD Bank** | Bank | 🏷️ Stub | Account tagging only, no data pull |
| **Yahoo Finance** | Market Data | ✅ Full | Historical equity returns (TSX, US), stored as `HistoricalReturn` |
| **Bank of Canada** | Market Data | ✅ Full | Overnight rate, 10Y GoC bond yield via public Valet API |
| **CSV Export** | Export | ✅ Full | Projection data per-year |
| **PDF Export** | Export | ✅ Full | Full multi-scenario report via `@react-pdf/renderer` |

**Critical gaps:** The average Canadian retiree holds accounts at one of the Big 5 banks (RBC, TD, BMO, Scotiabank, CIBC) plus one brokerage. We currently have no reliable way to pull data from RBC, BMO, Scotiabank, or CIBC — representing roughly 80% of Canadian banking relationships. For people who don't use YNAB or Questrade, onboarding requires 100% manual entry.

---

## Part 1 — Canadian Financial Institution Landscape

### The Big 5 Banks (Direct API: None)

None of the Big 5 offer a published consumer/developer API for account data as of 2026. Canada's Open Banking framework (consumer-driven banking, CDR) is legislated but implementation regulations are still being finalized. The Office of the Financial Consumer Agency of Canada (FCAC) has released the implementation framework but mandated connections are expected in 2026–2027 at the earliest.

| Bank | Market Share | Direct API | OFX Export | Notes |
|---|---|---|---|---|
| **RBC Royal Bank** | ~25% | ❌ None | ✅ Available | Direct Investing brokerage has OFX |
| **TD Bank** | ~22% | ❌ None | ✅ Available | WebBroker has OFX/CSV |
| **Scotiabank** | ~14% | ❌ None | ✅ Available | Scotia iTRADE has OFX |
| **BMO** | ~13% | ❌ None | ✅ Available | InvestorLine has OFX/CSV |
| **CIBC** | ~12% | ❌ None | ✅ Available | Investor's Edge has OFX |
| **National Bank** | ~6% | ❌ None | ✅ Available | Direct Brokerage has OFX |

**Strategic implication:** Direct API connections to Big 5 banks require either (a) a financial data aggregator that handles screen-scraping/bank partnerships on our behalf (Flinks, Wealthica), or (b) OFX/CSV file import as a self-serve fallback. Both should be implemented.

### Credit Unions & Caisses Populaires

| Institution | Region | Members | Notes |
|---|---|---|---|
| **Desjardins** | Quebec, Ontario | 7M+ | Largest credit union in North America |
| **Meridian** | Ontario | 400K | Second largest Ontario CU |
| **FirstOntario** | Ontario | 130K | |
| **Servus** | Alberta | 400K | |
| **Coast Capital** | BC | 600K | |
| **Assiniboine** | Manitoba | 195K | |
| **DUCA** | Ontario | 90K | |

Desjardins is especially critical for Quebec users — it is the dominant financial institution for the province. Flinks covers Desjardins.

### Discount Brokerages (Direct API: Mixed)

| Broker | Users | API | Notes |
|---|---|---|---|
| **Questrade** | 350K+ | ✅ Official OAuth | Already integrated (balances). Positions not yet pulled. |
| **Wealthsimple Invest/Trade** | 3M+ | ⚠️ Unofficial | OAuth2 observed in browser; no published dev program |
| **Qtrade** | ~200K | ❌ None | Part of Aviso Wealth; no public API |
| **Virtual Brokers** | ~100K | ❌ None | Part of CI Financial |
| **NBDB** | ~100K | ❌ None | National Bank Direct Brokerage |
| **RBC Direct Investing** | ~2M | ❌ None | OFX export available |
| **TD WebBroker** | ~1M | ❌ None | OFX export available |
| **BMO InvestorLine** | ~600K | ❌ None | CSV/OFX export available |
| **CIBC Investor's Edge** | ~400K | ❌ None | OFX/CSV export |
| **Scotia iTRADE** | ~300K | ❌ None | OFX export |
| **Manulife (Group RRSP/DPSP)** | Millions | ⚠️ Partial | Manulife Connect API — group plan member data |
| **Sun Life (Group RRSP/DPSP)** | Millions | ⚠️ Partial | SunAdvisor API for plan sponsors |
| **Canada Life / Great-West** | Millions | ⚠️ Partial | PlanAdvisor portal |

---

## Part 2 — Questrade Deep Dive

### Existing Implementation
We currently call:
- `POST login.questrade.com/oauth2/token` — refresh token exchange (single-use rotation)
- `GET {apiServer}v1/accounts` — account list
- `GET {apiServer}v1/accounts/{number}/balances` — CAD totalEquity only

### Untapped Questrade Endpoints

The official [Questrade API](https://www.questrade.com/api/documentation/getting-started) exposes far more data we should pull:

#### Positions (Critical — enables ACB tracking)
```
GET {apiServer}v1/accounts/{number}/positions
```
Returns per-holding data:
```json
{
  "positions": [{
    "symbol":              "VFV.TO",
    "symbolId":            12345,
    "openQuantity":        100,
    "closedQuantity":      0,
    "currentMarketValue":  9800.00,
    "currentPrice":        98.00,
    "averageEntryPrice":   85.00,     // ← ACB per share
    "openPnl":             1300.00,   // unrealized gain
    "closedPnl":           0,
    "totalCost":           8500.00,   // ← total ACB
    "isRealTime":          true,
    "isUnderResp":         false,
    "securityType":        "Equity",
    "currency":            "CAD"
  }]
}
```

**Use case:** Pre-populate `costBasis` on non-registered account positions, enabling accurate capital gains projection at disposition. Also enables real-time portfolio valuation vs. what's in the DB.

#### Activities / Transaction History
```
GET {apiServer}v1/accounts/{number}/activities?startTime=...&endTime=...
```
Returns deposits, withdrawals, dividends, trades. Maximum 31-day range per request — requires paging by month.

**Use case:** Reconstruct RRSP/TFSA contribution history to auto-calculate contribution room.

#### Orders
```
GET {apiServer}v1/accounts/{number}/orders?stateFilter=All&startTime=...&endTime=...
```

#### Market Quotes
```
GET {apiServer}v1/symbols/search?prefix=VFV
GET {apiServer}v1/markets/quotes/{symbolId}
```

**Use case:** Real-time price refresh for portfolio holdings.

### Questrade Enhancement Plan

| Enhancement | API Endpoint | Benefit |
|---|---|---|
| Import positions + ACB | `positions` | Auto-populate `costBasis` on non-reg accounts |
| Import transaction history | `activities` | Auto-calculate RRSP/TFSA contribution room |
| Live price refresh | `markets/quotes` | Show unrealized P&L vs. entry |
| Allocation auto-detect | `positions` | Compute equity/fixed-income/cash % from holdings |

---

## Part 3 — Wealthsimple Deep Dive

### Current Implementation: Fragile
Currently requires user to manually extract a Bearer token from browser DevTools (`Authorization:` header from any `my.wealthsimple.com` network request). This token expires in ~24 hours. No refresh mechanism. This needs to be replaced.

### Wealthsimple's Authentication Reality
Wealthsimple does **not** have a published developer API or OAuth application registration portal. However, their mobile/web app uses OAuth2 client credentials that have been reverse-engineered by the community. The observed flow:

**Token endpoint:** `https://api.production.wealthsimple.com/v1/oauth/token`

**Connection flow (reverse-engineered):**
```
POST /v1/oauth/token
{
  "grant_type": "password",
  "username": "{email}",
  "password": "{password}",
  "otp": "{6-digit TOTP}",        // if 2FA enabled
  "client_id": "4da53ac2...",     // Wealthsimple mobile app client ID
  "client_secret": "...",
  "scope": "invest.read trade.read"
}
→ { "access_token": "...", "refresh_token": "...", "expires_in": 1800 }
```

**Refresh flow:**
```
POST /v1/oauth/token
{
  "grant_type": "refresh_token",
  "refresh_token": "...",
  "client_id": "4da53ac2..."
}
```

**Known internal API endpoints:**

| Endpoint | Data |
|---|---|
| `GET /v1/accounts` | Account list: TFSA, RRSP, non-reg, crypto, pension |
| `GET /v1/account-holdings` | All holdings across all accounts |
| `GET /v1/orders?account_id={id}` | Order history |
| `GET /v1/deposits?account_id={id}` | Deposit/withdrawal history |
| `GET /v1/tax-documents` | T5, T3, T5008 PDF downloads |
| `POST /v1/graphql` | GraphQL queries for richer data |

**Warnings:**
- Client IDs rotate with app updates; hardcoding them is fragile and violates Wealthsimple's ToS
- The ethical alternative is to ask users to authenticate via Wealthsimple's official mobile app flow and import data — they do not expose 3rd-party OAuth apps
- **Recommended approach:** Replace fragile Bearer-token scraping with an official partnership request to Wealthsimple + interim CSV/OFX import for Wealthsimple users

### Wealthsimple CSV/Statement Export (Near-term)
Wealthsimple allows users to download:
- Account statements (PDF)
- Transaction history (CSV) from the web app → Activity tab → Export
- T3/T5/T5008 tax slips (PDF)

Layout: `Date, Type, Symbol, Quantity, Price, Commission, Currency, Account`

This is the secure, stable approach while waiting for a proper API.

---

## Part 4 — Financial Data Aggregators

These are the key to covering the Big 5 banks without individual integrations.

### 4.1 Flinks (Top Recommendation for Banking Data)

**What it is:** Canada's leading financial data aggregation platform, used by fintechs including Wealthsimple itself. Provides connectivity to 200+ Canadian financial institutions.

**Coverage:** RBC, TD, Scotiabank, BMO, CIBC, National Bank, Desjardins, Meridian, EQ Bank, Tangerine, Simplii, Neo Financial, and ~190 more.

**API:** REST; data delivered as JSON. Authentication uses "Flinks Connect" — a white-labelled bank login UI component that handles credential entry, MFA, and consent in an iframe/webview.

**Data available:**
- Account list: id, institution, type, currency, balance, transit, transit number
- Transactions (90–366 days): date, amount, description, merchant, category
- Account holder identity: name, address
- Investment accounts: balances only (positions not available at all institutions)

**Integration model:**
```
1. Embed FlinksConnect iframe on IntegrationsPage
2. User logs in to their bank in the iframe (credentials never touch our server)
3. Flinks returns a loginId + requestId token
4. Our backend calls POST api.flinks.io/v3/{instanceKey}/BankingServices/GetAccountsSummary
   with loginId → receives full account list + balances
5. Transactions: POST /GetTransactions  
6. Store flinks_account_id on Account rows
7. Nightly sync: POST /RefreshAuthentication + GetAccountsSummaryAsync (background job)
```

**Pricing:** Usage-based; typical Canadian fintech rate is ~$0.15–0.50 per connection per month. Free tier available for small scale.

**Why it matters:** Single integration → covers all Big 5 banks, major credit unions, and neo-banks. Replaces the need for individual RBC/BMO/Scotiabank/CIBC integrations.

---

### 4.2 Wealthica (Top Recommendation for Investment Data)

**What it is:** A Canadian portfolio tracker that aggregates investment accounts from 130+ Canadian financial institutions. Their developer API is fully public.

**Website:** https://wealthica.com/developers/

**Coverage for investments:** Questrade, Wealthsimple, RBC Direct Investing, TD WebBroker, BMO InvestorLine, CIBC Investor's Edge, Scotia iTRADE, Qtrade, NBDB, Manulife (group plans), Sun Life, Interactive Brokers Canada, and over 120 more.

**API (official, public REST API):**
```
Base URL: https://api.wealthica.com/v1/
Auth: API key (OAuth2 available for registered apps)
```

| Endpoint | Data |
|---|---|
| `GET /institutions` | List of supported institutions |
| `GET /portfolios` | User's portfolio summary |
| `GET /portfolio/positions` | Holdings: symbol, quantity, book_value, market_value, currency |
| `GET /portfolio/transactions` | All transactions: buy, sell, dividend, deposit, withdrawal |
| `GET /portfolio/snapshots` | Daily portfolio value history |
| `GET /accounts` | Account list with type, institution, currency, balance |

**The unique opportunity:** Wealthica already handles the authentication complexity with brokerages like RBC Direct, TD WebBroker, etc. By integrating with Wealthica, we get positions + transactions from all of these in one integration. This would allow us to auto-populate:
- Account balances at any Canadian brokerage
- Holdings and ACB (book value from Wealthica = ACB)
- Transaction history for contribution room reconstruction
- Portfolio valuation history

**Go-to-market:** Apply for Wealthica partner status. They have a free developer tier for testing.

---

### 4.3 Plaid (US-focused, limited Canada)

Plaid technically supports some Canadian institutions (TD, RBC, Scotiabank, CIBC, BMO, Desjardins) but coverage is significantly weaker than Flinks — fewer account types, lower connection success rates, and no investment account details for Canadian brokerages. **Not recommended over Flinks for a Canada-first product.**

---

### 4.4 Open Banking (Canada) — 2026–2027

Canada's **Consumer-Driven Banking (CDB)** framework was passed in the 2024 Federal Budget (Bill C-69). The Financial Consumer Agency of Canada (FCAC) is the lead regulator. Timeline:
- 2024: Legislation passed
- 2025: Accreditation regime for data recipients
- 2026: Initial rollout — likely covering transaction data + account balances at Big 5
- 2027+: Investment account data, FDX (Financial Data Exchange) standard adoption

**Action:** Register as a "data recipient" with FCAC when accreditation opens (target: Q3 2026). The FDX API standard is JSON REST, very similar to Plaid/Flinks schema. This will eventually replace Flinks for bank data.

---

## Part 5 — Canadian Budgeting & Planning Apps

These are apps Canadians already use to track spending. Integrating with their export formats dramatically reduces onboarding friction.

### 5.1 YNAB (Already Integrated ✅)

**Integration:** Full — PAT-based, real-time sync of budgets, categories, account balances, and net-worth history. Most complete integration in the app.

**Users in Canada:** ~500K+ (global userbase ~1M, ~50% NA users)

**Enhancement opportunity:** Today we only sync category budgets as annual expenses. We could also sync:
- **Transaction-level spending actuals** → compare actual vs. planned spending in retirement
- **Age-range category mappings** → already partially in schema via `YnabCategoryMapping` start/endAge

---

### 5.2 Monarch Money

**What it is:** The most popular YNAB alternative. Web + mobile. Launched in Canada 2023.

**Canadian bank support:** Connects to RBC, TD, Scotiabank, BMO, CIBC, Desjardins, EQ Bank, Neo Financial, Tangerine, Simplii via Plaid (for banking) and direct connections for some Canadian brokerages.

**Export format:** CSV download of all transactions with columns: `Date, Merchant, Category, Account, Original Statement, Notes, Amount, Tags`

**Integration approach:** 
- No public API
- **Import: CSV** — user downloads Monarch CSV from Settings → Export Data
- Parse transaction CSV to reconstruct spending categories and monthly averages
- Map Monarch categories to our local categories (similar to YNAB mapping workflow)

**Implementation effort:** Medium. Build a CSV parser that recognizes Monarch's format and creates `Expense` rows. Reuse the YNAB category mapping UI.

---

### 5.3 Copilot Money

**What it is:** Premium budgeting app, iOS only. Growing Canadian user base (2024 Canadian bank support added).

**Export:** CSV of transactions: `Date, Payee, Category, Amount, Account, Notes`

**Integration approach:** CSV import only.

---

### 5.4 Mint (Discontinued Jan 2024)

Mint shut down January 1, 2024. Many former Canadian Mint users migrated to YNAB, Monarch Money, or Wealthica. **No integration value.** However, offering a "**Intuit/Mint Data Import**" (parsing the exported Mint zip archive) would help those users who exported their data before shutdown.

---

### 5.5 Personal Finance Apps with Canadian Bank Connections

| App | Canadian Bank Support | Export | Notes |
|---|---|---|---|
| **Wealthica** | 130+ Canadian FIs (investments) | CSV/JSON API | Already discussed — best for investments |
| **Monarch Money** | 20+ Canadian FIs via Plaid | CSV | Growing; strong YNAB alternative |
| **Copilot** | 15+ Canadian FIs | CSV | iOS only |
| **PocketGuard** | 10+ Canadian FIs | CSV | Basic budgeting, US-focused |
| **Empower (Personal Capital)** | Limited CA (some Big 5) | CSV | No real CA investment support |
| **Lunch Money** | Manual/CSV import | CSV/API | Developer-friendly; has a public API |
| **Simplifi by Quicken** | Limited CA | CSV | US-focused |
| **Buckets** | Offline only | CSV | Open-source; no bank connections |
| **Actual Budget** | Self-hosted, manual | CSV | Open-source; no connections |

**Highest value targets after YNAB:** Monarch Money (growing CA user base) and Wealthica (investment-focused CA users).

---

### 5.6 Employer Benefits Platforms

A significant but overlooked category: group RRSP / DPSP / pension plans through employers. These are held at:

| Platform | Employer Plans | API/Export |
|---|---|---|
| **Manulife** | GroupRetirement | ⚠️ Partial — Manulife Connect API for plan members |
| **Sun Life** | GroupRetirement | ⚠️ Partial — SunAdvisor API |
| **Canada Life / Great-West** | GroupRSP, DPSP | ⚠️ Partners only |
| **Desjardins Group Insurance** | Group plans | ❌ None |
| **Benecaid / CloudAdvisor** | Benefits admin | ❌ None |
| **Humi / Rippling** | Payroll + benefits | ⚠️ REST API (generic HR) |

**Strategy:** For group RRSP/DPSP, the most practical approach in 2026 is a **standard CSV import** — all group plan providers can export a balance/statement CSV. A structured import template would capture: account type, current balance, annual contribution, employer match %, vesting schedule.

---

## Part 6 — Integration Priority Matrix & Implementation Plan

### Priority Tiers

**Tier 1 — High impact, moderate effort (ship next sprint)**

| # | Integration | Covers | Implementation |
|---|---|---|---|
| I-1 | **Questrade Positions + ACB** | 350K+ Questrade users | Add `GET .../positions` call; write `costBasis` + allocation % to Account |
| I-2 | **Universal OFX/QFX Import** | All Big 5 bank users | Parse OFX XML; create/update Account balances and optionally import transactions |
| I-3 | **Universal CSV Transaction Import** | Monarch, Copilot, Mint refugees, any brokerage | Parse generic CSV with column mapper; build recurring expense suggestions |
| I-4 | **Wealthsimple CSV Import** | 3M+ WS users | Accept WS activity export CSV; update account balances + import transaction history |

**Tier 2 — High impact, significant effort (next 2 sprints)**

| # | Integration | Covers | Implementation |
|---|---|---|---|
| I-5 | **Flinks Connect** (bank aggregator) | All Big 5 + 200 CUs | Embed FlinksConnect iframe; backend sync via Flinks API |
| I-6 | **Wealthica API** (investment aggregator) | 130 Canadian brokerages | OAuth flow with Wealthica; import positions, transactions, portfolio history |
| I-7 | **Questrade Transaction History** | Contribution room auto-calc | `GET .../activities`; reconstruct RRSP/TFSA room from trade history |
| I-8 | **Monarch Money CSV Import** | Growing CA budgeting users | CSV parser matching Monarch format + category mapping UI |

**Tier 3 — Strategic, longer timeline**

| # | Integration | Covers | Notes |
|---|---|---|---|
| I-9 | **CRA My Account API** | RRSP/TFSA room, NOAs | Awaiting FCAC accreditation (2026–2027) |
| I-10 | **Open Banking (FCAC/FDX)** | All regulated FIs | Register as data recipient when accreditation opens |
| I-11 | **Manulife / Sun Life Group Plans** | Group RRSP/DPSP holders | Business partnership required for API; CSV import as fallback |
| I-12 | **Wealthsimple OAuth** | 3M+ WS users | Official partnership or wait for public developer program |
| I-13 | **Desjardins (via Flinks)** | 7M Quebec users | Covered by Flinks Tier 2 |

---

## Part 7 — Detailed Technical Specs

### I-1: Questrade Positions + ACB Import

**New API calls in `brokerage.service.ts`:**

```typescript
// New method: getQuestradePositions(userId, accountNumber)
GET {apiServer}v1/accounts/{number}/positions

// Response shape:
interface QuestradePosition {
  symbol:           string;   // "VFV.TO"
  symbolId:         number;
  openQuantity:     number;   // shares held
  currentMarketValue: number; // current total value (CAD)
  currentPrice:     number;
  averageEntryPrice: number;  // ACB per share
  totalCost:        number;   // ACB total (= openQuantity × averageEntryPrice)
  openPnl:          number;   // unrealized gain
  securityType:     string;   // "Equity" | "MutualFund" | "ETF" | "Bond"
  currency:         string;
}
```

**What we write to DB:**
- Non-registered accounts: `account.costBasis = sum(position.totalCost)` → enables capital gains calculation on disposition
- Per-account: `account.equityPercent`, `fixedIncomePercent` calculated from `securityType` distribution
- `account.estimatedReturnRate` can be auto-computed from holdings using capital market assumptions

**New REST endpoint:**
```
GET /brokerage/questrade/positions?householdId=...
POST /brokerage/questrade/sync-positions { householdId }
```

---

### I-2: Universal OFX/QFX Import

**OFX (Open Financial Exchange)** is the file format exported by all Canadian banks and brokerages from their web portals (TD WebBroker → Download → OFX, CIBC Investor's Edge → Statements → OFX, etc.). It is an SGML/XML-like format.

Key structure:
```xml
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <CURDEF>CAD</CURDEF>
        <BANKACCTFROM>
          <BANKID>0004</BANKID>   <!-- BMO routing -->
          <ACCTID>123456789</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <LEDGERBAL>
          <BALAMT>25432.18</BALAMT>
        </LEDGERBAL>
        <BANKTRANLIST>
          <DTSTART>20260101</DTSTART>
          <DTEND>20260322</DTEND>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260115</DTPOSTED>
            <TRNAMT>-150.00</TRNAMT>
            <NAME>GROCERY STORE</NAME>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
```

For investment accounts, brokerages export OFX with `<INVSTMTRS>` containing `<INVPOSLIST>` (positions) and `<INVTRANLIST>` (trades).

**Implementation:**
- Install `ofx-js` or write a lightweight parser (the format is simple enough)
- Frontend: `FileUpload` component on IntegrationsPage, accept `.ofx`, `.qfx`
- Backend: `POST /import/ofx` → parse → upsert Account balance, optionally import transactions
- Show a preview: "Found 3 accounts: TD RRSP $142,000 | TD TFSA $68,000 | TD Chequing $12,000. Import?"

---

### I-3 / I-4 / I-8: CSV Transaction Import (Universal)

A single `POST /import/csv` endpoint that accepts a CSV file and a `format` hint (`monarch`, `wealthsimple`, `mint`, `generic`).

**Column mapping per format:**

| Format | Date col | Amount col | Category col | Account col |
|---|---|---|---|---|
| **Monarch** | `Date` | `Amount` | `Category` | `Account` |
| **Wealthsimple (Activity)** | `Activity Date` | `Net Amount` | `Activity Type` | `Account` |
| **Mint (archive)** | `Date` | `Amount` | `Category` | `Account Name` |
| **Questrade Activity** | `Transaction Date` | `Net Amount` | `Activity Type` | `Account # N/A` |
| **Generic** | User maps columns in UI | | | |

**Processing pipeline:**
1. Parse CSV → array of `{ date, amount, description, category, account }`
2. Group by account → propose new `Account` records if not found by name
3. Group by category → suggest `Expense` records (monthly average × 12)
4. Show diff preview: "This would create 4 accounts and 12 expense categories. Review and confirm."
5. Persist approved rows

---

### I-5: Flinks Connect Integration

**Frontend:**
- Add "Connect Your Bank" button on IntegrationsPage → opens Flinks Connect modal
- Flinks provides an iframe SDK (`@flinks/connect`) — a white-labelled bank login UI
- After successful auth, Flinks fires a `message` event with `loginId`

**Backend:**
```typescript
// POST /flinks/connect
// body: { loginId: string, householdId: string }
// 1. Call Flinks API: GetAccountsSummaryAsync
POST api.flinks.io/v3/{instanceKey}/BankingServices/GetAccountsSummaryAsync
{ "LoginId": loginId, "MostRecentCached": false }
→ returns requestId

// 2. Poll: GET .../GetAccountsSummary/{requestId}
// 3. Parse accounts → upsert Account rows with flinksAccountId
// 4. Store FlinksConnection { userId, loginId, lastSyncedAt }
```

**Data model additions required:**
```prisma
model FlinksConnection {
  id           String   @id @default(cuid())
  userId       String   @unique
  loginId      String   // encrypted
  institution  String?
  lastSyncedAt DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

`Account` model additions: `flinksAccountId String?`, `flinksInstitution String?`

---

### I-6: Wealthica API Integration

**Auth flow:** OAuth2 PKCE. User clicks "Connect Wealthica" → redirected to `wealth.wealthica.com/oauth/authorize?client_id=...&scope=...&redirect_uri=...` → user grants consent → redirected back with `?code=...` → backend exchanges for `access_token` + `refresh_token` at `api.wealthica.com/oauth/token`.

**Backend service:**
```typescript
// GET /api/wealthica/accounts
GET https://api.wealthica.com/v1/accounts
Authorization: Bearer {accessToken}
→ [{ id, label, institution, type, currency, balance, positions }]

// GET /api/wealthica/positions
GET https://api.wealthica.com/v1/portfolio/positions
→ [{ symbol, description, quantity, book_value, market_value, currency }]
```

**What we write:**
- `Account.balance` from `account.balance`
- `Account.costBasis` from sum of `position.book_value` (Wealthica stores ACB as book_value)
- `Account.brokerageProvider` = institution name (e.g. "QUESTRADE", "RBC", "BMO")
- `Account.equityPercent` / `fixedIncomePercent` from position type classification

---

## Part 8 — Onboarding Experience Redesign

With these integrations in place, the onboarding flow should become:

```
1. Create account (email/password)
2. "Let's build your retirement plan" — guided wizard:

   Step 1: Household basics (names, DOBs, province)

   Step 2: "Connect your finances" — three parallel paths:
   ┌─────────────────────────────────────┐
   │  🏦 Connect your bank               │  ← Flinks (covers all Big 5 / CUs)
   │  [Connect Bank]                     │
   ├─────────────────────────────────────┤
   │  📊 Connect your brokerage          │  ← Questrade (OAuth), Wealthsimple (CSV/OAuth),
   │  [Questrade] [Wealthsimple] [Other] │     Wealthica (OAuth for everything else)
   ├─────────────────────────────────────┤
   │  💰 Sync your budget                │  ← YNAB, Monarch, or CSV upload
   │  [YNAB] [Monarch] [Upload CSV]      │
   ├─────────────────────────────────────┤
   │  📁 Import a file                   │  ← OFX from any bank, CSV from any source
   │  [Upload OFX/CSV]                   │
   └─────────────────────────────────────┘

   Step 3: Income sources (CPP estimate, OAS, employment)

   Step 4: Goals

   Step 5: Run first projection → Dashboard
```

**Target:** A user who connects Flinks + Questrade should have 80%+ of their data pre-populated in under 3 minutes.

---

## Part 9 — Implementation Roadmap for ROADMAP Document

The following should be added to the main ROADMAP as **Theme 9 — Data & Integration** items (supplementing existing 9.1–9.4):

| # | Feature | Priority | Effort |
|---|---|---|---|
| I-1 | Questrade: Positions + ACB import | H | S |
| I-2 | Questrade: Activity history → contribution room | M | M |
| I-3 | Universal OFX/QFX file import | H | M |
| I-4 | Wealthsimple CSV activity import | H | S |
| I-5 | Monarch Money CSV import | M | S |
| I-6 | Flinks bank aggregator (Big 5 + CUs) | H | H |
| I-7 | Wealthica investment aggregator | H | H |
| I-8 | Wealthsimple: Replace fragile Bearer with proper OAuth | H | M |
| I-9 | Open Banking / FCAC registration (2027) | H | H |
| I-10 | Manulife/Sun Life group plan CSV import | M | S |
| I-11 | Onboarding wizard with integration steps | H | M |

---

*Document authored: March 2026. Research basis: Questrade Developer API docs (official), Wealthsimple reverse-engineering community (wealthsimple-rs, SnoTrack), Flinks product documentation, Wealthica developer portal, FCAC Consumer-Driven Banking framework, Canadian Banker's Association Open Banking position papers.*
