# PDF Reports and CSV Export

## Purpose and Role

Reports allow users to take their retirement plan offline and share it with advisors, family members, or their own files. The PDF report is a comprehensive, printable summary of the household's plan — formatted as something a financial advisor could review and annotate. CSV export provides the raw projection data for users who want to do further analysis in Excel or similar tools.

**Frontend (PDF):** `apps/web/src/components/PdfReport.tsx` — React PDF component using `@react-pdf/renderer`  
**API endpoint:** `GET /projections/:id/pdf` or generated client-side via React PDF  
**CSV:** Generated client-side from `ProjectionYear[]` array

---

## PDF Report Structure

The PDF is built with `@react-pdf/renderer`, which renders React components as PDF pages. Each "page" in the PDF is a React component that receives pre-computed data and renders it using the library's primitive components (`<View>`, `<Text>`, `<Page>`, `<StyleSheet>`).

**Important:** `@react-pdf/renderer` does not support D3 charts or HTML canvas. Charts in the PDF are implemented using SVG paths drawn directly with the renderer's `<Svg>`, `<Path>`, `<Line>` components — not imported from D3 chart components.

### Pages in the current PDF

**Page 1 — Cover Page**
- Household name + plan generation date
- One-sentence plan summary (derived from readiness score and key metrics)
- System branding

**Page 2 — Executive Summary**
- Readiness Score box (large number + color + label)
- Key Metrics 2×2 grid:
  - Projected retirement income
  - Years until retirement
  - Monte Carlo success rate
  - Estimated estate value
- Top 3 recommendations (from the insights engine)
- RRSP / TFSA Contribution Room section

**Pages 3–N+2 — Scenario Overview(s)**
- For each scenario: name, key parameters (retirement age, inflation, return), projection chart (SVG line chart), year-by-year table

**Page N+3 — Estate Summary**
- Gross estate, tax and fees, net to heirs
- Breakdown table by account type
- Probate note

**Final Page — Appendix: Assumptions and Methodology**
- Capital Market Assumptions table (the values from `CAPITAL_MARKET_ASSUMPTIONS`)
- Methodology disclosure (explains the projection engine approach, limitations, disclaimers)
- Data sources

---

## `RetirementPlanData` — The PDF Data Shape

The PDF component is fed a single data object of type `RetirementPlanData`. This shape is assembled in the PDF route handler before passing to the React PDF renderer:

```typescript
interface RetirementPlanData {
  household: {
    name: string
    province: Province
    members: { name: string; age: number; retirementAge: number }[]
  }
  
  // Optional — enriched if available
  readinessScore?: ReadinessScoreResult
  insights?: Insight[]
  contributionRoom?: {
    rrspAvailableRoom: number
    tfsaAvailableRoom: number
  }
  estateResult?: EstateResult
  
  // Core projection data
  scenarios: {
    name: string
    parameters: Partial<CashFlowInput>
    projectionYears: ProjectionYear[]
    successRate?: number   // Monte Carlo success rate if available
  }[]
  
  // Assumption disclosure
  assumptions?: {
    equityReturn:     number
    fixedReturn:      number
    inflationRate:    number
    generatedDate:    string
    disclaimer:       string
  }
}
```

All optional fields are rendered with graceful fallbacks (section simply doesn't appear if data is missing). This is the "backward compatible" design — adding new optional fields to `RetirementPlanData` does not break existing PDF generation.

---

## How the PDF is Generated

### Option A: Client-side generation (current approach)
The React component `PdfReport` is rendered in-browser using `@react-pdf/renderer`'s `<PDFViewer>` or triggering a download via `pdf(<PdfPage data={data} />).toBlob()`. The user clicks "Download PDF" and a Blob is created and downloaded immediately.

**Pros:** No server load, no file storage  
**Cons:** Can be slow for very large projections (many scenario years); PDFViewer shows a preview in-browser first

### Option B: Server-side generation (future)
A NestJS endpoint could render the component server-side using `@react-pdf/renderer`'s Node.js API. The endpoint returns `application/pdf` content. This is useful for:
- Sending the PDF via email
- Storing the PDF for advisor sharing
- Batch report generation

---

## SVG Charts in the PDF

Since D3 is not available inside the PDF renderer, projection charts are drawn as simple SVG paths. The pattern:

```tsx
// Simplified example — net worth line chart in PDF
function ProjectionChart({ data }: { data: ProjectionYear[] }) {
  const maxValue = Math.max(...data.map(d => d.totalNetWorth));
  const chartWidth = 480;
  const chartHeight = 200;
  
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * chartWidth,
    y: chartHeight - (d.totalNetWorth / maxValue) * chartHeight,
  }));
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  
  return (
    <Svg width={chartWidth} height={chartHeight}>
      <Path d={pathD} stroke="#1976d2" strokeWidth={2} fill="none" />
    </Svg>
  );
}
```

This approach creates simple but accurate charts without needing D3 or canvas.

---

## CSV Export

CSV export generates a file containing one row per `ProjectionYear` with all key fields as columns. The users can open this in Excel, Google Sheets, or any data tool.

**Columns exported:**
```
Age, Year, Income, Expenses, CPP Income, OAS Income, RRSP Balance, TFSA Balance, 
Non-Reg Balance, Cash Balance, Total Net Worth, Tax Paid, RRSP Withdrawal, 
TFSA Withdrawal, Non-Reg Withdrawal, Cash Withdrawal, RRIF Minimum Withdrawal, 
Net Cash Flow
```

**Implementation pattern (client-side):**
```typescript
function exportToCSV(data: ProjectionYear[], scenarioName: string) {
  const headers = ['Age', 'Year', 'Income', ...];
  const rows = data.map(y => [y.age, y.year, y.income, ...].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `retiree-plan-${scenarioName}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

No API call is needed — CSV is generated from the already-loaded `ProjectionYear[]` data in TanStack Query cache.

---

## AI-Assisted Coding Quick Reference

**When adding a new section to the PDF:**
1. Create a new component in `apps/web/src/components/PdfReport.tsx` following the existing section pattern
2. Add the new section's data to `RetirementPlanData` as an optional field
3. Add the component to the `PdfDocument` component with a `if (data.newField)` guard for backward compatibility
4. To test: use the `<PDFViewer>` wrapper in a test page rather than downloading each time

**When updating the PDF with new CRA figures:**
- These come through the `assumptions` object in `RetirementPlanData`
- The API assembles this from `CAPITAL_MARKET_ASSUMPTIONS` and current CRA limits at generation time
- The Appendix page renders these — no hardcoded values in the PDF component

**When implementing advisor sharing (future):**
1. Add a `POST /reports/generate` endpoint that accepts `RetirementPlanData` and returns a presigned URL to a stored PDF blob
2. Store the generated PDF in a blob storage (S3 or equivalent) with a time-limited access token
3. Return the share URL to the client for copying/emailing

**What NOT to do:**
- Do not use `@react-pdf/renderer` for interactive charts — it is a static rendering library; use minimal SVG paths
- Do not include raw Prisma models in `RetirementPlanData` — map to plain objects first to avoid circular references in serialization
- Do not block the PDF download if optional fields are missing — use `if (data.field)` guards throughout
- Do not assume the PDF will look like the browser UI — MUI styles do not carry through to `@react-pdf/renderer`; use the library's own `StyleSheet.create` for all styling
