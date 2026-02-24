/**
 * Pre-defined tour step sets.
 * Import APP_TOUR_STEPS to start the full application walkthrough.
 * Individual feature tours can be started from their respective pages.
 */
import type { TourStep } from '../contexts/TourContext';

/** Full application walkthrough (14 steps). */
export const APP_TOUR_STEPS: TourStep[] = [
  {
    target: '',
    title: 'Welcome to RetireePlan',
    content:
      'This guided tour walks you through every key area of the app in about 2 minutes. ' +
      'You can skip any step, and restart the tour at any time from the Help menu.',
    placement: 'bottom',
  },
  {
    target: 'nav[aria-label="Main navigation"]',
    title: 'Navigation Sidebar',
    content:
      'The sidebar gives you instant access to every section. ' +
      'Pages are ordered to match a typical setup workflow: Household first, then Accounts, Scenarios, and finally Projections.',
    placement: 'right',
  },
  {
    target: 'a[href="/"], [aria-current="page"]',
    title: 'Dashboard',
    content:
      'The Dashboard shows your net worth, annual income, and RRSP/TFSA totals at a glance. ' +
      'Quick-action buttons let you jump directly to the most common tasks.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="nav-household"]',
    title: 'Step 1 — Household Setup',
    content:
      'Start here. Add each member of your household with their date of birth, province of residence, ' +
      'and income sources (employment, CPP, OAS, pensions). This data feeds every other calculation.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-accounts"]',
    title: 'Step 2 — Accounts',
    content:
      'Add your RRSP, TFSA, and non-registered accounts with current balances and annual contributions. ' +
      'You can optionally link a YNAB budget to keep balances updated automatically.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-milestones"]',
    title: 'Milestones',
    content:
      'Milestones are one-time events that affect future cash flow — a partner retiring, ' +
      'an inheritance, mortgage payoff, or mandated RRSP-to-RRIF conversion at age 71.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-scenarios"]',
    title: 'Step 3 — Scenarios',
    content:
      'A scenario is a named set of planning assumptions: retirement age, life expectancy, ' +
      'expected return, inflation rate, and equity fraction. ' +
      'Create an optimistic, base-case, and conservative scenario to bracket your outcomes.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-projections"]',
    title: 'Step 4 — Cash-Flow Projections',
    content:
      'Select a scenario and click "Run Projection" to get year-by-year income, ' +
      'expense, tax, and net-worth tables from today through to your life expectancy. ' +
      'Charts include Cash Flow, Sankey, Waterfall, and Monte Carlo fan.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-simulations"]',
    title: 'Simulations',
    content:
      'Four stress-test engines: ' +
      'Monte Carlo (1 000 randomised runs), ' +
      '55-year Historical Backtest (TSX + bond returns 1970-2024), ' +
      'Guyton-Klinger dynamic withdrawal rules, ' +
      'and a Success-Rate Heatmap across withdrawal rates vs. equity fractions.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-tax"]',
    title: 'Tax Analytics',
    content:
      'Visualise 2024 federal and provincial tax brackets side-by-side. ' +
      'Income is pre-populated from your household. ' +
      'Edit the value to explore marginal rate cliffs for any income level.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-estate"]',
    title: 'Estate Planning',
    content:
      'Estimate the tax bill your estate will face on death: ' +
      'RRSP/RRIF deemed disposition income, capital gains on non-registered accounts, ' +
      'and principal residence exemption savings.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-compare"]',
    title: 'Scenario Compare',
    content:
      'Put two scenarios side-by-side to clearly see the impact of retiring 5 years earlier, ' +
      'holding more equities, or spending less in retirement.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-ai"]',
    title: 'AI Assistant',
    content:
      'Ask plain-English questions about your plan. With context-aware mode enabled, ' +
      'the assistant knows your household data, accounts, and scenarios to give personalised advice.',
    placement: 'right',
  },
  {
    target: '[data-tour="tour-help"]',
    title: 'Help & Tour',
    content:
      'You can restart this tour at any time, or open the Help page for FAQs and methodology notes, ' +
      'by clicking the "?" button in the app bar.',
    placement: 'bottom',
  },
];

/** Shorter 5-step projections-focused tour. */
export const PROJECTIONS_TOUR_STEPS: TourStep[] = [
  {
    target: '',
    title: 'Running a Projection',
    content:
      'This tour walks you through running your first cash-flow projection in 4 steps.',
  },
  {
    target: '[data-tour="scenario-select"]',
    title: '1. Select a Scenario',
    content:
      'Choose the scenario whose assumptions you want to project — retirement age, ' +
      'life expectancy, expected return, and annual expenses.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="run-projection-btn"]',
    title: '2. Run Projection',
    content:
      'Click "Run Projection" to compute the year-by-year cash flow. ' +
      'Results appear immediately as interactive charts and a table.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="run-mc-btn"]',
    title: '3. Run Monte Carlo',
    content:
      'Once you have a projection, "Run Monte Carlo" generates 1 000 randomised return sequences ' +
      'and shows the range of outcomes as a fan chart with a success rate chip.',
    placement: 'bottom',
  },
  {
    target: '',
    title: 'Explore the Charts',
    content:
      'Switch between the Cash Flow, Monte Carlo Fan, Sankey, Waterfall, and Year-by-Year Table tabs ' +
      'to view your results from different perspectives. Export to CSV or PDF at any time.',
  },
];
