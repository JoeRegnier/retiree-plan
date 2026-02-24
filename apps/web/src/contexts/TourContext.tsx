/**
 * TourContext — drives the in-app guided walkthrough.
 *
 * Usage:
 *   const { startTour } = useTour();
 *   startTour(APP_TOUR_STEPS);   // or any custom step array
 *
 * Each step targets a CSS selector.  The TourOverlay component (rendered
 * once in AppLayout) shows the spotlight + tooltip.
 */
import React, {
  createContext, useContext, useState, useCallback, type ReactNode,
} from 'react';

export interface TourStep {
  /** CSS selector for the element to spotlight.  Use '' for a centred modal step. */
  target: string;
  /** Short heading shown in the tooltip. */
  title: string;
  /** Explanatory body text. */
  content: string;
  /** Preferred tooltip position relative to the target. Default: auto. */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourContextType {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  step: TourStep | null;
  startTour: (steps: TourStep[]) => void;
  stopTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: ReactNode }) {
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const startTour = useCallback((newSteps: TourStep[]) => {
    if (!newSteps.length) return;
    setSteps(newSteps);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const stopTour = useCallback(() => {
    setIsActive(false);
    setSteps([]);
    setCurrentStep(0);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((i) => {
      const next = i + 1;
      if (next >= steps.length) {
        // Schedule the stop outside the updater to avoid nested setState calls
        setTimeout(() => {
          setIsActive(false);
          setSteps([]);
          setCurrentStep(0);
        }, 0);
        return i; // keep current index until the stop fires
      }
      return next;
    });
  }, [steps]);

  const prevStep = useCallback(() => {
    setCurrentStep((i) => Math.max(0, i - 1));
  }, []);

  const goToStep = useCallback((index: number) => {
    setCurrentStep(Math.max(0, Math.min(index, steps.length - 1)));
  }, [steps.length]);

  const step = isActive && steps.length > 0 ? steps[currentStep] : null;

  return (
    <TourContext.Provider value={{
      isActive, currentStep, totalSteps: steps.length, step,
      startTour, stopTour, nextStep, prevStep, goToStep,
    }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used inside TourProvider');
  return ctx;
}
