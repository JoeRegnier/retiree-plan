/**
 * Unit tests for the OFX parser and ImportService CSV utilities.
 *
 * These tests run with Vitest in isolation (no DB, no NestJS DI).
 */
import { describe, it, expect } from 'vitest';
import { parseOFX, mapOFXTypeToAccountType } from './ofx-parser';
import { ImportService } from './import.service';

// ── mapOFXTypeToAccountType ───────────────────────────────────────────────────

describe('mapOFXTypeToAccountType', () => {
  it.each([
    ['RRSP',         'RRSP'],
    ['LRSP',         'RRSP'],
    ['SPOUSAL RRSP', 'RRSP'],
    ['RRIF',         'RRIF'],
    ['TFSA',         'TFSA'],
    ['FHSA',         'TFSA'],
    ['LIRA',         'LIRA'],
    ['LIF',          'LIF'],
    ['RESP',         'RESP'],
    ['CHECKING',     'CASH'],
    ['SAVINGS',      'CASH'],
    ['MONEYMKT',     'CASH'],
    ['CD',           'CASH'],
    ['INVESTMENT',   'NON_REGISTERED'],
    ['BROKERAGE',    'NON_REGISTERED'],
    ['margin',       'NON_REGISTERED'],      // lower case
    ['UNKNOWN',      'NON_REGISTERED'],
  ])('"%s" → %s', (input, expected) => {
    expect(mapOFXTypeToAccountType(input)).toBe(expected);
  });
});

// ── parseOFX — SGML (OFX 1.x) ────────────────────────────────────────────────

describe('parseOFX — SGML bank account', () => {
  it('parses a chequing account', () => {
    const ofx = Buffer.from(`
OFXHEADER:100
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>CAD
<BANKACCTFROM>
<BANKID>021909989
<ACCTID>12345678
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<LEDGERBAL>
<BALAMT>4500.00
<DTASOF>20240101000000
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`);

    const result = parseOFX(ofx);
    expect(result).toHaveLength(1);
    const acc = result[0];
    expect(acc.accountId).toBe('12345678');
    expect(acc.bankId).toBe('021909989');
    expect(acc.accountType).toBe('CHECKING');
    expect(acc.localAccountType).toBe('CASH');
    expect(acc.balance).toBe(4500);
    expect(acc.currency).toBe('CAD');
  });

  it('parses a savings account with AVAILBAL fallback', () => {
    const ofx = Buffer.from(`
<OFX>
<STMTRS>
<CURDEF>CAD
<BANKACCTFROM>
<ACCTID>99887766
<ACCTTYPE>SAVINGS
</BANKACCTFROM>
<AVAILBAL>
<BALAMT>12000.00
</AVAILBAL>
</STMTRS>
</OFX>
`);
    const result = parseOFX(ofx);
    expect(result[0].balance).toBe(12000);
    expect(result[0].localAccountType).toBe('CASH');
  });

  it('parses multiple accounts in one file', () => {
    const ofx = Buffer.from(`
<OFX>
<STMTRS>
<CURDEF>CAD
<BANKACCTFROM><ACCTID>AAA001<ACCTTYPE>CHECKING</BANKACCTFROM>
<LEDGERBAL><BALAMT>100.00</LEDGERBAL>
</STMTRS>
<STMTRS>
<CURDEF>CAD
<BANKACCTFROM><ACCTID>BBB002<ACCTTYPE>SAVINGS</BANKACCTFROM>
<LEDGERBAL><BALAMT>200.00</LEDGERBAL>
</STMTRS>
</OFX>
`);
    const result = parseOFX(ofx);
    expect(result).toHaveLength(2);
    expect(result[0].accountId).toBe('AAA001');
    expect(result[1].accountId).toBe('BBB002');
  });
});

// ── parseOFX — XML investment account ────────────────────────────────────────

