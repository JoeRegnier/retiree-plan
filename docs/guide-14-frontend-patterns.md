# Frontend Patterns and Architecture

## Purpose and Role

This guide describes the frontend conventions, architectural patterns, and component structure used throughout the React application. Following these patterns ensures consistency, predictability, and maintainability as the application grows. It also helps AI coding assistants understand where to find things and how to add new features without disrupting existing patterns.

**Frontend root:** `apps/web/src/`  
**Tech stack:** React 19, MUI v6, D3.js v7, TanStack Query v5, React Router v6

---

## Page Structure

Each route corresponds to a single page file in `apps/web/src/pages/`. Pages are the top-level components that:
1. Fetch data using TanStack Query hooks
2. Handle loading and error states
3. Compose child components into a layout
4. Never perform direct calculations — all values come from the API or engine

### Standard page pattern

```tsx
// apps/web/src/pages/ExamplePage.tsx

import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { api } from '../lib/apiClient';

export default function ExamplePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['example-data'],
    queryFn: () => api.get('/example').then(r => r.data),
  });

  if (isLoading) return <CircularProgress sx={{ m: 4 }} />;
  if (error) return <Alert severity="error">Failed to load data</Alert>;
  if (!data) return null;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Example</Typography>
      {/* Content components here */}
    </Box>
  );
}
```

### Lazy loading in App.tsx

All pages are lazy-loaded to reduce initial bundle size:

```tsx
const ExamplePage = lazy(() => import('./pages/ExamplePage'));

// In the router:
<Route path="/example" element={
  <Suspense fallback={<CircularProgress />}>
    <ExamplePage />
  </Suspense>
} />
```

---

## TanStack Query Patterns

TanStack Query manages all server state. It handles caching, background refetching, loading states, and error states.

### Cache key conventions

Query keys are arrays that identify a unique piece of server data:
```typescript
['household', householdId]           // A specific household
['accounts', householdId]            // All accounts for a household
['projection', scenarioId]           // Projection for a scenario
['dash-projection', householdId]     // Dashboard projection (base scenario)
['insights', householdId]            // Insights for a household
['simulations', scenarioId, 'mc']    // Monte Carlo results
```

**The same cache key deduplicates requests.** `DashboardPage` and `GlobalWhatIfController` both use `['dash-projection', hh?.id]` — they share a single API call and a single cached result.

### Mutation pattern

```typescript
const updateScenario = useMutation({
  mutationFn: (params: Partial<Scenario>) =>
    api.patch(`/scenarios/${scenarioId}`, params).then(r => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['projection', scenarioId] });
    queryClient.invalidateQueries({ queryKey: ['dash-projection'] });
  },
});
```

After a mutation, always invalidate all queries that could be affected. This triggers background refetch of stale data.

### Optimistic updates

Not implemented in the current codebase — all mutations wait for server confirmation before updating the UI. This keeps the state simple and avoids complex rollback logic.

---

## App Layout

`apps/web/src/layouts/AppLayout.tsx` wraps every page. It provides:

1. **MUI Box** — full-width layout container with `sx={{ display: 'flex' }}`
2. **Navigation** — A persistent left drawer with nav items
3. **Top AppBar** — Page title + notification badge + user menu
4. **QuickActionsProvider context** — Wraps all page content so any component can access quick actions
5. **GlobalWhatIfController** — Sits inside `QuickActionsProvider`; configures the What-If drawer globally before the page content renders
6. **QuickActionsPanel** — The floating action panel (lower-right corner) containing the What-If calculator, PDF export, etc.
7. **Main content area** — `<Outlet />` where React Router renders the active page

### Nav item format

```typescript
const navItems = [
  { label: 'Dashboard',     path: '/',            icon: <DashboardIcon /> },
  { label: 'Household',     path: '/household',   icon: <FamilyRestroomIcon /> },
  { label: 'Accounts',      path: '/accounts',    icon: <AccountBalanceIcon /> },
  { label: 'Projections',   path: '/projections', icon: <TimelineIcon /> },
  { label: 'Scenarios',     path: '/scenarios',   icon: <TuneIcon /> },
  { label: 'Simulations',   path: '/simulations', icon: <BarChartIcon /> },
  { label: 'Goals',         path: '/goals',       icon: <TrackChangesIcon /> },
  { label: 'Milestones',    path: '/milestones',  icon: <EventIcon /> },
  { label: 'Estate',        path: '/estate',      icon: <HomeWorkIcon /> },
];
```

---

## QuickActionsContext

The QuickActionsContext allows any component in the app to register an action button in the QuickActionsPanel. This is how the What-If button appears on every page without the page itself knowing about the panel.

```typescript
// Consumer: any page or layout component
const { setWhatIfAction } = useQuickActions();

useEffect(() => {
  setWhatIfAction({
    projectionData: yearlyData,
    currentAge: household.members[0].currentAge,
  });
}, [yearlyData]);
```

**Context file:** `apps/web/src/contexts/QuickActionsContext.tsx`

The context provides:
- `whatIfAction` — The current What-If configuration (projection data to compare against)
- `setWhatIfAction(config)` — Called to register/update the What-If data
- `isWhatIfOpen` — Whether the drawer is visible
- `openWhatIf()` / `closeWhatIf()` — Open/close the drawer

### GlobalWhatIfController

