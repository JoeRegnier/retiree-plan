import {
  Box,
  Typography,
  Stack,
  Chip,
  Button,
  Divider,
  Paper,
  Tooltip,
  IconButton,
  Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import ScheduleIcon from '@mui/icons-material/Schedule';
import type {
  DecisionRecord,
  AlternativeOption,
} from '../../pages/DecisionJournalPage';
import {
  CATEGORY_COLORS,
  STATUS_COLORS,
  DECISION_CATEGORIES,
} from '../../pages/DecisionJournalPage';

interface Props {
  record: DecisionRecord;
  allRecords: DecisionRecord[];
  onEdit: (record: DecisionRecord) => void;
  onDelete: (id: string) => void;
  onSupersede: (id: string) => void;
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box mb={2}>
      <Typography
        variant="overline"
        sx={{ color: 'text.secondary', fontSize: '0.65rem', letterSpacing: 1.2 }}
      >
        {label}
      </Typography>
      <Box mt={0.25}>{children}</Box>
    </Box>
  );
}

export function DecisionDetailCard({
  record,
  allRecords,
  onEdit,
  onDelete,
  onSupersede,
}: Props) {
  const categoryLabel =
    DECISION_CATEGORIES.find((c) => c.value === record.category)?.label ??
    record.category;

  const categoryColor = CATEGORY_COLORS[record.category] ?? '#757575';

  const parsedAlternatives: AlternativeOption[] = (() => {
    if (!record.alternatives) return [];
    try {
      return JSON.parse(record.alternatives);
    } catch {
      return [];
    }
  })();

  const parsedTags: string[] = (() => {
    if (!record.tags) return [];
    try {
      return JSON.parse(record.tags);
    } catch {
      return [];
    }
  })();

  const isOverdue =
    record.reviewDate &&
    new Date(record.reviewDate) <= new Date() &&
    record.status !== 'SUPERSEDED';

  const relatedDecisions = record.relatedTo ?? [];

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      {/* Title row */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
            <Chip
              label={record.status}
              color={STATUS_COLORS[record.status] ?? 'default'}
              size="small"
            />
            <Chip
              label={categoryLabel}
              size="small"
              sx={{
                bgcolor: categoryColor,
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.7rem',
              }}
            />
          </Stack>
          <Typography variant="h6" fontWeight={700}>
            {record.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {record.decisionDate
              ? `Decided: ${new Date(record.decisionDate).toLocaleDateString('en-CA', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}`
              : 'Not yet decided'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5}>
          {record.status === 'DECIDED' && (
            <Tooltip title="Supersede this decision">
              <IconButton
                size="small"
                onClick={() => onSupersede(record.id)}
                color="warning"
              >
                <BlockIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => onEdit(record)} color="primary">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => onDelete(record.id)}
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      {isOverdue && (
        <Alert severity="warning" icon={<ScheduleIcon />} sx={{ mb: 2 }}>
          This decision is due for review (
          {new Date(record.reviewDate!).toLocaleDateString('en-CA')}).
        </Alert>
      )}

      {record.supersededBy && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Superseded by: <strong>{record.supersededBy.title}</strong>
        </Alert>
      )}

      <Section label="Context">
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {record.context}
        </Typography>
      </Section>

      {record.decision && (
        <Section label="Decision">
          <Typography
            variant="body2"
            sx={{
              whiteSpace: 'pre-wrap',
              fontWeight: 600,
              borderLeft: `3px solid ${categoryColor}`,
              pl: 1.5,
            }}
          >
            {record.decision}
          </Typography>
        </Section>
      )}

      {record.rationale && (
        <Section label="Rationale">
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {record.rationale}
          </Typography>
        </Section>
      )}

      {parsedAlternatives.length > 0 && (
        <Section label="Alternatives Considered">
          <Stack spacing={1.5}>
            {parsedAlternatives.map((alt, idx) => (
              <Box
                key={idx}
                sx={{
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  p: 1.25,
                }}
              >
                <Typography variant="body2" fontWeight={600}>
                  {alt.title}
                </Typography>
                {alt.description && (
                  <Typography variant="caption" color="text.secondary">
                    {alt.description}
                  </Typography>
                )}
                {alt.whyRejected && (
                  <Typography variant="caption" display="block" color="error.main" mt={0.25}>
                    Rejected: {alt.whyRejected}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        </Section>
      )}

      {record.consequences && (
        <Section label="Consequences">
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {record.consequences}
          </Typography>
        </Section>
      )}

      {relatedDecisions.length > 0 && (
        <Section label="Related Decisions">
          <Stack spacing={0.5}>
            {relatedDecisions.map((rel) => (
              <Stack key={rel.id} direction="row" spacing={0.5} alignItems="center">
                <LinkIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="body2">{rel.title}</Typography>
                <Chip
                  label={rel.status}
                  color={STATUS_COLORS[rel.status] ?? 'default'}
                  size="small"
                  sx={{ fontSize: '0.6rem', height: 16 }}
                />
              </Stack>
            ))}
          </Stack>
        </Section>
      )}

      {parsedTags.length > 0 && (
        <Section label="Tags">
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {parsedTags.map((tag) => (
              <Chip key={tag} label={tag} size="small" variant="outlined" />
            ))}
          </Stack>
        </Section>
      )}

      {record.reviewDate && (
        <Box
          mt={1}
          pt={1.5}
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        >
          <Typography variant="caption" color="text.secondary">
            <ScheduleIcon
              fontSize="inherit"
              sx={{ verticalAlign: 'middle', mr: 0.5 }}
            />
            Review on{' '}
            {new Date(record.reviewDate).toLocaleDateString('en-CA', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