describe('parseOFX — XML investment account', () => {
  it('parses an investment account with INVTOTALS', () => {
    const ofx = Buffer.from(`
<?xml version="1.0" ?>
<?OFX OFXHEADER="200" VERSION="211" ?>
<OFX>
<INVSTMTMSGSRSV1>
<INVSTMTTRNRS>
<INVSTMTRS>
<DTASOF>20240101000000</DTASOF>
<CURDEF>CAD</CURDEF>
<INVACCTFROM>
<BROKERID>questrade.com</BROKERID>
<ACCTID>56789012</ACCTID>
</INVACCTFROM>
<INVTRANLIST></INVTRANLIST>
<INVPOSLIST></INVPOSLIST>
<INVBAL>
<AVAILCASH>5000.00</AVAILCASH>
</INVBAL>
<INVTOTALS>
<DTASOF>20240101000000</DTASOF>
<TOTALASSETS>87500.25</TOTALASSETS>
</INVTOTALS>
</INVSTMTRS>
</INVSTMTTRNRS>
</INVSTMTMSGSRSV1>
</OFX>
`);

    const result = parseOFX(ofx);
    expect(result).toHaveLength(1);
    const acc = result[0];
    expect(acc.accountId).toBe('56789012');
    expect(acc.balance).toBeCloseTo(87500.25);
    expect(acc.localAccountType).toBe('NON_REGISTERED');
  });

  it('detects RRSP type from BROKERID hint', () => {
    const ofx = Buffer.from(`
<OFX>
<INVSTMTRS>
<CURDEF>CAD</CURDEF>
<INVACCTFROM>
<BROKERID>RRSP-12345</BROKERID>
<ACCTID>RRSPACCT1</ACCTID>
</INVACCTFROM>
<INVTOTALS><TOTALASSETS>55000.00</TOTALASSETS></INVTOTALS>
</INVSTMTRS>
</OFX>
`);
    const result = parseOFX(ofx);
    expect(result[0].localAccountType).toBe('RRSP');
  });

  it('detects TFSA type from ACCTTYPE hint', () => {
    const ofx = Buffer.from(`
<OFX>
<INVSTMTRS>
<CURDEF>CAD</CURDEF>
<INVACCTFROM>
<ACCTID>TFSAACCT1</ACCTID>
<ACCTTYPE>TFSA</ACCTTYPE>
</INVACCTFROM>
<INVTOTALS><TOTALASSETS>22000.00</TOTALASSETS></INVTOTALS>
</INVSTMTRS>
</OFX>
`);
    const result = parseOFX(ofx);
    expect(result[0].localAccountType).toBe('TFSA');
  });

  it('falls back to MKTVAL sum when no INVTOTALS', () => {
    const ofx = Buffer.from(`
<OFX>
<INVSTMTRS>
<CURDEF>CAD</CURDEF>
<INVACCTFROM><ACCTID>ACCT001</ACCTID></INVACCTFROM>
<INVPOSLIST>
<POSSTOCK><MKTVAL>10000.00</MKTVAL></POSSTOCK>
<POSSTOCK><MKTVAL>5500.75</MKTVAL></POSSTOCK>
</INVPOSLIST>
</INVSTMTRS>
</OFX>
`);
    const result = parseOFX(ofx);
    expect(result[0].balance).toBeCloseTo(15500.75);
  });
});

// ── parseOFX — error cases ────────────────────────────────────────────────────

describe('parseOFX — error cases', () => {
  it('throws on non-OFX content', () => {
    expect(() => parseOFX(Buffer.from('This is not an OFX file at all.'))).toThrow(
      /Invalid OFX\/QFX file/,
    );
  });

  it('throws when OFX root has no account blocks', () => {
    // Valid OFX root but no STMTRS or INVSTMTRS blocks
    expect(() =>
      parseOFX(Buffer.from('<OFX><SIGNONMSGSRSV1></SIGNONMSGSRSV1></OFX>')),
    ).toThrow();
  });
});

// ── ImportService.parseCSVLine ────────────────────────────────────────────────

