/**
 * PdfReport.tsx
 *
 * @react-pdf/renderer Document component for exporting a full retirement-plan
 * summary to PDF.  Import PdfDownloadButton for a ready-to-use button, or use
 * PdfDocument directly with PDFViewer / pdf().
 *
 * Usage:
 *   import { PdfDownloadButton } from '../components/PdfReport';
 *   <PdfDownloadButton plan={plan} label="Download PDF" />
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
  Font,
  Svg,
  Path,
  Polyline,
  Rect,
  Line as SvgLine,
} from '@react-pdf/renderer';
import { Button } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PdfMember {
  name: string;
  birthYear: number;
  retirementAge: number;
  province?: string;
  country?: string;
}

export interface PdfIncomeSource {
  name: string;
  type: string;
  annualAmount: number;
  startYear?: number;
  endYear?: number;
  memberName?: string;
}

export interface PdfAccount {
  name: string;
  type: string;
  balance: number;
  memberName?: string;
}

export interface PdfProjectionRow {
  year: number; // age
  totalIncome: number;
  totalExpenses: number;
  tax?: number;
  netWorth: number;
}

/** Full per-year engine output row, used for detailed charts */
export interface PdfProjYear {
  age: number;
  rrspBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  cashBalance: number;
  employmentIncome: number;
  cppIncome: number;
  oasIncome: number;
  rrspWithdrawal: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;
  totalTax: number;
  netCashFlow: number;
}

/** Single percentile band row from Monte Carlo simulation */
export interface PdfMcBand {
  age: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface PdfScenarioParameters {
  retirementAge?: number;
  lifeExpectancy?: number;
  inflationRate?: number;
  expectedReturnRate?: number;
  cppStartAge?: number;
  oasStartAge?: number;
  rrifConversionAge?: number;
  investSurplus?: boolean;
  cashSavingsRate?: number;
  annualExpenses?: number;
}

export interface PdfScenario {
  name: string;
  description?: string;
  parameters?: PdfScenarioParameters;
  projectionRows?: PdfProjectionRow[];
  allYears?: PdfProjYear[];
  mcBands?: PdfMcBand[];
  successRate?: number;
  netWorthAtRetirement?: number;
  portfolioDepletionAge?: number | null;
}

export interface RetirementPlanData {
  householdName: string;
  generatedAt?: string;
  members: PdfMember[];
  incomeSources: PdfIncomeSource[];
  accounts: PdfAccount[];
  projections?: PdfProjectionRow[];
  scenarios?: PdfScenario[];
  annualExpenses?: number;
  notes?: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BRAND_BLUE = '#1565C0';
const LIGHT_GREY = '#F5F5F5';
const DARK_TEXT = '#212121';
const MED_TEXT = '#555555';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK_TEXT,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
  },
  // Header
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: BRAND_BLUE,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_BLUE,
  },
  headerSubtitle: {
    fontSize: 10,
    color: MED_TEXT,
    marginTop: 4,
  },
  // Sections
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_BLUE,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
    paddingBottom: 3,
  },
  // Table
  table: {
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 4,
  },
  tableHeader: {
    backgroundColor: BRAND_BLUE,
  },
  tableHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tableCell: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    color: DARK_TEXT,
  },
  tableRowEven: {
    backgroundColor: LIGHT_GREY,
  },
  // Member card
  memberCard: {
    backgroundColor: LIGHT_GREY,
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
  },
  memberName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginBottom: 2,
  },
  memberDetail: {
    color: MED_TEXT,
    fontSize: 9,
  },
  // Key-value rows
  kvRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  kvKey: {
    fontFamily: 'Helvetica-Bold',
    width: '40%',
  },
  kvValue: {
    width: '60%',
    color: MED_TEXT,
  },
  // Totals highlight
  summaryBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_BLUE,
  },
  summaryLabel: {
    fontSize: 8,
    color: MED_TEXT,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: MED_TEXT,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 4,
  },
  // Scenario detail
  scenarioHeader: {
    backgroundColor: '#E3F2FD',
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
  },
  scenarioTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_BLUE,
    marginBottom: 2,
  },
  scenarioDesc: {
    fontSize: 9,
    color: MED_TEXT,
  },
  paramGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  paramItem: {
    width: '33%',
    marginBottom: 5,
  },
  paramLabel: {
    fontSize: 8,
    color: MED_TEXT,
    marginBottom: 1,
  },
  paramValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: DARK_TEXT,
  },
  depletionBadge: {
    backgroundColor: '#FFEBEE',
    borderRadius: 4,
    padding: 6,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  depletionBadgeOk: {
    backgroundColor: '#E8F5E9',
    borderRadius: 4,
    padding: 6,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  depletionText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#C62828',
  },
  depletionTextOk: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#2E7D32',
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

const fmtShort = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

const ColW = {
  income: ['30%', '20%', '20%', '15%', '15%'],
  projection: ['15%', '22%', '22%', '22%', '19%'],
  scenarioProj: ['12%', '20%', '20%', '18%', '18%', '12%'],
};

// ── SVG Chart components ──────────────────────────────────────────────────────

/** Line chart of net worth over age with an optional retirement-age marker. */
function NetWorthChart({ rows, retirementAge }: { rows: PdfProjectionRow[]; retirementAge?: number }) {
  if (rows.length < 2) return null;

  const W = 490, H = 115;
  const pL = 52, pR = 8, pT = 6, pB = 22;
  const cW = W - pL - pR;
  const cH = H - pT - pB;

  const ages = rows.map(r => r.year);
  const vals = rows.map(r => r.netWorth);
  const minAge = ages[0], maxAge = ages[ages.length - 1];
  const rawMin = Math.min(0, ...vals);
  const rawMax = Math.max(...vals);
  const valRange = rawMax - rawMin || 1;

  const xOf = (age: number) => pL + ((age - minAge) / (maxAge - minAge || 1)) * cW;
  const yOf = (val: number) => pT + cH - ((val - rawMin) / valRange) * cH;

  const polyPoints = rows.map(r => `${xOf(r.year).toFixed(1)},${yOf(r.netWorth).toFixed(1)}`).join(' ');

  const zeroY = yOf(0);
  const areaD =
    `M ${xOf(ages[0]).toFixed(1)},${zeroY.toFixed(1)} ` +
    rows.map(r => `L ${xOf(r.year).toFixed(1)},${yOf(r.netWorth).toFixed(1)}`).join(' ') +
    ` L ${xOf(ages[ages.length - 1]).toFixed(1)},${zeroY.toFixed(1)} Z`;

  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => ({
    val: rawMin + (i / yTickCount) * valRange,
    yPos: yOf(rawMin + (i / yTickCount) * valRange),
  }));

  const step = Math.max(1, Math.floor(rows.length / 7));
  const xLabels = rows.filter((_, i) => i % step === 0 || i === rows.length - 1);

  const retX = retirementAge && retirementAge > minAge && retirementAge < maxAge
    ? xOf(retirementAge) : null;

  return (
    <Svg width={W} height={H}>
      {/* Y-axis grid lines */}
      {yTicks.map((t, i) => (
        <SvgLine key={`yg${i}`} x1={pL} y1={t.yPos} x2={W - pR} y2={t.yPos}
          stroke={Math.abs(t.val) < valRange * 0.001 ? '#999' : '#E0E0E0'}
          strokeWidth={Math.abs(t.val) < valRange * 0.001 ? 0.8 : 0.4} />
      ))}
      {/* Y-axis labels */}
      {yTicks.map((t, i) => (
        <Text key={`yl${i}`} x={pL - 2} y={t.yPos + 2.5} fill="#777"
          style={{ fontSize: 5.5 } as any}>
          {fmtShort(t.val)}
        </Text>
      ))}
      {/* Area fill */}
      <Path d={areaD} fill="#BBDEFB" fillOpacity={0.5} />
      {/* Net-worth line */}
      <Polyline points={polyPoints} stroke="#1565C0" strokeWidth={1.5} fill="none" />
      {/* Retirement age marker */}
      {retX !== null && (
        <SvgLine x1={retX!} y1={pT} x2={retX!} y2={pT + cH}
          stroke="#E65100" strokeWidth={1} strokeDasharray="3,2" />
      )}
      {/* X-axis baseline */}
      <SvgLine x1={pL} y1={pT + cH} x2={W - pR} y2={pT + cH} stroke="#999" strokeWidth={0.5} />
      {/* X-axis labels */}
      {xLabels.map((r, i) => (
        <Text key={`xl${i}`} x={xOf(r.year)} y={H - 5} fill="#666"
          style={{ fontSize: 5.5 } as any}>
          {r.year}
        </Text>
      ))}
    </Svg>
  );
}

