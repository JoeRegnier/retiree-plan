import { describe, it, expect } from 'vitest';
import { buildProjectionPayload } from './buildProjectionPayload';

describe('buildProjectionPayload', () => {
  it('builds member share timeline from account attribution history', () => {
    const currentYear = new Date().getFullYear();
    const payload = buildProjectionPayload(
      {
        members: [
          {
            id: 'm1',
            name: 'David',
            province: 'ON',
            dateOfBirth: '1970-01-01',
            incomeSources: [],
          },
          {
            id: 'm2',
            name: 'Sarah',
            province: 'ON',
            dateOfBirth: '1972-01-01',
            incomeSources: [],
          },
        ],
        accounts: [
          {
            id: 'a1',
            type: 'NON_REG',
            balance: 100_000,
            annualContribution: 0,
            taxAttributionHistory: [
              {
                effectiveYear: currentYear,
                mode: 'JOINT_PERCENTAGE',
                primaryMemberId: 'm1',
                secondaryMemberId: 'm2',
                primaryPercentage: 0.7,
                secondaryPercentage: 0.3,
              },
            ],
          },
          {
            id: 'a2',
            type: 'RRSP',
            balance: 50_000,
            annualContribution: 0,
            taxAttributionHistory: [
              {
                effectiveYear: currentYear,
                mode: 'SINGLE_MEMBER',
                primaryMemberId: 'm2',
              },
            ],
          },
        ],
      },
      {
        lifeExpectancy: 90,
        retirementAge: 65,
        annualExpenses: 60_000,
      },
    ) as any;

    expect(payload).toBeTruthy();
    expect(Array.isArray(payload.members)).toBe(true);
    expect(payload.memberTypeShareTimeline.length).toBeGreaterThan(0);

    const rowsForYear = payload.memberTypeShareTimeline.filter((r: any) => r.effectiveYear === currentYear);
    const rowM1 = rowsForYear.find((r: any) => r.memberId === 'm1');
    const rowM2 = rowsForYear.find((r: any) => r.memberId === 'm2');

    expect(rowM1).toBeTruthy();
    expect(rowM2).toBeTruthy();

    expect(rowM1.nonRegShare).toBeCloseTo(0.7, 6);
    expect(rowM2.nonRegShare).toBeCloseTo(0.3, 6);
    expect(rowM1.rrspShare).toBeCloseTo(0, 6);
    expect(rowM2.rrspShare).toBeCloseTo(1, 6);
  });
});
