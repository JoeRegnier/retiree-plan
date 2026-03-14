import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Box, Typography, Accordion, AccordionSummary, AccordionDetails,
  Grid, Card, CardContent, Chip, Divider, Alert, Link,
  Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow,
  Paper, Stack, Button, useTheme, alpha, LinearProgress, Tooltip,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import TimelineIcon from '@mui/icons-material/Timeline';
import CasinoIcon from '@mui/icons-material/Casino';
import BarChartIcon from '@mui/icons-material/BarChart';
import FlagIcon from '@mui/icons-material/Flag';
import CompareIcon from '@mui/icons-material/Compare';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PsychologyIcon from '@mui/icons-material/Psychology';
import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';

interface FaqItem {
  q: string;
  a: string;
}

interface Section {
  title: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  faqs: FaqItem[];
}

const SECTIONS: Section[] = [
  {
    title: 'Getting Started',
    icon: <AccountBalanceIcon />,
    color: '#1976d2',
    description: 'Set up your household, members, and accounts to begin planning.',
    faqs: [
      {
        q: 'Where do I start?',
        a: 'Begin at Household to create your household profile and add family members. Then go to Accounts to enter your RRSP, TFSA, and non-registered investment balances.',
      },
      {
        q: 'What account types are supported?',
        a: 'RRSP, TFSA, and Non-Registered (taxable) accounts. Each has distinct tax treatment modeled in the projection engine.',
      },
      {
        q: 'Can I model a couple?',
        a: 'Yes — add both spouses as household members. The projection engine considers each member\'s age, income sources, and OAS/CPP eligibility separately.',
      },
    ],
  },
  {
    title: 'Scenarios',
    icon: <CompareIcon />,
    color: '#7b1fa2',
    description: 'Scenarios let you model different retirement assumptions.',
    faqs: [
      {
        q: 'What is a scenario?',
        a: 'A scenario is a named set of parameters (retirement age, withdrawal rate, expected return, inflation, etc.) that drives the projection and simulation engines.',
      },
      {
        q: 'How many scenarios can I have?',
        a: 'Unlimited. Create an optimistic, base, and pessimistic scenario at a minimum to bracket your outcomes.',
      },
      {
        q: 'What does equity fraction mean?',
        a: 'This is the percentage of your portfolio allocated to equities (vs. bonds/GICs). Higher equity fraction generally means higher expected returns but also higher volatility.',
      },
    ],
  },
  {
    title: 'Projections',
    icon: <TimelineIcon />,
    color: '#388e3c',
    description: 'Deterministic year-by-year cash-flow projections.',
    faqs: [
      {
        q: 'How are projections calculated?',
        a: 'The engine runs a year-by-year simulation starting at your current age. Each year it calculates income (CPP, OAS, pension, employment), applies Canadian federal and provincial tax, deducts expenses, and updates account balances.',
      },
      {
        q: 'What is the RRSP meltdown strategy?',
        a: 'RRSP meltdown accelerates RRSP withdrawals in lower-income years before OAS/CPP begins, filling lower tax brackets and minimizing lifetime tax. It converts RRSP room to TFSA.',
      },
      {
        q: 'What does "portfolio depleted" mean?',
        a: 'When net worth reaches zero, the portfolio is depleted and your plan may not be sustainable at the current withdrawal rate.',
      },
    ],
  },
  {
    title: 'Simulations',
    icon: <CasinoIcon />,
    color: '#e64a19',
    description: 'Monte Carlo, historical backtesting, and Guyton-Klinger guardrails.',
    faqs: [
      {
        q: 'What is Monte Carlo simulation?',
        a: 'Monte Carlo runs thousands of trials with randomized annual returns drawn from a normal distribution. The success rate is the share of trials where the portfolio survives the full retirement period.',
      },
      {
        q: 'What is historical backtesting?',
        a: 'Backtesting replays your strategy over every historical 30-year window in the TSX/bond data to see how you would have fared in real market conditions, including crashes.',
      },
      {
        q: 'What are Guyton-Klinger guardrails?',
        a: 'GK is a dynamic withdrawal strategy. If your portfolio drops below a "lower guardrail" ratio, you cut spending by 10%. If it rises above an "upper guardrail", you take a 10% raise. This dramatically improves portfolio longevity.',
      },
    ],
  },
  {
    title: 'Tax Analytics',
    icon: <BarChartIcon />,
    color: '#0288d1',
    description: 'Understand your lifetime tax burden and marginal rates.',
    faqs: [
      {
        q: 'What taxes are modeled?',
        a: 'Federal and Ontario provincial income tax, CPP/EI contributions, OAS clawback (recovery tax), RRSP deduction, basic personal amount, and age amount credits.',
      },
      {
        q: 'How is OAS clawback calculated?',
        a: 'For 2024, OAS begins clawback at ~$90,997 of net income at a rate of 15 cents per dollar above the threshold.',
      },
    ],
  },
  {
    title: 'Milestones',
    icon: <FlagIcon />,
    color: '#f9a825',
    description: 'One-time financial events tied to a specific age.',
    faqs: [
      {
        q: 'What are milestone events?',
        a: 'Milestones are one-time cash flows that occur at a specific age: inheritance received, home sale, cottage purchase, major medical expense, etc. They are incorporated into your projection runs.',
      },
      {
        q: 'What milestone types are there?',
        a: 'Income (extra income), Expense (extra spending), Lump Sum In (asset sale proceeds), Lump Sum Out (large purchase or gift).',
      },
    ],
  },
  {
    title: 'Estate Planning',
    icon: <AccountTreeIcon />,
    color: '#546e7a',
    description: 'Estimate the tax consequences of your estate at death.',
    faqs: [
      {
        q: 'What is RRSP deemed disposition?',
        a: 'When you die, your RRSP/RRIF is treated as if you received its full value as income in the year of death. At a 50% marginal rate, nearly half can go to tax unless rolled over to a spouse.',
      },
      {
        q: 'Is the principal residence exempt?',
        a: 'Yes — the principal residence exemption eliminates capital gains on your primary home. A secondary property (cottage) is subject to capital gains tax.',
      },
      {
        q: 'What are probate fees?',
        a: 'Provinces charge a fee to validate your will and authorize asset transfers. Ontario charges 0.5% on the first $50K and 1.5% on the remainder. Quebec has nominal fees for notarial wills.',
      },
    ],
  },
];

const TIPS = [
  'Maximize TFSA contributions every year — growth and withdrawals are tax-free.',
  'Time RRSP withdrawals to fill lower tax brackets before CPP/OAS begins.',
  'A spousal RRSP can reduce family tax by splitting income in retirement.',
  'Dynamic withdrawal strategies (Guyton-Klinger) can significantly extend portfolio life.',
  'Name your RRSP/RRIF beneficiary as your spouse to defer taxation to their death.',
  'Use the RRSP Meltdown strategy if your marginal rate at death will be much higher than today.',
  'Consider the 4% rule as a starting point, but model your specific situation.',
];

// ── Planning Guide data ───────────────────────────────────────────────────────

interface ExternalLink {
  label: string;
  url: string;
  description: string;
}

interface StatCallout {
  value: string;
  label: string;
  color: string;
}

interface GuideStep {
  number: number;
  title: string;
  icon: React.ReactNode;
  color: string;
  concept: string;
  details: Array<{ heading?: string; body: string; type?: 'info' | 'warning' | 'tip' | 'check' }>;
  action?: { label: string; path: string };
  table?: { headers: string[]; rows: string[][] };
  stats?: StatCallout[];
  colourLegend?: Array<{ colour: string; label: string }>;
  externalLinks?: ExternalLink[];
  tips?: string[];
}