describe('ImportService.parseCSVLine', () => {
  // Access via the public method exposed for testing
  const svc = new (ImportService as any)(null as any);
  const parse = (line: string) => (svc as any).parseCSVLine(line) as string[];

  it('splits basic comma-separated values', () => {
    expect(parse('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields containing commas', () => {
    expect(parse('"hello, world",foo,bar')).toEqual(['hello, world', 'foo', 'bar']);
  });

  it('handles escaped double-quotes inside quoted fields', () => {
    expect(parse('"say ""hi"" there",x')).toEqual(['say "hi" there', 'x']);
  });

  it('handles empty fields', () => {
    expect(parse(',,')).toEqual(['', '', '']);
  });

  it('handles trailing comma', () => {
    expect(parse('a,b,')).toEqual(['a', 'b', '']);
  });

  it('strips surrounding whitespace from unquoted fields', () => {
    expect(parse(' a , b , c ')).toEqual(['a', 'b', 'c']);
  });
});

// ── previewWealthsimpleCSV ────────────────────────────────────────────────────

describe('previewWealthsimpleCSV — offline parsing', () => {
  /**
   * Call the private _parseWealthsimpleCSV helper directly.
   * The actual previewWealthsimpleCSV method calls the DB, so we test the
   * parsing logic through a thin extraction.
   */
  it('detects RRSP account type from account name', () => {
    // Minimal Wealthsimple CSV: Date, Account, Type, Amount, Currency, ...
    const csv = `Date,Account,Type,Amount,Currency
2024-01-31,RRSP Self-Directed,eod balance,55000,CAD
2024-02-28,RRSP Self-Directed,eod balance,56000,CAD
`;
    const svc = new (ImportService as any)(null as any);
    const parsed = (svc as any)._parseWealthsimpleCSV(Buffer.from(csv)) as Array<{
      accountId: string;
      localAccountType: string;
      balance: number;
    }>;
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    const rrsp = parsed.find((a) => a.localAccountType === 'RRSP');
    expect(rrsp).toBeTruthy();
    expect(rrsp!.balance).toBe(56000);
  });

  it('detects TFSA account type', () => {
    const csv = `Date,Account,Type,Amount,Currency
2024-01-31,TFSA Self-Directed,eod balance,20000,CAD
`;
    const svc = new (ImportService as any)(null as any);
    const parsed = (svc as any)._parseWealthsimpleCSV(Buffer.from(csv)) as Array<{
      localAccountType: string;
    }>;
    expect(parsed.find((a) => a.localAccountType === 'TFSA')).toBeTruthy();
  });

  it('throws when no balance rows are present (M4 — no running-sum fallback)', () => {
    // Activity rows have no "eod balance" / "balance" type — only deposits
    const csv = `Date,Account,Type,Amount,Currency
2024-01-15,TFSA Self-Directed,deposit,500,CAD
2024-02-01,TFSA Self-Directed,deposit,500,CAD
`;
    const svc = new (ImportService as any)(null as any);
    expect(() => (svc as any)._parseWealthsimpleCSV(Buffer.from(csv))).toThrow(
      /No balance rows found/i,
    );
  });
});

// ── previewMonarchCSV ─────────────────────────────────────────────────────────

describe('previewMonarchCSV — offline parsing', () => {
  it('aggregates categories and computes monthly averages', () => {
    // Monarch transaction CSV: Date, Merchant, Category, Account, Original Statement, Notes, Amount, Tags
    const csv = `Date,Merchant,Category,Account,Original Statement,Notes,Amount,Tags
2024-01-15,Grocery Store,Groceries,Chequing,,,-200.00,
2024-01-20,Gas Station,Transportation,Chequing,,,-80.00,
2024-02-10,Grocery Store,Groceries,Chequing,,,-210.00,
2024-02-22,Bus Pass,Transportation,Chequing,,,-90.00,
2024-01-30,Netflix,Subscriptions,Chequing,,,-15.00,
`;
    const svc = new (ImportService as any)(null as any);
    const result = (svc as any)._parseMonarchCSV(Buffer.from(csv)) as {
      expenses: Array<{ category: string; monthlyAvg: number; annualAmount: number }>;
      totalCategories: number;
    };

    expect(result.totalCategories).toBe(3);

    const groceries = result.expenses.find((e) => e.category === 'Groceries');
    expect(groceries).toBeTruthy();
    // Average over 2 months: (200 + 210) / 2 = 205
    expect(groceries!.monthlyAvg).toBeCloseTo(205);
    expect(groceries!.annualAmount).toBeCloseTo(205 * 12);

    const transport = result.expenses.find((e) => e.category === 'Transportation');
    expect(transport).toBeTruthy();
    expect(transport!.monthlyAvg).toBeCloseTo(85);
  });

  it('ignores non-expense (positive amount) rows', () => {
    const csv = `Date,Merchant,Category,Account,Original Statement,Notes,Amount,Tags
2024-01-01,Employer,Income,Chequing,,,3000.00,
2024-01-15,Grocery Store,Groceries,Chequing,,,-150.00,
`;
    const svc = new (ImportService as any)(null as any);
    const result = (svc as any)._parseMonarchCSV(Buffer.from(csv)) as {
      expenses: Array<{ category: string }>;
    };
    expect(result.expenses.find((e) => e.category === 'Income')).toBeUndefined();
    expect(result.expenses.find((e) => e.category === 'Groceries')).toBeTruthy();
  });
});

// ── OFX account count limit (M7) ─────────────────────────────────────────────

describe('parseOFX — account count limit', () => {
  it('throws when the OFX file contains more than 200 accounts', () => {
    // Build a synthetic OFX with 201 STMTRS sections
    const sections = Array.from({ length: 201 }, (_, i) =>
      `<STMTRS><ACCTID>ACC${i}</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE><BANKID>001</BANKID><LEDGERBAL><BALAMT>100</BALAMT></LEDGERBAL></STMTRS>`,
    ).join('\n');
    const ofx = `OFXHEADER:100\n<OFX><BANKMSGSRSV1>${sections}</BANKMSGSRSV1></OFX>`;
    expect(() => parseOFX(Buffer.from(ofx))).toThrow(/Too many accounts/i);
  });
});

// ── CSV injection sanitisation (L4) ──────────────────────────────────────────

describe('mapMonarchCategory — CSV injection stripping', () => {
  it('strips leading = injection characters from unmatched categories', () => {
    const svc = new (ImportService as any)(null as any);
    const result = (svc as any).mapMonarchCategory('=cmd|/C calc');
    // Leading = should be stripped
    expect(result).not.toMatch(/^=/);
  });

  it('strips leading + injection characters', () => {
    const svc = new (ImportService as any)(null as any);
    const result = (svc as any).mapMonarchCategory('+1/0');
    expect(result).not.toMatch(/^\+/);
  });

  it('does not strip normal category names', () => {
    const svc = new (ImportService as any)(null as any);
    expect((svc as any).mapMonarchCategory('Groceries')).toBe('Food & Dining');
    expect((svc as any).mapMonarchCategory('WeirdCategory')).toBe('WeirdCategory');
  });
});
