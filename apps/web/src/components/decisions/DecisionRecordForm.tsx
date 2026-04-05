import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  IconButton,
  Divider,
  Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type { DecisionRecord, AlternativeOption } from '../../pages/DecisionJournalPage';
import { DECISION_STATUSES, DECISION_CATEGORIES } from '../../pages/DecisionJournalPage';

interface Props {
  open: boolean;
  initialData: DecisionRecord | null;
  householdId: string;
  allRecords: DecisionRecord[];
  onSubmit: (data: Partial<DecisionRecord>) => void;
  onClose: () => void;
  isSubmitting: boolean;
}

const emptyForm = {
  title: '',
  status: 'PROPOSED',
  category: 'GENERAL',
  context: '',
  decision: '',
  rationale: '',
  consequences: '',
  decisionDate: '',
  reviewDate: '',
  tags: [] as string[],
  alternatives: [] as AlternativeOption[],
  linkedScenarioIds: [] as string[],
  linkedGoalIds: [] as string[],
  relatedDecisionIds: [] as string[],
};

type FormState = typeof emptyForm;

export function DecisionRecordForm({
  open,
  initialData,
  allRecords,
  onSubmit,
  onClose,
  isSubmitting,
}: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [tagInput, setTagInput] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title ?? '',
        status: initialData.status ?? 'PROPOSED',
        category: initialData.category ?? 'GENERAL',
        context: initialData.context ?? '',
        decision: initialData.decision ?? '',
        rationale: initialData.rationale ?? '',
        consequences: initialData.consequences ?? '',
        decisionDate: initialData.decisionDate
          ? new Date(initialData.decisionDate).toISOString().split('T')[0]
          : '',
        reviewDate: initialData.reviewDate
          ? new Date(initialData.reviewDate).toISOString().split('T')[0]
          : '',
        tags: parseTags(initialData.tags),
        alternatives: parseAlternatives(initialData.alternatives),
        linkedScenarioIds: parseIds(initialData.linkedScenarioIds),
        linkedGoalIds: parseIds(initialData.linkedGoalIds),
        relatedDecisionIds:
          initialData.relatedTo?.map((r) => r.id) ?? [],
      });
    } else {
      setForm(emptyForm);
    }
    setStep(0);
  }, [initialData, open]);

  function parseTags(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }
  function parseAlternatives(raw: string | null | undefined): AlternativeOption[] {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }
  function parseIds(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  function set(field: keyof FormState, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addAlternative() {
    set('alternatives', [
      ...form.alternatives,
      { title: '', description: '', whyRejected: '' },
    ]);
  }

  function updateAlternative(
    idx: number,
    field: keyof AlternativeOption,
    value: string,
  ) {
    const next = form.alternatives.map((a, i) =>
      i === idx ? { ...a, [field]: value } : a,
    );
    set('alternatives', next);
  }

  function removeAlternative(idx: number) {
    set('alternatives', form.alternatives.filter((_, i) => i !== idx));
  }

  function addTag() {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      set('tags', [...form.tags, tag]);
    }
    setTagInput('');
  }

  function handleSubmit() {
    const payload: Partial<DecisionRecord> = {
      title: form.title,
      status: form.status,
      category: form.category,
      context: form.context,
      decision: form.decision || undefined,
      rationale: form.rationale || undefined,
      consequences: form.consequences || undefined,
      decisionDate: form.decisionDate
        ? new Date(form.decisionDate).toISOString()
        : undefined,
      reviewDate: form.reviewDate
        ? new Date(form.reviewDate).toISOString()
        : undefined,
      alternatives:
        form.alternatives.length > 0
          ? JSON.stringify(form.alternatives.filter((a) => a.title))
          : null,
      tags:
        form.tags.length > 0 ? JSON.stringify(form.tags) : null,
      // Pass relatedDecisionIds as a custom property; the API handles it
      ...(form.relatedDecisionIds.length > 0
        ? ({ relatedDecisionIds: form.relatedDecisionIds } as any)
        : {}),
    };
    onSubmit(payload);
  }

  const steps = ['Basic', 'Context & Decision', 'Rationale & Alternatives', 'Dates & Links'];

  const otherRecords = allRecords.filter((r) => r.id !== initialData?.id);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>{initialData ? 'Edit Decision' : 'New Decision Record'}</DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={step} orientation="vertical">
          {/* Step 0: Basic */}
          <Step>
            <StepLabel>Basic Info</StepLabel>
            <StepContent>
              <Stack spacing={2} mt={1}>
                <TextField
                  label="Title"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  required
                  fullWidth
                  size="small"
                  placeholder="e.g. Delay CPP to Age 70"
                />
                <Stack direction="row" spacing={2}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={form.status}
                      label="Status"
                      onChange={(e) => set('status', e.target.value)}
                    >
                      {DECISION_STATUSES.map((s) => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={form.category}
                      label="Category"
                      onChange={(e) => set('category', e.target.value)}
                    >
                      {DECISION_CATEGORIES.map((c) => (
                        <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
                {/* Tags */}
                <Box>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      label="Add tag"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    />
                    <Button size="small" onClick={addTag}>Add</Button>
                  </Stack>
                  {form.tags.length > 0 && (
                    <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap">
                      {form.tags.map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          onDelete={() =>
                            set('tags', form.tags.filter((t) => t !== tag))
                          }
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
              </Stack>
              <Box mt={2}>
                <Button variant="contained" size="small" onClick={() => setStep(1)}>
                  Continue
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 1: Context & Decision */}
          <Step>
            <StepLabel>Context &amp; Decision</StepLabel>
            <StepContent>
              <Stack spacing={2} mt={1}>
                <TextField
                  label="Context"
                  value={form.context}
                  onChange={(e) => set('context', e.target.value)}
                  multiline
                  rows={4}
                  fullWidth
                  required
                  size="small"
                  helperText="What situation or trigger prompted this decision?"
                />
                <TextField
                  label="Decision"
                  value={form.decision}
                  onChange={(e) => set('decision', e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  size="small"
                  helperText="State the decision clearly and unambiguously (can be filled later if Proposed)"
                />
              </Stack>
              <Stack direction="row" spacing={1} mt={2}>
                <Button size="small" onClick={() => setStep(0)}>Back</Button>
                <Button variant="contained" size="small" onClick={() => setStep(2)}>Continue</Button>
              </Stack>
            </StepContent>
          </Step>

          {/* Step 2: Rationale & Alternatives */}
          <Step>
            <StepLabel>Rationale &amp; Alternatives</StepLabel>
            <StepContent>
              <Stack spacing={2} mt={1}>
                <TextField
                  label="Rationale"
                  value={form.rationale}
                  onChange={(e) => set('rationale', e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  size="small"
                  helperText="Why was this option chosen over alternatives?"
                />
                <TextField
                  label="Consequences"
                  value={form.consequences}
                  onChange={(e) => set('consequences', e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  size="small"
                  helperText="Expected outcomes, trade-offs, and downstream impacts"
                />
                <Box>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="subtitle2">Alternatives Considered</Typography>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={addAlternative}
                    >
                      Add
                    </Button>
                  </Stack>
                  {form.alternatives.map((alt, idx) => (
                    <Box
                      key={idx}
                      mb={1.5}
                      p={1.5}
                      sx={{ bgcolor: 'action.hover', borderRadius: 1, position: 'relative' }}
                    >
                      <IconButton
                        size="small"
                        sx={{ position: 'absolute', top: 4, right: 4 }}
                        onClick={() => removeAlternative(idx)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                      <Stack spacing={1}>
                        <TextField
                          size="small"
                          label="Title"
                          value={alt.title}
                          onChange={(e) => updateAlternative(idx, 'title', e.target.value)}
                          fullWidth
                        />
                        <TextField
                          size="small"
                          label="Description"
                          value={alt.description}
                          onChange={(e) => updateAlternative(idx, 'description', e.target.value)}
                          fullWidth
                        />
                        <TextField
                          size="small"
                          label="Why Rejected"
                          value={alt.whyRejected ?? ''}
                          onChange={(e) => updateAlternative(idx, 'whyRejected', e.target.value)}
                          fullWidth
                        />
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} mt={2}>
                <Button size="small" onClick={() => setStep(1)}>Back</Button>
                <Button variant="contained" size="small" onClick={() => setStep(3)}>Continue</Button>
              </Stack>
            </StepContent>
          </Step>

          {/* Step 3: Dates & Links */}
          <Step>
            <StepLabel>Dates &amp; Links</StepLabel>
            <StepContent>
              <Stack spacing={2} mt={1}>
                <Stack direction="row" spacing={2}>
                  <TextField
                    size="small"
                    label="Decision Date"
                    type="date"
                    value={form.decisionDate}
                    onChange={(e) => set('decisionDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Review Date"
                    type="date"
                    value={form.reviewDate}
                    onChange={(e) => set('reviewDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    helperText="When should this decision be re-evaluated?"
                  />
                </Stack>
                {otherRecords.length > 0 && (
                  <Autocomplete
                    multiple
                    size="small"
                    options={otherRecords}
                    getOptionLabel={(o) => o.title}
                    value={otherRecords.filter((r) =>
                      form.relatedDecisionIds.includes(r.id),
                    )}
                    onChange={(_, selected) =>
                      set('relatedDecisionIds', selected.map((s) => s.id))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Related Decisions"
                        helperText="Select other decisions this one is connected to"
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          size="small"
                          label={option.title}
                          {...getTagProps({ index })}
                          key={option.id}
                        />
                      ))
                    }
                  />
                )}
              </Stack>
              <Stack direction="row" spacing={1} mt={2}>
                <Button size="small" onClick={() => setStep(2)}>Back</Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSubmit}
                  disabled={!form.title || !form.context || isSubmitting}
                >
                  {isSubmitting ? 'Saving…' : initialData ? 'Save Changes' : 'Create Decision'}
                </Button>
              </Stack>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
