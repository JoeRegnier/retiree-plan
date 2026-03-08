/**
 * Real estate projection utilities for Canadian retirement planning.
 */

export interface RealEstateProperty {
  name: string;
  propertyType: 'PRIMARY_RESIDENCE' | 'RENTAL' | 'VACATION';
  currentValue: number;
  purchasePrice: number;
  annualAppreciation: number;
  grossRentalIncome: number | null;
  rentalExpenses: number | null;
  sellAtAge: number | null;
  netProceedsPercent: number;
}

export interface RealEstateProjectionYear {
  age: number;
  propertyValue: number;
  netRentalIncome: number;
  sold: boolean;
  saleProceeds: number;
  capitalGain: number;
  capitalGainTax: number;
}

export interface DownsizingEvent {
  age: number;
  grossProceeds: number;
  netProceeds: number;
  capitalGain: number;
  taxOwed: number;
}

/** Project property value forward by N years using compound appreciation. */
export function projectRealEstateValue(
  property: RealEstateProperty,
  years: number,
): number {
  return property.currentValue * Math.pow(1 + property.annualAppreciation, years);
}

/** Calculate annual net rental income (gross - expenses). Returns 0 for non-rental. */
export function calculateNetRentalIncome(property: RealEstateProperty): number {
  if (property.propertyType !== 'RENTAL') return 0;
  return (property.grossRentalIncome ?? 0) - (property.rentalExpenses ?? 0);
}

/**
 * Calculate downsizing proceeds when selling a property at a given age.
 * Primary residences are exempt from capital gains tax (PRE).
 * Other properties pay capital gains at 50% inclusion.
 */
export function calculateDownsizingProceeds(
  property: RealEstateProperty,
  currentAge: number,
  capitalGainsTaxRate: number,
): DownsizingEvent | null {
  if (property.sellAtAge == null) return null;

  const yearsToSell = property.sellAtAge - currentAge;
  if (yearsToSell < 0) return null;

  const valueAtSale = projectRealEstateValue(property, yearsToSell);
  const grossProceeds = valueAtSale;
  const netProceeds = grossProceeds * property.netProceedsPercent;

  const capitalGain = Math.max(0, valueAtSale - property.purchasePrice);
  // Primary residence exemption: no capital gains tax
  const taxOwed = property.propertyType === 'PRIMARY_RESIDENCE'
    ? 0
    : capitalGain * capitalGainsTaxRate;

  return {
    age: property.sellAtAge,
    grossProceeds,
    netProceeds: netProceeds - taxOwed,
    capitalGain,
    taxOwed,
  };
}

/**
 * Calculate capital gain on a real estate property.
 * Primary residences are exempt under the Principal Residence Exemption.
 */
export function calculateRealEstateCapitalGain(
  currentValue: number,
  purchasePrice: number,
  isPrimaryResidence: boolean,
): number {
  if (isPrimaryResidence) return 0;
  return Math.max(0, currentValue - purchasePrice);
}

/**
 * Project real estate holdings year-by-year for a given property.
 */
export function projectRealEstate(
  property: RealEstateProperty,
  currentAge: number,
  endAge: number,
  inflationRate: number,
  capitalGainsTaxRate: number,
): RealEstateProjectionYear[] {
  const years: RealEstateProjectionYear[] = [];

  for (let age = currentAge; age <= endAge; age++) {
    const yearIndex = age - currentAge;
    const propertyValue = projectRealEstateValue(property, yearIndex);
    const inflationFactor = Math.pow(1 + inflationRate, yearIndex);

    // Rental income grows with inflation
    const netRental = property.propertyType === 'RENTAL'
      ? calculateNetRentalIncome(property) * inflationFactor
      : 0;

    const sold = property.sellAtAge != null && age === property.sellAtAge;
    let saleProceeds = 0;
    let capitalGain = 0;
    let capitalGainTax = 0;

    if (sold) {
      const downsizing = calculateDownsizingProceeds(property, currentAge, capitalGainsTaxRate);
      if (downsizing) {
        saleProceeds = downsizing.netProceeds;
        capitalGain = downsizing.capitalGain;
        capitalGainTax = downsizing.taxOwed;
      }
    }

    years.push({
      age,
      propertyValue: sold ? 0 : propertyValue,
      netRentalIncome: sold ? 0 : netRental,
      sold,
      saleProceeds,
      capitalGain,
      capitalGainTax,
    });
  }

  return years;
}