/** Grouped bar chart: income vs expenses per sampled age. */
function IncomeExpenseChart({ rows }: { rows: PdfProjectionRow[] }) {
  if (rows.length < 1) return null;

  const W = 490, H = 95;
  const pL = 52, pR = 8, pT = 6, pB = 22;
  const cW = W - pL - pR;
  const cH = H - pT - pB;

  const maxVal = Math.max(...rows.flatMap(r => [r.totalIncome, r.totalExpenses])) || 1;
  const slot = cW / rows.length;
  const bW = Math.min(Math.max(slot * 0.3, 2), 12);

  const barY = (v: number) => pT + cH - (v / maxVal) * cH;
  const barH = (v: number) => Math.max(0, (v / maxVal) * cH);

  const yTicks = [0, 0.5, 1].map(t => ({
    val: t * maxVal,
    yPos: pT + cH * (1 - t),
  }));

  return (
    <Svg width={W} height={H}>
      {/* Y grid lines and labels */}
      {yTicks.map((t, i) => (
        <SvgLine key={`g${i}`} x1={pL} y1={t.yPos} x2={W - pR} y2={t.yPos}
          stroke="#E0E0E0" strokeWidth={0.4} />
      ))}
      {yTicks.map((t, i) => (
        <Text key={`yl${i}`} x={pL - 2} y={t.yPos + 2.5} fill="#777"
          style={{ fontSize: 5.5 } as any}>
          {fmtShort(t.val)}
        </Text>
      ))}
      {/* Bars */}
      {rows.map((r, i) => {
        const cx = pL + i * slot + slot / 2;
        return (
          <React.Fragment key={`b${i}`}>
            <Rect x={cx - bW - 0.5} y={barY(r.totalIncome)} width={bW} height={barH(r.totalIncome)}
              fill="#43A047" fillOpacity={0.85} />
            <Rect x={cx + 0.5} y={barY(r.totalExpenses)} width={bW} height={barH(r.totalExpenses)}
              fill="#EF6C00" fillOpacity={0.85} />
          </React.Fragment>
        );
      })}
      {/* X axis baseline */}
      <SvgLine x1={pL} y1={pT + cH} x2={W - pR} y2={pT + cH} stroke="#999" strokeWidth={0.5} />
      {/* X labels */}
      {rows.map((r, i) => (
        <Text key={`xl${i}`} x={pL + i * slot + slot / 2} y={H - 5} fill="#666"
          style={{ fontSize: 5.5 } as any}>
          {r.year}
        </Text>
      ))}
    </Svg>
  );
}

