import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Builds a concise text summary of a user's retirement plan to include
 * as context in AI assistant prompts.  Keeps the token count low by
 * omitting very large fields and rounding numbers.
 */
@Injectable()
export class AiContextBuilderService {
  constructor(private prisma: PrismaService) {}

  async buildContext(userId: string): Promise<string> {
    const households = await this.prisma.household.findMany({
      where: { userId },
      include: {
        members: { include: { incomeSources: true } },
        accounts: true,
        expenses: true,
        milestoneEvents: true,
        scenarios: true,
      },
    });

    if (households.length === 0) {
      return 'The user has not yet set up a household.';
    }

    const hh = households[0]; // primary household
    const lines: string[] = [];

    lines.push(`## Household: ${hh.name}`);

    // Members
    for (const m of hh.members) {
      const age = this.ageFromDob(m.dateOfBirth as unknown as string);
      lines.push(`\n### Member: ${m.name} (age ${age}, province: ${m.province})`);
      if (m.incomeSources.length > 0) {
        lines.push('Income sources:');
        for (const inc of m.incomeSources) {
          const range = [inc.startAge && `from ${inc.startAge}`, inc.endAge && `to ${inc.endAge}`]
            .filter(Boolean)
            .join(' ');
          lines.push(
            `  - ${inc.name} (${inc.type}): $${Math.round(inc.annualAmount).toLocaleString()}/yr ${range}`,
          );
        }
      } else {
        lines.push('  No income sources recorded.');
      }
    }

    // Accounts
    if (hh.accounts.length > 0) {
      lines.push('\n### Accounts');
      for (const acc of hh.accounts) {
        lines.push(
          `  - ${acc.name} (${acc.type}): $${Math.round(acc.balance).toLocaleString()} balance, $${Math.round(acc.annualContribution).toLocaleString()}/yr contribution`,
        );
      }
    }

    // Expenses
    if (hh.expenses.length > 0) {
      const totalExpenses = hh.expenses.reduce((s, e) => s + e.annualAmount, 0);
      lines.push(`\n### Expenses (total: $${Math.round(totalExpenses).toLocaleString()}/yr)`);
      for (const exp of hh.expenses) {
        lines.push(`  - ${exp.name} (${exp.category}): $${Math.round(exp.annualAmount).toLocaleString()}/yr`);
      }
    }

    // Milestones
    if (hh.milestoneEvents.length > 0) {
      lines.push('\n### Milestone Events');
      for (const ms of hh.milestoneEvents) {
        lines.push(
          `  - ${ms.name} at age ${ms.age}: $${Math.round(ms.amount).toLocaleString()} (${ms.type})`,
        );
      }
    }

    // Scenarios
    if (hh.scenarios.length > 0) {
      lines.push('\n### Scenarios');
      for (const sc of hh.scenarios) {
        lines.push(`  - ${sc.name}${sc.description ? ': ' + sc.description : ''}`);
      }
    }

    return lines.join('\n');
  }

  private ageFromDob(dateOfBirth: string | Date): number {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }
}
