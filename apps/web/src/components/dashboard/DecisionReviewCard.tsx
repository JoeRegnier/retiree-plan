import {
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Box,
  Button,
  Divider,
  Skeleton,
  Alert,
} from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../hooks/useApi';
import type { DecisionRecord } from '../../pages/DecisionJournalPage';
import { STATUS_COLORS } from '../../pages/DecisionJournalPage';

interface Props {
  householdId: string | undefined;
}

export function DecisionReviewCard({ householdId }: Props) {
  const { apiFetch } = useApi();
  const navigate = useNavigate();

  const { data: records = [], isLoading } = useQuery<DecisionRecord[]>({
    queryKey: ['decision-records', householdId, '', ''],
    queryFn: () => apiFetch(`/decision-records/household/${householdId}`),
    enabled: !!householdId,
  });

  const { data: dueForReview = [] } = useQuery<DecisionRecord[]>({
    queryKey: ['decision-records-due', householdId],
    queryFn: () =>
      apiFetch(`/decision-records/household/${householdId}/due-for-review`),
    enabled: !!householdId,
  });

  const decided = records.filter((r) => r.status === 'DECIDED').length;
  const proposed = records.filter((r) => r.status === 'PROPOSED').length;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          <ArticleIcon color="primary" fontSize="small" />
          <Typography variant="h6" fontWeight={700}>
            Decisions
          </Typography>
        </Stack>

        {isLoading ? (
          <Stack spacing={1}>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="50%" />
          </Stack>
        ) : records.length === 0 ? (
          <Box>
            <Typography variant="body2" color="text.secondary" mb={1.5}>
              No decisions recorded yet. Start documenting your financial choices.
            </Typography>
          </Box>
        ) : (
          <>
            <Stack direction="row" spacing={1} mb={1.5}>
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                  <CheckCircleIcon fontSize="small" color="success" />
                  <Typography variant="h5" fontWeight={700}>
                    {decided}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Decided
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                  <PendingIcon fontSize="small" color="warning" />
                  <Typography variant="h5" fontWeight={700}>
                    {proposed}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Proposed
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                  <ScheduleIcon
                    fontSize="small"
                    color={dueForReview.length > 0 ? 'error' : 'disabled'}
                  />
                  <Typography variant="h5" fontWeight={700}>
                    {dueForReview.length}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Due for Review
                </Typography>
              </Box>
            </Stack>

            {dueForReview.length > 0 && (
              <>
                <Alert severity="warning" sx={{ mb: 1.5, py: 0.5 }}>
                  {dueForReview.length} decision{dueForReview.length > 1 ? 's' : ''} overdue for review
                </Alert>
                <Stack spacing={0.5} mb={1}>
                  {dueForReview.slice(0, 3).map((r) => (
                    <Stack key={r.id} direction="row" spacing={0.75} alignItems="center">
                      <Chip
                        label={r.status}
                        color={STATUS_COLORS[r.status] ?? 'default'}
                        size="small"
                        sx={{ fontSize: '0.6rem', height: 16 }}
                      />
                      <Typography variant="caption" noWrap>
                        {r.title}
                      </Typography>
                    </Stack>
                  ))}
                  {dueForReview.length > 3 && (
                    <Typography variant="caption" color="text.secondary">
                      +{dueForReview.length - 3} more…
                    </Typography>
                  )}
                </Stack>
              </>
            )}
          </>
        )}

        <Button
          size="small"
          variant="outlined"
          fullWidth
          sx={{ mt: 0.5 }}
          onClick={() => navigate('/decisions')}
        >
          {records.length === 0 ? 'Start Journal' : 'View Decision Journal'}
        </Button>
      </CardContent>
    </Card>
  );
}