/** Stacked bar chart: account balances (RRSP/RRIF, TFSA, Non-Reg, Cash) over time. */
function AccountBalanceChart({ years, retirementAge }: { years: PdfProjYear[]; retirementAge?: number }) {
  if (!years || years.length === 0) return null;

  const sampled: PdfProjYear[] = years.filter(
    (y, i) => i === 0 || i === years.length - 1 || y.age % 5 === 0,
  );

  const W = 490, H = 130;
  const pL = 46, pR = 8, pT = 8, pB = 20;
  const cW = W - pL - pR;
  const cH = H - pT - pB;
  const n = sampled.length;
  const slot = cW / n;
  const bW = Math.min(Math.max(slot * 0.65, 3), 16);

  const maxVal = Math.max(
    ...sampled.map(y => y.rrspBalance + y.tfsaBalance + y.nonRegBalance + y.cashBalance),
    1,
  );

  type Layer = { color: string; get: (y: PdfProjYear) => number };
  const layers: Layer[] = [
    { color: '#81D4FA', get: y => y.cashBalance },
    { color: '#CE93D8', get: y => y.nonRegBalance },
    { color: '#A5D6A7', get: y => y.tfsaBalance },
    { color: '#FFCC80', get: y => y.rrspBalance },
  ];

  return (
    <Svg width={W} height={H}>
      {/* Gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const yPos = pT + cH * (1 - f);
        return (
          <SvgLine key={f} x1={pL} y1={yPos} x2={W - pR} y2={yPos}
            stroke="#E0E0E0" strokeWidth={0.4} />
        );
      })}
      {/* Y labels */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <Text key={f} x={pL - 2} y={pT + cH * (1 - f) + 2} fill="#777"
          style={{ fontSize: 5.5 } as any}>
          {fmtShort(maxVal * f)}
        </Text>
      ))}
      {/* Stacked bars */}
      {sampled.map((yr, i) => {
        const cx = pL + i * slot + slot / 2;
        let cum = 0;
        return layers.map(layer => {
          const val = layer.get(yr);
          const bH = Math.max(0, (val / maxVal) * cH);
          const y = pT + cH - cum - bH;
          cum += bH;
          return <Rect key={layer.color} x={cx - bW / 2} y={y} width={bW} height={bH} fill={layer.color} />;
        });
      })}
      {/* Retirement marker */}
      {retirementAge != null && (() => {
        const idx = sampled.findIndex(y => y.age >= retirementAge!);
        if (idx < 0) return null;
        const x = pL + idx * slot + slot / 2;
        return <SvgLine x1={x} y1={pT} x2={x} y2={pT + cH} stroke="#E65100" strokeWidth={1} strokeDasharray="3,2" />;
      })()}
      {/* Baseline */}
      <SvgLine x1={pL} y1={pT + cH} x2={W - pR} y2={pT + cH} stroke="#999" strokeWidth={0.5} />
      {/* X labels */}
      {sampled.map((yr, i) => (
        <Text key={yr.age} x={pL + i * slot + slot / 2} y={H - 5} fill="#666"
          style={{ fontSize: 5.5 } as any}>
          {yr.age}
        </Text>
      ))}
    </Svg>
  );
}

/** Stacked bar chart: income by source (employment, CPP, OAS, RRSP/TFSA/NonReg withdrawals). */
function IncomeBreakdownChart({ years }: { years: PdfProjYear[] }) {
  if (!years || years.length === 0) return null;

  const sampled: PdfProjYear[] = years.filter(
    (y, i) => i === 0 || i === years.length - 1 || y.age % 5 === 0,
  );

  const W = 490, H = 110;
  const pL = 46, pR = 8, pT = 8, pB = 20;
  const cW = W - pL - pR;
  const cH = H - pT - pB;
  const n = sampled.length;
  const slot = cW / n;
  const bW = Math.min(Math.max(slot * 0.65, 3), 16);

  type SrcLayer = { color: string; get: (y: PdfProjYear) => number };
  const layers: SrcLayer[] = [
    { color: '#42A5F5', get: y => y.employmentIncome },
    { color: '#EF5350', get: y => y.cppIncome },
    { color: '#FFA726', get: y => y.oasIncome },
    { color: '#FF7043', get: y => y.rrspWithdrawal },
    { color: '#66BB6A', get: y => y.tfsaWithdrawal },
    { color: '#AB47BC', get: y => y.nonRegWithdrawal },
  ];

  const maxVal = Math.max(
    ...sampled.map(y => layers.reduce((s, l) => s + l.get(y), 0)),
    1,
  );

  return (
    <Svg width={W} height={H}>
      {[0, 0.5, 1].map(f => {
        const yPos = pT + cH * (1 - f);
        return (
          <SvgLine key={f} x1={pL} y1={yPos} x2={W - pR} y2={yPos}
            stroke="#E0E0E0" strokeWidth={0.4} />
        );
      })}
      {[0, 0.5, 1].map(f => (
        <Text key={f} x={pL - 2} y={pT + cH * (1 - f) + 2} fill="#777"
          style={{ fontSize: 5.5 } as any}>
          {fmtShort(maxVal * f)}
        </Text>
      ))}
      {sampled.map((yr, i) => {
        const cx = pL + i * slot + slot / 2;
        let cum = 0;
        return layers.map(layer => {
          const val = layer.get(yr);
          const bH = Math.max(0, (val / maxVal) * cH);
          const y = pT + cH - cum - bH;
          cum += bH;
          return <Rect key={layer.color} x={cx - bW / 2} y={y} width={bW} height={bH} fill={layer.color} />;
        });
      })}
      <SvgLine x1={pL} y1={pT + cH} x2={W - pR} y2={pT + cH} stroke="#999" strokeWidth={0.5} />
      {sampled.map((yr, i) => (
        <Text key={yr.age} x={pL + i * slot + slot / 2} y={H - 5} fill="#666"
          style={{ fontSize: 5.5 } as any}>
          {yr.age}
        </Text>
      ))}
    </Svg>
  );
}

