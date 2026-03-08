import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';

interface AssumptionsAuditDialogProps {
  open: boolean;
  onClose: () => void;
}

interface MarketAssumptions {
  tfsaLimit: number;
  rrspMax: number;
  cppMax: number;
  oasMax: number;
  equityReturn: number;
  fixedIncomeReturn: number;
  alternativesReturn: number;
  cashReturn: number;
  inflationRate: number;
  bondYield: number;
  lastUpdated: string;
}

interface MarketAssumptionsApi {
  tfsaLimit?: number;
  rrspMax?: number;
  cppMax?: number;
  oasMax?: number;
  equityReturn?: number;
  fixedIncomeReturn?: number;
  alternativesReturn?: number;
  cashReturn?: number;
  inflationRate?: number;
  bondYield?: number;

  tfsaAnnualLimit?: number;
  rrspMaxContribution?: number;
  cppMaxMonthlyAt65?: number;
  oasMaxMonthly?: number;
  inflation?: number;
  equity?: { expectedReturn?: number };
  fixedIncome?: { expectedReturn?: number };

  lastUpdated?: string;
}

const currencyFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('en-CA', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatPercent(value: number): string {
  return percentFormatter.format(value);
}

function formatLastUpdated(value?: string): string {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';

  return parsed.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function isCurrentYear(value?: string): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getFullYear() === new Date().getFullYear();
}

function normalizeAssumptions(raw?: MarketAssumptionsApi): MarketAssumptions | null {
  if (!raw) return null;

  const tfsaLimit = raw.tfsaLimit ?? raw.tfsaAnnualLimit;
  const rrspMax = raw.rrspMax ?? raw.rrspMaxContribution;
  const cppMax = raw.cppMax ?? (raw.cppMaxMonthlyAt65 != null ? raw.cppMaxMonthlyAt65 * 12 : undefined);
  const oasMax = raw.oasMax ?? (raw.oasMaxMonthly != null ? raw.oasMaxMonthly * 12 : undefined);
  const equityReturn = raw.equityReturn ?? raw.equity?.expectedReturn;
  const fixedIncomeReturn = raw.fixedIncomeReturn ?? raw.fixedIncome?.expectedReturn;
  const inflationRate = raw.inflationRate ?? raw.inflation;
  const bondYield = raw.bondYield ?? raw.fixedIncome?.expectedReturn;

  if (
    tfsaLimit == null ||
    rrspMax == null ||
    cppMax == null ||
    oasMax == null ||
    equityReturn == null ||
    fixedIncomeReturn == null ||
    inflationRate == null ||
    bondYield == null
  ) {
    return null;
  }

  return {
    tfsaLimit,
    rrspMax,
    cppMax,
    oasMax,
    equityReturn,
    fixedIncomeReturn,
    alternativesReturn: raw.alternativesReturn ?? 0,
    cashReturn: raw.cashReturn ?? 0,
    inflationRate,
    bondYield,
    lastUpdated: raw.lastUpdated ?? '',
  };
}

export function AssumptionsAuditDialog({ open, onClose }: AssumptionsAuditDialogProps) {
  const { apiFetch } = useApi();

  const {
    data: rawAssumptions,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<MarketAssumptionsApi, Error>({
    queryKey: ['market-assumptions'],
    queryFn: () => apiFetch<MarketAssumptionsApi>('/market-data/assumptions'),
    enabled: open,
    staleTime: 60 * 60 * 1000,
  });

  const assumptions = normalizeAssumptions(rawAssumptions);

  const current = isCurrentYear(assumptions?.lastUpdated);

  const rows = assumptions
    ? [
        { name: 'TFSA Annual Limit (current year)', value: formatCurrency(assumptions.tfsaLimit) },
        { name: 'RRSP Maximum Contribution', value: formatCurrency(assumptions.rrspMax) },
        { name: 'CPP Maximum Annual Benefit', value: formatCurrency(assumptions.cppMax) },
        { name: 'OAS Maximum Annual Benefit', value: formatCurrency(assumptions.oasMax) },
        { name: 'Equity Expected Return', value: formatPercent(assumptions.equityReturn) },
        { name: 'Fixed Income Expected Return', value: formatPercent(assumptions.fixedIncomeReturn) },
        { name: 'Inflation Rate', value: formatPercent(assumptions.inflationRate) },
        { name: 'Bond Yield', value: formatPercent(assumptions.bondYield) },
      ]
    : [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1 }}>Market Data Assumptions Audit</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Last updated: {formatLastUpdated(assumptions?.lastUpdated)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Review your assumptions annually to keep projections accurate.
            </Typography>
          </Box>

          {isError && (
            <Alert severity="error">
              {error?.message ?? 'Unable to load assumptions right now. Please try again.'}
            </Alert>
          )}

          {isLoading && !assumptions ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" aria-label="Planning assumptions table">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Assumption</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Current Value</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Last Updated</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.name}
                      sx={{
                        '&:nth-of-type(odd)': {
                          bgcolor: (theme) => theme.palette.action.hover,
                        },
                      }}
                    >
                      <TableCell sx={{ width: '46%' }}>{row.name}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {row.value}
                          </Typography>
                          <Chip
                            size="small"
                            color={current ? 'success' : 'warning'}
                            icon={current ? <CheckCircleIcon /> : <WarningAmberIcon />}
                            label={current ? 'Current' : 'Stale'}
                            sx={{ fontWeight: 600 }}
                          />
                        </Stack>
                      </TableCell>
                      <TableCell>{formatLastUpdated(assumptions?.lastUpdated)}</TableCell>
                    </TableRow>
                  ))}
                  {!rows.length && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography variant="body2" color="text.secondary">
                          No assumptions available yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Assumptions are based on current CRA limits and Bank of Canada data.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            void refetch();
          }}
          disabled={isFetching}
          startIcon={isFetching ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
        >
          Refresh from Bank of Canada
        </Button>
      </DialogActions>
    </Dialog>
  );
}
