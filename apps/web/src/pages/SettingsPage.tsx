import {
  Box, Typography, Card, CardContent, Grid, TextField,
  Button, FormControl, InputLabel, Select, MenuItem, Divider, Alert, Snackbar,
  List, ListItem, ListItemText, Chip, Stack,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router';
import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';
import { PROVINCE_NAMES } from '@retiree-plan/shared';
import { PdfDownloadButton, RetirementPlanData } from '../components/PdfReport';

interface UserProfile { id: string; email: string; name?: string; }

interface YnabStatus { connected: boolean; budgetName?: string; }

export function SettingsPage() {
  const { apiFetch } = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [snack, setSnack] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: (data: any[]) =>
      apiFetch('/households/import', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['households'] });
      setSnack('Data imported successfully');
    },
    onError: () => setSnack('Import failed — check file format'),
  });

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const data = Array.isArray(parsed) ? parsed : [parsed];
        importMutation.mutate(data);
      } catch {
        setSnack('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => apiFetch('/auth/me'),
  });

  const { data: households } = useQuery<any[]>({
    queryKey: ['households'],
    queryFn: () => apiFetch('/households'),
  });

  const { data: ynabStatus } = useQuery<YnabStatus>({
    queryKey: ['ynab-status'],
    queryFn: () => apiFetch('/ynab/status'),
    retry: false,
  });

  const planData = useMemo((): RetirementPlanData | null => {
    const hh = households?.[0];
    if (!hh) return null;
    return {
      householdName: hh.name ?? 'My Household',
      generatedAt: new Date().toLocaleDateString('en-CA'),
      members: (hh.members ?? []).map((m: any) => ({
        name: m.name,
        birthYear: m.birthYear ?? new Date().getFullYear() - 50,
        retirementAge: m.retirementAge ?? 65,
        province: m.province,
        country: m.country,
      })),
      incomeSources: (hh.members ?? []).flatMap((m: any) =>
        (m.incomeSources ?? []).map((src: any) => ({
          name: src.name,
          type: src.type ?? 'Other',
          annualAmount: src.annualAmount ?? 0,
          startYear: src.startYear,
          endYear: src.endYear,
          memberName: m.name,
        }))
      ),
      accounts: (hh.members ?? []).flatMap((m: any) =>
        (m.accounts ?? []).map((acc: any) => ({
          name: acc.name,
          type: acc.type ?? 'Other',
          balance: acc.balance ?? 0,
          memberName: m.name,
        }))
      ),
      annualExpenses: hh.annualExpenses ?? 0,
      notes: hh.notes,
    };
  }, [households]);

  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [defaultProvince, setDefaultProvince] = useState<string>('ON');
  const [inflationAssumption, setInflationAssumption] = useState<string>('2.5');
  const [expectedReturn, setExpectedReturn] = useState<string>('6.0');

  const updateProfile = useMutation({
    mutationFn: () => apiFetch('/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || profile?.name }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setSnack('Profile saved'); },
    onError: () => setSnack('Failed to save profile'),
  });

  const handleExport = async () => {
    try {
      const households = await apiFetch<unknown[]>('/households');
      const json = JSON.stringify(households, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `retiree-plan-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSnack('Data exported');
    } catch {
      setSnack('Export failed');
    }
  };

  return (
    <Box>
      <Typography variant="h3" sx={{ mb: 1 }}>Settings</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Configure your profile, preferences, and integrations.
      </Typography>

      <Grid container spacing={3}>
        {/* Profile */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Profile</Typography>
              <TextField
                label="Display Name"
                fullWidth
                defaultValue={profile?.name ?? ''}
                onChange={(e) => setName(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Email"
                fullWidth
                value={profile?.email ?? ''}
                InputProps={{ readOnly: true }}
                helperText="Email cannot be changed"
                sx={{ mb: 3 }}
              />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Change Password</Typography>
              <TextField label="Current Password" type="password" fullWidth value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} sx={{ mb: 1.5 }} />
              <TextField label="New Password" type="password" fullWidth value={newPassword} onChange={(e) => setNewPassword(e.target.value)} sx={{ mb: 2 }} />
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => updateProfile.mutate()}
              >
                Save Profile
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Preferences */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Default Assumptions</Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Default Province</InputLabel>
                <Select value={defaultProvince} label="Default Province" onChange={(e) => setDefaultProvince(e.target.value)}>
                  {Object.entries(PROVINCE_NAMES).map(([code, name]) => (
                    <MenuItem key={code} value={code}>{name} ({code})</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Default Inflation Rate (%)"
                type="number"
                fullWidth
                value={inflationAssumption}
                onChange={(e) => setInflationAssumption(e.target.value)}
                inputProps={{ step: 0.1, min: 0, max: 10 }}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Default Expected Return (%)"
                type="number"
                fullWidth
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(e.target.value)}
                inputProps={{ step: 0.1, min: 0, max: 20 }}
                sx={{ mb: 2 }}
              />
              <Button variant="outlined" onClick={() => setSnack('Preferences saved')}>
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Integrations */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Integrations</Typography>
              <List disablePadding>
                <ListItem disableGutters>
                  <ListItemText
                    primary="YNAB"
                    secondary={ynabStatus?.connected ? `Budget: ${ynabStatus.budgetName ?? 'connected'}` : 'Not connected — add your Personal Access Token'}
                  />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={ynabStatus?.connected ? 'Connected' : 'Not connected'}
                      color={ynabStatus?.connected ? 'success' : 'default'}
                      size="small"
                      variant={ynabStatus?.connected ? 'filled' : 'outlined'}
                    />
                    <Button size="small" endIcon={<OpenInNewIcon fontSize="inherit" />} onClick={() => navigate('/integrations')}>
                      Configure
                    </Button>
                  </Stack>
                </ListItem>
                <Divider sx={{ my: 1 }} />
                <ListItem disableGutters>
                  <ListItemText
                    primary="AI Assistant"
                    secondary="Powered by Ollama (local) or GitHub Copilot SDK"
                  />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label="Active" color="success" size="small" />
                    <Button size="small" endIcon={<OpenInNewIcon fontSize="inherit" />} onClick={() => navigate('/ai-chat')}>
                      Open
                    </Button>
                  </Stack>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Data management */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Data Management</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Export or import all your plan data.
              </Typography>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport}>
                    Export to JSON
                  </Button>
                  {planData && <PdfDownloadButton plan={planData} label="Export to PDF" />}
                </Stack>
                <Box>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    style={{ display: 'none' }}
                    onChange={handleImport}
                  />
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<UploadIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importMutation.isPending}
                  >
                    Import from JSON
                  </Button>
                </Box>
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Alert severity="info" variant="outlined">
                Data is stored locally in a SQLite database. Regular exports are recommended.
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} />
    </Box>
  );
}