/** Bar chart: annual net cash flow (green = surplus, red = deficit). */
function NetCashFlowChart({ years }: { years: PdfProjYear[] }) {
  if (!years || years.length === 0) return null;

  const sampled: PdfProjYear[] = years.filter(
    (y, i) => i === 0 || i === years.length - 1 || y.age % 5 === 0,
  );

  const W = 490, H = 90;
  const pL = 46, pR = 8, pT = 8, pB = 20;
  const cW = W - pL - pR;
  const cH = H - pT - pB;
  const n = sampled.length;
  const slot = cW / n;
  const bW = Math.min(Math.max(slot * 0.65, 3), 16);

  const flows = sampled.map(y => y.netCashFlow);
  const rawMin = Math.min(0, ...flows);
  const rawMax = Math.max(0, ...flows) || 1;
  const range = rawMax - rawMin || 1;

  const zeroY = pT + ((rawMax) / range) * cH;
  const yOf = (v: number) => pT + ((rawMax - v) / range) * cH;

  return (
    <Svg width={W} height={H}>
      {/* Zero line */}
      <SvgLine x1={pL} y1={zeroY} x2={W - pR} y2={zeroY} stroke="#888" strokeWidth={0.6} />
      {/* Y labels */}
      {[rawMin, 0, rawMax].map((v, i) => (
        <Text key={i} x={pL - 2} y={yOf(v) + 2} fill="#777"
          style={{ fontSize: 5.5 } as any}>
          {fmtShort(v)}
        </Text>
      ))}
      {/* Bars */}
      {sampled.map((yr, i) => {
        const v = yr.netCashFlow;
        const cx = pL + i * slot + slot / 2;
        const isPos = v >= 0;
        const y = isPos ? yOf(v) : zeroY;
        const bH = Math.max(0.5, Math.abs((v / range) * cH));
        return (
          <Rect key={yr.age} x={cx - bW / 2} y={y} width={bW} height={bH}
            fill={isPos ? '#43A047' : '#E53935'} fillOpacity={0.85} />
        );
      })}
      <SvgLine x1={pL} y1={pT + cH} x2={W - pR} y2={pT + cH} stroke="#999" strokeWidth={0.5} />
      {sampled.map((yr, i) => (
        <Text key={yr.age} x={pL + i * slot + slot / 2} y={H - 5} fill="#666"
          style={{ fontSize: 5.5 } as any}>
          {yr.age}
        </Text>
      ))}
    </Svg>
  );
}

