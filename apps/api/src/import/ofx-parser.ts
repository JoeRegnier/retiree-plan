/**
 * OFX / QFX file parser — no external dependencies.
 *
 * Handles both formats:
 *  - OFX 1.x (SGML): raw key–value headers followed by tag soup (leaf elements
 *    have no closing tags)
 *  - OFX 2.x / QFX 2.x (XML): proper XML with an optional <?OFX?> processing
 *    instruction before the root <OFX> element
 *
 * Extracts bank account balances (STMTRS) and investment account total values
 * (INVSTMTRS). Investment account type (RRSP / TFSA / RRIF etc.) is inferred
 * from the BROKERID or account description where possible.
 */

export interface OFXAccountData {
  /** Raw institution account identifier (e.g. "11223344"). */
  accountId: string;
  /** Bank routing / transit number or broker ID (optional). */
  bankId?: string;
  /** Raw OFX account type string, upper-cased (e.g. "CHECKING", "RRSP"). */
  accountType: string;
  /** Mapped to the app's internal AccountType enum. */
  localAccountType: string;
  balance: number;
  currency: string;
  institution?: string;
  /** Short human-readable description shown in preview UI. */
  description?: string;
}

// ── Type mapping ─────────────────────────────────────────────────────────────

/**
 * Map a raw OFX account type string to the app's AccountType enum values.
 */
