import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Stepper, Step, StepLabel, Grid, Chip,
  IconButton, List, ListItem, ListItemText, ListItemSecondaryAction, Divider,
  Alert, CircularProgress, Accordion, AccordionSummary, AccordionDetails,
  FormControlLabel, Switch,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';
import { PROVINCE_NAMES } from '@retiree-plan/shared';
import { calcAge } from '../utils/age';

const PROVINCE_OPTIONS = Object.entries(PROVINCE_NAMES).map(([code, name]) => ({ code, name }));

const INCOME_TYPES = [
  'Employment', 'Self-Employment', 'CPP', 'OAS', 'Pension', 'RRSP/RRIF',
  'Investment', 'Rental', 'Other',
];

const EXPENSE_CATEGORIES = [
  'Housing', 'Food', 'Transportation', 'Healthcare', 'Travel', 'Entertainment',
  'Clothing', 'Insurance', 'Utilities', 'Personal Care', 'Education', 'Gifts',
  'Charitable', 'Other',
];

const WIZARD_STEPS = ['Household Name', 'Members', 'Income Sources', 'Expenses'];

interface Member {
  id: string;
  name: string;
  dateOfBirth: string;
  province: string;
  incomeSources?: IncomeSource[];
}

interface IncomeSource {
  id: string;
  name: string;
  type: string;
  annualAmount: number;
  startAge?: number;
  endAge?: number;
  indexToInflation: boolean;
  memberId: string;
}

interface Expense {
  id: string;
  name: string;
  category: string;
  annualAmount: number;
  startAge?: number;
  endAge?: number;
  indexToInflation: boolean;
}

interface Household {
  id: string;
  name: string;
  members: Member[];
  expenses?: Expense[];
}