/** Monte Carlo fan chart: percentile bands (p5-p95, p25-p75) and p50 median. */
function MonteCarloFanChart({ bands, successRate }: { bands: PdfMcBand[]; successRate?: number }) {
  if (!bands || bands.length < 2) return null;

  const W = 490, H = 140;
  const pL = 46, pR = 8, pT = 8, pB = 20;
  const cW = W - pL - pR;
  const cH = H - pT - pB;

  const ages = bands.map(b => b.age);
  const minAge = ages[0];
  const maxAge = ages[ages.length - 1] || minAge + 1;
  const allVals = bands.flatMap(b => [b.p5, b.p95]);
  const rawMin = Math.min(0, ...allVals);
  const rawMax = Math.max(...allVals) || 1;
  const range = rawMax - rawMin || 1;

  const xOf = (age: number) => pL + ((age - minAge) / (maxAge - minAge)) * cW;
  const yOf = (v: number) => pT + cH - ((v - rawMin) / range) * cH;

  // Build filled polygon paths
  const outerPath =
    bands.map((b, i) => `${i === 0 ? 'M' : 'L'} ${xOf(b.age).toFixed(1)},${yOf(b.p95).toFixed(1)}`).join(' ') +
    ' ' +
    [...bands].reverse().map(b => `L ${xOf(b.age).toFixed(1)},${yOf(b.p5).toFixed(1)}`).join(' ') +
    ' Z';

  const innerPath =
    bands.map((b, i) => `${i === 0 ? 'M' : 'L'} ${xOf(b.age).toFixed(1)},${yOf(b.p75).toFixed(1)}`).join(' ') +
    ' ' +
    [...bands].reverse().map(b => `L ${xOf(b.age).toFixed(1)},${yOf(b.p25).toFixed(1)}`).join(' ') +
    ' Z';

  const medianPoints = bands.map(b => `${xOf(b.age).toFixed(1)},${yOf(b.p50).toFixed(1)}`).join(' ');

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    val: rawMin + f * range,
    yPos: yOf(rawMin + f * range),
  }));

  const step = Math.max(1, Math.floor(bands.length / 7));
  const xLabels = bands.filter((_, i) => i % step === 0 || i === bands.length - 1);

  return (
    <Svg width={W} height={H}>
      {/* Gridlines */}
      {yTicks.map((t, i) => (
        <SvgLine key={i} x1={pL} y1={t.yPos} x2={W - pR} y2={t.yPos}
          stroke="#E0E0E0" strokeWidth={0.4} />
      ))}
      {/* Y labels */}
      {yTicks.map((t, i) => (
        <Text key={i} x={pL - 2} y={t.yPos + 2} fill="#777"
          style={{ fontSize: 5.5 } as any}>
          {fmtShort(t.val)}
        </Text>
      ))}
      {/* p5-p95 outer band */}
      <Path d={outerPath} fill="#BBDEFB" fillOpacity={0.5} />
      {/* p25-p75 inner band */}
      <Path d={innerPath} fill="#90CAF9" fillOpacity={0.6} />
      {/* Median line */}
      <Polyline points={medianPoints} stroke="#1565C0" strokeWidth={1.5} fill="none" />
      {/* Baseline */}
      <SvgLine x1={pL} y1={pT + cH} x2={W - pR} y2={pT + cH} stroke="#999" strokeWidth={0.5} />
      {/* X labels */}
      {xLabels.map((b, i) => (
        <Text key={i} x={xOf(b.age)} y={H - 5} fill="#666"
          style={{ fontSize: 5.5 } as any}>
          {b.age}
        </Text>
      ))}
      {/* Success rate badge */}
      {successRate != null && (
        <>
          <Rect x={W - pR - 55} y={pT + 2} width={55} height={14} fill="#E8F5E9" rx={3} />
          <Text x={W - pR - 52} y={pT + 11} fill="#2E7D32"
            style={{ fontSize: 7 } as any}>
            {`Success: ${successRate.toFixed(1)}%`}
          </Text>
        </>
      )}
    </Svg>
  );
}

// ── Document ──────────────────────────────────────────────────────────────────

