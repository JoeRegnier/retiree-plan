/** Canadian provinces and territories (2-letter codes) */
export const PROVINCES = [
  'AB',
  'BC',
  'MB',
  'NB',
  'NL',
  'NS',
  'NT',
  'NU',
  'ON',
  'PE',
  'QC',
  'SK',
  'YT',
] as const;

export type Province = (typeof PROVINCES)[number];

/** Province display names */
export const PROVINCE_NAMES: Record<Province, string> = {
  AB: 'Alberta',
  BC: 'British Columbia',
  MB: 'Manitoba',
  NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  ON: 'Ontario',
  PE: 'Prince Edward Island',
  QC: 'Quebec',
  SK: 'Saskatchewan',
  YT: 'Yukon',
};

/** Federal tax brackets for 2024 */
export const FEDERAL_TAX_BRACKETS_2024 = [
  { min: 0, max: 55_867, rate: 0.15 },
  { min: 55_867, max: 111_733, rate: 0.205 },
  { min: 111_733, max: 154_906, rate: 0.26 },
  { min: 154_906, max: 220_000, rate: 0.29 },
  { min: 220_000, max: Infinity, rate: 0.33 },
] as const;

/** Basic personal amount (federal) 2024 */
export const FEDERAL_BASIC_PERSONAL_AMOUNT_2024 = 15_705;

/** CPP constants for 2024 */
export const CPP_2024 = {
  maxPensionableEarnings: 68_500,
  basicExemption: 3_500,
  employeeRate: 0.0595,
  maxContribution: 3_867.5,
  maxMonthlyBenefitAt65: 1_364.6,
  earlyReductionPerMonth: 0.006,
  deferralIncreasePerMonth: 0.007,
} as const;

/** OAS constants for 2024 */
export const OAS_2024 = {
  maxMonthlyBenefit: 713.34,
  clawbackThreshold: 90_997,
  clawbackRate: 0.15,
  fullClawbackIncome: 148_000,
  deferralIncreasePerMonth: 0.006,
  yearsForFullOAS: 40,
  minimumYearsForOAS: 10,
} as const;

/** RRSP constants for 2024 */
export const RRSP_2024 = {
  contributionRateOfEarnedIncome: 0.18,
  maxContribution: 31_560,
  overContributionBuffer: 2_000,
  conversionDeadlineAge: 71,
} as const;

/** TFSA annual limit for 2024 */
export const TFSA_ANNUAL_LIMIT_2024 = 7_000;

/** TFSA cumulative limits by year (since 2009) */
export const TFSA_ANNUAL_LIMITS: Record<number, number> = {
  2009: 5_000,
  2010: 5_000,
  2011: 5_000,
  2012: 5_000,
  2013: 5_500,
  2014: 5_500,
  2015: 10_000,
  2016: 5_500,
  2017: 5_500,
  2018: 5_500,
  2019: 6_000,
  2020: 6_000,
  2021: 6_000,
  2022: 6_000,
  2023: 6_500,
  2024: 7_000,
  2025: 7_000,
  2026: 7_000,
};

/** RRIF minimum withdrawal percentages by age */
export const RRIF_MINIMUM_WITHDRAWAL: Record<number, number> = {
  71: 0.0528,
  72: 0.054,
  73: 0.0553,
  74: 0.0567,
  75: 0.0582,
  76: 0.0598,
  77: 0.0617,
  78: 0.0636,
  79: 0.0658,
  80: 0.0682,
  81: 0.0708,
  82: 0.0738,
  83: 0.0771,
  84: 0.0808,
  85: 0.0851,
  86: 0.0899,
  87: 0.0955,
  88: 0.1021,
  89: 0.1099,
  90: 0.1192,
  91: 0.1306,
  92: 0.1449,
  93: 0.1634,
  94: 0.1879,
  95: 0.2,
};

/** Default simulation parameters */
export const DEFAULT_INFLATION_RATE = 0.02;
export const DEFAULT_REAL_RETURN_RATE = 0.04;
export const DEFAULT_MONTE_CARLO_TRIALS = 1_000;

/** TFSA annual limit for 2026 (projected - same as 2025 until CRA announces) */
export const TFSA_ANNUAL_LIMIT_2026 = 7_000;

/** Capital market assumptions - updated annually */
export const CAPITAL_MARKET_ASSUMPTIONS = {
  equityExpectedReturn: 0.07,
  fixedIncomeExpectedReturn: 0.035,
  alternativesExpectedReturn: 0.055,
  cashExpectedReturn: 0.025,
  inflationExpectation: 0.02,
  lastUpdated: '2026-01-01',
} as const;
