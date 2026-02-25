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
  year: number;
  totalIncome: number;
  totalExpenses: number;
  netWorth: number;
}

export interface PdfScenario {
  name: string;
  description?: string;
  netWorthAtRetirement?: number;
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
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

const ColW = {
  income: ['30%', '20%', '20%', '15%', '15%'],
  projection: ['15%', '22%', '22%', '22%', '19%'],
};

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

      {/* ── Page 3: Scenarios (if provided) ── */}
      {plan.scenarios && plan.scenarios.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Scenarios</Text>
            <Text style={styles.headerSubtitle}>{plan.householdName}</Text>
          </View>

          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableHeaderCell, { width: '35%' }]}>Name</Text>
              <Text style={[styles.tableHeaderCell, { width: '45%' }]}>Description</Text>
              <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Net Worth</Text>
            </View>
            {plan.scenarios.map((sc, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowEven : {}]}>
                <Text style={[styles.tableCell, { width: '35%' }]}>{sc.name}</Text>
                <Text style={[styles.tableCell, { width: '45%' }]}>{sc.description ?? '—'}</Text>
                <Text style={[styles.tableCell, { width: '20%' }]}>
                  {sc.netWorthAtRetirement != null ? fmt(sc.netWorthAtRetirement) : '—'}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <Text>{plan.householdName} — Scenarios</Text>
            <Text>{now}</Text>
          </View>
        </Page>
      )}
    </Document>
  );
}

// ── PdfDownloadButton ─────────────────────────────────────────────────────────

interface PdfDownloadButtonProps {
  plan: RetirementPlanData;
  label?: string;
  filename?: string;
}

export function PdfDownloadButton({
  plan,
  label = 'Download PDF',
  filename,
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
          variant="outlined"
          startIcon={<DownloadIcon />}
          disabled={loading}
        >
          {loading ? 'Preparing PDF…' : label}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
