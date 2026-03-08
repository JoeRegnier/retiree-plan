import { RRSP_2024, TFSA_ANNUAL_LIMITS } from '@retiree-plan/shared';

const TFSA_START_YEAR = 2009;
const CURRENT_YEAR = new Date().getUTCFullYear();
const TFSA_LIMIT_YEARS = Object.keys(TFSA_ANNUAL_LIMITS)
  .map((year) => Number(year))
  .sort((a, b) => a - b);
const LAST_KNOWN_TFSA_YEAR = TFSA_LIMIT_YEARS[TFSA_LIMIT_YEARS.length - 1] ?? TFSA_START_YEAR;
const LAST_KNOWN_TFSA_LIMIT = TFSA_ANNUAL_LIMITS[LAST_KNOWN_TFSA_YEAR] ?? 0;

export interface ContributionRoomInput {
  /** User-entered current RRSP contribution room (from CRA NOA) */
  currentRrspRoom: number;
  /** User-entered current TFSA contribution room */
  currentTfsaRoom: number;
  /** Prior-year earned income (for computing new RRSP room) */
  priorYearIncome: number;
  /** Current age of the member */
  currentAge: number;
  /** Planned retirement age */
  retirementAge: number;
  /** ISO date string for date of birth */
  dateOfBirth: string;
  /** Annual RRSP contribution the user plans to make */
  annualRrspContribution: number;
  /** Annual TFSA contribution the user plans to make */
  annualTfsaContribution: number;
}

export interface ContributionRoomResult {
  rrsp: {
    currentRoom: number;
    annualNewRoom: number;
    projectedRoomAtRetirement: number;
    overContribution: boolean;
  };
  tfsa: {
    currentRoom: number;
    totalCumulativeRoom: number;
    annualLimit: number;
    projectedRoomAtRetirement: number;
    overContribution: boolean;
  };
}

function parseYearTurned18(dateOfBirth: string): number {
  if (!dateOfBirth) {
    throw new Error('Date of birth is required for contribution room calculation');
  }

  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) {
    throw new Error(`Invalid dateOfBirth: ${dateOfBirth}`);
  }

  return birthDate.getUTCFullYear() + 18;
}

function resolveTfsaAnnualLimit(year: number): number {
  // For years beyond the lookup table, continue using the latest known annual limit.
  return TFSA_ANNUAL_LIMITS[year] ?? LAST_KNOWN_TFSA_LIMIT;
}

function calculateTfsaCumulativeRoom(yearTurned18: number): number {
  const startYear = Math.max(TFSA_START_YEAR, yearTurned18);
  let total = 0;

  for (let year = startYear; year <= CURRENT_YEAR; year += 1) {
    total += resolveTfsaAnnualLimit(year);
  }

  return total;
}

export function calculateContributionRoom(input: ContributionRoomInput): ContributionRoomResult {
  const annualNewRrspRoom = Math.min(
    input.priorYearIncome * RRSP_2024.contributionRateOfEarnedIncome,
    RRSP_2024.maxContribution,
  );

  let projectedRrspRoomAtRetirement = input.currentRrspRoom;
  for (let age = input.currentAge; age < input.retirementAge; age += 1) {
    const generatedRoom = age <= RRSP_2024.conversionDeadlineAge ? annualNewRrspRoom : 0;
    projectedRrspRoomAtRetirement += generatedRoom - input.annualRrspContribution;
  }

  const yearTurned18 = parseYearTurned18(input.dateOfBirth);
  const totalCumulativeTfsaRoom = calculateTfsaCumulativeRoom(yearTurned18);
  const annualTfsaLimit = resolveTfsaAnnualLimit(CURRENT_YEAR);

  let projectedTfsaRoomAtRetirement = input.currentTfsaRoom;
  for (let age = input.currentAge; age < input.retirementAge; age += 1) {
    projectedTfsaRoomAtRetirement += annualTfsaLimit - input.annualTfsaContribution;
  }

  return {
    rrsp: {
      currentRoom: input.currentRrspRoom,
      annualNewRoom: annualNewRrspRoom,
      projectedRoomAtRetirement: projectedRrspRoomAtRetirement,
      overContribution: input.currentRrspRoom < -RRSP_2024.overContributionBuffer,
    },
    tfsa: {
      currentRoom: input.currentTfsaRoom,
      totalCumulativeRoom: totalCumulativeTfsaRoom,
      annualLimit: annualTfsaLimit,
      projectedRoomAtRetirement: projectedTfsaRoomAtRetirement,
      overContribution: input.currentTfsaRoom < 0,
    },
  };
}
