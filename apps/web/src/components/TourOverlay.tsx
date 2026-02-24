/**
 * TourOverlay — renders the spotlight backdrop + step tooltip.
 *
 * Mount this once inside AppLayout.  It reads from TourContext and renders
 * nothing when no tour is active.
 *
 * Spotlight strategy: 4 semi-transparent divs surround the target element,
 * leaving a transparent gap that feels like a focused highlight.
 */
import { useState, useEffect, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Button, IconButton,
  LinearProgress, useTheme, alpha,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useTour } from '../contexts/TourContext';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8; // padding around the highlighted element (px)

function emptyRect(): Rect {
  return { top: 0, left: 0, width: 0, height: 0 };
}

export function TourOverlay() {
  const theme = useTheme();
  const { isActive, step, currentStep, totalSteps, nextStep, prevStep, stopTour } = useTour();
  const [rect, setRect] = useState<Rect>(emptyRect());
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Recompute spotlight coords whenever the active step changes
  useEffect(() => {
    if (!isActive || !step?.target) {
      setRect(emptyRect());
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setRect(emptyRect());
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Slight delay so scroll finishes before measuring
    const id = setTimeout(() => {
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      });
    }, 200);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, currentStep]); // intentionally keyed on currentStep, not step reference

  // Re-measure on resize
  useEffect(() => {
    if (!isActive) return;
    const onResize = () => {
      if (!step?.target) return;
      const el = document.querySelector(step.target);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isActive, step]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') nextStep();
      if (e.key === 'ArrowLeft') prevStep();
      if (e.key === 'Escape') stopTour();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive, nextStep, prevStep, stopTour]);

  if (!isActive || !step) return null;

  // A step is "centred" only when it deliberately has no target element.
  const isCentred = !step.target;

  const tooltipWidth = Math.min(360, window.innerWidth - 24);
  const TOOLTIP_H = 190; // approx rendered height
  const MARGIN = 16;

  /** Compute tooltip left/top based on the step's preferred placement. */
  function resolvePosition(): { left: number; top: number } {
    if (isCentred || rect.width === 0) {
      return {
        left: (window.innerWidth - tooltipWidth) / 2,
        top: window.innerHeight / 2 - TOOLTIP_H / 2,
      };
    }

    const placement = step!.placement ?? 'auto';
    const elCentreX = rect.left + rect.width / 2;
    const elCentreY = rect.top + rect.height / 2;

    // Clamp helpers
    const clampX = (x: number) =>
      Math.min(Math.max(x, MARGIN), window.innerWidth - tooltipWidth - MARGIN);
    const clampY = (y: number) =>
      Math.min(Math.max(y, MARGIN), window.innerHeight - TOOLTIP_H - MARGIN);

    if (placement === 'right') {
      return {
        left: clampX(rect.left + rect.width + MARGIN),
        top: clampY(elCentreY - TOOLTIP_H / 2),
      };
    }
    if (placement === 'left') {
      return {
        left: clampX(rect.left - tooltipWidth - MARGIN),
        top: clampY(elCentreY - TOOLTIP_H / 2),
      };
    }
    if (placement === 'top') {
      return {
        left: clampX(elCentreX - tooltipWidth / 2),
        top: clampY(rect.top - TOOLTIP_H - MARGIN),
      };
    }
    if (placement === 'bottom') {
      return {
        left: clampX(elCentreX - tooltipWidth / 2),
        top: clampY(rect.top + rect.height + MARGIN),
      };
    }
    // 'auto' — prefer below; if not enough room, go above
    const below = rect.top + rect.height + MARGIN;
    const above = rect.top - TOOLTIP_H - MARGIN;
    const top = below + TOOLTIP_H < window.innerHeight - MARGIN ? below : Math.max(MARGIN, above);
    return {
      left: clampX(elCentreX - tooltipWidth / 2),
      top,
    };
  }

  const { left: tooltipLeft, top: tooltipTop } = resolvePosition();
  const progress = totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 100;

  const backdropStyle = {
    position: 'fixed' as const,
    zIndex: 1400,
    pointerEvents: 'none' as const,
    bgcolor: alpha('#000', 0.72),
  };

  return (
    <>
      {/* ── Backdrop: 4 dark panels surrounding the spotlight ── */}
      {!isCentred ? (
        <>
          {/* Top panel */}
          <Box sx={{ ...backdropStyle, top: 0, left: 0, right: 0, height: Math.max(0, rect.top) }} />
          {/* Bottom panel */}
          <Box sx={{ ...backdropStyle, top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }} />
          {/* Left panel */}
          <Box sx={{ ...backdropStyle, top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }} />
          {/* Right panel */}
          <Box sx={{ ...backdropStyle, top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }} />
          {/* Border ring around spotlight */}
          <Box
            sx={{
              position: 'fixed',
              zIndex: 1401,
              pointerEvents: 'none',
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              borderRadius: 2,
              border: `2px solid ${theme.palette.primary.light}`,
              boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.4)}, 0 0 24px ${alpha(theme.palette.primary.main, 0.3)}`,
              transition: 'all 0.25s ease',
            }}
          />
        </>
      ) : (
        /* Full-screen dim when no target */
        <Box sx={{ ...backdropStyle, inset: 0 }} />
      )}

      {/* ── Click-to-dismiss backdrop — only for intentionally centred steps ── */}
      {isCentred && (
        <Box
          sx={{ position: 'fixed', zIndex: 1400, inset: 0, cursor: 'default', pointerEvents: 'all' }}
          onClick={(e) => {
            // Only dismiss if the user clicked the dim itself, not a child element
            if (e.target === e.currentTarget) nextStep();
          }}
        />
      )}

      {/* ── Tooltip card ── */}
      <Card
        ref={tooltipRef}
        elevation={24}
        sx={{
          position: 'fixed',
          zIndex: 1402,
          width: tooltipWidth,
          top: Math.max(8, tooltipTop),
          left: tooltipLeft,
          bgcolor: 'background.paper',
          border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
          transition: 'top 0.25s ease, left 0.25s ease',
        }}
      >
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 3, bgcolor: alpha(theme.palette.primary.main, 0.15), '& .MuiLinearProgress-bar': { bgcolor: 'primary.main' } }}
        />
        <CardContent sx={{ pb: '12px !important' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, pr: 2 }}>
              {step.title}
            </Typography>
            <IconButton size="small" onClick={stopTour} aria-label="Close tour" sx={{ mt: -0.5, mr: -0.5 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Body */}
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 2 }}>
            {step.content}
          </Typography>

          {/* Footer */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {currentStep + 1} / {totalSteps}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {currentStep > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ArrowBackIcon fontSize="small" />}
                  onClick={prevStep}
                  sx={{ px: 1.5 }}
                >
                  Back
                </Button>
              )}
              <Button
                size="small"
                variant="contained"
                endIcon={currentStep < totalSteps - 1 ? <ArrowForwardIcon fontSize="small" /> : undefined}
                onClick={nextStep}
                sx={{ px: 2 }}
              >
                {currentStep >= totalSteps - 1 ? 'Done' : 'Next'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </>
  );
}