`GlobalWhatIfController` is a component in `AppLayout.tsx` that sets up the What-If action once (using the Dashboard projection) so every page gets the What-If button automatically, without each page needing its own projection fetch.

---

## D3 Chart Components

All D3 charts live in `apps/web/src/components/charts/`. They follow a consistent pattern:

### Standard D3 chart pattern

```tsx
// apps/web/src/components/charts/SomeChart.tsx

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Box } from '@mui/material';

interface SomeChartProps {
  data: SomeDataPoint[];
  // No D3 imports needed from outside — the component is self-contained
}

export default function SomeChart({ data }: SomeChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();  // Clear previous render
    
    // Build chart...
    
  }, [data]);  // Re-render when data changes

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: 300 }}>
      <svg ref={svgRef} width="100%" height="100%" />
    </Box>
  );
}
```

**Key rules for D3 components:**
- Always `svg.selectAll('*').remove()` at the start of `useEffect` to prevent stale elements
- Put all D3 logic inside `useEffect`; never render D3 inside JSX
- Use `ResizeObserver` for truly responsive charts that need to respond to container width changes
- Accept pre-computed data — never call API or engine inside the chart component

### Current chart components

| Component | Description |
|---|---|
| `NetWorthChart.tsx` | D3 area sparkline with CatmullRom curve — Dashboard net worth timeline |
| `WaterfallChart.tsx` | Income → expenses → savings Sankey-style flow diagram |
| `HeatmapChart.tsx` | Return rate × withdrawal rate success rate grid |
| `DrawdownWaterfallChart.tsx` | Animated stacked bars showing account balances over retirement with scrubber |
| `AllocationDonut.tsx` | Interactive D3 donut chart for household asset allocation |
| `GlidePathChart.tsx` | D3 line chart showing equity % declining over age |
| `MonteCarloFanChart.tsx` | Fan/cone chart showing probability distribution of outcomes |

---

## Dialog Pattern (CRUD forms)

All create/edit operations use MUI `<Dialog>` components embedded in the same page file. The pattern:

```tsx
// State
const [dialogOpen, setDialogOpen] = useState(false);
const [editingItem, setEditingItem] = useState<Item | null>(null);

// Open for create
function handleCreate() {
  setEditingItem(null);
  setDialogOpen(true);
}

// Open for edit
function handleEdit(item: Item) {
  setEditingItem(item);
  setDialogOpen(true);
}

// Submit
async function handleSubmit(formData: ItemFormData) {
  if (editingItem) {
    await updateMutation.mutateAsync({ id: editingItem.id, ...formData });
  } else {
    await createMutation.mutateAsync(formData);
  }
  setDialogOpen(false);
}
```

The same dialog component handles both create and edit — `editingItem === null` means create mode; any non-null value means edit mode with pre-filled fields.

---

## Error Handling

### API errors

All API calls go through `apps/web/src/lib/apiClient.ts`, which is an Axios instance with interceptors. A 401 unauthorized response redirects to the login page. Other error responses are passed through to TanStack Query's `error` state.

Components display errors using MUI `<Alert severity="error">` components rather than throwing to an error boundary, since these are expected user-facing errors (validation failures, not found, etc.).

### Form validation

Forms use standard controlled inputs with local validation. Zod schemas from `packages/shared/src/schemas/` are reused for client-side validation, ensuring the same rules apply on both frontend and API.

---

## Authentication and Protected Routes

Authentication uses JWT tokens stored in `localStorage`. The `apiClient` Axios instance adds the token to every request via an Authorization header interceptor.

Protected routes are wrapped in an `<AuthGuard>` component in `App.tsx` that checks for a valid token and redirects to `/login` if absent.

---

## Theme and Styling

MUI v6 theme is configured in `apps/web/src/lib/theme.ts`. All styling uses MUI's `sx` prop or `styled` API — no plain CSS files.

**Palette:**
- Primary: `#1976d2` (blue)
- Secondary: `#dc004e` (pink/red)
- RRSP: Blue (#1976d2)
- TFSA: Green (#2e7d32)
- Non-Reg: Orange (#e65100)
- Cash: Grey (#757575)

The account type colors are used consistently across all charts and chips.

---

## AI-Assisted Coding Quick Reference

**When adding a new page:**
1. Create `apps/web/src/pages/NewPage.tsx` following the standard page pattern
2. Add lazy import + route in `apps/web/src/App.tsx`
3. Add nav item to `navItems` array in `apps/web/src/layouts/AppLayout.tsx`
4. The page should handle its own data fetching via TanStack Query

**When adding a new D3 chart:**
1. Create `apps/web/src/components/charts/NewChart.tsx` following the standard D3 chart pattern
2. Accept pre-computed data as props — no API calls inside the chart
3. Import the component into the page that needs it

**When adding a new CRUD entity:**
1. Follow the Dialog pattern above — same Dialog handles create and edit
2. Use TanStack Query mutations that `invalidateQueries` on success
3. Display the list of entities as MUI Cards (not a Table unless there are many columns)

**What NOT to do:**
- Do not perform calculations in page components — numbers come from API or engine outputs
- Do not share mutable state between sibling components through prop drilling — use Context or separate Query calls
- Do not skip loading/error states — every `useQuery` call must handle `isLoading` and `error`
- Do not call `svg.selectAll('*').remove()` only conditionally — always clear the previous render to prevent stale element accumulation
- Do not use `index` as a React key for lists of mutable items — use the entity's stable `id`
