import { describe, it, expect } from 'vitest';
import { createUserSchema, loginSchema } from '../src/schemas/user.js';
import { createHouseholdSchema } from '../src/schemas/household.js';
import { createAccountSchema } from '../src/schemas/account.js';
import { createScenarioSchema } from '../src/schemas/scenario.js';

describe('User schemas', () => {
  it('validates a correct createUser input', () => {
    const result = createUserSchema.safeParse({
      email: 'test@example.com',
      password: 'securepassword',
      name: 'Test User',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = createUserSchema.safeParse({
      email: 'not-an-email',
      password: 'securepassword',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = createUserSchema.safeParse({
      email: 'test@example.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('validates login input', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'anypassword',
    });
    expect(result.success).toBe(true);
  });
});

describe('Household schemas', () => {
  it('validates a correct household with members', () => {
    const result = createHouseholdSchema.safeParse({
      name: 'The Smiths',
      members: [
        { name: 'John', dateOfBirth: '1970-05-15', province: 'ON' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects household with no members', () => {
    const result = createHouseholdSchema.safeParse({
      name: 'Empty Household',
      members: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid province', () => {
    const result = createHouseholdSchema.safeParse({
      name: 'Bad Province',
      members: [
        { name: 'Jane', dateOfBirth: '1975-01-01', province: 'XX' },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('Account schemas', () => {
  it('validates a correct account', () => {
    const result = createAccountSchema.safeParse({
      name: 'My RRSP',
      type: 'RRSP',
      balance: 100000,
      householdId: 'abc123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown account type', () => {
    const result = createAccountSchema.safeParse({
      name: 'Bad Account',
      type: 'UNKNOWN',
      balance: 0,
      householdId: 'abc123',
    });
    expect(result.success).toBe(false);
  });
});

describe('Scenario schemas', () => {
  it('validates a correct scenario', () => {
    const result = createScenarioSchema.safeParse({
      name: 'Base Case',
      householdId: 'abc123',
      parameters: {
        retirementAge: 65,
        inflationRate: 0.02,
        realReturnRate: 0.04,
        cppStartAge: 65,
        oasStartAge: 65,
      },
    });
    expect(result.success).toBe(true);
  });

  it('applies defaults for missing optional parameters', () => {
    const result = createScenarioSchema.safeParse({
      name: 'Defaults Test',
      householdId: 'abc123',
      parameters: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parameters.inflationRate).toBe(0.02);
      expect(result.data.parameters.cppStartAge).toBe(65);
    }
  });
});
