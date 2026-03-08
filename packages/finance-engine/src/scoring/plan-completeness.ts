export interface PlanCompletenessInput {
  members: {
    dateOfBirth?: string | null;
    province?: string | null;
    cppExpectedBenefit?: number | null;
    rrspContributionRoom?: number | null;
    tfsaContributionRoom?: number | null;
    priorYearIncome?: number | null;
    incomeSources?: {
      type: string;
      startAge?: number | null;
      annualAmount?: number | null;
    }[];
  }[];
  accounts: { type: string; balance: number }[];
  scenarios: { parameters: any }[];
  expenses: { annualAmount: number }[];
}

export interface PlanCompletenessResult {
  percentage: number;
  items: PlanChecklistItem[];
}

export interface PlanChecklistItem {
  id: string;
  label: string;
  hint?: string;
  completed: boolean;
  category: 'basics' | 'income' | 'accounts' | 'planning';
  linkTo?: string;
}

function normalizeType(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function parseScenarioParameters(
  parameters: unknown,
): Record<string, unknown> | null {
  if (typeof parameters === 'string') {
    try {
      const parsed = JSON.parse(parameters);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
    return parameters as Record<string, unknown>;
  }

  return null;
}

export function calculatePlanCompleteness(
  input: PlanCompletenessInput,
): PlanCompletenessResult {
  const members = Array.isArray(input.members) ? input.members : [];
  const accounts = Array.isArray(input.accounts) ? input.accounts : [];
  const scenarios = Array.isArray(input.scenarios) ? input.scenarios : [];
  const expenses = Array.isArray(input.expenses) ? input.expenses : [];

  const hasMembers = members.length > 0;
  const parsedScenarioParameters = scenarios
    .map((scenario) => parseScenarioParameters(scenario?.parameters))
    .filter((parameters): parameters is Record<string, unknown> =>
      Boolean(parameters),
    );

  const hasAnyIncomeSource =
    hasMembers &&
    members.some(
      (member) =>
        Array.isArray(member.incomeSources) && member.incomeSources.length > 0,
    );

  const hasCppIncomeSource =
    hasMembers &&
    members.some((member) =>
      (member.incomeSources ?? []).some(
        (source) => normalizeType(source?.type) === 'cpp',
      ),
    );

  const items: PlanChecklistItem[] = [
    {
      id: 'dob',
      label: 'Date of birth for all members',
      hint: 'Used to calculate current age and years to retirement.',
      completed:
        hasMembers && members.every((member) => member.dateOfBirth != null),
      category: 'basics',
      linkTo: '/household',
    },
    {
      id: 'province',
      label: 'Province set for all members',
      hint: 'Provincial tax rules affect how much of your income is taxed each year.',
      completed: hasMembers && members.every((member) => member.province != null),
      category: 'basics',
      linkTo: '/household',
    },
    {
      id: 'expenses',
      label: 'Expenses entered',
      hint: 'No expense categories detected. Add individual expenses on the Household page or import from YNAB. Projections fall back to a default of $60,000/yr until this is set.',
      completed: expenses.some((expense) => expense.annualAmount > 0),
      category: 'basics',
      linkTo: '/household',
    },
    {
      id: 'cpp-config',
      label: 'CPP start age configured',
      hint: 'Starting CPP at 70 vs 65 can increase your benefit by up to 42%.',
      completed: parsedScenarioParameters.some(
        (parameters) => parameters.cppStartAge != null,
      ),
      category: 'income',
      linkTo: '/scenarios',
    },
    {
      id: 'cpp-benefit',
      label: 'CPP benefit amount entered',
      hint: 'Your personal CPP estimate offsets how much your portfolio must cover. Add it on the Household page, or look it up in your My Service Canada Account.',

      completed:
        (hasMembers &&
          members.some((member) => member.cppExpectedBenefit != null)) ||
        hasCppIncomeSource,
      category: 'income',
      linkTo: '/household',
    },
    {
      id: 'oas-config',
      label: 'OAS start age configured',
      hint: 'Deferring OAS beyond 65 increases the benefit by 0.6% per month, up to 36% at age 70.',
      completed: parsedScenarioParameters.some(
        (parameters) => parameters.oasStartAge != null,
      ),
      category: 'income',
      linkTo: '/scenarios',
    },
    {
      id: 'income-sources',
      label: 'Income sources defined',
      hint: 'Employment, pension, rental, and other income reduce how much your portfolio needs to cover.',
      completed: hasAnyIncomeSource,
      category: 'income',
      linkTo: '/household',
    },
    {
      id: 'rrsp',
      label: 'RRSP account or balance entered',
      hint: 'RRSP/RRIF balances are a major source of retirement income and are converted to RRIF by age 71.',
      completed: accounts.some((account) => {
        const type = normalizeType(account.type);
        return (type === 'rrsp' || type === 'rrif') && account.balance > 0;
      }),
      category: 'accounts',
      linkTo: '/accounts',
    },
    {
      id: 'tfsa',
      label: 'TFSA account or balance entered',
      hint: 'TFSA withdrawals are tax-free and do not affect OAS/GIS clawbacks — a powerful retirement tool.',
      completed: accounts.some(
        (account) => normalizeType(account.type) === 'tfsa' && account.balance > 0,
      ),
      category: 'accounts',
      linkTo: '/accounts',
    },
    {
      id: 'cash',
      label: 'Cash or savings balance entered',
      hint: 'No cash or savings account found. Add one on the Accounts page. A 3–6 month expense buffer avoids forced withdrawals during market downturns.',

      completed: accounts.some(
        (account) => normalizeType(account.type) === 'cash' && account.balance > 0,
      ),
      category: 'accounts',
      linkTo: '/accounts',
    },
    {
      id: 'scenario',
      label: 'At least one scenario defined',
      hint: 'Scenarios let you model different retirement ages, return rates, and spending to stress-test your plan.',
      completed: scenarios.length > 0,
      category: 'planning',
      linkTo: '/scenarios',
    },
    {
      id: 'inflation',
      label: 'Inflation rate reviewed',
      hint: 'Even 2% inflation halves purchasing power over 35 years — confirm the rate matches your expectations.',
      completed: parsedScenarioParameters.some(
        (parameters) => parameters.inflationRate != null,
      ),
      category: 'planning',
      linkTo: '/scenarios',
    },
    {
      id: 'return-rate',
      label: 'Return rate reviewed',
      hint: 'No real return rate set in your scenario. This is the single biggest assumption in your projection — open your scenario and confirm the rate reflects your portfolio mix.',

      completed: parsedScenarioParameters.some(
        (parameters) => parameters.realReturnRate != null,
      ),
      category: 'planning',
      linkTo: '/scenarios',
    },
  ];

  const completedCount = items.filter((item) => item.completed).length;

  return {
    percentage: Math.round((completedCount / items.length) * 100),
    items,
  };
}