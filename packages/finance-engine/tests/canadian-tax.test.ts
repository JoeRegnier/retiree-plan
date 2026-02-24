import { describe, it, expect } from 'vitest';
import {
  calculateBracketTax,
  calculateFederalTax,
  calculateProvincialTax,
  calculateTotalTax,
} from '../src/tax/canadian-tax.js';
import { FEDERAL_TAX_BRACKETS_2024 } from '@retiree-plan/shared';

describe('Canadian Tax Engine', () => {
  describe('calculateBracketTax', () => {
    it('returns 0 for zero income', () => {
      expect(calculateBracketTax(0, FEDERAL_TAX_BRACKETS_2024)).toBe(0);
    });

    it('returns 0 for negative income', () => {
      expect(calculateBracketTax(-10000, FEDERAL_TAX_BRACKETS_2024)).toBe(0);
    });

    it('correctly calculates tax in the first bracket only', () => {
      // $50,000 at 15% = $7,500
      const tax = calculateBracketTax(50_000, FEDERAL_TAX_BRACKETS_2024);
      expect(tax).toBeCloseTo(7500, 0);
    });

    it('correctly calculates tax across multiple brackets', () => {
      // $100,000:
      //   55,867 * 0.15 = 8,380.05
      //   44,133 * 0.205 = 9,047.27
      //   Total = 17,427.32
      const tax = calculateBracketTax(100_000, FEDERAL_TAX_BRACKETS_2024);
      expect(tax).toBeCloseTo(17_427.32, 0);
    });
  });

  describe('calculateFederalTax', () => {
    it('returns 0 for income at or below basic personal amount', () => {
      expect(calculateFederalTax(15_000)).toBe(0);
    });

    it('calculates correctly for $80,000 income', () => {
      const tax = calculateFederalTax(80_000);
      // Gross: 55,867*0.15 + 24,133*0.205 = 8,380.05 + 4,947.27 = 13,327.32
      // Credit: 15,705 * 0.15 = 2,355.75
      // Net: 10,971.57
      expect(tax).toBeCloseTo(10_971.57, 0);
    });
  });

  describe('calculateProvincialTax', () => {
    it('calculates Ontario provincial tax', () => {
      const tax = calculateProvincialTax(80_000, 'ON');
      expect(tax).toBeGreaterThan(0);
    });

    it('calculates Alberta provincial tax', () => {
      const tax = calculateProvincialTax(80_000, 'AB');
      expect(tax).toBeGreaterThan(0);
    });
  });

  describe('calculateTotalTax', () => {
    it('returns all components for $100,000 in Ontario', () => {
      const result = calculateTotalTax(100_000, 'ON');
      expect(result.federalTax).toBeGreaterThan(0);
      expect(result.provincialTax).toBeGreaterThan(0);
      expect(result.totalTax).toBeCloseTo(result.federalTax + result.provincialTax, 1);
      expect(result.effectiveRate).toBeGreaterThan(0);
      expect(result.effectiveRate).toBeLessThan(1);
      expect(result.marginalRate).toBeGreaterThan(result.effectiveRate);
    });
  });
});
