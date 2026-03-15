import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Tab,
  Tabs,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Collapse,
  Link,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Desktop integration: show data directory and allow switching profiles
  const [desktopAvailable, setDesktopAvailable] = useState(false);
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [dbFile, setDbFile] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Array<{ id: string; label?: string; path: string }>>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [showPlanControls, setShowPlanControls] = useState(false);

  useEffect(() => {
    const desktop = window?.electron?.desktop;
    if (desktop) {
      setDesktopAvailable(true);
      (async () => {
        try {
          const info = await desktop.getDataInfo();
          setDataDir(info.dataDir ?? null);
          setDbFile(info.dbFile ?? null);
          setProfiles(info.profiles ?? []);
          setSelectedProfileId(info.profiles?.[0]?.id ?? null);
        } catch (e) {
          // ignore
        }
      })();
    }
  }, []);

  const refreshDataInfo = async () => {
    const desktop = window?.electron?.desktop;
    if (!desktop) return;
    const info = await desktop.getDataInfo();
    setDataDir(info.dataDir ?? null);
    setDbFile(info.dbFile ?? null);
    setProfiles(info.profiles ?? []);
    if (!selectedProfileId) setSelectedProfileId(info.profiles?.[0]?.id ?? null);
  };

  const handleOpenFolder = async () => {
    const desktop = window?.electron?.desktop;
    if (!desktop) return;
    await desktop.openDataFolder();
  };

  const handleChangeDataLocation = async () => {
    const desktop = window?.electron?.desktop;
    if (!desktop) return;
    await desktop.changeDataLocation();
    await refreshDataInfo();
  };

  const handleCreateFreshProfile = async () => {
    const desktop = window?.electron?.desktop;
    if (!desktop) return;
    await desktop.createFreshProfile();
    await refreshDataInfo();
  };

  const handleSwitchProfile = async () => {
    const desktop = window?.electron?.desktop;
    if (!desktop || !selectedProfileId) return;
    const res = await desktop.switchProfile(selectedProfileId);
    if (res.success) {
      // Reload so the API restarts and the app reconnects to the selected DB
      window.location.reload();
    } else {
      setError('Failed to switch profile');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const normalisedEmail = email.trim().toLowerCase();
      if (tab === 0) {
        await login(normalisedEmail, password);
      } else {
        await register(normalisedEmail, password, name || undefined);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 2.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              RetireePlan
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Canadian Financial & Retirement Planning
            </Typography>
          </Box>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} centered sx={{ mb: 3 }}>
            <Tab label="Sign In" />
            <Tab label="Register" />
          </Tabs>

          {desktopAvailable && (
            <Box sx={{ mb: 2.5 }}>
              {/* Collapsed summary row */}
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {profiles.find((p) => p.path === dataDir)?.label ??
                      (dataDir ? dataDir.split(/[/\\]/).pop() : '—')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active plan
                  </Typography>
                </Box>
                <Link
                  component="button"
                  variant="caption"
                  onClick={() => setShowPlanControls((v) => !v)}
                  underline="hover"
                  sx={{ color: 'text.secondary' }}
                >
                  {showPlanControls ? 'Done' : 'Change'}
                </Link>
              </Stack>

              {/* Expandable controls */}
              <Collapse in={showPlanControls}>
                <Box
                  sx={{
                    mt: 1.5,
                    p: 1.5,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ wordBreak: 'break-all', display: 'block', mb: 1.5 }}
                  >
                    {dataDir ?? 'Not set'}
                  </Typography>

                  {profiles.length > 0 && (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel id="profile-select-label">Switch plan</InputLabel>
                        <Select
                          labelId="profile-select-label"
                          value={selectedProfileId ?? ''}
                          label="Switch plan"
                          onChange={(e) => setSelectedProfileId(e.target.value as string)}
                        >
                          {profiles.map((p) => (
                            <MenuItem key={p.id} value={p.id}>
                              {p.label ?? p.path.split(/[/\\]/).pop()}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleSwitchProfile}
                        disabled={!selectedProfileId}
                        sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        Switch
                      </Button>
                    </Stack>
                  )}

                  <Stack direction="row" spacing={0} sx={{ ml: -0.75 }}>
                    <Button size="small" onClick={handleOpenFolder} sx={{ fontSize: '0.72rem' }}>
                      Open Folder
                    </Button>
                    <Button size="small" onClick={handleChangeDataLocation} sx={{ fontSize: '0.72rem' }}>
                      Change Location
                    </Button>
                    <Button size="small" onClick={handleCreateFreshProfile} sx={{ fontSize: '0.72rem' }}>
                      New Profile
                    </Button>
                  </Stack>
                </Box>
              </Collapse>
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            {tab === 1 && (
              <TextField
                label="Name"
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                sx={{ mb: 2 }}
              />
            )}
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 3 }}
              inputProps={{ minLength: 8 }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
            >
              {loading ? 'Please wait…' : tab === 0 ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
