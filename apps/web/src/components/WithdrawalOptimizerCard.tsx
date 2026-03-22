/**
 * Withdrawal Optimizer Card
 *
 * Compares all withdrawal strategies by calling the API and renders a
 * ranked results table with the recommended strategy highlighted.
 */

import { useState } from 'react';
import {
  Box, Button, Card, CardContent, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, Chip, CircularProgress, Alert, Tooltip,
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import { useApi } from '../hooks/useApi';

interface StrategyResult {
  strategyId: string;
  strategyName: string;
  totalLifetimeTax: number;
  totalOasClawback: number;
  finalNetWorth: number;
  portfolioDepletionAge: number | null;
}

interface ComparisonResult {
  strategies: StrategyResult[];
  recommendedStrategyId: string;
  recommendationReason: string;
  estimatedSavings: number;
}

interface WithdrawalOptimizerCardProps {
  /** The full CashFlowInput payload already built from the scenario. */
  projectionPayload: Record<string, unknown> | null;
}

const fmt = (n: number) =>
  n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });

export function WithdrawalOptimizerCard({ projectionPayload }: WithdrawalOptimizerCardProps) {
  const { apiFetch } = useApi();
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!projectionPayload) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ComparisonResult>('/optimization/withdrawal-comparison', {
        method: 'POST',
        body: JSON.stringify(projectionPayload),
      });
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? 'Comparison failed');
    } finally {
      setLoading(false);
    }
  };

  // Sort: recommended first, then by ascending tax
  const sorted = result
    ? [...result.strategies].sort((a, b) => {
        if (a.strategyId === result.recommendedStrategyId) return -1;
        if (b.strategyId === result.recommendedStrategyId) return 1;
        return a.totalLifetimeTax - b.totalLifetimeTax;
      })
    : [];

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h6">Withdrawal Strategy Optimizer</Typography>
            <Typography variant="body2" color="text.secondary">
              Compare all built-in drawdown strategies to minimise lifetime tax and OAS clawback.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CompareArrowsIcon />}
            onClick={handleCompare}
            disabled={loading || !projectionPayload}
          >
            Compare Strategies
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!projectionPayload && (
          <Alert severity="info">
            Run a projection first, then click "Compare Strategies" to see the full comparison.
          </Alert>
        )}

        {result && (
          <>
            <Alert severity="success" icon={false} sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Recommended:</strong> {result.strategies.find((s) => s.strategyId === result.recommendedStrategyId)?.strategyName}.{' '}
                {result.recommendationReason}
              </Typography>
              {result.estimatedSavings > 1000 && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Estimated savings vs. worst strategy: <strong>{fmt(result.estimatedSavings)}</strong>
                </Typography>
              )}
            </Alert>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Strategy</TableCell>
                  <TableCell align="right">Lifetime Tax</TableCell>
                  <TableCell align="right">OAS Clawback</TableCell>
                  <TableCell align="right">Final Net Worth</TableCell>
                  <TableCell align="right">Depletion Age</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((s) => {
                  const isRecommended = s.strategyId === result.recommendedStrategyId;
                  return (
                    <TableRow
                      key={s.strategyId}
                      sx={{
                        bgcolor: isRecommended ? 'success.light' : undefined,
                        fontWeight: isRecommended ? 700 : 400,
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {s.strategyName}
                          {isRecommended && (
                            <Chip label="Best" size="small" color="success" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Total estimated taxes paid over the projection period">
                          <span>{fmt(s.totalLifetimeTax)}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        {s.totalOasClawback > 0 ? (
                          <Tooltip title="Total OAS clawback (recovery tax) over the projection period">
                            <span style={{ color: '#d32f2f' }}>{fmt(s.totalOasClawback)}</span>
                          </Tooltip>
                        ) : (
                          <span style={{ color: '#2e7d32' }}>$0</span>
                        )}
                      </TableCell>
                      <TableCell align="right">{fmt(s.finalNetWorth)}</TableCell>
                      <TableCell align="right">
                        {s.portfolioDepletionAge != null ? (
                          <Chip label={`Age ${s.portfolioDepletionAge}`} size="small" color="error" variant="outlined" />
                        ) : (
                          <Chip label="Survives" size="small" color="success" variant="outlined" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
