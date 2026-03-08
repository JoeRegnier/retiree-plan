/**
 * Goal evaluation engine.
 * Evaluates retirement goals against Monte Carlo simulation results.
 */

import type { ProjectionYear } from '@retiree-plan/shared';

export interface GoalDefinition {
  name: string;
  targetAmount: number;
  targetAge: number | null;
  priority: 'essential' | 'discretionary';
  category: string;
}

export interface GoalResult {
  goal: GoalDefinition;
  successRate: number;
  progressPercent: number;
  shortfall: number;
  funded: boolean;
}

/**
 * Evaluate a single goal against Monte Carlo trial data.
 *
 * For goals with a targetAge: checks if net worth at that age >= targetAmount
 * For goals without targetAge (ongoing): checks if portfolio survives to end
 */
function evaluateGoal(
  goal: GoalDefinition,
  trials: ProjectionYear[][],
  currentNetWorth: number,
): GoalResult {
  if (trials.length === 0) {
    return {
      goal,
      successRate: 0,
      progressPercent: goal.targetAmount > 0
        ? Math.min(100, (currentNetWorth / goal.targetAmount) * 100)
        : 100,
      shortfall: Math.max(0, goal.targetAmount - currentNetWorth),
      funded: currentNetWorth >= goal.targetAmount,
    };
  }

  let successes = 0;
  let totalNWAtTarget = 0;

  for (const trial of trials) {
    if (goal.targetAge != null) {
      // Find the projection year matching targetAge
      const targetYear = trial.find((y) => y.age === goal.targetAge);
      if (targetYear) {
        const nw = targetYear.totalNetWorth ?? 0;
        if (nw >= goal.targetAmount) {
          successes++;
        }
        totalNWAtTarget += nw;
      }
    } else {
      // Ongoing goal: check if portfolio never depletes
      const lastYear = trial[trial.length - 1];
      if (lastYear && (lastYear.totalNetWorth ?? 0) > 0) {
        successes++;
      }
      totalNWAtTarget += (lastYear?.totalNetWorth ?? 0);
    }
  }

  const successRate = successes / trials.length;
  const avgNWAtTarget = totalNWAtTarget / trials.length;
  const progressPercent = goal.targetAmount > 0
    ? Math.min(100, (currentNetWorth / goal.targetAmount) * 100)
    : 100;
  const shortfall = Math.max(0, goal.targetAmount - avgNWAtTarget);

  return {
    goal,
    successRate,
    progressPercent,
    shortfall,
    funded: successRate >= 0.9,
  };
}

/**
 * Evaluate all goals against Monte Carlo simulation results.
 * Returns results sorted by priority (essential first) then success rate (lowest first).
 */
export function evaluateGoals(
  goals: GoalDefinition[],
  trials: ProjectionYear[][],
  currentNetWorth: number,
): GoalResult[] {
  const results = goals.map((goal) => evaluateGoal(goal, trials, currentNetWorth));

  // Sort: essential first, then by success rate ascending (worst first)
  const priorityRank = { essential: 0, discretionary: 1 };
  return results.sort((a, b) => {
    const pDiff = priorityRank[a.goal.priority] - priorityRank[b.goal.priority];
    if (pDiff !== 0) return pDiff;
    return a.successRate - b.successRate;
  });
}