const GUIDE_STEPS: GuideStep[] = [
  {
    number: 1,
    title: 'What Is a Retirement Plan?',
    icon: <PsychologyIcon />,
    color: '#6C63FF',
    concept:
      'A retirement plan answers one fundamental question: will you run out of money before you run out of time? The system models your life from today to a planning horizon on a year-by-year basis, tracking every dollar of income, spending, tax, and account balance.',
    details: [
      {
        heading: 'Three pillars of a plan',
        body: 'Resources — what you own today (accounts, real estate, pensions). Obligations — what you spend and what you owe. Assumptions — how the future behaves (returns, inflation, longevity, benefit timing).',
        type: 'info',
      },
      {
        heading: 'Built for Canada',
        body: 'This system applies accurate federal and provincial progressive income tax, CPP and OAS benefit calculations, RRIF mandatory minimum withdrawal schedules, RRSP and TFSA contribution limits, OAS clawback, and capital gains inclusion rules for all 13 provinces and territories.',
        type: 'check',
      },
      {
        heading: 'Why plan to age 90–95?',
        body: 'A 65-year-old Canadian woman has a 50% chance of living to 87 and a 25% chance of reaching 94. Planning only to average life expectancy means a 50% chance of outliving your money. Plan conservatively — assets left over are never a problem.',
        type: 'warning',
      },
    ],
    stats: [
      { value: '50%', label: 'Chance a 65-yr-old woman lives to 87+', color: '#6C63FF' },
      { value: '25%', label: 'Chance of reaching age 94', color: '#A29BFE' },
      { value: '90–95', label: 'Recommended planning horizon (age)', color: '#00C49F' },
    ],
    externalLinks: [
      { label: 'Statistics Canada — Life Tables', url: 'https://www150.statcan.gc.ca/n1/pub/84-537-x/84-537-x2021001-eng.htm', description: 'Official Canadian longevity data by age and sex' },
      { label: 'FP Canada — Financial Planning Standards', url: 'https://www.fpcanada.ca/planners/why-financial-planning', description: 'What a certified financial planner does and why it matters' },
    ],
  },
  {
    number: 2,
    title: 'Step 1 — Build Your Household Profile',
    icon: <AccountBalanceIcon />,
    color: '#1976d2',
    concept:
      'Your household profile is the foundation every other calculation rests on. It determines provincial tax rates, CPP and OAS timing, when RRSP contributions legally stop (age 71), and when employment income drops to zero.',
    details: [
      {
        heading: 'Find your CRA information',
        body: 'RRSP contribution room and TFSA room are both on CRA My Account (canada.ca/my-cra-account). Your CPP Statement of Contributions is available on My Service Canada Account. These are the authoritative sources — do not guess.',
        type: 'warning',
      },
      {
        heading: 'Couples and spouses',
        body: 'Add a second household member for your partner. The system tracks two members with independent income, accounts, and province. Income-splitting strategies (pension income splitting, spousal RRSP) are applied automatically.',
        type: 'tip',
      },
    ],
    action: { label: 'Go to Household', path: '/household' },
    table: {
      headers: ['Field', 'Why it matters', 'Where to find it'],
      rows: [
        ['Date of birth', 'All projections are age-based. CPP, OAS, and RRIF ages are automatically correct.', 'SIN card or passport'],
        ['Province of residence', "Ontario top marginal rate: 53.5%. Alberta: 48%. BC: 53.7%. This drives every tax calculation.", 'Your current province'],
        ['Planned retirement age', 'Employment income stops here — the start of the decumulation phase.', 'Your own estimate'],
        ['RRSP contribution room', 'Caps how much the engine recommends you contribute each year.', 'CRA My Account → RRSP Deduction Limit'],
        ['TFSA contribution room', 'Available room since eligibility (age 18 in 2009+). Withdrawal re-adds room next Jan 1.', 'CRA My Account → TFSA Room'],
        ['CPP expected benefit', 'Expected monthly CPP at 65. The engine scales this for your chosen start age.', 'My Service Canada Account → CPP Statement'],
      ],
    },
    externalLinks: [
      { label: 'CRA My Account', url: 'https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-individuals/account-individuals.html', description: 'Find RRSP room, TFSA room, and tax history' },
      { label: 'My Service Canada Account', url: 'https://www.canada.ca/en/employment-social-development/services/my-account.html', description: 'View your CPP Statement of Contributions and OAS eligibility' },
    ],
  },
  {
    number: 3,
    title: 'Step 2 — Enter Your Income Sources',
    icon: <TrendingUpIcon />,
    color: '#388e3c',
    concept:
      "Income is categorized precisely because different types have different tax treatment, different timing, and different flexibility. CPP and OAS are automatically calculated by the engine — do not add them as manual entries.",
    details: [
      {
        heading: 'Part-time / phased retirement income',
        body: 'An income source with a defined start age and end age only appears in the projection for those years. Example: consulting at $25,000/year from age 60 to 68.',
        type: 'tip',
      },
      {
        heading: 'Defined Benefit pensions',
        body: 'Enter the annual payment amount and the age it starts. If indexed, enter the target amount at the start age — the engine adjusts for inflation from that point.',
        type: 'info',
      },
    ],
    action: { label: 'Go to Household', path: '/household' },
    table: {
      headers: ['Type', 'Examples', 'Tax treatment'],
      rows: [
        ['Employment / Self-Employment', 'Salary, consulting, contract', 'Fully taxable; stops at retirement age'],
        ['CPP', 'Canada Pension Plan benefit', 'Fully taxable; auto-calculated from cppStartAge'],
        ['OAS', 'Old Age Security', 'Fully taxable; clawed back above ~$91k net income'],
        ['Defined Benefit Pension', 'Government or employer pension', 'Fully taxable; specify start age and annual amount'],
        ['RRSP/RRIF', 'Registered retirement withdrawals', 'Fully taxable when withdrawn'],
        ['Investment / Rental', 'Dividends, rent, non-reg portfolio income', 'Capital gains: 50% inclusion. Eligible dividends: Dividend Tax Credit applied'],
      ],
    },
    externalLinks: [
      { label: 'CRA — Income Tax Guide T4011', url: 'https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4011.html', description: 'CRA guide on pension and retirement income tax treatment' },
      { label: 'CPP — How Much You Could Receive', url: 'https://www.canada.ca/en/services/benefits/publicpensions/cpp/cpp-benefit/amount.html', description: 'Service Canada: how CPP benefit amounts are calculated' },
    ],
  },
  {
    number: 4,
    title: 'Step 3 — Define Your Expenses',
    icon: <SavingsOutlinedIcon />,
    color: '#e64a19',
    concept:
      'Expenses are the single most consequential variable in a retirement plan. A $10,000/year difference in annual spending compounds to hundreds of thousands of dollars over 30 years. Most Canadians underestimate their true spending by 15–25%.',
    details: [
      {
        heading: 'The 3 spending phases',
        body: '"Go-Go" years (65–74): Full spending plus active travel — budget at 100% or more. "Slow-Go" years (75–84): Less discretionary travel but more healthcare — budget at ~90%. "No-Go" years (85+): Primarily care costs — budget at ~75%, but healthcare can spike.',
        type: 'info',
      },
      {
        heading: 'YNAB Integration (recommended)',
        body: 'Connect YNAB on the Integrations page. The system syncs your budgeted category amounts directly — real-data foundation rather than estimates. Use this if you track spending at all.',
        type: 'tip',
      },
      {
        heading: 'Inflation compounds relentlessly',
        body: 'At 2.5% inflation, a $72,000 expense today becomes ~$131,000 in 30 years. All expenses in the projection are grown at the annual inflation rate set in your Scenario, so the correct number to enter is today\'s dollars.',
        type: 'warning',
      },
    ],
    action: { label: 'Go to Integrations', path: '/integrations' },
    stats: [
      { value: '15–25%', label: 'How much most people underestimate expenses', color: '#e64a19' },
      { value: '$131K', label: '$72K today at 2.5% inflation in 30 years', color: '#FF6B6B' },
      { value: '2.5%', label: 'Historical Canadian CPI average', color: '#FFB347' },
    ],
    externalLinks: [
      { label: 'Statistics Canada — Average Household Spending', url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1110022201', description: 'Canadian household expenditure survey data by age group' },
      { label: 'YNAB — You Need a Budget', url: 'https://www.youneedabudget.com', description: 'Budgeting app with RetireePlan integration' },
    ],
  },
  {
    number: 5,
    title: 'Step 4 — Set Up Your Investment Accounts',
    icon: <AccountBalanceIcon />,
    color: '#00C49F',
    concept:
      'Canada has a deliberate tax-efficiency hierarchy for investment accounts. The projection engine draws using a waterfall: Cash → Non-Registered → RRSP/RRIF → TFSA. Understanding this order is essential to reading your drawdown chart.',
    details: [
      {
        heading: 'What to enter for each account',
        body: 'Account name and type (RRSP, TFSA, Non-Registered, Cash), current balance from a recent statement, estimated annual return rate, and your planned annual contribution until retirement.',
        type: 'info',
      },
      {
        heading: 'Return rate guidance',
        body: 'Aggressive (80%+ equity): 7–8% nominal historical. Balanced (60/40): 5.5–7%. Conservative (40/60): 4–5.5%. GIC / bond heavy: 3–4%. Use nominal (before inflation) rates — the engine handles real vs. nominal internally.',
        type: 'tip',
      },
    ],
    action: { label: 'Go to Accounts', path: '/accounts' },
    table: {
      headers: ['Account type', 'Tax on growth', 'Tax on withdrawal', 'Key rule'],
      rows: [
        ['RRSP', 'Tax-deferred', 'Fully taxable as income', 'Must convert to RRIF by age 71'],
        ['TFSA', 'Tax-free', 'Tax-free (not income)', 'Room limited; withdrawals re-add room next Jan 1'],
        ['Non-Registered', 'Taxable each year', 'Capital gains on disposition (50% inclusion)', 'No contribution limits; no tax shelter'],
        ['Cash / Savings', 'Taxable (interest income)', 'None', 'Liquid buffer. Earns configurable savings rate (default 2.5%)'],
      ],
    },
    externalLinks: [
      { label: 'CRA — TFSA Overview', url: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account.html', description: 'Official CRA guide on TFSA rules, limits, and withdrawals' },
      { label: 'CRA — RRSP Overview', url: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans.html', description: 'Official CRA guide on RRSP contributions, limits, and conversion' },
      { label: 'PWL Capital — Asset Allocation Research', url: 'https://www.pwlcapital.com/resources/', description: 'Evidence-based research on Canadian portfolio return assumptions' },
    ],
  },
  {
    number: 6,
    title: 'Step 5 — Create Your Baseline Scenario',
    icon: <CompareIcon />,
    color: '#7b1fa2',
    concept:
      'A scenario is a named collection of planning assumptions. Create multiple scenarios — a base case, an optimistic case, a stress case — to understand which assumptions drive the most uncertainty in your plan.',
    details: [
      {
        heading: 'Life expectancy vs. planning horizon',
        body: 'Do not set your planning horizon to your expected age of death. Set it to the age you want financial certainty to. Running to age 95 or 100 adds almost no cost to a solvent plan — but dramatically changes the picture if the base case was marginal.',
        type: 'warning',
      },
      {
        heading: 'Return and inflation pairing',
        body: 'A balanced 60/40 portfolio has historically averaged 6–7% nominal. Bank of Canada targets 2.0% inflation; historical CPI averaged 2.5%. The combination that matters is the "real return": nominal minus inflation. A 6% return with 2.5% inflation is a 3.5% real return.',
        type: 'info',
      },
    ],
    action: { label: 'Go to Scenarios', path: '/scenarios' },
    table: {
      headers: ['Parameter', 'Typical range', 'Notes'],
      rows: [
        ['Retirement age', '55–70', 'Employment income stops here'],
        ['Life expectancy', '88–100', 'Use 90+ for conservative planning'],
        ['Expected return', '4–7%', 'Nominal; 6% reasonable for balanced 60/40'],
        ['Inflation rate', '2.0–2.5%', 'Bank of Canada target is 2.0%'],
        ['Volatility (σ)', '10–16%', '12% appropriate for balanced portfolio'],
        ['CPP start age', '60–70', 'See Step 7 for the deferral analysis'],
        ['OAS start age', '65–70', 'Deferring adds 0.6%/month (max 36% at age 70)'],
      ],
    },
    externalLinks: [
      { label: 'Bank of Canada — Inflation Target', url: 'https://www.bankofcanada.ca/core-functions/monetary-policy/inflation/', description: "Canada's 2% inflation target explained" },
      { label: 'Stingy Investor — Canadian Return Data', url: 'https://www.ndir.com/SI/returns/index.shtml', description: 'Historical Canadian equity and bond return data by decade' },
    ],
  },
  {
    number: 7,
    title: 'Step 6 — Run and Read Your First Projection',
    icon: <TimelineIcon />,
    color: '#0288d1',
    concept:
      'The engine runs a year-by-year simulation from your current age to your planning horizon. For every year it calculates all income, all expenses (inflation-adjusted), all taxes (federal and provincial), and account balances after contributions, growth, and withdrawals.',
    details: [
      {
        heading: 'Cash Flow tab — the big picture',
        body: 'The stacked area chart shows total net worth over time. Each colour band is an account type. Watch for the point where total area starts declining — that is where net portfolio drawdown begins. A healthy plan has this in the late 60s or 70s.',
        type: 'info',
      },
      {
        heading: 'Year-by-Year tab — the detail',
        body: 'Shows every simulated year: income sources, expenses, tax paid, RRIF minimum, withdrawal from each account, net cash flow, and balances. Use this to trace exactly what happens in any specific year for tax planning.',
        type: 'tip',
      },
      {
        heading: 'Key metrics to check first',
        body: 'Final Net Worth at your planning horizon: positive means solvent, negative means a problem. Average unused RRSP and TFSA room: high numbers indicate optimization potential.',
        type: 'check',
      },
    ],
    action: { label: 'Go to Projections', path: '/projections' },
    table: {
      headers: ['Metric', 'Green signal', 'Warning signal'],
      rows: [
        ['Final Net Worth (at horizon)', 'Positive balance with comfortable margin', 'Zero or negative — plan is not sustainable'],
        ['Peak Net Worth age', 'Mid-to-late 60s or early 70s', 'Peaking before 65 may signal under-saving'],
        ['Avg unused RRSP room', 'Small or zero', 'Large → contributing less than allowed; tax efficiency lost'],
        ['Avg unused TFSA room', 'Small or zero', 'Large → compounding outside the shelter; losing tax-free growth'],
        ['Tax band at age 75–80', 'Stable / slowly growing', 'Sharp spike → RRIF minimums pushing to higher bracket'],
      ],
    },
    externalLinks: [
      { label: "CRA — T1 General Guide (Income Types)", url: 'https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package.html', description: 'Understanding how different incomes appear on your tax return' },
    ],
  },
  {
    number: 8,
    title: 'Step 7 — Plan Your CPP & OAS Timing',
    icon: <EmojiObjectsIcon />,
    color: '#FFB347',
    concept:
      'CPP timing is the single most impactful irreversible decision in Canadian retirement planning. Taking CPP at 70 instead of 60 can mean $624 more per month — indexed to inflation — for life. The break-even on deferring from 60 to 65 is approximately age 74.',
    details: [
      {
        heading: 'The deferral math',
        body: 'CPP: each month before 65 reduces benefit by 0.6% (−36% at 60). Each month after 65 increases it by 0.7% (+42% at 70). OAS: cannot start before 65; each month deferred from 65 to 70 adds 0.6% (+36% maximum).',
        type: 'info',
      },
      {
        heading: 'The OAS clawback trap',
        body: 'If your net income exceeds $90,997 (2024), CRA claws back OAS at 15 cents per dollar above the threshold — fully eliminated at ~$148,000. Large RRIF minimums at age 75–80 routinely push retirees into this trap without planning.',
        type: 'warning',
      },
      {
        heading: 'How to model this',
        body: 'In the Scenarios page, slide the CPP Start Age and OAS Start Age sliders between their limits, Run Projection, and compare the Final Net Worth and lifetime tax paid. Also use the Compare page to put two scenarios side by side.',
        type: 'tip',
      },
    ],
    action: { label: 'Go to Scenarios', path: '/scenarios' },
    stats: [
      { value: '$512', label: 'CPP at 60 (on $800/month base)', color: '#e64a19' },
      { value: '$800', label: 'CPP at 65 (baseline)', color: '#FFB347' },
      { value: '$1,136', label: 'CPP at 70 (+42% enhancement)', color: '#00C49F' },
    ],
    externalLinks: [
      { label: 'Service Canada — CPP Retirement Pension', url: 'https://www.canada.ca/en/services/benefits/publicpensions/cpp/cpp-benefit/before-apply.html', description: 'Official CPP deferral rules and benefit amount calculator' },
      { label: 'Service Canada — OAS Pension', url: 'https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security/benefit-amount.html', description: 'OAS amounts, deferral rules, and clawback thresholds' },
      { label: 'Retire Happy — CPP Calculator', url: 'https://retirehappy.ca/cpp-calculator/', description: 'Independent CPP timing break-even analysis tool' },
    ],
  },
  {
    number: 9,
    title: 'Step 8 — RRSP Strategy: Contributions, Conversion & Meltdown',
    icon: <AutoAwesomeIcon />,
    color: '#A29BFE',
    concept:
      'Every RRSP dollar saves tax at your current marginal rate. But a large RRSP converted to RRIF at 71 can generate mandatory income above $90K, triggering the OAS clawback and high marginal rates. The meltdown strategy voluntarily draws it down in the low-income window before that happens.',
    details: [
      {
        heading: 'Why the meltdown works',
        body: 'Between retirement and RRIF conversion (after CPP/OAS haven\'t fully kicked in), you can be in the 29–33% marginal bracket. Withdraw RRSP strategically to fill that bracket, pay tax at the lower rate now, then re-invest after-tax proceeds into your TFSA to continue compounding tax-free.',
        type: 'info',
      },
      {
        heading: 'Typical tax saving',
        body: 'A well-executed meltdown on a $700,000+ RRSP typically saves $40,000–$120,000 in lifetime taxes. Run your numbers in Simulations → RRSP Meltdown to see your specific figure.',
        type: 'check',
      },
      {
        heading: '2024 RRSP limits',
        body: 'Maximum new room = 18% of prior-year earned income, up to $31,560. Unused room carries forward indefinitely. Contribution deadline: 60 days after December 31 (typically March 1). RRSP must convert to RRIF by December 31 of the year you turn 71.',
        type: 'warning',
      },
    ],
    action: { label: 'Go to Simulations → RRSP Meltdown', path: '/simulations' },
    stats: [
      { value: '$31,560', label: '2024 RRSP annual contribution limit', color: '#A29BFE' },
      { value: 'Age 71', label: 'RRSP → RRIF conversion deadline', color: '#6C63FF' },
      { value: '$40–120K', label: 'Typical lifetime tax saving from meltdown', color: '#00C49F' },
    ],
    table: {
      headers: ['Age', 'RRIF minimum (% of Jan 1 balance)'],
      rows: [
        ['71', '5.28%'],
        ['75', '5.82%'],
        ['80', '6.82%'],
        ['85', '8.51%'],
        ['90', '11.92%'],
        ['95+', '20.00%'],
      ],
    },
    externalLinks: [
      { label: 'CRA — RRIF Minimum Withdrawals', url: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans/registered-retirement-income-fund-rrif.html', description: 'Official RRIF minimum withdrawal table and rules' },
      { label: 'MoneySense — RRSP Meltdown Explained', url: 'https://www.moneysense.ca/save/retirement/rrsp/rrsp-meltdown-strategy/', description: 'Independent guide to the RRSP meltdown tax strategy' },
    ],
  },
  {
    number: 10,
    title: 'Step 9 — TFSA: Tax-Free Growth and Flexible Withdrawals',
    icon: <SavingsOutlinedIcon />,
    color: '#00C49F',
    concept:
      "TFSA withdrawals are completely tax-free, do not appear on your T1, do not trigger OAS clawback, and do not inflate your marginal rate. This makes the TFSA your most powerful late-retirement account — hold it until last.",
    details: [
      {
        heading: 'Room calculation',
        body: 'Every Canadian 18+ accumulates $7,000 new TFSA room per year (2024). Total cumulative room since 2009 through 2024 is $95,000 if you have never contributed. Withdrawals re-add room the following January 1 — you never permanently lose room.',
        type: 'info',
      },
      {
        heading: 'The RRSP refund double-dip',
        body: 'Invest your RRSP tax refund directly into your TFSA. This combines the RRSP deduction (tax savings now) with TFSA compounding (tax-free growth forever). A $10,000 RRSP contribution at 43% marginal rate generates a $4,300 refund — put it straight into the TFSA.',
        type: 'tip',
      },
      {
        heading: 'Watch the unused room metric',
        body: 'The Avg unused TFSA room number on the Projections page is a direct measure of foregone tax-free compounding. Every $7,000 that sits in a taxable account instead of your TFSA generates unnecessary annual tax drag for the rest of your life.',
        type: 'warning',
      },
    ],
    action: { label: 'Go to Accounts', path: '/accounts' },
    stats: [
      { value: '$7,000', label: '2024 annual TFSA limit', color: '#00C49F' },
      { value: '$95,000', label: 'Total cumulative room since 2009', color: '#00B894' },
      { value: '0%', label: 'Tax on TFSA withdrawals', color: '#6C63FF' },
    ],
    externalLinks: [
      { label: 'CRA — TFSA Contribution Limit History', url: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account/contributions.html', description: 'TFSA annual limits from 2009 to present and cumulative room calculator' },
    ],
  },
  {
    number: 11,
    title: 'Step 10 — Income Flow: Where Your Money Goes Each Year',
    icon: <BarChartIcon />,
    color: '#FF6B6B',
    concept:
      "The Income Flow chart is the clearest single view of whether your money is working optimally. A spike in the red (tax) band in your mid-70s is a RRIF-triggered tax problem. Large muted purple bands are missed RRSP room. Thick teal bands are TFSA working hard.",
    details: [
      {
        heading: 'Before retirement (left portion)',
        body: 'You should see meaningful purple (RRSP) and teal (TFSA) contribution bands. If you see large muted bands of "unused room", you have an optimization opportunity — contribute more, or check that your contribution room is entered correctly.',
        type: 'info',
      },
      {
        heading: 'At the retirement line',
        body: 'Employment income drops and a new mix appears — CPP, OAS, and RRIF draws. The bars typically shrink after retirement, then grow again as inflation-adjusted expenses rise in the 70s and 80s.',
        type: 'info',
      },
      {
        heading: 'Interactive hover',
        body: 'Hover on any bar to see the exact breakdown for that year: exact expense amount, exact tax paid, exact contributions, and exact surplus. Use this in conjunction with the Year-by-Year table.',
        type: 'tip',
      },
    ],
    action: { label: 'Go to Projections → Income Flow tab', path: '/projections' },
    colourLegend: [
      { colour: '#FF8C00', label: 'Expenses (inflation-adjusted living costs)' },
      { colour: '#d32f2f', label: 'Tax (federal + provincial + CPP contributions)' },
      { colour: '#7B1FA2', label: 'RRSP contribution' },
      { colour: '#00897B', label: 'TFSA contribution' },
      { colour: '#2e7d32', label: 'Surplus → Non-Registered investment' },
      { colour: '#b0bec5', label: 'Surplus → Cash savings' },
      { colour: '#CE93D8', label: 'Unused RRSP room (optimization opportunity)' },
      { colour: '#80CBC4', label: 'Unused TFSA room' },
    ],
  },
  {
    number: 12,
    title: 'Step 11 — Account Drawdown: How Your Portfolio Empties Over Time',
    icon: <TimelineIcon />,
    color: '#0288d1',
    concept:
      'The Drawdown chart shows one horizontal bar per year of retirement. The total bar length is your total portfolio. The colour bands show the account mix at that age. The slider controls playback age — drag it to see your portfolio composition in any retirement year.',
    details: [
      {
        heading: 'What a healthy drawdown looks like',
        body: 'Non-Registered depletes first (most tax-inefficient). RRSP/RRIF shrinks gradually from mandatory RRIF minimums — normal and expected. TFSA holds or grows through most of retirement — becomes the dominant account in the late 70s. All bars still exist at your planning horizon.',
        type: 'check',
      },
      {
        heading: 'Key Insights panel',
        body: 'Below the chart, the Key Insights section automatically computes: peak portfolio value and age, age when net drawdown begins, RRSP→RRIF conversion milestone, non-registered depletion age, and a sustainability verdict at the planning horizon.',
        type: 'info',
      },
      {
        heading: 'Red flag: RRSP/RRIF as only source late in retirement',
        body: 'If the blue (RRSP/RRIF) band is the only remaining band in the 80s, your TFSA was depleted too early. This indicates TFSA contributions should be maximized throughout retirement, not just in accumulation years.',
        type: 'warning',
      },
    ],
    action: { label: 'Go to Projections → Drawdown tab', path: '/projections' },
    colourLegend: [
      { colour: '#1976d2', label: 'RRSP / RRIF balance' },
      { colour: '#2e7d32', label: 'TFSA balance' },
      { colour: '#e65100', label: 'Non-Registered balance' },
      { colour: '#757575', label: 'Cash balance' },
    ],
  },
  {
    number: 13,
    title: 'Step 12 — Sankey: Where Every Dollar Flows',
    icon: <AccountTreeIcon />,
    color: '#7b1fa2',
    concept:
      'The Sankey tab on the Projections page visualizes the complete flow of money for a selected year — from every income source, through taxes and contributions, into savings and spending. At a glance you can spot tax drag, under-utilized accounts, and surplus efficiency.',
    details: [
      {
        heading: 'How to read it',
        body: 'Thick left bands are large income sources. The diagram splits each source into destinations: taxes paid, RRSP contribution, TFSA contribution, non-registered savings, and final expenses. A thick "Tax" path relative to total income is the primary signal for optimization.',
        type: 'info',
      },
      {
        heading: 'Year selector',
        body: 'Use the age/year slider to trace your money flow at any specific age — the year you retire, the year you turn 71 (RRSP → RRIF conversion), or the year OAS starts. The diagram re-renders instantly for every year you select.',
        type: 'tip',
      },
      {
        heading: 'What a well-optimized Sankey looks like',
        body: 'In accumulation years: thick RRSP and TFSA paths, thin tax path relative to income. In retirement: CPP and RRIF as income sources, thin or absent OAS clawback path, balanced TFSA draw vs RRIF draw. A large clawback node after age 71 is a structural warning.',
        type: 'check',
      },
    ],
    action: { label: 'Go to Projections → Sankey tab', path: '/projections' },
  },
  {
    number: 14,
    title: 'Step 13 — Waterfall: Annual Net Worth Changes',
    icon: <BarChartIcon />,
    color: '#0097a7',
    concept:
      'The Waterfall tab shows your portfolio as a series of annual bars — each bar represents the net change (positive or negative) in total net worth for that year. Unlike the Cash Flow chart which shows cumulative balances, the Waterfall isolates how much was gained or lost each individual year.',
    details: [
      {
        heading: 'Historical + projected in one view',
        body: 'The left portion of the chart shows actual historical net worth year-by-year (based on data you have entered). The right portion shows projected annual changes based on your scenario assumptions. The hand-off point between real and projected is clearly marked.',
        type: 'info',
      },
      {
        heading: 'Reading the bars',
        body: 'Green bars: net worth grew that year (accumulation or strong market returns). Red bars: net worth declined (drawdown, poor returns, or large lump-sum outflows such as a home purchase). The first sustained sequence of red bars typically marks the start of retirement drawdown.',
        type: 'tip',
      },
      {
        heading: 'Identifying drawdown acceleration',
        body: 'Watch for red bars that grow progressively taller after retirement — this indicates withdrawals are growing faster than the portfolio recovers. A well-managed plan has red bars that stay roughly flat or shrink over time, reflecting a sustainable withdrawal rate.',
        type: 'warning',
      },
    ],
    action: { label: 'Go to Projections → Waterfall tab', path: '/projections' },
  },
  {
    number: 15,
    title: 'Step 14 — Retire Finder: Your Earliest Retirement Age',
    icon: <EmojiObjectsIcon />,
    color: '#FFB347',
    concept:
      'The Retire Finder sweeps every retirement age from 50 to 70, runs a full projection for each, and plots final net worth on a bar chart — showing exactly how much you would have at your planning horizon for every possible retirement date, and where your minimum viable retirement age is.',
    details: [
      {
        heading: 'How to use it',
        body: 'Set a target net worth (or leave it at $0 as the survival threshold). The chart plots final net worth for each potential retirement age. The earliest age where the bar clears your target is your earliest viable retirement date under your current scenario assumptions.',
        type: 'info',
      },
      {
        heading: 'What drives the curve shape',
        body: 'Retiring at 55 vs 62 can mean a $2M+ difference in final net worth — because you accumulate contributions for 7 more years AND shorten the drawdown period by 7 years. The curve typically shows a steep positive slope from 50 to 62, then flattens as CPP and DB pension income offsets the shorter accumulation.',
        type: 'tip',
      },
      {
        heading: 'Use conservative and optimistic scenarios',
        body: 'The sweep runs against your selected scenario. Run it on a bear-market scenario (low return, high inflation) to find a safe floor. Run it on a base scenario to find your expected earliest retire age. The gap between the two defines your planning buffer.',
        type: 'check',
      },
    ],
    action: { label: 'Go to Retire Finder', path: '/earliest-retire' },
    stats: [
      { value: '50–70', label: 'Age range swept in the analysis', color: '#6C63FF' },
      { value: '$1–3M', label: 'Typical net worth difference: age 55 vs 62', color: '#00C49F' },
      { value: '1 click', label: 'Select any bar to explore that retirement age', color: '#FFB347' },
    ],
  },
  {
    number: 16,
    title: 'Step 15 — Monte Carlo: Planning for Market Uncertainty',
    icon: <CasinoIcon />,
    color: '#e64a19',
    concept:
      'A constant-return projection misses the biggest real risk: sequence of returns. A −30% crash in year 1 of retirement is far more damaging than −30% in year 20 — because you are selling at depressed prices to fund living expenses. Monte Carlo quantifies this.',
    details: [
      {
        heading: 'How it works',
        body: 'The system runs 500 independent simulations of your plan. In each, annual returns are randomly drawn from a normal distribution using your mean return and volatility. Some runs have bad early years; some have good ones. The results are displayed as percentile bands (P5 through P95).',
        type: 'info',
      },
      {
        heading: 'What is a good success rate?',
        body: 'A professional financial planner typically targets 85–90% success. 100% is unnecessarily sacrificial — it means dying with a very large estate. 70% means significant changes are needed. If you are below 85%, work through the list in order: reduce spending first, then defer CPP, then defer OAS.',
        type: 'tip',
      },
      {
        heading: 'Sequence of returns risk',
        body: 'The biggest risk in retirement is not average returns — it is the order. A retiree withdrawing $50,000/year from a $1M portfolio in a −30% market year is forced to sell 7.1% of assets at bottom prices. That permanently reduces the compounding base for all future years.',
        type: 'warning',
      },
    ],
    action: { label: 'Go to Simulations → Monte Carlo', path: '/simulations' },
    stats: [
      { value: '500', label: 'Simulation trials per Monte Carlo run', color: '#e64a19' },
      { value: '85–90%', label: 'Target success rate for most households', color: '#00C49F' },
      { value: 'P25–P75', label: 'The middle 50% of outcomes band', color: '#A29BFE' },
    ],
    table: {
      headers: ['Success rate', 'Interpretation', 'Suggested action'],
      rows: [
        ['95%+', 'Very conservative / over-funded', 'Consider spending more or retiring earlier'],
        ['85–95%', 'Well-funded — target zone', 'Maintain current plan'],
        ['70–85%', 'Moderate risk', 'Reduce spending by $5–10K or defer CPP/OAS'],
        ['Below 70%', 'High risk', 'Structural changes needed — see action list'],
      ],
    },
    externalLinks: [
      { label: 'Investopedia — Sequence of Returns Risk', url: 'https://www.investopedia.com/terms/s/sequence-risk.asp', description: 'Explains why early retirement losses are disproportionately damaging' },
      { label: 'Ben Felix — Monte Carlo vs Historical Backtesting', url: 'https://www.youtube.com/watch?v=3BScK-QyWIo', description: 'Evidence-based analysis of when simulation methods diverge' },
    ],
  },
  {
    number: 17,
    title: 'Step 16 — Historical Backtesting: Testing Against Real Market History',
    icon: <TimelineIcon />,
    color: '#546e7a',
    concept:
      'Historical backtesting runs your withdrawal plan through every rolling historical market window — using what markets actually did, not normally distributed simulations. It tests survival through the 1929 Depression, 1970s stagflation, 2000 tech crash, and 2008 financial crisis.',
    details: [
      {
        heading: 'How it differs from Monte Carlo',
        body: 'Monte Carlo generates random return sequences assuming returns are normally distributed and independent each year. Backtesting uses every real historical sequence that actually occurred — including fat tails, multi-year correlations, and simultaneous high-inflation + low-return periods (like the 1970s) that are underrepresented in a normal distribution.',
        type: 'info',
      },
      {
        heading: 'Reading the success rate',
        body: 'The result shows what percentage of all historical 30-year (or your horizon length) rolling windows your plan survived. A 90%+ backtesting success rate means your plan survived 90% of the worst historical periods ever recorded — including the Great Depression and World War II market disruptions.',
        type: 'check',
      },
      {
        heading: 'Best case vs. worst case windows',
        body: 'The tool highlights your best-case and worst-case historical window. The worst case is typically 1929 or 1966 (the start of a decade of stagflation). The best case is often 1982 (the beginning of the longest bull market in history). Examine both to understand the true range of historically possible outcomes.',
        type: 'tip',
      },
    ],
    action: { label: 'Go to Simulations → Historical Backtesting', path: '/simulations' },
    externalLinks: [
      { label: 'Finiki — Safe Withdrawal Rate Research', url: 'https://www.finiki.org/wiki/Safe_withdrawal_rate', description: 'Canadian wiki summary of withdrawal rate research including historical backtesting studies' },
      { label: 'ERN Blog — Safe Withdrawal Rate Series', url: 'https://earlyretirementnow.com/safe-withdrawal-rate-series/', description: 'The most comprehensive backtesting analysis of withdrawal strategies published online' },
    ],
  },
  {
    number: 18,
    title: 'Step 17 — Historical Scenarios: The Fan Chart',
    icon: <BarChartIcon />,
    color: '#455a64',
    concept:
      'The Historical Scenarios fan chart re-plays your exact plan through dozens of named historical market periods simultaneously. Each line is a different colored path showing where your portfolio would have finished had you retired in 1929, 1966, 1980, 1990, 2000, or 2008.',
    details: [
      {
        heading: 'Reading the fan',
        body: 'Each line on the chart is your retirement portfolio projected through one historical decade\'s actual return sequence. A narrow fan means outcomes are similar regardless of timing — you have a robust plan. A wide fan means timing luck matters significantly — consider building more buffer.',
        type: 'info',
      },
      {
        heading: 'Named worst historical retirements',
        body: 'The chart highlights the named worst scenarios (e.g., "1966 Stagflation", "1929 Depression"). If your portfolio survives these labeled paths, it is resilient to historical extremes. If it does not, the gap between the line and zero shows exactly how much additional capital or spending reduction is needed.',
        type: 'warning',
      },
      {
        heading: 'Monte Carlo vs. Historical Scenarios — use both',
        body: 'Historical scenarios use correlated, fat-tailed, real return sequences. Monte Carlo assumes independent, normally distributed returns each year. Historical scenarios tend to be more severe in stressed periods (like the 1970s), while Monte Carlo better captures tail risks we have not seen yet. Running both gives a more complete picture.',
        type: 'tip',
      },
    ],
    action: { label: 'Go to Simulations → Historical Scenarios', path: '/simulations' },
  },
  {
    number: 19,
    title: 'Step 18 — Success Rate Heatmap: Sensitivity at a Glance',
    icon: <AutoAwesomeIcon />,
    color: '#6C63FF',
    concept:
      'The Success Rate Heatmap answers: "how sensitive is my plan to the two biggest uncertainties — annual spending and portfolio return?" It presents a grid where each cell shows the Monte Carlo success rate for a specific spending/return combination, coloured from red (failure) to green (success).',
    details: [
      {
        heading: 'How to read the heatmap',
        body: 'Rows represent different annual spending levels (e.g., $60K, $70K, $80K, $90K). Columns represent different expected return rates (e.g., 4%, 5%, 6%, 7%). Each cell shows the Monte Carlo success rate for that combination. The colour shifts from red (high failure probability) through yellow to green (high success).',
        type: 'info',
      },
      {
        heading: 'Your risk boundary',
        body: 'The boundary between green and yellow/red cells is your plan\'s risk edge. If your current plan lands in the middle of the green zone, you have substantial flexibility. If you are near the boundary, a 1% return shortfall or $10K/year higher spending could move you into the danger zone.',
        type: 'warning',
      },
      {
        heading: 'Your current plan is marked',
        body: 'Your active scenario\'s spending and return rate are highlighted on the heatmap. You can immediately see how much margin you have — and which direction of change is most impactful. If the boundary is closest horizontally (spending axis), reducing spending is the primary lever. If closest vertically (return axis), asset allocation is the lever.',
        type: 'tip',
      },
    ],
    action: { label: 'Go to Simulations → Success Rate Heatmap', path: '/simulations' },
    stats: [
      { value: 'Red', label: 'Success rate < 70% — structural changes needed', color: '#e64a19' },
      { value: 'Yellow', label: 'Success rate 70–85% — moderate risk zone', color: '#FFB347' },
      { value: 'Green', label: 'Success rate 85%+ — target zone', color: '#00C49F' },
    ],
  },
  {
    number: 20,
    title: 'Step 19 — Guyton-Klinger: Adaptive Withdrawal Strategy',
    icon: <PsychologyIcon />,
    color: '#388e3c',
    concept:
      'Guyton-Klinger (GK) is a rules-based withdrawal strategy that adapts your spending to portfolio performance — cutting withdrawals in bad market years and allowing raises in good ones. Compared to a rigid fixed withdrawal, GK can support 10–20% higher initial spending with the same survival probability.',
    details: [
      {
        heading: 'The two core guardrail rules',
        body: 'Prosperity Rule: if your portfolio grows beyond expectations, take a 10% spending raise that year. Capital Preservation Rule: if your current withdrawal rate exceeds 120% of your initial rate (the upper guardrail), cut spending by 10%. Together these rules maintain long-term solvency dynamically without rigid adherence to a fixed dollar amount.',
        type: 'info',
      },
      {
        heading: 'Reading the Guyton-Klinger chart',
        body: 'The chart shows your projected spending path under GK rules as a band — the upper bound is the prosperity track, the lower bound is the capital preservation floor. Compare it to your fixed-expense projection line to see how much spending volatility you are accepting in exchange for the higher starting withdrawal.',
        type: 'tip',
      },
      {
        heading: 'Is Guyton-Klinger right for you?',
        body: 'GK works best when you have genuinely discretionary spending you can cut in bad years — travel, dining, gifts. It is poorly suited to fixed obligations such as rent, medication, or care. The guardrails are guidelines, not guarantees — real behaviour during a −30% crash requires real spending discipline.',
        type: 'warning',
      },
    ],
    action: { label: 'Go to Simulations → Guyton-Klinger', path: '/simulations' },
    externalLinks: [
      { label: 'Kitces — Guardrails Withdrawal Deep Dive', url: 'https://www.kitces.com/blog/guyton-klinger-guardrails-dynamic-withdrawal-strategies/', description: 'In-depth breakdown of the guardrails approach and when it outperforms fixed withdrawal' },
      { label: 'Finiki — Dynamic Withdrawal Strategies', url: 'https://www.finiki.org/wiki/Withdrawal_strategies', description: 'Canadian wiki overview of withdrawal types including fixed, variable, and rules-based' },
    ],
  },
  {
    number: 21,
    title: 'Step 20 — Stress Test with Scenarios and What-If Analysis',
    icon: <PsychologyIcon />,
    color: '#6C63FF',
    concept:
      "Your base case is what you expect. A retirement plan must also answer: what if things go wrong? A full scenario set brackets your outcomes and reveals which assumptions drive the most variability in your plan's sustainability.",
    details: [
      {
        heading: 'The Compare page',
        body: 'Place two scenarios side by side: projected net worth over time, final net worth difference, lifetime tax paid difference, and Monte Carlo success rate for each. Particularly useful for the CPP timing decision — create one scenario at 60 and one at 70.',
        type: 'tip',
      },
      {
        heading: 'The What-If drawer',
        body: 'On any Projections chart, the What-If floating panel lets you change a single assumption — retirement age, return rate, expenses — and see the result instantly without saving. Ideal for real-time sensitivity analysis in a planning session.',
        type: 'info',
      },
      {
        heading: 'Most impactful levers (in order)',
        body: 'Annual spending is #1 — a $10,000/year reduction extends portfolio life far more than any other single change. Retirement age is #2 — one more year working adds returns AND reduces the drawdown period. CPP/OAS timing is #3.',
        type: 'check',
      },
    ],
    action: { label: 'Go to Compare', path: '/compare' },
    table: {
      headers: ['Scenario name', 'Key changes from base'],
      rows: [
        ['Base Case', 'Your central assumptions'],
        ['Early Retirement', 'Retire at 60; CPP at 60; lower assets'],
        ['Bear Market', 'Return rate 3%; volatility 18%'],
        ['Longevity', 'Planning horizon age 100; same returns'],
        ['High Inflation', 'Inflation 4%; return stays at 6%'],
        ['Frugal Retirement', 'Expenses 80% of base'],
        ['Generous Spending', 'Expenses 120% — how much can you afford?'],
      ],
    },
    externalLinks: [
      { label: 'Vanguard — How Spending Affects Portfolio Longevity', url: 'https://investor.vanguard.com/investor-resources-education/retirement/withdrawal-strategies', description: 'Research on safe withdrawal rates and spending flexibility' },
      { label: 'Finiki — Canadian Personal Finance Wiki', url: 'https://www.finiki.org/wiki/Retirement_planning', description: 'Community-maintained Canadian retirement planning knowledge base' },
    ],
  },
  {
    number: 22,
    title: 'Step 21 — Goals and Milestones',
    icon: <FlagIcon />,
    color: '#f9a825',
    concept:
      'Milestones are dated events on your planning timeline — labelled vertical lines on every chart. Goals are financial targets with a dollar amount and target age, integrated into the cash flow projection as lump-sum events or recurring flows.',
    details: [
      {
        heading: 'Examples of goals to model',
        body: 'Mortgage payoff lump sum at 58. Annual travel budget of $20,000/year from 65–80. Inheritance of $100,000 at age 68. Moving to a retirement community at 82 ($60,000/year). Gifting to children at 70 ($50,000 lump sum out).',
        type: 'tip',
      },
      {
        heading: 'Milestones vs. goals',
        body: 'A milestone is a visual marker (your retirement date, CPP start, mortgage paid off). A goal has financial consequences that flow into the projection. Both types appear as vertical dashed lines on the Cash Flow and Income Flow charts.',
        type: 'info',
      },
    ],
    action: { label: 'Go to Goals', path: '/goals' },
    externalLinks: [
      { label: 'CMHC — Housing Options for Older Canadians', url: 'https://www.cmhc-schl.gc.ca/en/consumers/owning-a-home/home-articles/housing-options-for-older-canadians', description: "Canada's national guide to retirement housing costs and care options" },
    ],
  },
  {
    number: 23,
    title: 'Step 22 — Estate Planning: What Your Heirs Receive',
    icon: <AccountTreeIcon />,
    color: '#546e7a',
    concept:
      "When a Canadian dies, CRA treats all assets as if sold at fair market value immediately before death. On a $1,000,000 RRIF with no surviving spouse, the tax bill can be $450,000–$530,000. The Estate page models your net estate after all taxes and probate fees.",
    details: [
      {
        heading: 'Deemed disposition — asset by asset',
        body: 'RRSP/RRIF: fully taxable as ordinary income on the final return — the most severe. Non-Registered: capital gains tax on accrued gains (50% inclusion). TFSA: completely tax-free to named beneficiaries. Primary residence: exempt. Cottage: capital gains since purchase.',
        type: 'warning',
      },
      {
        heading: 'Four estate optimization moves',
        body: '1. Maximize TFSA — bypasses estate tax entirely if beneficiary named. 2. RRSP meltdown — smaller RRIF at death = smaller tax bill. 3. Name beneficiaries on all registered accounts to bypass probate. 4. Name spouse as RRIF successor holder (not beneficiary) for a tax-free spousal rollover.',
        type: 'check',
      },
    ],
    action: { label: 'Go to Estate', path: '/estate' },
    table: {
      headers: ['Asset', 'Tax at death', 'Bypass strategy'],
      rows: [
        ['RRSP / RRIF', 'Fully taxable as income', 'Rollover to surviving spouse (successor holder)'],
        ['TFSA', 'None — tax-free', 'Name beneficiary to bypass probate'],
        ['Non-Registered', 'Capital gains on accrued growth (50% inclusion)', 'No bypass; manage ACB throughout life'],
        ['Primary Residence', 'None — Principal Residence Exemption', '—'],
        ['Cottage / Rental', 'Capital gains on gain since purchase', 'Consider life insurance to fund the tax bill'],
      ],
    },
    externalLinks: [
      { label: 'CRA — Deemed Disposition at Death', url: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/information-survivors-deceased-persons/deemed-disposition-property.html', description: 'Official CRA guide to tax consequences at death' },
      { label: 'Miltons Estate Law — Probate Fees by Province', url: 'https://www.miltonslegal.com/estate/probate/probate-fees-canada/', description: 'Province-by-province probate fee schedule for 2024' },
    ],
  },
  {
    number: 24,
    title: 'Step 23 — Tax Analytics and Optimization',
    icon: <BarChartIcon />,
    color: '#0288d1',
    concept:
      'The Tax Analytics page gives you a year-by-year view of your projected tax burden: marginal rates, effective rates, tax by income source, and OAS clawback years. Use it to identify withdrawal timing opportunities and bracket-filling strategies before they happen.',
    details: [
      {
        heading: 'Five optimization signals to look for',
        body: '1. Rate drops sharply at retirement → big meltdown window. 2. Rate spikes at 72–75 → RRIF minimums; meltdown earlier. 3. OAS clawback years → income above $91K; needs structural fix. 4. Far below $91K → consider higher TFSA contributions or more early-retirement spending. 5. High non-reg income in accumulation years → move assets inside RRSP/TFSA.',
        type: 'info',
      },
      {
        heading: 'Province matters enormously',
        body: "If you are considering retiring to a different province, model it explicitly. Moving from Ontario to Alberta can reduce your marginal rate on $120,000 income from 43.4% to 36%. That's $8,880 per year in provincial income tax savings, compounded over 30 years.",
        type: 'tip',
      },
    ],
    action: { label: 'Go to Tax Analytics', path: '/tax-analytics' },
    externalLinks: [
      { label: 'Taxtips.ca — Provincial Tax Rates 2024', url: 'https://www.taxtips.ca/marginaltaxrates.htm', description: 'All Canadian provincial and federal marginal rates by income bracket (2024)' },
      { label: 'EY Tax Calculators', url: 'https://www.ey.com/en_ca/tax/tax-calculators', description: "EY Canada's free personal income tax calculator for all provinces" },
    ],
  },
  {
    number: 25,
    title: 'Step 24 — Keeping the Plan Current',
    icon: <CheckCircleOutlineIcon />,
    color: '#388e3c',
    concept:
      'A retirement plan is not a one-time exercise. It is a living model that needs updating as circumstances change. Run a full annual review each calendar year after filing your taxes — the whole review should take 30–60 minutes.',
    details: [
      {
        heading: 'Annual review — 7 updates to make',
        body: '1. Update RRSP room from new CRA Notice of Assessment. 2. Update TFSA room (new $7,000 added Jan 1). 3. Update CPP expected benefit if your earnings changed. 4. Update account balances from year-end statements. 5. Trigger a YNAB sync to refresh expense categories. 6. Review return rate and inflation assumptions. 7. Re-run Monte Carlo to see if success rate changed.',
        type: 'check',
      },
      {
        heading: 'Life events requiring immediate update',
        body: 'Change of province. Marriage or separation. Inheritance received or expected. Job loss or early retirement offer. Major health changes. Significant market events (check Monte Carlo success rate). Birth of grandchild (beneficiary update).',
        type: 'warning',
      },
    ],
    action: { label: 'Go to Dashboard', path: '/' },
    externalLinks: [
      { label: 'CRA — RRSP Filing Deadlines', url: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans/contributing-a-rrsp-prpp/how-much-can-you-contribute-your-rrsp.html', description: 'Official RRSP contribution room and deadline information' },
    ],
  },
  {
    number: 26,
    title: 'Quick Reference: Key Numbers for 2024',
    icon: <InfoOutlinedIcon />,
    color: '#455a64',
    concept:
      'All key Canadian retirement planning limits and rates for 2024. These are the actual figures applied in every projection run in this system.',
    details: [],
    table: {
      headers: ['Item', 'Amount / Rate'],
      rows: [
        ['RRSP annual contribution limit', '$31,560 (or 18% of prior-year earned income, whichever is less)'],
        ['TFSA annual limit', '$7,000'],
        ['TFSA cumulative room (2009–2024)', '$95,000'],
        ['CPP maximum monthly benefit (age 65)', '$1,364.60/month = $16,375/year'],
        ['CPP early reduction (before 65)', '−0.6% per month; max −36% at 60'],
        ['CPP deferral credit (after 65)', '+0.7% per month; max +42% at 70'],
        ['OAS maximum monthly benefit (age 65)', '$713.34/month = $8,560/year'],
        ['OAS deferral credit (after 65)', '+0.6% per month (max +36% at age 70 = $9,641/year)'],
        ['OAS clawback threshold', '$90,997 net income'],
        ['OAS clawback rate', '15 cents per dollar above threshold'],
        ['OAS fully eliminated at', '~$148,000 net income'],
        ['RRIF minimum at age 71', '5.28% of January 1 balance'],
        ['RRIF minimum at age 75', '5.82%'],
        ['RRIF minimum at age 80', '6.82%'],
        ['RRIF minimum at age 85', '8.51%'],
        ['RRIF minimum at age 90', '11.92%'],
        ['RRIF minimum at age 95+', '20.00%'],
        ['Federal basic personal amount', '$15,705'],
        ['Capital gains inclusion rate', '50% (up to $250,000 annual gain); ⅔ above that per 2024 federal budget'],
        ['RRSP contribution deadline', '60 days after December 31 (typically March 1)'],
        ['RRSP → RRIF conversion deadline', 'December 31 of year you turn 71'],
        ['CPP earliest start age', '60'],
        ['OAS earliest start age', '65'],
        ['Maximum deferral age (CPP and OAS)', '70'],
      ],
    },
    externalLinks: [
      { label: 'Service Canada — CPP and OAS Payment Amounts', url: 'https://www.canada.ca/en/services/benefits/publicpensions/cpp/payment-amounts.html', description: 'Current CPP and OAS payment amounts updated quarterly' },
      { label: 'CRA — RRSP/TFSA Limits Reference', url: 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/completing-slips-summaries/t4slip/rrsp-annual-dollar-limit.html', description: 'Historical and current year RRSP and TFSA annual limits' },
    ],
  },
];

// ── HelpPage component ────────────────────────────────────────────────────────

const DETAIL_STYLES: Record<string, { bg: string; icon: React.ReactNode; border: string }> = {
  info:    { bg: 'rgba(2,136,209,0.08)',   icon: <InfoOutlinedIcon sx={{ fontSize: 18 }} />,          border: 'rgba(2,136,209,0.4)' },
  warning: { bg: 'rgba(230,74,25,0.08)',   icon: <WarningAmberIcon sx={{ fontSize: 18 }} />,           border: 'rgba(230,74,25,0.4)' },
  tip:     { bg: 'rgba(0,196,159,0.08)',   icon: <LightbulbOutlinedIcon sx={{ fontSize: 18 }} />,      border: 'rgba(0,196,159,0.4)' },
  check:   { bg: 'rgba(56,142,60,0.08)',   icon: <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />,     border: 'rgba(56,142,60,0.4)' },
  default: { bg: 'transparent',            icon: null,                                                   border: 'divider' },
};

function GuideStepView({ step, onPrev, onNext, total }: {
  step: GuideStep;
  onPrev: () => void;
  onNext: () => void;
  total: number;
}) {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Box>
      {/* ── Header banner ───────────────────────────────────────────────── */}
      <Box
        sx={{
          borderRadius: 2,
          background: `linear-gradient(135deg, ${step.color}22, ${step.color}08)`,
          border: `1px solid ${step.color}44`,
          p: { xs: 2, md: 2.5 },
          mb: 2.5,
          display: 'flex',
          gap: 2,
          alignItems: 'flex-start',
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            flexShrink: 0,
            borderRadius: 2,
            bgcolor: `${step.color}22`,
            border: `1px solid ${step.color}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: step.color,
          }}
        >
          {step.icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
            <Chip
              label={`${step.number} / ${total}`}
              size="small"
              sx={{ bgcolor: `${step.color}22`, color: step.color, fontWeight: 700, border: `1px solid ${step.color}44`, height: 22 }}
            />
          </Box>
          <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2, color: 'text.primary' }}>
            {step.title}
          </Typography>
        </Box>
      </Box>

      {/* ── Concept block ───────────────────────────────────────────────── */}
      <Box
        sx={{
          borderLeft: `4px solid ${step.color}`,
          pl: 2,
          mb: 2.5,
          py: 0.5,
        }}
      >
        <Typography variant="body1" sx={{ lineHeight: 1.8, color: 'text.primary', fontWeight: 500 }}>
          {step.concept}
        </Typography>
      </Box>

      {/* ── Stat callouts ───────────────────────────────────────────────── */}
      {step.stats && (
        <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
          {step.stats.map((stat) => (
            <Grid item xs={12} sm={4} key={stat.label}>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  textAlign: 'center',
                  borderColor: `${stat.color}44`,
                  background: `linear-gradient(135deg, ${stat.color}10, ${stat.color}04)`,
                  borderRadius: 2,
                }}
              >
                <Typography variant="h5" fontWeight={800} sx={{ color: stat.color, lineHeight: 1.1 }}>
                  {stat.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, display: 'block', mt: 0.25 }}>
                  {stat.label}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ── Colour legend ───────────────────────────────────────────────── */}
      {step.colourLegend && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            Chart Colour Key
          </Typography>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Grid container spacing={0.75}>
              {step.colourLegend.map((entry) => (
                <Grid item xs={12} sm={6} key={entry.label}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 16, height: 16, borderRadius: 0.5, flexShrink: 0, bgcolor: entry.colour, border: `1px solid ${alpha(entry.colour, 0.4)}` }} />
                    <Typography variant="body2" sx={{ lineHeight: 1.4 }}>{entry.label}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Box>
      )}

      {/* ── Detail sections ─────────────────────────────────────────────── */}
      {step.details.length > 0 && (
        <Stack spacing={1.5} sx={{ mb: 2.5 }}>
          {step.details.map((d, i) => {
            const style = DETAIL_STYLES[d.type ?? 'default'];
            return (
              <Box
                key={i}
                sx={{
                  p: 1.75,
                  borderRadius: 2,
                  bgcolor: style.bg,
                  border: `1px solid`,
                  borderColor: style.border,
                }}
              >
                {d.heading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                    {style.icon && (
                      <Box sx={{ color: style.border, flexShrink: 0 }}>{style.icon}</Box>
                    )}
                    <Typography variant="subtitle2" fontWeight={700}>{d.heading}</Typography>
                  </Box>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, pl: d.heading && style.icon ? 3.25 : 0 }}>
                  {d.body}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {step.table && (
        <Box sx={{ mb: 2.5, overflowX: 'auto', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: `${step.color}12` }}>
                {step.table.headers.map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 700, whiteSpace: 'nowrap', borderBottom: `2px solid ${step.color}33`, color: 'text.primary' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {step.table.rows.map((row, ri) => (
                <TableRow
                  key={ri}
                  sx={{
                    '&:last-child td': { border: 0 },
                    '&:hover': { bgcolor: 'action.hover' },
                    '&:nth-of-type(even)': { bgcolor: alpha(theme.palette.background.paper, 0.5) },
                  }}
                >
                  {row.map((cell, ci) => (
                    <TableCell
                      key={ci}
                      sx={{
                        verticalAlign: 'top',
                        fontWeight: ci === 0 ? 600 : 400,
                        color: ci === 0 ? 'text.primary' : 'text.secondary',
                        fontSize: '0.8rem',
                      }}
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* ── Action button ───────────────────────────────────────────────── */}
      {step.action && (
        <Box sx={{ mb: 2.5 }}>
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate(step.action!.path)}
            sx={{ bgcolor: step.color, '&:hover': { bgcolor: `${step.color}cc` }, fontWeight: 600 }}
            endIcon={<NavigateNextIcon />}
          >
            {step.action.label}
          </Button>
        </Box>
      )}

      {/* ── External resources ──────────────────────────────────────────── */}
      {step.externalLinks && step.externalLinks.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            <OpenInNewIcon sx={{ fontSize: 16 }} />
            External Resources
          </Typography>
          <Stack spacing={1}>
            {step.externalLinks.map((link) => (
              <Paper
                key={link.url}
                variant="outlined"
                sx={{
                  p: 1.25,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  '&:hover': { borderColor: step.color, bgcolor: `${step.color}06` },
                  transition: 'border-color 0.15s, background-color 0.15s',
                  cursor: 'pointer',
                }}
                onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: 1,
                    bgcolor: `${step.color}18`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: step.color,
                  }}
                >
                  <OpenInNewIcon sx={{ fontSize: 16 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                    {link.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                    {link.description}
                  </Typography>
                </Box>
                <OpenInNewIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
              </Paper>
            ))}
          </Stack>
        </Box>
      )}

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <Divider sx={{ mt: 3, mb: 2 }} />
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pb: 10 }}>
        <Button
          startIcon={<NavigateBeforeIcon />}
          onClick={onPrev}
          disabled={step.number === 1}
          variant="outlined"
          size="small"
        >
          Previous
        </Button>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {Array.from({ length: total }, (_, i) => (
            <Tooltip key={i} title={GUIDE_STEPS[i].title.replace(/^Step \d+ — /, '')} placement="top">
              <Box
                sx={{
                  width: step.number === i + 1 ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  bgcolor: step.number === i + 1 ? step.color : 'action.disabled',
                  transition: 'all 0.2s',
                  cursor: 'default',
                }}
              />
            </Tooltip>
          ))}
        </Box>
        <Button
          endIcon={<NavigateNextIcon />}
          onClick={onNext}
          disabled={step.number === total}
          variant="outlined"
          size="small"
        >
          Next
        </Button>
      </Stack>
    </Box>
  );
}

export function HelpPage() {
  const [expanded, setExpanded] = useState<string | false>(false);
  const [tab, setTab] = useState(0);
  const [guideStep, setGuideStep] = useState(0);
  const navigate = useNavigate();
  const theme = useTheme();
  const currentStep = GUIDE_STEPS[guideStep];

  return (
    <Box sx={{ pb: 10 }}>
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <Box
        sx={{
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.secondary.main, 0.06)})`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          p: { xs: 2, md: 3 },
          mb: 3,
          display: 'flex',
          gap: 2,
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            width: 52,
            height: 52,
            flexShrink: 0,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.15),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'primary.main',
          }}
        >
          <MenuBookIcon fontSize="large" />
        </Box>
        <Box>
          <Typography variant="h4" fontWeight={800}>Help & Documentation</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Learn how to use RetireePlan to model and optimize your Canadian retirement.
          </Typography>
        </Box>
      </Box>

      <Alert
        severity="info"
        sx={{ mb: 2, borderRadius: 2 }}
        icon={<InfoOutlinedIcon />}
      >
        <strong>Disclaimer:</strong> This tool provides estimates for educational and planning purposes only.
        It is not financial, tax, or legal advice. Consult a qualified advisor for your specific situation.
      </Alert>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab icon={<HelpOutlineIcon fontSize="small" />} iconPosition="start" label="FAQ & Quick Tips" />
        <Tab icon={<MenuBookIcon fontSize="small" />} iconPosition="start" label="Retirement Planning Guide" />
      </Tabs>

      {/* ── Tab 0: FAQ ──────────────────────────────────────────────────────── */}
      {tab === 0 && (
        <Box>
          {/* Quick Tips — visual card grid */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <LightbulbOutlinedIcon sx={{ color: '#FFB347' }} />
              Quick Tips
            </Typography>
            <Grid container spacing={1.5}>
              {TIPS.map((tip, i) => (
                <Grid item xs={12} sm={6} key={i}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      display: 'flex',
                      gap: 1.5,
                      alignItems: 'flex-start',
                      '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.04) },
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        flexShrink: 0,
                        borderRadius: '50%',
                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'primary.main',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                      }}
                    >
                      {i + 1}
                    </Box>
                    <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{tip}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* FAQ Sections */}
          <Grid container spacing={2.5}>
            {SECTIONS.map((section) => (
              <Grid item xs={12} md={6} key={section.title}>
                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    borderTop: `3px solid ${section.color}`,
                    height: '100%',
                    transition: 'box-shadow 0.15s',
                    '&:hover': { boxShadow: `0 4px 20px ${section.color}20` },
                  }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 1.5,
                          bgcolor: `${section.color}18`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: section.color,
                          flexShrink: 0,
                        }}
                      >
                        {section.icon}
                      </Box>
                      <Typography variant="h6" fontWeight={700}>{section.title}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={2} sx={{ lineHeight: 1.6 }}>
                      {section.description}
                    </Typography>
                    <Divider sx={{ mb: 1 }} />
                    {section.faqs.map((faq) => (
                      <Accordion
                        key={faq.q}
                        disableGutters
                        elevation={0}
                        expanded={expanded === `${section.title}-${faq.q}`}
                        onChange={(_, isExp) => setExpanded(isExp ? `${section.title}-${faq.q}` : false)}
                        sx={{ '&:before': { display: 'none' } }}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.75 } }}>
                          <Typography variant="body2" fontWeight={600}>{faq.q}</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0, px: 0, pb: 1 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>{faq.a}</Typography>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box mt={3} textAlign="center">
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              New to RetireePlan?{' '}
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate('/overview')}
                sx={{ verticalAlign: 'baseline' }}
              >
                View the feature overview
              </Link>
              {' '}to see everything the app can do.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Have feedback?{' '}
              <Link href="https://gitlab.com/fox-den/retireeplan/-/issues" target="_blank" rel="noreferrer">
                Open an issue on GitLab
              </Link>
            </Typography>
          </Box>
        </Box>
      )}

      {/* ── Tab 1: Planning Guide ───────────────────────────────────────────── */}
      {tab === 1 && (
        <Grid container spacing={2.5}>
          {/* Sidebar: step list */}
          <Grid item xs={12} md={3}>
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', position: 'sticky', top: 80 }}>
              {/* Progress bar */}
              <Box sx={{ p: 1.5, pb: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(currentStep.color, 0.06) }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Progress
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <LinearProgress
                    variant="determinate"
                    value={((guideStep + 1) / GUIDE_STEPS.length) * 100}
                    sx={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      bgcolor: alpha(currentStep.color, 0.15),
                      '& .MuiLinearProgress-bar': { bgcolor: currentStep.color, borderRadius: 3 },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
                    {guideStep + 1}/{GUIDE_STEPS.length}
                  </Typography>
                </Box>
              </Box>

              {/* Step list */}
              <Box sx={{ py: 0.75 }}>
                {GUIDE_STEPS.map((s, idx) => {
                  const isActive = guideStep === idx;
                  const isComplete = guideStep > idx;
                  return (
                    <Box
                      key={s.number}
                      onClick={() => setGuideStep(idx)}
                      sx={{
                        px: 1.5,
                        py: 0.65,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        bgcolor: isActive ? `${s.color}15` : 'transparent',
                        borderRight: isActive ? `3px solid ${s.color}` : '3px solid transparent',
                        '&:hover': { bgcolor: isActive ? `${s.color}20` : 'action.hover' },
                        transition: 'all 0.15s',
                      }}
                    >
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          flexShrink: 0,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: isActive ? s.color : isComplete ? alpha(s.color, 0.2) : alpha(theme.palette.text.disabled, 0.12),
                          color: isActive ? '#fff' : isComplete ? s.color : 'text.disabled',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          transition: 'all 0.15s',
                        }}
                      >
                        {isComplete ? '✓' : s.number}
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          lineHeight: 1.35,
                          fontWeight: isActive ? 700 : 400,
                          color: isActive ? 'text.primary' : 'text.secondary',
                          fontSize: '0.78rem',
                        }}
                      >
                        {s.title.replace(/^Step \d+ — /, '')}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          </Grid>

          {/* Main content */}
          <Grid item xs={12} md={9}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <GuideStepView
                  step={currentStep}
                  onPrev={() => setGuideStep((s) => Math.max(0, s - 1))}
                  onNext={() => setGuideStep((s) => Math.min(GUIDE_STEPS.length - 1, s + 1))}
                  total={GUIDE_STEPS.length}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}



