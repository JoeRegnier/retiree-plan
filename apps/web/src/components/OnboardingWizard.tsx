/**
 * OnboardingWizard — a 6-step dialog that appears automatically on the user's
 * first login (gated by rp_onboarded in localStorage).
 *
 * Can also be re-launched from Help via useOnboarding().openOnboarding().
 *
 * Mount once inside AppLayout.
 */
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogTitle, Stepper, Step, StepLabel,
  StepContent, Box, Typography, Button, IconButton, useTheme, alpha,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HouseIcon from '@mui/icons-material/House';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import FlagIcon from '@mui/icons-material/Flag';
import TuneIcon from '@mui/icons-material/Tune';
import BarChartIcon from '@mui/icons-material/BarChart';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import TourIcon from '@mui/icons-material/Tour';
import { useNavigate } from 'react-router';
import { useTour } from '../contexts/TourContext';
import { APP_TOUR_STEPS } from '../data/tourSteps';

const ONBOARDED_KEY = 'rp_onboarded';

// ── Internal context so AppLayout and a Help button can both control the wizard

interface OnboardingCtx {
  openOnboarding: () => void;
}
const OnboardingContext = createContext<OnboardingCtx>({ openOnboarding: () => {} });
export function useOnboarding() { return useContext(OnboardingContext); }

// ── Step definitions ────────────────────────────────────────────────────────

interface WizardStep {
  label: string;
  icon: React.ReactNode;
  description: string;
  linkLabel?: string;
  linkPath?: string;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    label: 'Welcome to RetireePlan',
    icon: <RocketLaunchIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
    description:
      "Canada's most comprehensive retirement planning tool. Let's take a quick tour to show you the key areas of the app.",
  },
  {
    label: 'Set Up Your Household',
    icon: <HouseIcon sx={{ fontSize: 32, color: 'secondary.main' }} />,
    description:
      'Start by adding yourself and any family members. RetireePlan uses family data to personalise scenarios, CPP/OAS estimates, and tax projections.',
    linkLabel: 'Go to Household',
    linkPath: '/household',
  },
  {
    label: 'Add Your Accounts',
    icon: <AccountBalanceWalletIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
    description:
      'Enter your RRSPs, TFSAs, non-registered accounts, pensions, and debts. The app tracks balances, contribution room, and tax impact automatically.',
    linkLabel: 'Go to Accounts',
    linkPath: '/accounts',
  },
  {
    label: 'Define Your Milestones',
    icon: <FlagIcon sx={{ fontSize: 32, color: 'secondary.main' }} />,
    description:
      "Milestones are life events that affect your plan — retirement date, a home purchase, a child's education, or a major expense. Add yours here.",
    linkLabel: 'Go to Milestones',
    linkPath: '/milestones',
  },
  {
    label: 'Create Scenarios',
    icon: <TuneIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
    description:
      'Scenarios let you compare different futures — "retire at 60 with 4 % growth" vs "work until 65". Create as many as you like and compare side by side.',
    linkLabel: 'Go to Scenarios',
    linkPath: '/scenarios',
  },
  {
    label: 'Run Projections & Simulations',
    icon: <BarChartIcon sx={{ fontSize: 32, color: 'secondary.main' }} />,
    description:
      "Once your data is in place, run projections to see year-by-year net worth, then stress-test with Monte Carlo and historical backtests to understand the odds.",
    linkLabel: 'Go to Projections',
    linkPath: '/projections',
  },
];

// ── Component ───────────────────────────────────────────────────────────────

interface Props {
  /** Let the parent expose the openOnboarding fn to siblings via context */
  onContextReady?: (ctx: OnboardingCtx) => void;
}

export function OnboardingWizard({ onContextReady }: Props) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { startTour } = useTour();
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const openOnboarding = useCallback(() => {
    setActiveStep(0);
    setOpen(true);
  }, []);

  // Expose openOnboarding via context helper prop
  useEffect(() => {
    onContextReady?.({ openOnboarding });
  }, [onContextReady, openOnboarding]);

  // Auto-open on first visit
  useEffect(() => {
    if (localStorage.getItem(ONBOARDED_KEY) !== 'true') {
      // Small delay so the Dashboard renders first
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  function handleClose() {
    localStorage.setItem(ONBOARDED_KEY, 'true');
    setOpen(false);
  }

  function handleNext() {
    if (activeStep < WIZARD_STEPS.length - 1) {
      setActiveStep(s => s + 1);
    } else {
      handleClose();
    }
  }

  function handleBack() {
    setActiveStep(s => s - 1);
  }

  function handleGoTo(path: string) {
    handleClose();
    navigate(path);
  }

  function handleStartTour() {
    handleClose();
    // Give the dialog time to unmount before overlay appears
    setTimeout(() => startTour(APP_TOUR_STEPS), 300);
  }

  const isLast = activeStep === WIZARD_STEPS.length - 1;
  const step = WIZARD_STEPS[activeStep];

  return (
    <OnboardingContext.Provider value={{ openOnboarding }}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pb: 1,
          }}
        >
          <Typography variant="h6" component="span">
            Getting Started
          </Typography>
          <IconButton onClick={handleClose} size="small" aria-label="Close onboarding">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 0 }}>
          {/* Stepper sidebar */}
          <Stepper activeStep={activeStep} orientation="vertical" sx={{ mb: 0 }}>
            {WIZARD_STEPS.map((s, index) => (
              <Step key={s.label} completed={index < activeStep}>
                <StepLabel
                  sx={{
                    cursor: index < activeStep ? 'pointer' : 'default',
                    '& .MuiStepLabel-label': {
                      color: index === activeStep ? 'primary.main' : undefined,
                      fontWeight: index === activeStep ? 700 : 400,
                    },
                  }}
                  onClick={() => index < activeStep && setActiveStep(index)}
                >
                  {s.label}
                </StepLabel>
                <StepContent>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mb: 2 }}>
                    {s.icon}
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
                      {s.description}
                    </Typography>
                  </Box>

                  {/* Action row */}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Back / Next */}
                    {activeStep > 0 && (
                      <Button size="small" variant="outlined" onClick={handleBack}>
                        Back
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleNext}
                    >
                      {isLast ? "Let's go!" : 'Continue'}
                    </Button>

                    {/* Optional deep link */}
                    {s.linkLabel && s.linkPath && (
                      <Button
                        size="small"
                        variant="text"
                        sx={{ color: 'secondary.main' }}
                        onClick={() => handleGoTo(s.linkPath!)}
                      >
                        {s.linkLabel} →
                      </Button>
                    )}

                    {/* Start tour on last step */}
                    {isLast && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="secondary"
                        startIcon={<TourIcon fontSize="small" />}
                        onClick={handleStartTour}
                        sx={{ ml: 'auto' }}
                      >
                        Start guided tour
                      </Button>
                    )}
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </DialogContent>
      </Dialog>
    </OnboardingContext.Provider>
  );
}
