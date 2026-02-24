import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Box, Typography, Accordion, AccordionSummary, AccordionDetails,
  Grid, Card, CardContent, Chip, Divider, Alert, Link,
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

export function HelpPage() {
  const [expanded, setExpanded] = useState<string | false>(false);
  const navigate = useNavigate();

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <HelpOutlineIcon color="primary" />
        <Typography variant="h4" fontWeight={700}>Help & Documentation</Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Learn how to use the Retiree Plan app to model and optimize your Canadian retirement.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <strong>Disclaimer:</strong> This tool provides estimates for educational and planning purposes only.
        It is not financial, tax, or legal advice. Consult a qualified advisor for your specific situation.
      </Alert>

      {/* Quick Tips */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" mb={2}>Quick Tips</Typography>
          <Grid container spacing={1}>
            {TIPS.map((tip, i) => (
              <Grid item xs={12} sm={6} key={i}>
                <Box display="flex" gap={1} alignItems="flex-start">
                  <Chip label={i + 1} size="small" variant="outlined" color="primary" sx={{ mt: 0.2, minWidth: 28 }} />
                  <Typography variant="body2">{tip}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Sections */}
      <Grid container spacing={3}>
        {SECTIONS.map((section) => (
          <Grid item xs={12} md={6} key={section.title}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                  <Box sx={{ color: section.color }}>{section.icon}</Box>
                  <Typography variant="h6">{section.title}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={2}>
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
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0 }}>
                      <Typography variant="body2" fontWeight={600}>{faq.q}</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0, px: 0 }}>
                      <Typography variant="body2" color="text.secondary">{faq.a}</Typography>
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
  );
}
