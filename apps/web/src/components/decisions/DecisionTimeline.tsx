import {
  Box,
  Typography,
  Stack,
  Chip,
  Divider,
  Paper,
  alpha,
  useTheme,
} from '@mui/material';
import type { DecisionRecord } from '../../pages/DecisionJournalPage';
import {
  CATEGORY_COLORS,
  STATUS_COLORS,
  DECISION_CATEGORIES,
} from '../../pages/DecisionJournalPage';

interface Props {
  records: DecisionRecord[];
  onSelect: (id: string) => void;
}

export function DecisionTimeline({ records, onSelect }: Props) {
  const theme = useTheme();

  // Sort by decisionDate desc, then createdAt desc
  const sorted = [...records].sort((a, b) => {
    const aDate = a.decisionDate ?? a.createdAt;
    const bDate = b.decisionDate ?? b.createdAt;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  // Group by year
  const byYear = new Map<string, DecisionRecord[]>();
  sorted.forEach((r) => {
    const d = r.decisionDate ?? r.createdAt;
    const year = new Date(d).getFullYear().toString();
    const existing = byYear.get(year) ?? [];
    byYear.set(year, [...existing, r]);
  });

  const years = Array.from(byYear.keys()).sort((a, b) => Number(b) - Number(a));

  if (records.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No decisions recorded yet.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={3}>
      {years.map((year) => (
        <Box key={year}>
          <Stack direction="row" alignItems="center" spacing={1.5} mb={1.5}>
            <Typography
              variant="h6"
              fontWeight={700}
              color="text.secondary"
              sx={{ minWidth: 48 }}
            >
              {year}
            </Typography>
            <Divider sx={{ flexGrow: 1 }} />
          </Stack>
          <Stack
            sx={{ pl: 3, borderLeft: '2px solid', borderColor: 'divider' }}
            spacing={1.5}
          >
            {byYear.get(year)!.map((r) => {
              const categoryColor = CATEGORY_COLORS[r.category] ?? '#757575';
              const categoryLabel =
                DECISION_CATEGORIES.find((c) => c.value === r.category)?.label ??
                r.category;

              return (
                <Box
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  sx={{
                    position: 'relative',
                    cursor: 'pointer',
                    pl: 2,
                    py: 1.25,
                    pr: 2,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: `4px solid ${categoryColor}`,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.04),
                    },
                    // Timeline dot
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: -22,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: categoryColor,
                      border: `2px solid ${theme.palette.background.paper}`,
                    },
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" mb={0.25}>
                    <Chip
                      label={r.status}
                      color={STATUS_COLORS[r.status] ?? 'default'}
                      size="small"
                      sx={{ fontSize: '0.6rem', height: 18 }}
                    />
                    <Chip
                      label={categoryLabel}
                      size="small"
                      sx={{
                        bgcolor: alpha(categoryColor, 0.15),
                        color: categoryColor,
                        fontWeight: 600,
                        fontSize: '0.6rem',
                        height: 18,
                      }}
                    />
                    {r.decisionDate && (
                      <Typography variant="caption" color="text.secondary">
                        {new Date(r.decisionDate).toLocaleDateString('en-CA', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Typography>
                    )}
                  </Stack>
                  <Typography variant="body2" fontWeight={600}>
                    {r.title}
                  </Typography>
                  {r.decision && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      noWrap
                    >
                      {r.decision}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
