import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Badge,
  alpha,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import ArticleIcon from '@mui/icons-material/Article';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TimelineIcon from '@mui/icons-material/Timeline';
import SearchIcon from '@mui/icons-material/Search';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';
import { DecisionDetailCard } from '../components/decisions/DecisionDetailCard';
import { DecisionRecordForm } from '../components/decisions/DecisionRecordForm';
import { DecisionMindMap } from '../components/decisions/DecisionMindMap';
import { DecisionTimeline } from '../components/decisions/DecisionTimeline';

export interface AlternativeOption {
  title: string;
  description: string;
  whyRejected?: string;
}

export interface DecisionRecord {
  id: string;
  householdId: string;
  title: string;
  status: string;
  context: string;
  decision?: string | null;
  rationale?: string | null;
  alternatives?: string | null;
  consequences?: string | null;
  category: string;
  tags?: string | null;
  decisionDate?: string | null;
  reviewDate?: string | null;
  supersededById?: string | null;
  linkedScenarioIds?: string | null;
  linkedGoalIds?: string | null;
  relatedTo?: Pick<DecisionRecord, 'id' | 'title' | 'status'>[];
  relatedFrom?: Pick<DecisionRecord, 'id' | 'title' | 'status'>[];
  supersededBy?: Pick<DecisionRecord, 'id' | 'title'> | null;
  supersedes?: Pick<DecisionRecord, 'id' | 'title'>[];
  createdAt: string;
  updatedAt: string;
}

export type ViewMode = 'list' | 'timeline' | 'mindmap';

export const DECISION_STATUSES = [
  'PROPOSED',
  'DECIDED',
  'SUPERSEDED',
  'DEPRECATED',
  'REJECTED',
] as const;

export const DECISION_CATEGORIES = [
  { value: 'WITHDRAWAL_STRATEGY', label: 'Withdrawal Strategy' },
  { value: 'ASSET_ALLOCATION', label: 'Asset Allocation' },
  { value: 'TAX_PLANNING', label: 'Tax Planning' },
  { value: 'CPP_OAS_TIMING', label: 'CPP / OAS Timing' },
  { value: 'HOUSING', label: 'Housing' },
  { value: 'ESTATE', label: 'Estate' },
  { value: 'INCOME', label: 'Income' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'GENERAL', label: 'General' },
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  WITHDRAWAL_STRATEGY: '#9c27b0',
  ASSET_ALLOCATION: '#1976d2',
  TAX_PLANNING: '#f57c00',
  CPP_OAS_TIMING: '#00796b',
  HOUSING: '#795548',
  ESTATE: '#37474f',
  INCOME: '#388e3c',
  INSURANCE: '#fbc02d',
  GENERAL: '#757575',
};

export const STATUS_COLORS: Record<string, 'warning' | 'success' | 'default' | 'error' | 'info'> = {
  PROPOSED: 'warning',
  DECIDED: 'success',
  SUPERSEDED: 'default',
  DEPRECATED: 'default',
  REJECTED: 'error',
};

interface Household {
  id: string;
  name: string;
}

