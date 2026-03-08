import { describe, it, expect } from 'vitest';
import { calculatePlanCompleteness } from '../src/scoring/plan-completeness.js';

function getItem(
  result: ReturnType<typeof calculatePlanCompleteness>,
  id: string,
) {
  const item = result.items.find((entry) => entry.id === id);
  expect(item).toBeDefined();
  return item!;
}

describe('calculatePlanCompleteness', () => {
  describe('overall completion scoring', () => {
    it('returns 100% for a complete plan', () => {
      const result = calculatePlanCompleteness({
        members: [
          {
            dateOfBirth: '1975-02-02',
            province: 'ON',
            cppExpectedBenefit: 14_400,
            rrspContributionRoom: 20_000,
            tfsaContributionRoom: 8_000,
            priorYearIncome: 95_000,
            incomeSources: [
              { type: 'employment', startAge: 45, annualAmount: 90_000 },
              { type: 'cpp', startAge: 65, annualAmount: 14_400 },
            ],
          },
        ],
        accounts: [
          { type: 'RRSP', balance: 250_000 },
          { type: 'TFSA', balance: 75_000 },
          { type: 'CASH', balance: 12_500 },
        ],
        scenarios: [
          {
            parameters: {
              cppStartAge: 65,
              oasStartAge: 65,
              inflationRate: 0.02,
              realReturnRate: 0.04,
            },
          },
        ],
        expenses: [{ annualAmount: 62_000 }],
      });

      expect(result.percentage).toBe(100);
      expect(result.items).toHaveLength(13);
      result.items.forEach((item) => {
        expect(item.completed).toBe(true);
      });
    });

    it('returns 0% for an empty plan', () => {
      const result = calculatePlanCompleteness({
        members: [],
        accounts: [],
        scenarios: [],
        expenses: [],
      });

      expect(result.percentage).toBe(0);
      expect(result.items).toHaveLength(13);
      result.items.forEach((item) => {
        expect(item.completed).toBe(false);
      });
    });

    it('returns the expected percentage for a partial plan', () => {
      const result = calculatePlanCompleteness({
        members: [
          {
            dateOfBirth: '1980-01-01',
            province: null,
            cppExpectedBenefit: null,
            incomeSources: [{ type: 'employment', annualAmount: 50_000 }],
          },
        ],
        accounts: [{ type: 'rrsp', balance: 10_000 }],
        scenarios: [{ parameters: { cppStartAge: 65 } }],
        expenses: [],
      });

      const completedIds = result.items
        .filter((item) => item.completed)
        .map((item) => item.id)
        .sort();

      expect(completedIds).toEqual([
        'cpp-config',
        'dob',
        'income-sources',
        'rrsp',
        'scenario',
      ]);

      // 5 of 13 items completed => 38% after rounding.
      expect(result.percentage).toBe(38);
    });
  });

  describe('completion logic details', () => {
    it('parses scenario parameters when provided as a JSON string', () => {
      const result = calculatePlanCompleteness({
        members: [],
        accounts: [],
        scenarios: [
          {
            parameters:
              '{"cppStartAge":65,"oasStartAge":65,"inflationRate":0.02,"realReturnRate":0.04}',
          },
        ],
        expenses: [],
      });

      expect(getItem(result, 'scenario').completed).toBe(true);
      expect(getItem(result, 'cpp-config').completed).toBe(true);
      expect(getItem(result, 'oas-config').completed).toBe(true);
      expect(getItem(result, 'inflation').completed).toBe(true);
      expect(getItem(result, 'return-rate').completed).toBe(true);
    });

    it('marks cpp-benefit complete when member has cpp income source only', () => {
      const result = calculatePlanCompleteness({
        members: [
          {
            dateOfBirth: '1970-03-03',
            province: 'BC',
            cppExpectedBenefit: null,
            incomeSources: [{ type: 'cpp', annualAmount: 13_000 }],
          },
        ],
        accounts: [],
        scenarios: [],
        expenses: [],
      });

      expect(getItem(result, 'cpp-benefit').completed).toBe(true);
    });

    it('counts RRIF account balances toward rrsp checklist item', () => {
      const result = calculatePlanCompleteness({
        members: [],
        accounts: [{ type: 'RRIF', balance: 40_000 }],
        scenarios: [],
        expenses: [],
      });

      expect(getItem(result, 'rrsp').completed).toBe(true);
    });

    it('requires date of birth for all members', () => {
      const result = calculatePlanCompleteness({
        members: [
          { dateOfBirth: '1968-04-04', province: 'ON', incomeSources: [] },
          { dateOfBirth: null, province: 'ON', incomeSources: [] },
        ],
        accounts: [],
        scenarios: [],
        expenses: [],
      });

      expect(getItem(result, 'dob').completed).toBe(false);
    });
  });

  describe('item metadata', () => {
    it('returns items with expected categories and link targets', () => {
      const result = calculatePlanCompleteness({
        members: [],
        accounts: [],
        scenarios: [],
        expenses: [],
      });

      const itemMeta = result.items.map((item) => ({
        id: item.id,
        category: item.category,
        linkTo: item.linkTo,
      }));

      expect(itemMeta).toEqual([
        { id: 'dob', category: 'basics', linkTo: undefined },
        { id: 'province', category: 'basics', linkTo: undefined },
        { id: 'expenses', category: 'basics', linkTo: '/household' },
        { id: 'cpp-config', category: 'income', linkTo: '/scenarios' },
        { id: 'cpp-benefit', category: 'income', linkTo: '/household' },
        { id: 'oas-config', category: 'income', linkTo: '/scenarios' },
        { id: 'income-sources', category: 'income', linkTo: '/household' },
        { id: 'rrsp', category: 'accounts', linkTo: '/accounts' },
        { id: 'tfsa', category: 'accounts', linkTo: '/accounts' },
        { id: 'cash', category: 'accounts', linkTo: '/accounts' },
        { id: 'scenario', category: 'planning', linkTo: '/scenarios' },
        { id: 'inflation', category: 'planning', linkTo: '/scenarios' },
        { id: 'return-rate', category: 'planning', linkTo: '/scenarios' },
      ]);
    });
  });
});