import { describe, it, expect } from 'vitest';
import { calculateCppBenefit, calculateOasBenefit } from '../src/benefits/government.js';

describe('Government Benefits', () => {
  describe('CPP', () => {
    it('calculates full benefit at age 65', () => {
      const benefit = calculateCppBenefit({ startAge: 65 });
      // ~$16,375.20 annually (1364.60 * 12)
      expect(benefit).toBeCloseTo(16_375.20, 0);
    });

    it('reduces benefit for early start at 60', () => {
      const benefit = calculateCppBenefit({ startAge: 60 });
      const fullBenefit = calculateCppBenefit({ startAge: 65 });
      // 36% reduction
      expect(benefit).toBeCloseTo(fullBenefit * 0.64, 0);
    });

    it('increases benefit for deferred start at 70', () => {
      const benefit = calculateCppBenefit({ startAge: 70 });
      const fullBenefit = calculateCppBenefit({ startAge: 65 });
      // 42% increase
      expect(benefit).toBeCloseTo(fullBenefit * 1.42, 0);
    });

    it('applies benefit fraction', () => {
      const benefit = calculateCppBenefit({ startAge: 65, benefitFraction: 0.5 });
      const fullBenefit = calculateCppBenefit({ startAge: 65 });
      expect(benefit).toBeCloseTo(fullBenefit * 0.5, 0);
    });
  });

  describe('OAS', () => {
    it('calculates full benefit at age 65 with 40 years residency', () => {
      const benefit = calculateOasBenefit({ startAge: 65 });
      // ~$8,560.08 annually (713.34 * 12)
      expect(benefit).toBeCloseTo(8_560.08, 0);
    });

    it('returns 0 for less than 10 years residency', () => {
      const benefit = calculateOasBenefit({ startAge: 65, yearsOfResidency: 5 });
      expect(benefit).toBe(0);
    });

    it('prorates for partial residency', () => {
      const full = calculateOasBenefit({ startAge: 65, yearsOfResidency: 40 });
      const half = calculateOasBenefit({ startAge: 65, yearsOfResidency: 20 });
      expect(half).toBeCloseTo(full * 0.5, 0);
    });

    it('applies clawback for high income', () => {
      const noClawback = calculateOasBenefit({ startAge: 65, netIncome: 80_000 });
      const withClawback = calculateOasBenefit({ startAge: 65, netIncome: 120_000 });
      expect(withClawback).toBeLessThan(noClawback);
    });

    it('fully claws back at very high income', () => {
      const benefit = calculateOasBenefit({ startAge: 65, netIncome: 200_000 });
      expect(benefit).toBe(0);
    });

    it('increases benefit for deferral to 70', () => {
      const at65 = calculateOasBenefit({ startAge: 65 });
      const at70 = calculateOasBenefit({ startAge: 70 });
      expect(at70).toBeGreaterThan(at65);
      // 36% increase
      expect(at70).toBeCloseTo(at65 * 1.36, 0);
    });
  });
});
