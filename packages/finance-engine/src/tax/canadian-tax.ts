import {
  FEDERAL_TAX_BRACKETS_2024,
  FEDERAL_BASIC_PERSONAL_AMOUNT_2024,
  type Province,
} from '@retiree-plan/shared';

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface TaxResult {
  federalTax: number;
  provincialTax: number;
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
}

/**
 * Calculate tax owed given a set of brackets and taxable income.
 * Applies brackets progressively — each bracket only applies to the
 * portion of income within its range.
 */
export function calculateBracketTax(income: number, brackets: readonly TaxBracket[]): number {
  if (income <= 0) return 0;

  let tax = 0;
  for (const bracket of brackets) {
    if (income <= bracket.min) break;
    const taxableInBracket = Math.min(income, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }
  return Math.max(0, tax);
}

/**
 * Calculate federal income tax for a given taxable income.
 * Uses 2024 brackets by default.
 */
export function calculateFederalTax(
  taxableIncome: number,
  basicPersonalAmount: number = FEDERAL_BASIC_PERSONAL_AMOUNT_2024,
): number {
  const grossTax = calculateBracketTax(taxableIncome, FEDERAL_TAX_BRACKETS_2024);
  const basicPersonalCredit = basicPersonalAmount * 0.15;
  return Math.max(0, grossTax - basicPersonalCredit);
}

/**
 * Provincial/territorial income tax brackets — all 13 PT (2024).
 */
const PROVINCIAL_BRACKETS: Record<Province, TaxBracket[]> = {
  ON: [
    { min: 0, max: 51_446, rate: 0.0505 },
    { min: 51_446, max: 102_894, rate: 0.0915 },
    { min: 102_894, max: 150_000, rate: 0.1116 },
    { min: 150_000, max: 220_000, rate: 0.1216 },
    { min: 220_000, max: Infinity, rate: 0.1316 },
  ],
  BC: [
    { min: 0, max: 47_937, rate: 0.0506 },
    { min: 47_937, max: 95_875, rate: 0.077 },
    { min: 95_875, max: 110_076, rate: 0.105 },
    { min: 110_076, max: 133_664, rate: 0.1229 },
    { min: 133_664, max: 181_232, rate: 0.147 },
    { min: 181_232, max: 252_752, rate: 0.168 },
    { min: 252_752, max: Infinity, rate: 0.205 },
  ],
  AB: [
    { min: 0, max: 148_269, rate: 0.1 },
    { min: 148_269, max: 177_922, rate: 0.12 },
    { min: 177_922, max: 237_230, rate: 0.13 },
    { min: 237_230, max: 355_845, rate: 0.14 },
    { min: 355_845, max: Infinity, rate: 0.15 },
  ],
  QC: [
    { min: 0, max: 51_780, rate: 0.14 },
    { min: 51_780, max: 103_545, rate: 0.19 },
    { min: 103_545, max: 126_000, rate: 0.24 },
    { min: 126_000, max: Infinity, rate: 0.2575 },
  ],
  MB: [
    { min: 0, max: 47_000, rate: 0.108 },
    { min: 47_000, max: 100_000, rate: 0.1275 },
    { min: 100_000, max: Infinity, rate: 0.174 },
  ],
  SK: [
    { min: 0, max: 49_720, rate: 0.105 },
    { min: 49_720, max: 142_058, rate: 0.125 },
    { min: 142_058, max: Infinity, rate: 0.145 },
  ],
  NB: [
    { min: 0, max: 47_715, rate: 0.094 },
    { min: 47_715, max: 95_431, rate: 0.14 },
    { min: 95_431, max: 176_756, rate: 0.16 },
    { min: 176_756, max: Infinity, rate: 0.195 },
  ],
  NS: [
    { min: 0, max: 29_590, rate: 0.0879 },
    { min: 29_590, max: 59_180, rate: 0.1495 },
    { min: 59_180, max: 93_000, rate: 0.1667 },
    { min: 93_000, max: 150_000, rate: 0.175 },
    { min: 150_000, max: Infinity, rate: 0.21 },
  ],
  NL: [
    { min: 0, max: 43_198, rate: 0.087 },
    { min: 43_198, max: 86_395, rate: 0.145 },
    { min: 86_395, max: 154_244, rate: 0.158 },
    { min: 154_244, max: 215_943, rate: 0.178 },
    { min: 215_943, max: 275_870, rate: 0.198 },
    { min: 275_870, max: 551_739, rate: 0.208 },
    { min: 551_739, max: Infinity, rate: 0.218 },
  ],
  PE: [
    { min: 0, max: 32_656, rate: 0.096 },
    { min: 32_656, max: 64_313, rate: 0.1337 },
    { min: 64_313, max: 105_000, rate: 0.1638 },
    { min: 105_000, max: 140_000, rate: 0.1675 },
    { min: 140_000, max: Infinity, rate: 0.18 },
  ],
  NT: [
    { min: 0, max: 50_597, rate: 0.059 },
    { min: 50_597, max: 101_198, rate: 0.086 },
    { min: 101_198, max: 164_525, rate: 0.122 },
    { min: 164_525, max: Infinity, rate: 0.1405 },
  ],
  NU: [
    { min: 0, max: 53_268, rate: 0.04 },
    { min: 53_268, max: 106_537, rate: 0.07 },
    { min: 106_537, max: 173_205, rate: 0.09 },
    { min: 173_205, max: Infinity, rate: 0.115 },
  ],
  YT: [
    { min: 0, max: 55_867, rate: 0.064 },
    { min: 55_867, max: 111_733, rate: 0.09 },
    { min: 111_733, max: 154_906, rate: 0.109 },
    { min: 154_906, max: 500_000, rate: 0.128 },
    { min: 500_000, max: Infinity, rate: 0.15 },
  ],
};

const PROVINCIAL_BASIC_PERSONAL: Record<Province, number> = {
  ON: 11_865,
  BC: 12_580,
  AB: 21_003,
  QC: 17_183,
  MB: 15_780,
  SK: 17_661,
  NB: 12_458,
  NS: 8_481,
  NL: 10_818,
  PE: 12_000,
  NT: 16_593,
  NU: 17_925,
  YT: 15_705,
};

/**
 * Calculate provincial income tax for all 13 provinces/territories.
 */
export function calculateProvincialTax(taxableIncome: number, province: Province): number {
  const brackets = PROVINCIAL_BRACKETS[province];
  const basicPersonal = PROVINCIAL_BASIC_PERSONAL[province];
  const grossTax = calculateBracketTax(taxableIncome, brackets);
  const lowestRate = brackets[0]?.rate ?? 0.0505;
  const basicCredit = basicPersonal * lowestRate;
  return Math.max(0, grossTax - basicCredit);
}

/**
 * Calculate combined federal + provincial tax and derived rates.
 */
export function calculateTotalTax(taxableIncome: number, province: Province): TaxResult {
  const federalTax = calculateFederalTax(taxableIncome);
  const provincialTax = calculateProvincialTax(taxableIncome, province);
  const totalTax = federalTax + provincialTax;
  const effectiveRate = taxableIncome > 0 ? totalTax / taxableIncome : 0;

  // Find marginal rate (combined)
  const delta = 1;
  const taxOnExtra = calculateFederalTax(taxableIncome + delta) +
    calculateProvincialTax(taxableIncome + delta, province);
  const marginalRate = taxOnExtra - totalTax;

  return {
    federalTax: Math.round(federalTax * 100) / 100,
    provincialTax: Math.round(provincialTax * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    effectiveRate: Math.round(effectiveRate * 10000) / 10000,
    marginalRate: Math.round(marginalRate * 10000) / 10000,
  };
}