export function HouseholdPage() {
  const { apiFetch } = useApi();
  const queryClient = useQueryClient();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [householdName, setHouseholdName] = useState('');
  const [newHouseholdId, setNewHouseholdId] = useState('');
  const [memberForm, setMemberForm] = useState({ name: '', dateOfBirth: '', province: 'ON' });
  const [incomeForm, setIncomeForm] = useState({ name: '', type: 'Employment', annualAmount: '', startAge: '', endAge: '', indexToInflation: true, memberId: '' });
  const [expenseForm, setExpenseForm] = useState({ name: '', category: 'Housing', annualAmount: '', startAge: '', endAge: '', indexToInflation: true });
  const [wizardError, setWizardError] = useState('');

  const [memberDialog, setMemberDialog] = useState(false);
  const [incomeDialog, setIncomeDialog] = useState(false);
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingIncome, setEditingIncome] = useState<IncomeSource | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');

  const { data: households, isLoading } = useQuery<Household[]>({
    queryKey: ['households'],
    queryFn: () => apiFetch('/households'),
  });

  const household: Household | undefined = households?.[0];

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ['expenses', household?.id],
    queryFn: () => apiFetch(`/expenses/household/${household!.id}`),
    enabled: !!household?.id,
  });

  const createHousehold = useMutation({
    mutationFn: (data: { name: string; members: { name: string; dateOfBirth: string; province: string }[] }) =>
      apiFetch('/households', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (hh: any) => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
      setNewHouseholdId(hh.id);
      setMemberForm({ name: '', dateOfBirth: '', province: 'ON' });
      setWizardError('');
      // Stay on step 1 so the user can add additional members
    },
    onError: (e: Error) => setWizardError(e.message),
  });

  const addMember = useMutation({
    mutationFn: (data: any) => apiFetch('/members', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
      setMemberDialog(false);
      setMemberForm({ name: '', dateOfBirth: '', province: 'ON' });
    },
  });

  const deleteMember = useMutation({
    mutationFn: (id: string) => apiFetch(`/members/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['households'] }),
  });

  const addIncome = useMutation({
    mutationFn: (data: any) => apiFetch('/incomes', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
      setIncomeDialog(false);
      setIncomeForm({ name: '', type: 'Employment', annualAmount: '', startAge: '', endAge: '', indexToInflation: true, memberId: '' });
    },
  });

  const deleteIncome = useMutation({
    mutationFn: (id: string) => apiFetch(`/incomes/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['households'] }),
  });

  const addExpense = useMutation({
    mutationFn: (data: any) => apiFetch('/expenses', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', household?.id] });
      setExpenseDialog(false);
      setExpenseForm({ name: '', category: 'Housing', annualAmount: '', startAge: '', endAge: '', indexToInflation: true });
    },
  });

  const updateExpense = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiFetch(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', household?.id] });
      setExpenseDialog(false);
      setEditingExpense(null);
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (id: string) => apiFetch(`/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses', household?.id] }),
  });

  const handleWizardNext = () => {
    setWizardError('');
    if (wizardStep === 0) {
      if (!householdName.trim()) { setWizardError('Please enter a household name'); return; }
      setWizardStep(1);
    } else if (wizardStep < 3) {
      setWizardStep((s) => s + 1);
    } else {
      setWizardOpen(false);
      setWizardStep(0);
      setHouseholdName('');
      setNewHouseholdId('');
    }
  };

  const handleCreateHouseholdWithFirstMember = () => {
    if (!householdName.trim()) { setWizardError('Please enter a household name'); return; }
    if (!memberForm.name.trim() || !memberForm.dateOfBirth) { setWizardError('Fill in all member fields'); return; }
    createHousehold.mutate({ name: householdName, members: [memberForm] });
  };

  const handleAddMemberInWizard = () => {
    if (!memberForm.name.trim() || !memberForm.dateOfBirth) { setWizardError('Fill in all member fields'); return; }
    setWizardError('');
    addMember.mutate({ ...memberForm, householdId: newHouseholdId || household?.id }, {
      onSuccess: () => {
        setMemberForm({ name: '', dateOfBirth: '', province: 'ON' });
        setWizardError('');
      },
    });
  };

  const openIncomeDialog = (memberId: string, income?: IncomeSource) => {
    setSelectedMemberId(memberId);
    if (income) {
      setEditingIncome(income);
      setIncomeForm({
        name: income.name, type: income.type, annualAmount: String(income.annualAmount),
        startAge: String(income.startAge ?? ''), endAge: String(income.endAge ?? ''),
        indexToInflation: income.indexToInflation, memberId,
      });
    } else {
      setEditingIncome(null);
      setIncomeForm({ name: '', type: 'Employment', annualAmount: '', startAge: '', endAge: '', indexToInflation: true, memberId });
    }
    setIncomeDialog(true);
  };

  const openExpenseDialog = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setExpenseForm({
        name: expense.name, category: expense.category, annualAmount: String(expense.annualAmount),
        startAge: String(expense.startAge ?? ''), endAge: String(expense.endAge ?? ''),
        indexToInflation: expense.indexToInflation,
      });
    } else {
      setEditingExpense(null);
      setExpenseForm({ name: '', category: 'Housing', annualAmount: '', startAge: '', endAge: '', indexToInflation: true });
    }
    setExpenseDialog(true);
  };

  const handleSaveIncome = () => {
    const payload = {
      name: incomeForm.name, type: incomeForm.type,
      annualAmount: Number(incomeForm.annualAmount),
      ...(incomeForm.startAge ? { startAge: Number(incomeForm.startAge) } : {}),
      ...(incomeForm.endAge ? { endAge: Number(incomeForm.endAge) } : {}),
      indexToInflation: incomeForm.indexToInflation,
      memberId: selectedMemberId,
    };
    if (editingIncome) {
      apiFetch(`/incomes/${editingIncome.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        .then(() => { queryClient.invalidateQueries({ queryKey: ['households'] }); setIncomeDialog(false); setEditingIncome(null); });
    } else {
      addIncome.mutate(payload);
    }
  };

  const handleSaveExpense = () => {
    const payload = {
      name: expenseForm.name, category: expenseForm.category,
      annualAmount: Number(expenseForm.annualAmount),
      ...(expenseForm.startAge ? { startAge: Number(expenseForm.startAge) } : {}),
      ...(expenseForm.endAge ? { endAge: Number(expenseForm.endAge) } : {}),
      indexToInflation: expenseForm.indexToInflation,
      householdId: household?.id,
    };
    if (editingExpense) {
      updateExpense.mutate({ id: editingExpense.id, data: payload });
    } else {
      addExpense.mutate(payload);
    }
  };

  const totalIncome = household?.members.flatMap(m => m.incomeSources ?? []).reduce((s, i) => s + i.annualAmount, 0) ?? 0;
  const totalExpenses = expenses?.reduce((s, e) => s + e.annualAmount, 0) ?? 0;

  if (isLoading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h3">Household</Typography>
          <Typography variant="body1" color="text.secondary">
            Manage household members, income sources, and expenses.
          </Typography>
        </Box>
        {!household && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setWizardOpen(true)}>
            Setup Household
          </Button>
        )}
      </Box>

      {!household ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <PeopleIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>No household set up yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Use the setup wizard to add members, income sources and expenses.
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setWizardOpen(true)}>
              Start Setup Wizard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Box>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Card><CardContent>
                <Typography variant="overline" color="text.secondary">Members</Typography>
                <Typography variant="h4">{household.members.length}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card><CardContent>
                <Typography variant="overline" color="text.secondary">Annual Income</Typography>
                <Typography variant="h4">${totalIncome.toLocaleString()}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card><CardContent>
                <Typography variant="overline" color="text.secondary">Annual Expenses</Typography>
                <Typography variant="h4">${totalExpenses.toLocaleString()}</Typography>
              </CardContent></Card>
            </Grid>
          </Grid>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6"><PeopleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Members</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => setMemberDialog(true)}>Add Member</Button>
              </Box>
              {household.members.map((m) => (
                <Accordion key={m.id} sx={{ mb: 1, '&:before': { display: 'none' }, bgcolor: 'background.default' }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', pr: 1 }}>
                      <Typography fontWeight={600}>{m.name}</Typography>
                      <Chip label={PROVINCE_NAMES[m.province as keyof typeof PROVINCE_NAMES] ?? m.province} size="small" />
                      <Chip label={`${calcAge(m.dateOfBirth)} yrs`} size="small" variant="outlined" />
                      <Box sx={{ ml: 'auto' }}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); deleteMember.mutate(m.id); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        <AttachMoneyIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />Income Sources
                      </Typography>
                      <Button size="small" startIcon={<AddIcon />} onClick={() => openIncomeDialog(m.id)}>Add Income</Button>
                    </Box>
                    {(m.incomeSources ?? []).length === 0 ? (
                      <Typography variant="body2" color="text.disabled" sx={{ ml: 1 }}>No income sources added.</Typography>
                    ) : (
                      <List dense disablePadding>
                        {(m.incomeSources ?? []).map((inc) => (
                          <ListItem key={inc.id} disableGutters>
                            <ListItemText
                              primary={inc.name}
                              secondary={`${inc.type} • $${inc.annualAmount.toLocaleString()}/yr${inc.startAge ? ` • Age ${inc.startAge}–${inc.endAge ?? '∞'}` : ''}`}
                            />
                            <ListItemSecondaryAction>
                              <IconButton size="small" onClick={() => openIncomeDialog(m.id, inc)}><EditIcon fontSize="small" /></IconButton>
                              <IconButton size="small" onClick={() => deleteIncome.mutate(inc.id)}><DeleteIcon fontSize="small" /></IconButton>
                            </ListItemSecondaryAction>
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6"><ShoppingCartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Expenses</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => openExpenseDialog()}>Add Expense</Button>
              </Box>
              {(!expenses || expenses.length === 0) ? (
                <Typography variant="body2" color="text.disabled">No expenses added yet.</Typography>
              ) : (
                <List dense disablePadding>
                  {expenses.map((exp, i) => (
                    <React.Fragment key={exp.id}>
                      {i > 0 && <Divider />}
                      <ListItem disableGutters>
                        <ListItemText
                          primary={exp.name}
                          secondary={`${exp.category} • $${exp.annualAmount.toLocaleString()}/yr${exp.indexToInflation ? ' • Indexed' : ''}`}
                        />
                        <ListItemSecondaryAction>
                          <IconButton size="small" onClick={() => openExpenseDialog(exp)}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => deleteExpense.mutate(exp.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Household Setup Wizard */}
      <Dialog open={wizardOpen} maxWidth="sm" fullWidth onClose={() => setWizardOpen(false)}>
        <DialogTitle>Household Setup Wizard</DialogTitle>
        <DialogContent>
          <Stepper activeStep={wizardStep} sx={{ mb: 3, mt: 1 }}>
            {WIZARD_STEPS.map((s) => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
          </Stepper>
          {wizardError && <Alert severity="error" sx={{ mb: 2 }}>{wizardError}</Alert>}
          {wizardStep === 0 && (
            <TextField label="Household Name" fullWidth value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)} placeholder="e.g. The Smith Family" />
          )}
          {wizardStep === 1 && (
            <Box>
              {/* List of already-added members */}
              {household && household.members.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Members added so far:</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {household.members.map((m) => (
                      <Chip key={m.id} label={m.name} color="success" size="small" />
                    ))}
                  </Box>
                </Box>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {newHouseholdId || household ? 'Add another member, or click Next to continue.' : 'Add at least one household member to continue.'}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label="Name" value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} fullWidth />
                <TextField label="Date of Birth" type="date" value={memberForm.dateOfBirth}
                  onChange={(e) => setMemberForm({ ...memberForm, dateOfBirth: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
                <TextField label="Province" select value={memberForm.province}
                  onChange={(e) => setMemberForm({ ...memberForm, province: e.target.value })} fullWidth>
                  {PROVINCE_OPTIONS.map((p) => <MenuItem key={p.code} value={p.code}>{p.name}</MenuItem>)}
                </TextField>
                {!(newHouseholdId || household) ? (
                  <Button variant="contained" onClick={handleCreateHouseholdWithFirstMember} disabled={createHousehold.isPending}>
                    {createHousehold.isPending ? <CircularProgress size={20} /> : 'Create Household & Add Member'}
                  </Button>
                ) : (
                  <Button variant="outlined" onClick={handleAddMemberInWizard} disabled={addMember.isPending}>
                    {addMember.isPending ? <CircularProgress size={20} /> : 'Add Another Member'}
                  </Button>
                )}
              </Box>
            </Box>
          )}
          {wizardStep === 2 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Add income sources for each member now, or skip and add them later from the Household page.
              </Typography>
              {(household?.members ?? []).map((m) => (
                <Accordion key={m.id} sx={{ mb: 1, '&:before': { display: 'none' }, bgcolor: 'background.default' }} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography fontWeight={600}>{m.name}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {(m.incomeSources ?? []).length > 0 && (
                      <List dense disablePadding sx={{ mb: 1 }}>
                        {(m.incomeSources ?? []).map((inc) => (
                          <ListItem key={inc.id} disableGutters>
                            <ListItemText
                              primary={inc.name}
                              secondary={`${inc.type} • $${inc.annualAmount.toLocaleString()}/yr`}
                            />
                            <ListItemSecondaryAction>
                              <IconButton size="small" onClick={() => deleteIncome.mutate(inc.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </ListItemSecondaryAction>
                          </ListItem>
                        ))}
                      </List>
                    )}
                    <Button size="small" startIcon={<AddIcon />} onClick={() => openIncomeDialog(m.id)}>
                      Add Income Source
                    </Button>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}
          {wizardStep === 3 && (
            <Alert severity="success">Your household is set up! Add income sources and expenses from the Household page.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          {wizardStep > 0 && <Button onClick={() => setWizardStep((s) => s - 1)}>Back</Button>}
          <Button variant="contained" onClick={handleWizardNext} disabled={wizardStep === 1 && !newHouseholdId && !household}>
            {wizardStep === WIZARD_STEPS.length - 1 ? 'Finish' : 'Next'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={memberDialog} maxWidth="xs" fullWidth onClose={() => setMemberDialog(false)}>
        <DialogTitle>Add Member</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Name" value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} fullWidth />
          <TextField label="Date of Birth" type="date" value={memberForm.dateOfBirth}
            onChange={(e) => setMemberForm({ ...memberForm, dateOfBirth: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
          <TextField label="Province" select value={memberForm.province}
            onChange={(e) => setMemberForm({ ...memberForm, province: e.target.value })} fullWidth>
            {PROVINCE_OPTIONS.map((p) => <MenuItem key={p.code} value={p.code}>{p.name}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMemberDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => addMember.mutate({ ...memberForm, householdId: household?.id })} disabled={addMember.isPending}>
            Add Member
          </Button>
        </DialogActions>
      </Dialog>

      {/* Income Source Dialog */}
      <Dialog open={incomeDialog} maxWidth="xs" fullWidth onClose={() => { setIncomeDialog(false); setEditingIncome(null); }}>
        <DialogTitle>{editingIncome ? 'Edit Income Source' : 'Add Income Source'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Name" value={incomeForm.name} onChange={(e) => setIncomeForm({ ...incomeForm, name: e.target.value })} fullWidth />
          <TextField label="Type" select value={incomeForm.type} onChange={(e) => setIncomeForm({ ...incomeForm, type: e.target.value })} fullWidth>
            {INCOME_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TextField label="Annual Amount ($)" type="number" value={incomeForm.annualAmount}
            onChange={(e) => setIncomeForm({ ...incomeForm, annualAmount: e.target.value })} fullWidth />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField label="Start Age" type="number" value={incomeForm.startAge}
                onChange={(e) => setIncomeForm({ ...incomeForm, startAge: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={6}>
              <TextField label="End Age" type="number" value={incomeForm.endAge}
                onChange={(e) => setIncomeForm({ ...incomeForm, endAge: e.target.value })} fullWidth />
            </Grid>
          </Grid>
          <FormControlLabel
            control={<Switch checked={incomeForm.indexToInflation} onChange={(e) => setIncomeForm({ ...incomeForm, indexToInflation: e.target.checked })} />}
            label="Index to inflation"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setIncomeDialog(false); setEditingIncome(null); }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveIncome} disabled={addIncome.isPending}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={expenseDialog} maxWidth="xs" fullWidth onClose={() => { setExpenseDialog(false); setEditingExpense(null); }}>
        <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Description" value={expenseForm.name} onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })} fullWidth />
          <TextField label="Category" select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} fullWidth>
            {EXPENSE_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField label="Annual Amount ($)" type="number" value={expenseForm.annualAmount}
            onChange={(e) => setExpenseForm({ ...expenseForm, annualAmount: e.target.value })} fullWidth />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField label="Start Age" type="number" value={expenseForm.startAge}
                onChange={(e) => setExpenseForm({ ...expenseForm, startAge: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={6}>
              <TextField label="End Age" type="number" value={expenseForm.endAge}
                onChange={(e) => setExpenseForm({ ...expenseForm, endAge: e.target.value })} fullWidth />
            </Grid>
          </Grid>
          <FormControlLabel
            control={<Switch checked={expenseForm.indexToInflation} onChange={(e) => setExpenseForm({ ...expenseForm, indexToInflation: e.target.checked })} />}
            label="Index to inflation"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setExpenseDialog(false); setEditingExpense(null); }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveExpense} disabled={addExpense.isPending || updateExpense.isPending}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