export function DecisionJournalPage() {
  const { apiFetch } = useApi();
  const queryClient = useQueryClient();
  const theme = useTheme();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<DecisionRecord | null>(null);

  const { data: households = [] } = useQuery<Household[]>({
    queryKey: ['households'],
    queryFn: () => apiFetch('/households'),
  });
  const householdId = households[0]?.id ?? '';

  const { data: records = [], isLoading } = useQuery<DecisionRecord[]>({
    queryKey: ['decision-records', householdId, statusFilter, categoryFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      return apiFetch(
        `/decision-records/household/${householdId}${params.toString() ? `?${params}` : ''}`,
      );
    },
    enabled: !!householdId,
  });

  const { data: dueForReview = [] } = useQuery<DecisionRecord[]>({
    queryKey: ['decision-records-due', householdId],
    queryFn: () =>
      apiFetch(`/decision-records/household/${householdId}/due-for-review`),
    enabled: !!householdId,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<DecisionRecord>) =>
      apiFetch('/decision-records', {
        method: 'POST',
        body: JSON.stringify({ ...data, householdId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decision-records'] });
      setFormOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DecisionRecord> }) =>
      apiFetch(`/decision-records/${id}?householdId=${householdId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decision-records'] });
      setFormOpen(false);
      setEditRecord(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/decision-records/${id}?householdId=${householdId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['decision-records'] });
      if (selectedId === id) setSelectedId(null);
    },
  });

  const supersedeMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/decision-records/${id}/supersede?householdId=${householdId}`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['decision-records'] }),
  });

  const filteredRecords = useMemo(() => {
    if (!searchQuery) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.context.toLowerCase().includes(q) ||
        (r.decision ?? '').toLowerCase().includes(q),
    );
  }, [records, searchQuery]);

  const selectedRecord = records.find((r) => r.id === selectedId) ?? null;

  const summaryCounts = useMemo(
    () => ({
      decided: records.filter((r) => r.status === 'DECIDED').length,
      proposed: records.filter((r) => r.status === 'PROPOSED').length,
      overdue: dueForReview.length,
    }),
    [records, dueForReview],
  );

  if (!householdId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Create a household first to start keeping a Decision Journal.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <ArticleIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            Decision Journal
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditRecord(null);
            setFormOpen(true);
          }}
        >
          New Decision
        </Button>
      </Stack>

      {/* Summary chips */}
      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <Chip
          label={`${summaryCounts.decided} Decided`}
          color="success"
          size="small"
          variant="outlined"
        />
        <Chip
          label={`${summaryCounts.proposed} Proposed`}
          color="warning"
          size="small"
          variant="outlined"
        />
        {summaryCounts.overdue > 0 && (
          <Chip
            icon={<ScheduleIcon />}
            label={`${summaryCounts.overdue} Due for Review`}
            color="error"
            size="small"
          />
        )}
      </Stack>

      {/* Filter bar */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
          <TextField
            size="small"
            placeholder="Search decisions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} /> }}
            sx={{ minWidth: 200, flexGrow: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All statuses</MenuItem>
              {DECISION_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryFilter}
              label="Category"
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="">All categories</MenuItem>
              {DECISION_CATEGORIES.map((c) => (
                <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <ToggleButtonGroup
            size="small"
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
          >
            <ToggleButton value="list">
              <Tooltip title="List"><FilterListIcon fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="timeline">
              <Tooltip title="Timeline"><TimelineIcon fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="mindmap">
              <Tooltip title="Mind Map"><AccountTreeIcon fontSize="small" /></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : viewMode === 'mindmap' ? (
        <DecisionMindMap
          householdId={householdId}
          onNodeClick={(id) => { setSelectedId(id); setViewMode('list'); }}
        />
      ) : viewMode === 'timeline' ? (
        <DecisionTimeline
          records={filteredRecords}
          onSelect={(id) => { setSelectedId(id); setViewMode('list'); }}
        />
      ) : (
        /* List + Detail split view */
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
          {/* Left: Decision list */}
          <Paper
            variant="outlined"
            sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0, maxHeight: '75vh', overflow: 'auto' }}
          >
            {filteredRecords.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <ArticleIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                <Typography color="text.secondary" mt={1}>
                  No decisions yet. Start by recording one.
                </Typography>
              </Box>
            ) : (
              filteredRecords.map((r, idx) => {
                const isOverdue =
                  r.reviewDate && new Date(r.reviewDate) <= new Date() && r.status !== 'SUPERSEDED';
                return (
                  <Box key={r.id}>
                    {idx > 0 && <Divider />}
                    <Box
                      onClick={() => setSelectedId(r.id)}
                      sx={{
                        p: 1.5,
                        cursor: 'pointer',
                        bgcolor:
                          selectedId === r.id
                            ? alpha(theme.palette.primary.main, 0.08)
                            : 'transparent',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                        borderLeft: `4px solid ${CATEGORY_COLORS[r.category] ?? '#757575'}`,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Chip
                          label={r.status}
                          color={STATUS_COLORS[r.status] ?? 'default'}
                          size="small"
                          sx={{ mb: 0.5, fontSize: '0.65rem', height: 18 }}
                        />
                        {isOverdue && (
                          <Tooltip title="Due for review">
                            <ScheduleIcon fontSize="small" color="error" />
                          </Tooltip>
                        )}
                      </Stack>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {r.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {DECISION_CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category}
                        {r.decisionDate
                          ? ` · ${new Date(r.decisionDate).toLocaleDateString('en-CA', { year: 'numeric', month: 'short' })}`
                          : ''}
                      </Typography>
                    </Box>
                  </Box>
                );
              })
            )}
          </Paper>

          {/* Right: Detail card */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            {selectedRecord ? (
              <DecisionDetailCard
                record={selectedRecord}
                allRecords={records}
                onEdit={(r) => { setEditRecord(r); setFormOpen(true); }}
                onDelete={(id) => deleteMutation.mutate(id)}
                onSupersede={(id) => supersedeMutation.mutate(id)}
              />
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  p: 4,
                  textAlign: 'center',
                  height: 320,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArticleIcon sx={{ fontSize: 56, color: 'text.disabled' }} />
                <Typography color="text.secondary" mt={1}>
                  Select a decision to view its record
                </Typography>
              </Paper>
            )}
          </Box>
        </Stack>
      )}

      {/* Create / Edit form */}
      <DecisionRecordForm
        open={formOpen}
        initialData={editRecord}
        householdId={householdId}
        allRecords={records}
        onSubmit={(data) => {
          if (editRecord) {
            updateMutation.mutate({ id: editRecord.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        onClose={() => { setFormOpen(false); setEditRecord(null); }}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </Box>
  );
}