export function mapOFXTypeToAccountType(ofxType: string): string {
  switch (ofxType.toUpperCase()) {
    case 'RRSP':
    case 'SPOUSAL RRSP':
    case 'LRSP': return 'RRSP';
    case 'RRIF': return 'RRIF';
    case 'TFSA': return 'TFSA';
    case 'FHSA': return 'TFSA';     // treat First Home Savings Account same as TFSA
    case 'LIRA': return 'LIRA';
    case 'LIF':  return 'LIF';
    case 'RESP': return 'RESP';
    case 'CORP':
    case 'CORPORATE': return 'CORPORATE';
    case 'CHECKING':
    case 'SAVINGS':
    case 'MONEYMKT':
    case 'CD':   return 'CASH';
    case 'INVESTMENT':
    case 'BROKERAGE':
    case 'MARGIN':
    case 'CREDITLINE':
    default:     return 'NON_REGISTERED';
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Extract the value of a specific tag from a block of OFX text.
 * Handles both XML-style `<TAG>value</TAG>` and SGML "self-closing"
 * leaf elements `<TAG>value` (i.e. no closing tag, ends at next tag or newline).
 */
function extractTag(text: string, tag: string): string | undefined {
  // 1. XML closed form: <TAG>value</TAG>
  const closedRe = new RegExp(`<${tag}>\\s*([^<]+?)\\s*<\\/${tag}>`, 'i');
  const cm = text.match(closedRe);
  if (cm) return cm[1].trim();
  // 2. SGML open-only form: <TAG>value  (end at next '<' or newline)
  const openRe = new RegExp(`<${tag}>\\s*([^<\\n\\r]+)`, 'i');
  const om = text.match(openRe);
  if (om) return om[1].trim();
  return undefined;
}

/** Extract all matching sections between start and end patterns (case-insensitive). */
function extractSections(body: string, openTag: string, closeTag: string): string[] {
  const sections: string[] = [];
  const openRe  = new RegExp(`<${openTag}>`, 'ig');
  const closeRe = new RegExp(`<\\/${closeTag}>`, 'i');
  let match;
  while ((match = openRe.exec(body)) !== null) {
    const start  = match.index;
    const after  = body.slice(start + match[0].length);
    const endIdx = after.search(closeRe);
    if (endIdx !== -1) {
      sections.push(body.slice(start, start + match[0].length + endIdx));
    } else {
      // No closing tag (SGML style) — take until the next sibling opening or end
      const nextSiblingRe = new RegExp(`<${openTag}>`, 'i');
      const nextIdx = after.search(nextSiblingRe);
      sections.push(nextIdx !== -1
        ? body.slice(start, start + match[0].length + nextIdx)
        : body.slice(start),
      );
    }
  }
  return sections;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse an OFX/QFX file buffer and return a list of accounts with balances.
 *
 * @throws {Error} when the file is not recognisable as OFX/QFX.
 */
export function parseOFX(buffer: Buffer): OFXAccountData[] {
  const text = buffer.toString('utf-8').replace(/\r/g, '');

  // Locate root <OFX> element
  const ofxIdx = text.search(/<OFX>/i);
  if (ofxIdx === -1) {
    throw new Error(
      'Invalid OFX/QFX file: no <OFX> root element found. ' +
      'Make sure you are uploading an OFX or QFX statement file.',
    );
  }
  const body = text.slice(ofxIdx);

  const accounts: OFXAccountData[] = [];

  // ── Bank / chequing / savings accounts (STMTRS) ───────────────────────────

  const bankSections = extractSections(body, 'STMTRS', 'STMTRS');
  const invSectionsEarly = extractSections(body, 'INVSTMTRS', 'INVSTMTRS');

  // M7: guard against pathological files with hundreds of account sections
  if (bankSections.length + invSectionsEarly.length > 200) {
    throw new Error(
      'Too many accounts in file (max 200). Ensure you are uploading a single account statement.',
    );
  }

  for (const section of bankSections) {
    const accountId = extractTag(section, 'ACCTID');
    if (!accountId) continue;

    const bankId    = extractTag(section, 'BANKID');
    const acctType  = (extractTag(section, 'ACCTTYPE') ?? 'CHECKING').toUpperCase();
    const currency  = extractTag(section, 'CURDEF') ?? 'CAD';

    // Balance: LEDGERBAL.BALAMT, fall back to AVAILBAL.BALAMT
    const ledgerSection = extractSections(section, 'LEDGERBAL', 'LEDGERBAL')[0]
      ?? extractSections(section, 'AVAILBAL', 'AVAILBAL')[0]
      ?? section;
    const balStr    = extractTag(ledgerSection, 'BALAMT') ?? '0';
    const balance   = parseFloat(balStr) || 0;

    const localAccountType = mapOFXTypeToAccountType(acctType);

    accounts.push({
      accountId,
      bankId,
      accountType: acctType,
      localAccountType,
      balance,
      currency,
      description: `${acctType} ···${accountId.slice(-4)}`,
    });
  }

  // ── Investment / brokerage accounts (INVSTMTRS) ───────────────────────────

  const invSections = invSectionsEarly;

  for (const section of invSections) {
    const accountId = extractTag(section, 'ACCTID');
    if (!accountId) continue;

    const brokerId = extractTag(section, 'BROKERID') ?? extractTag(section, 'BANKID');
    const currency = extractTag(section, 'CURDEF') ?? 'CAD';

    // Infer registered account type from broker-id or description hints
    let acctType = 'INVESTMENT';
    const typeHints = [brokerId ?? '', extractTag(section, 'ACCTTYPE') ?? ''].join(' ').toUpperCase();
    if (/\bRRSP\b/.test(typeHints))  acctType = 'RRSP';
    else if (/\bTFSA\b/.test(typeHints)) acctType = 'TFSA';
    else if (/\bRRIF\b/.test(typeHints)) acctType = 'RRIF';
    else if (/\bLIRA\b/.test(typeHints)) acctType = 'LIRA';
    else if (/\bRESP\b/.test(typeHints)) acctType = 'RESP';
    else if (/\bFHSA\b/.test(typeHints)) acctType = 'FHSA';

    // Total value: INVTOTALS.TOTALASSETS → sum of MKTVAL → INVBAL.AVAILCASH
    let balance = 0;
    const totalsSection = extractSections(section, 'INVTOTALS', 'INVTOTALS')[0];
    if (totalsSection) {
      balance = parseFloat(extractTag(totalsSection, 'TOTALASSETS') ?? '0') || 0;
    }
    if (balance === 0) {
      const mktvals = [...section.matchAll(/<MKTVAL>\s*([0-9.+\-eE]+)/gi)];
      balance = mktvals.reduce((sum, m) => sum + (parseFloat(m[1]) || 0), 0);
    }
    if (balance === 0) {
      const invBalSection = extractSections(section, 'INVBAL', 'INVBAL')[0];
      if (invBalSection) {
        balance = parseFloat(extractTag(invBalSection, 'AVAILCASH') ?? '0') || 0;
      }
    }

    accounts.push({
      accountId,
      bankId: brokerId,
      accountType: acctType.toUpperCase(),
      localAccountType: mapOFXTypeToAccountType(acctType),
      balance,
      currency,
      institution: brokerId,
      description: `${acctType} ···${accountId.slice(-4)}`,
    });
  }

  if (accounts.length === 0) {
    throw new Error(
      'No accounts found in this OFX/QFX file. ' +
      'Ensure you are uploading a bank or brokerage statement (not just a transaction history export).',
    );
  }

  return accounts;
}