export function PdfDocument({ plan }: { plan: RetirementPlanData }) {
  const now = plan.generatedAt ?? new Date().toLocaleDateString('en-CA');
  const totalAccounts = plan.accounts.reduce((s, a) => s + a.balance, 0);
  const totalIncome = plan.incomeSources.reduce((s, i) => s + i.annualAmount, 0);

  return (
    <Document title={`${plan.householdName} — Retirement Plan`} author="Retiree Plan">
      {/* ── Page 1: Overview ── */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{plan.householdName}</Text>
          <Text style={styles.headerSubtitle}>Retirement Plan Report · Generated {now}</Text>
        </View>

        {/* Summary boxes */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryBox, { width: '31%' }]}>
            <Text style={styles.summaryValue}>{fmt(totalAccounts)}</Text>
            <Text style={styles.summaryLabel}>Total Portfolio</Text>
          </View>
          <View style={[styles.summaryBox, { width: '31%' }]}>
            <Text style={styles.summaryValue}>{fmt(totalIncome)}</Text>
            <Text style={styles.summaryLabel}>Annual Income Sources</Text>
          </View>
          <View style={[styles.summaryBox, { width: '31%' }]}>
            <Text style={styles.summaryValue}>{fmt(plan.annualExpenses ?? 0)}</Text>
            <Text style={styles.summaryLabel}>Annual Expenses</Text>
          </View>
        </View>

        {/* Household Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Household Members</Text>
          {plan.members.map((m, i) => (
            <View key={i} style={styles.memberCard}>
              <Text style={styles.memberName}>{m.name}</Text>
              <Text style={styles.memberDetail}>
                Born {m.birthYear} · Retiring at {m.retirementAge}
                {m.province ? ` · ${m.province}` : ''}
                {m.country ? `, ${m.country}` : ''}
              </Text>
            </View>
          ))}
        </View>

        {/* Income Sources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Income Sources</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableHeaderCell, { width: ColW.income[0] }]}>Name</Text>
              <Text style={[styles.tableHeaderCell, { width: ColW.income[1] }]}>Type</Text>
              <Text style={[styles.tableHeaderCell, { width: ColW.income[2] }]}>Annual</Text>
              <Text style={[styles.tableHeaderCell, { width: ColW.income[3] }]}>Start</Text>
              <Text style={[styles.tableHeaderCell, { width: ColW.income[4] }]}>End</Text>
            </View>
            {plan.incomeSources.map((src, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowEven : {}]}>
                <Text style={[styles.tableCell, { width: ColW.income[0] }]}>
                  {src.name}{src.memberName ? ` (${src.memberName})` : ''}
                </Text>
                <Text style={[styles.tableCell, { width: ColW.income[1] }]}>{src.type}</Text>
                <Text style={[styles.tableCell, { width: ColW.income[2] }]}>{fmt(src.annualAmount)}</Text>
                <Text style={[styles.tableCell, { width: ColW.income[3] }]}>{src.startYear ?? '—'}</Text>
                <Text style={[styles.tableCell, { width: ColW.income[4] }]}>{src.endYear ?? '—'}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Accounts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accounts &amp; Savings</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableHeaderCell, { width: '45%' }]}>Account</Text>
              <Text style={[styles.tableHeaderCell, { width: '30%' }]}>Type</Text>
              <Text style={[styles.tableHeaderCell, { width: '25%' }]}>Balance</Text>
            </View>
            {plan.accounts.map((acc, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowEven : {}]}>
                <Text style={[styles.tableCell, { width: '45%' }]}>{acc.name}</Text>
                <Text style={[styles.tableCell, { width: '30%' }]}>{acc.type}</Text>
                <Text style={[styles.tableCell, { width: '25%' }]}>{fmt(acc.balance)}</Text>
              </View>
            ))}
          </View>
        </View>

        {plan.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={{ color: MED_TEXT, lineHeight: 1.5 }}>{plan.notes}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text>{plan.householdName} — Retirement Plan</Text>
          <Text>{now}</Text>
        </View>
      </Page>

      {/* ── Page 2: Projections (if provided) ── */}
      {plan.projections && plan.projections.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Year-by-Year Projections</Text>
            <Text style={styles.headerSubtitle}>{plan.householdName}</Text>
          </View>

          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableHeaderCell, { width: ColW.projection[0] }]}>Year</Text>
              <Text style={[styles.tableHeaderCell, { width: ColW.projection[1] }]}>Income</Text>
              <Text style={[styles.tableHeaderCell, { width: ColW.projection[2] }]}>Expenses</Text>
              <Text style={[styles.tableHeaderCell, { width: ColW.projection[3] }]}>Net Cash</Text>
              <Text style={[styles.tableHeaderCell, { width: ColW.projection[4] }]}>Net Worth</Text>
            </View>
            {plan.projections.map((row, i) => {
              const net = row.totalIncome - row.totalExpenses;
              return (
                <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowEven : {}]}>
                  <Text style={[styles.tableCell, { width: ColW.projection[0] }]}>{row.year}</Text>
                  <Text style={[styles.tableCell, { width: ColW.projection[1] }]}>{fmt(row.totalIncome)}</Text>
                  <Text style={[styles.tableCell, { width: ColW.projection[2] }]}>{fmt(row.totalExpenses)}</Text>
                  <Text style={[styles.tableCell, { width: ColW.projection[3] }, net < 0 ? { color: '#C62828' } : { color: '#2E7D32' }]}>
                    {fmt(net)}
                  </Text>
                  <Text style={[styles.tableCell, { width: ColW.projection[4] }]}>{fmt(row.netWorth)}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Text>{plan.householdName} — Projections</Text>
            <Text>{now}</Text>
          </View>
        </Page>
      )}

      {/* ── Pages 3+: One detail page per scenario ── */}
      {(plan.scenarios ?? []).map((sc, si) => {
        const p = sc.parameters ?? {};
        const rows = sc.projectionRows ?? [];
        const depleted = sc.portfolioDepletionAge;
        // Net worth at retirement from projections or explicit field
        const nwAtRet = sc.netWorthAtRetirement ??
          rows.find((r) => r.year === (p.retirementAge ?? 65))?.netWorth;

        // Build summary parameter pairs
        const params: Array<{ label: string; value: string }> = [
          { label: 'Retire Age', value: p.retirementAge != null ? `${p.retirementAge}` : '—' },
          { label: 'Life Expectancy', value: p.lifeExpectancy != null ? `${p.lifeExpectancy}` : '—' },
          { label: 'Inflation Rate', value: p.inflationRate != null ? `${(p.inflationRate * 100).toFixed(1)}%` : '—' },
          { label: 'Expected Return', value: p.expectedReturnRate != null ? `${(p.expectedReturnRate * 100).toFixed(1)}%` : '—' },
          { label: 'Annual Expenses', value: p.annualExpenses != null ? fmt(p.annualExpenses) : '—' },
          { label: 'CPP Start', value: p.cppStartAge != null ? `Age ${p.cppStartAge}` : '—' },
          { label: 'OAS Start', value: p.oasStartAge != null ? `Age ${p.oasStartAge}` : '—' },
          { label: 'RRIF Conversion', value: p.rrifConversionAge != null ? `Age ${p.rrifConversionAge}` : '—' },
          { label: 'Invest Surplus', value: p.investSurplus ? 'Yes (non-reg)' : 'No (savings)' },
          { label: 'Cash Savings Rate', value: p.cashSavingsRate != null ? `${(p.cashSavingsRate * 100).toFixed(1)}%` : '—' },
        ];

        return [
          <Page key={`${si}-detail`} size="A4" style={styles.page}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Scenario {si + 1} of {plan.scenarios!.length}</Text>
              <Text style={styles.headerSubtitle}>{plan.householdName}</Text>
            </View>

            {/* Scenario name + description */}
            <View style={styles.scenarioHeader}>
              <Text style={styles.scenarioTitle}>{sc.name}</Text>
              {sc.description ? <Text style={styles.scenarioDesc}>{sc.description}</Text> : null}
            </View>

            {/* Portfolio depletion badge */}
            {depleted != null ? (
              <View style={styles.depletionBadge}>
                <Text style={styles.depletionText}>
                  ⚠  Portfolio depletes at age {depleted}
                </Text>
              </View>
            ) : rows.length > 0 ? (
              <View style={styles.depletionBadgeOk}>
                <Text style={styles.depletionTextOk}>
                  ✓  Portfolio intact through life expectancy
                  {nwAtRet != null ? `   ·   Net worth at retirement: ${fmt(nwAtRet)}` : ''}
                </Text>
              </View>
            ) : null}

            {/* Assumption parameters */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Scenario Assumptions</Text>
              <View style={styles.paramGrid}>
                {params.map((item, i) => (
                  <View key={i} style={styles.paramItem}>
                    <Text style={styles.paramLabel}>{item.label}</Text>
                    <Text style={styles.paramValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Projection charts + table (sampled every 5 years) */}
            {rows.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Net Worth Trajectory</Text>
                <View style={{ marginBottom: 4 }}>
                  <NetWorthChart rows={rows} retirementAge={p.retirementAge} />
                  <View style={{ flexDirection: 'row', marginTop: 4, marginLeft: 52 }}>
                    <View style={{ width: 8, height: 4, backgroundColor: '#1565C0', marginRight: 3, marginTop: 2 }} />
                    <Text style={{ fontSize: 6, color: MED_TEXT, marginRight: 10 }}>Net Worth</Text>
                    <View style={{ width: 8, height: 4, backgroundColor: '#E65100', marginRight: 3, marginTop: 2 }} />
                    <Text style={{ fontSize: 6, color: MED_TEXT }}>Retirement</Text>
                  </View>
                </View>
              </View>
            )}

            {rows.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Income vs Expenses by Age</Text>
                <View style={{ marginBottom: 4 }}>
                  <IncomeExpenseChart rows={rows} />
                  <View style={{ flexDirection: 'row', marginTop: 4, marginLeft: 52 }}>
                    <View style={{ width: 8, height: 4, backgroundColor: '#43A047', marginRight: 3, marginTop: 2 }} />
                    <Text style={{ fontSize: 6, color: MED_TEXT, marginRight: 10 }}>Income</Text>
                    <View style={{ width: 8, height: 4, backgroundColor: '#EF6C00', marginRight: 3, marginTop: 2 }} />
                    <Text style={{ fontSize: 6, color: MED_TEXT }}>Expenses</Text>
                  </View>
                </View>
              </View>
            )}

            {rows.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Year-by-Year Detail (every 5 years)</Text>
                <View style={styles.table}>
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={[styles.tableHeaderCell, { width: ColW.scenarioProj[0] }]}>Age</Text>
                    <Text style={[styles.tableHeaderCell, { width: ColW.scenarioProj[1] }]}>Income</Text>
                    <Text style={[styles.tableHeaderCell, { width: ColW.scenarioProj[2] }]}>Expenses</Text>
                    <Text style={[styles.tableHeaderCell, { width: ColW.scenarioProj[3] }]}>Tax</Text>
                    <Text style={[styles.tableHeaderCell, { width: ColW.scenarioProj[4] }]}>Net Cash</Text>
                    <Text style={[styles.tableHeaderCell, { width: ColW.scenarioProj[5] }]}>Net Worth</Text>
                  </View>
                  {rows.map((row, i) => {
                    const net = row.totalIncome - row.totalExpenses - (row.tax ?? 0);
                    return (
                      <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowEven : {}]}>
                        <Text style={[styles.tableCell, { width: ColW.scenarioProj[0] }]}>{row.year}</Text>
                        <Text style={[styles.tableCell, { width: ColW.scenarioProj[1] }]}>{fmt(row.totalIncome)}</Text>
                        <Text style={[styles.tableCell, { width: ColW.scenarioProj[2] }]}>{fmt(row.totalExpenses)}</Text>
                        <Text style={[styles.tableCell, { width: ColW.scenarioProj[3] }]}>{row.tax != null ? fmt(row.tax) : '—'}</Text>
                        <Text style={[styles.tableCell, { width: ColW.scenarioProj[4] }, net < 0 ? { color: '#C62828' } : { color: '#2E7D32' }]}>
                          {fmt(net)}
                        </Text>
                        <Text style={[styles.tableCell, { width: ColW.scenarioProj[5] }]}>{fmt(row.netWorth)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.footer}>
              <Text>{plan.householdName} — {sc.name}</Text>
              <Text>{now}</Text>
            </View>
          </Page>,

          /* ── Growth & Income Analysis page ── */
          (sc.allYears && sc.allYears.length > 0) && (
            <Page key={`${si}-growth`} size="A4" style={styles.page}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Growth &amp; Income — {sc.name}</Text>
                <Text style={styles.headerSubtitle}>{plan.householdName}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account Balance Growth by Type</Text>
                <AccountBalanceChart years={sc.allYears!} retirementAge={p.retirementAge} />
                <View style={{ flexDirection: 'row', marginTop: 6, marginLeft: 46, flexWrap: 'wrap' }}>
                  {[
                    { color: '#FFCC80', label: 'RRSP/RRIF' },
                    { color: '#A5D6A7', label: 'TFSA' },
                    { color: '#CE93D8', label: 'Non-Reg' },
                    { color: '#81D4FA', label: 'Cash' },
                  ].map(item => (
                    <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 2 }}>
                      <View style={{ width: 8, height: 8, backgroundColor: item.color, borderRadius: 2, marginRight: 3 }} />
                      <Text style={{ fontSize: 7, color: MED_TEXT }}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Income Sources by Age</Text>
                <IncomeBreakdownChart years={sc.allYears!} />
                <View style={{ flexDirection: 'row', marginTop: 6, marginLeft: 46, flexWrap: 'wrap' }}>
                  {[
                    { color: '#42A5F5', label: 'Employment' },
                    { color: '#EF5350', label: 'CPP' },
                    { color: '#FFA726', label: 'OAS' },
                    { color: '#FF7043', label: 'RRSP/RRIF WD' },
                    { color: '#66BB6A', label: 'TFSA WD' },
                    { color: '#AB47BC', label: 'Non-Reg WD' },
                  ].map(item => (
                    <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 2 }}>
                      <View style={{ width: 8, height: 8, backgroundColor: item.color, borderRadius: 2, marginRight: 3 }} />
                      <Text style={{ fontSize: 7, color: MED_TEXT }}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Annual Net Cash Flow</Text>
                <NetCashFlowChart years={sc.allYears!} />
                <View style={{ flexDirection: 'row', marginTop: 6, marginLeft: 46 }}>
                  <View style={{ width: 8, height: 8, backgroundColor: '#43A047', borderRadius: 2, marginRight: 3 }} />
                  <Text style={{ fontSize: 7, color: MED_TEXT, marginRight: 14 }}>Surplus</Text>
                  <View style={{ width: 8, height: 8, backgroundColor: '#E53935', borderRadius: 2, marginRight: 3 }} />
                  <Text style={{ fontSize: 7, color: MED_TEXT }}>Deficit</Text>
                </View>
              </View>

              <View style={styles.footer}>
                <Text>{plan.householdName} — {sc.name} · Growth &amp; Income</Text>
                <Text>{now}</Text>
              </View>
            </Page>
          ),

          /* ── Risk Analysis / Monte Carlo page ── */
          (sc.mcBands && sc.mcBands.length > 1) && (
            <Page key={`${si}-monte`} size="A4" style={styles.page}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Monte Carlo Risk Analysis — {sc.name}</Text>
                <Text style={styles.headerSubtitle}>{plan.householdName}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Portfolio Value — 1,000-Trial Simulation</Text>
                <Text style={{ fontSize: 8, color: MED_TEXT, marginBottom: 6 }}>
                  Each year's shaded bands show the range of outcomes across all simulations with randomised annual returns.
                </Text>
                <MonteCarloFanChart bands={sc.mcBands!} successRate={sc.successRate} />
                <View style={{ flexDirection: 'row', marginTop: 6, marginLeft: 46, flexWrap: 'wrap' }}>
                  {[
                    { color: '#BBDEFB', label: 'p5 – p95 range' },
                    { color: '#90CAF9', label: 'p25 – p75 range' },
                    { color: '#1565C0', label: 'Median (p50)' },
                  ].map(item => (
                    <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 2 }}>
                      <View style={{ width: 16, height: 8, backgroundColor: item.color, borderRadius: 2, marginRight: 3 }} />
                      <Text style={{ fontSize: 7, color: MED_TEXT }}>{item.label}</Text>
                    </View>
                  ))}
                </View>
                {sc.successRate != null && (
                  <View style={{ backgroundColor: '#E8F5E9', borderRadius: 4, padding: 8, marginTop: 10 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#2E7D32' }}>
                      Success rate: {(sc.successRate).toFixed(1)}% of simulations maintained a positive portfolio through life expectancy.
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.footer}>
                <Text>{plan.householdName} — {sc.name} · Monte Carlo</Text>
                <Text>{now}</Text>
              </View>
            </Page>
          ),
        ].filter(Boolean);
      })}
    </Document>
  );
}

// ── PdfDownloadButton ─────────────────────────────────────────────────────────

interface PdfDownloadButtonProps {
  plan: RetirementPlanData;
  label?: string;
  filename?: string;
  /** When true, renders a smaller icon+text button suited for toolbar/panel use. */
  compact?: boolean;
}

export function PdfDownloadButton({
  plan,
  label = 'Download PDF',
  filename,
  compact = false,
}: PdfDownloadButtonProps) {
  const safeFilename =
    filename ?? `${plan.householdName.replace(/\s+/g, '-').toLowerCase()}-retirement-plan.pdf`;

  return (
    <PDFDownloadLink
      document={<PdfDocument plan={plan} />}
      fileName={safeFilename}
      style={{ textDecoration: 'none' }}
    >
      {({ loading }) => (
        <Button
          variant={compact ? 'text' : 'outlined'}
          size={compact ? 'small' : 'medium'}
          startIcon={<DownloadIcon fontSize={compact ? 'small' : 'medium'} />}
          disabled={loading}
          sx={compact ? { textTransform: 'none', fontSize: '0.8rem', px: 1.25, py: 0.75, minWidth: 0 } : undefined}
        >
          {loading ? (compact ? 'PDF…' : 'Preparing PDF…') : label}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
