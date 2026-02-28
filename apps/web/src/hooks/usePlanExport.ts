import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from './useApi';
import type {
  RetirementPlanData,
  PdfProjectionRow,
  PdfScenarioParameters,
  PdfProjYear,
  PdfMcBand,
} from '../components/PdfReport';

type ScenarioProjResult = {
  rows: PdfProjectionRow[];
  allYears: PdfProjYear[];
  mcBands: PdfMcBand[];
  successRate: number | null;
  depleted: number | null;
  nwAtRetirement: number | null;
  expenseTotal: number;
};

/**
 * Builds a complete `RetirementPlanData` object ready to pass to `PdfDownloadButton`.
 * Fetches per-scenario cash-flow projections and Monte Carlo bands for PDF charts.
 *
 * Designed to be called once (e.g. in the app layout) so the data is computed and
 * cached while the user works — no delay when they click "Export".
 */
export function usePlanExport(): {
  planData: RetirementPlanData | null;
  projectionsLoading: boolean;
} {
  const { apiFetch } = useApi();

  const { data: households } = useQuery<any[]>({
    queryKey: ['households'],
    queryFn: () => apiFetch('/households'),
  });

  const [scenarioProjections, setScenarioProjections] = useState<Record<string, ScenarioProjResult>>({});
  const [projectionsLoading, setProjectionsLoading] = useState(false);
  const [householdExpenseTotal, setHouseholdExpenseTotal] = useState<number | null>(null);

  const calcAge = useCallback((dob: string | null | undefined): number => {
    if (!dob) return 40;
    return new Date().getFullYear() - new Date(dob).getFullYear();
  }, []);

  const weightedRate = useCallback((accs: any[]): number | undefined => {
    const rated = accs.filter((a: any) => a.estimatedReturnRate != null);
    if (!rated.length) return undefined;
    const totalBal = rated.reduce((s: number, a: any) => s + a.balance, 0);
    if (totalBal <= 0) return rated[0].estimatedReturnRate as number;
    return rated.reduce((s: number, a: any) => s + a.balance * a.estimatedReturnRate, 0) / totalBal;
  }, []);

  useEffect(() => {
    const hh = households?.[0];
    if (!hh || !hh.scenarios?.length) return;
    const primaryMember = hh?.members?.[0];
    if (!primaryMember) return;

    const fetchAllProjections = async () => {
      setProjectionsLoading(true);
      const results: Record<string, ScenarioProjResult> = {};

      const currentAge = calcAge(primaryMember.dateOfBirth);
      const accounts: any[] = hh.accounts ?? [];
      const rrsp    = accounts.filter((a) => a.type === 'RRSP' || a.type === 'RRIF').reduce((s: number, a) => s + a.balance, 0);
      const tfsa    = accounts.filter((a) => a.type === 'TFSA').reduce((s: number, a) => s + a.balance, 0);
      const nonReg  = accounts.filter((a) => a.type === 'NON_REG').reduce((s: number, a) => s + a.balance, 0);
      const cashBal = accounts.filter((a) => a.type === 'CASH').reduce((s: number, a) => s + a.balance, 0);
      const rrspRate   = weightedRate(accounts.filter((a) => a.type === 'RRSP' || a.type === 'RRIF'));
      const tfsaRate   = weightedRate(accounts.filter((a) => a.type === 'TFSA'));
      const nonRegRate = weightedRate(accounts.filter((a) => a.type === 'NON_REG'));
      const cashRate   = weightedRate(accounts.filter((a) => a.type === 'CASH'));

      const ENGINE_EXCLUDED = new Set(['CPP', 'OAS']);
      const incomeSources = (hh.members ?? []).flatMap((m: any) =>
        (m.incomeSources ?? [])
          .filter((src: any) => !ENGINE_EXCLUDED.has(src.type))
          .map((src: any) => ({
            annualAmount: src.annualAmount as number,
            startAge: src.startAge as number | undefined,
            endAge: src.endAge as number | undefined,
            indexToInflation: src.indexToInflation !== false,
          }))
      );

      // Fetch actual expense line-items for the household
      let expenseItems: any[] = [];
      try {
        expenseItems = await apiFetch(`/expenses/household/${hh.id}`) as any[];
      } catch { /* fall back to household-level annualExpenses if endpoint fails */ }

      const fetchedTotal = expenseItems.length > 0
        ? expenseItems.reduce((s: number, e: any) => s + (e.annualAmount ?? 0), 0)
        : null;
      setHouseholdExpenseTotal(fetchedTotal);

      const totalExpenses = fetchedTotal ?? hh.annualExpenses ?? 60_000;

      const expenseEntries = expenseItems.length > 0
        ? expenseItems.map((e: any) => ({
            annualAmount: e.annualAmount as number,
            ...(e.startAge != null ? { startAge: e.startAge as number } : {}),
            ...(e.endAge   != null ? { endAge:   e.endAge   as number } : {}),
            indexToInflation: e.indexToInflation !== false,
          }))
        : undefined;

      for (const scenario of hh.scenarios) {
        try {
          const p: Record<string, any> = (() => {
            try {
              return typeof scenario.parameters === 'string'
                ? JSON.parse(scenario.parameters)
                : (scenario.parameters ?? {});
            } catch { return {}; }
          })();
          const payload: Record<string, unknown> = {
            currentAge,
            endAge: p.lifeExpectancy ?? 90,
            province: primaryMember.province ?? 'ON',
            employmentIncome: 0,
            incomeSources,
            retirementAge: p.retirementAge ?? 65,
            annualExpenses: totalExpenses,
            ...(expenseEntries ? { expenseEntries } : {}),
            inflationRate: p.inflationRate ?? 0.02,
            nominalReturnRate: p.expectedReturnRate ?? 0.06,
            cppStartAge: p.cppStartAge ?? 65,
            oasStartAge: p.oasStartAge ?? 65,
            rrspBalance: rrsp,
            tfsaBalance: tfsa,
            nonRegBalance: nonReg,
            cashBalance: cashBal,
            rrspContribution: accounts.find((a) => a.type === 'RRSP')?.annualContribution ?? 0,
            tfsaContribution: accounts.find((a) => a.type === 'TFSA')?.annualContribution ?? 0,
            rrifConversionAge: p.rrifStartAge ?? 71,
            nonRegTaxDragRate: p.nonRegTaxDragRate ?? 0,
            investSurplus: p.investSurplus ?? false,
            cashSavingsRate: cashRate ?? p.cashSavingsRate ?? 0.025,
            ...(rrspRate != null ? { rrspReturnRate: rrspRate } : {}),
            ...(tfsaRate != null ? { tfsaReturnRate: tfsaRate } : {}),
            ...(nonRegRate != null ? { nonRegReturnRate: nonRegRate } : {}),
            ...(p.glidePathSteps?.length ? { glidePathSteps: p.glidePathSteps } : {}),
            ...(p.spendingPhases?.length ? { spendingPhases: p.spendingPhases } : {}),
          };

          const data: any = await apiFetch('/projections/cash-flow', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

          const years: any[] = Array.isArray(data) ? data : (data.years ?? data.data ?? []);
          const rows: PdfProjectionRow[] = years
            .filter((_: any, i: number) => i % 5 === 0 || i === years.length - 1)
            .map((y: any) => ({
              year: y.age as number,
              totalIncome: (y.totalIncome as number) ?? 0,
              totalExpenses: (y.expenses ?? y.totalExpenses ?? 0) as number,
              tax: (y.totalTax ?? y.taxPaid ?? undefined) as number | undefined,
              netWorth: (y.totalNetWorth ?? y.netWorth ?? 0) as number,
            }));

          const depletedYear = years.find((y: any) => ((y.totalNetWorth ?? y.netWorth ?? 0) as number) <= 0);
          const depleted = depletedYear ? (depletedYear.age as number) : null;
          const retAge = (p.retirementAge as number | undefined) ?? 65;
          const atRet = years.find((y: any) => y.age === retAge);
          const nwAtRetirement = atRet ? ((atRet.totalNetWorth ?? atRet.netWorth ?? 0) as number) : null;

          const allYears: PdfProjYear[] = years.map((y: any) => ({
            age: y.age as number,
            rrspBalance: (y.rrspBalance ?? 0) as number,
            tfsaBalance: (y.tfsaBalance ?? 0) as number,
            nonRegBalance: (y.nonRegBalance ?? 0) as number,
            cashBalance: (y.cashBalance ?? 0) as number,
            employmentIncome: (y.employmentIncome ?? 0) as number,
            cppIncome: (y.cppIncome ?? 0) as number,
            oasIncome: (y.oasIncome ?? 0) as number,
            rrspWithdrawal: (y.rrspWithdrawal ?? 0) as number,
            tfsaWithdrawal: (y.tfsaWithdrawal ?? 0) as number,
            nonRegWithdrawal: (y.nonRegWithdrawal ?? 0) as number,
            totalTax: (y.totalTax ?? y.taxPaid ?? 0) as number,
            netCashFlow: (y.netCashFlow ?? 0) as number,
          }));

          let mcBands: PdfMcBand[] = [];
          let successRate: number | null = null;
          try {
            const mcData: any = await apiFetch('/projections/monte-carlo', {
              method: 'POST',
              body: JSON.stringify({ ...payload, trials: 1000 }),
            });
            successRate = mcData.successRate ?? null;
            const allBands: any[] = mcData.percentilesByYear ?? [];
            mcBands = allBands
              .filter((_: any, i: number) => i % 3 === 0 || i === allBands.length - 1)
              .map((b: any) => ({
                age: b.age as number,
                p5: b.p5 as number,
                p25: b.p25 as number,
                p50: b.p50 as number,
                p75: b.p75 as number,
                p95: b.p95 as number,
              }));
          } catch { /* Monte Carlo is optional; skip on error */ }

          results[scenario.id] = { rows, allYears, mcBands, successRate, depleted, nwAtRetirement, expenseTotal: totalExpenses };
        } catch {
          // Skip on error — scenario will appear without projection data
        }
      }

      setScenarioProjections(results);
      setProjectionsLoading(false);
    };

    void fetchAllProjections();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [households]);

  const planData = useMemo((): RetirementPlanData | null => {
    const hh = households?.[0];
    if (!hh) return null;
    return {
      householdName: hh.name ?? 'My Household',
      generatedAt: new Date().toLocaleDateString('en-CA'),
      members: (hh.members ?? []).map((m: any) => ({
        name: m.name,
        birthYear: m.dateOfBirth
          ? new Date(m.dateOfBirth).getFullYear()
          : new Date().getFullYear() - 50,
        retirementAge: m.retirementAge ?? 65,
        province: m.province,
        country: m.country,
      })),
      incomeSources: (hh.members ?? []).flatMap((m: any) =>
        (m.incomeSources ?? []).map((src: any) => ({
          name: src.name,
          type: src.type ?? 'Other',
          annualAmount: src.annualAmount ?? 0,
          startYear: src.startAge,
          endYear: src.endAge,
          memberName: m.name,
        }))
      ),
      accounts: (hh.accounts ?? []).map((acc: any) => ({
        name: acc.name,
        type: acc.type ?? 'Other',
        balance: acc.balance ?? 0,
      })),
      scenarios: (hh.scenarios ?? []).map((s: any) => {
        const proj = scenarioProjections[s.id];
        const p: Record<string, any> = (() => {
          try {
            return typeof s.parameters === 'string' ? JSON.parse(s.parameters) : (s.parameters ?? {});
          } catch { return {}; }
        })();
        const params: PdfScenarioParameters = {
          retirementAge: p.retirementAge,
          lifeExpectancy: p.lifeExpectancy,
          inflationRate: p.inflationRate,
          expectedReturnRate: p.expectedReturnRate,
          cppStartAge: p.cppStartAge,
          oasStartAge: p.oasStartAge,
          rrifConversionAge: p.rrifStartAge ?? p.rrifConversionAge,
          investSurplus: p.investSurplus,
          cashSavingsRate: p.cashSavingsRate,
          annualExpenses: proj?.expenseTotal ?? p.annualExpenses,
        };
        return {
          name: s.name,
          description: s.description,
          parameters: params,
          projectionRows: proj?.rows,
          allYears: proj?.allYears,
          mcBands: proj?.mcBands,
          successRate: proj?.successRate ?? undefined,
          portfolioDepletionAge: proj?.depleted ?? undefined,
          netWorthAtRetirement: proj?.nwAtRetirement ?? undefined,
        };
      }),
      annualExpenses: householdExpenseTotal ?? hh.annualExpenses ?? 0,
      notes: hh.notes,
    };
  }, [households, scenarioProjections, householdExpenseTotal]);

  return { planData, projectionsLoading };
}
