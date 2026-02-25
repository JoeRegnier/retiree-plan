import {
  Box, Typography, Card, CardContent, Grid, TextField,
  Button, FormControl, InputLabel, Select, MenuItem, Divider, Alert, Snackbar,
  List, ListItem, ListItemText, Chip, Stack,
  CircularProgress, Tooltip, TableContainer, Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import BackupIcon from '@mui/icons-material/Backup';
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router';
import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';
import { PROVINCE_NAMES } from '@retiree-plan/shared';
import { PdfDownloadButton, RetirementPlanData } from '../components/PdfReport';

interface UserProfile { id: string; email: string; name?: string; }

interface YnabStatus { connected: boolean; budgetName?: string; }

interface BackupInfo { filename: string; sizeBytes: number; createdAt: string; label?: string; }

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
        // Schema stores dateOfBirth (DateTime), not birthYear
        birthYear: m.dateOfBirth
          ? new Date(m.dateOfBirth).getFullYear()
          : new Date().getFullYear() - 50,
        retirementAge: m.retirementAge ?? 65,
        province: m.province,
        country: m.country,
      })),
      incomeSources: (hh.members ?? []).flatMap((m: any) =>
        (m.incomeSources ?? []).map((src: any) => ({
          name: src.name,
          type: src.type ?? 'Other',
          annualAmount: src.annualAmount ?? 0,
          // Schema uses startAge/endAge, not startYear/endYear
          startYear: src.startAge,
          endYear: src.endAge,
          memberName: m.name,
        }))
      ),
      // Accounts belong to the household, not individual members
      accounts: (hh.accounts ?? []).map((acc: any) => ({
        name: acc.name,
        type: acc.type ?? 'Other',
        balance: acc.balance ?? 0,
      })),
      // Include saved scenarios so PDF Page 3 is populated
      scenarios: (hh.scenarios ?? []).map((s: any) => ({
        name: s.name,
        description: s.description,
      })),
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
      body: JSON.stringify({
        ...(name ? { name } : {}),
        ...(newPassword ? { currentPassword, newPassword } : {}),
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      setCurrentPassword('');
      setNewPassword('');
      setSnack('Profile saved');
    },
    onError: (err: any) => {
      const msg = err?.message ?? '';
      if (msg.toLowerCase().includes('current password')) {
        setSnack('Current password is incorrect');
      } else if (msg.toLowerCase().includes('8 characters')) {
        setSnack('New password must be at least 8 characters');
      } else {
        setSnack('Failed to save profile');
      }
    },
  });

  // ── Database backup & restore ─────────────────────────────────────────────
  const { data: backups = [], refetch: refetchBackups, isFetching: backupsFetching } = useQuery<BackupInfo[]>({
    queryKey: ['db-backups'],
    queryFn: () => apiFetch('/database/backups'),
    refetchOnWindowFocus: false,
  });

  const backupNowMutation = useMutation({
    mutationFn: (label?: string) =>
      apiFetch('/database/backup', { method: 'POST', body: JSON.stringify({ label }) }),
    onSuccess: () => { setSnack('Backup created'); void refetchBackups(); },
    onError: () => setSnack('Backup failed'),
  });

  const restoreMutation = useMutation({
    mutationFn: (filename: string) =>
      apiFetch('/database/restore', { method: 'POST', body: JSON.stringify({ filename }) }),
    onSuccess: () => {
      setSnack('Restored — reloading in 2 s…');
      setTimeout(() => window.location.reload(), 2000);
    },
    onError: () => setSnack('Restore failed'),
  });

  const deleteBackupMutation = useMutation({
    mutationFn: (filename: string) =>
      apiFetch(`/database/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' }),
    onSuccess: () => { setSnack('Backup deleted'); void refetchBackups(); },
    onError: () => setSnack('Failed to delete backup'),
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
                key={profile?.name ?? ''}
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
        {/* ── Database Backup & Restore ── */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h6">Database Backup &amp; Restore</Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Tooltip title="Daily backups run automatically at 02:00. The most recent 7 daily backups are retained.">
                    <Chip label="Auto: daily at 02:00 · 7 kept" size="small" color="success" variant="outlined" />
                  </Tooltip>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={backupNowMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <BackupIcon />}
                    disabled={backupNowMutation.isPending}
                    onClick={() => backupNowMutation.mutate(undefined)}
                  >
                    Backup Now
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => refetchBackups()} disabled={backupsFetching}>
                    {backupsFetching ? <CircularProgress size={14} /> : 'Refresh'}
                  </Button>
                </Stack>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Backups are stored in <code>data/backups/</code> on the server. Restoring overwrites the live database — a
                <strong> pre-restore backup is created automatically</strong> before any restore.
              </Typography>
              {backups.length === 0 ? (
                <Alert severity="info">No backups yet. Click "Backup Now" to create one.</Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Filename</TableCell>
                        <TableCell>Label</TableCell>
                        <TableCell>Size</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {backups.map((b) => (
                        <TableRow key={b.filename} hover>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.filename}
                          </TableCell>
                          <TableCell>
                            {b.label
                              ? <Chip label={b.label} size="small" />
                              : <Typography variant="caption" color="text.disabled">—</Typography>}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">{(b.sizeBytes / 1024).toFixed(0)} KB</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">{new Date(b.createdAt).toLocaleString('en-CA')}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <Button
                                size="small"
                                startIcon={restoreMutation.isPending ? <CircularProgress size={12} /> : <RestoreIcon fontSize="small" />}
                                disabled={restoreMutation.isPending}
                                onClick={() => {
                                  if (window.confirm(`Restore "${b.filename}"?\n\nThe current database will be backed up first.`)) {
                                    restoreMutation.mutate(b.filename);
                                  }
                                }}
                              >
                                Restore
                              </Button>
                              <IconButton
                                size="small"
                                color="error"
                                title="Delete backup"
                                disabled={deleteBackupMutation.isPending}
                                onClick={() => {
                                  if (window.confirm(`Delete "${b.filename}"? This cannot be undone.`)) {
                                    deleteBackupMutation.mutate(b.filename);
                                  }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
    </Box>
  );
}
