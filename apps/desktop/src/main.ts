import { app, BrowserWindow, dialog, shell, Menu, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as http from 'http';
import { fork, ChildProcess } from 'child_process';

const isDev = !app.isPackaged;

// ── Path resolution ────────────────────────────────────────────────────────────
//   dev  → __dirname = <repo>/apps/desktop/dist/
//   prod → process.resourcesPath = .../Contents/Resources/  (macOS)
//                                   .../resources/            (win/linux)

function repoPath(...parts: string[]): string {
  // Navigate from apps/desktop/dist/ up to the repo root
  return path.join(__dirname, '..', '..', '..', ...parts);
}

const API_ENTRY = isDev
  ? repoPath('apps', 'api', 'dist', 'main.js')
  : path.join(process.resourcesPath, 'server', 'index.js');

const WEB_DIST = isDev
  ? repoPath('apps', 'web', 'dist')
  : path.join(process.resourcesPath, 'web');

// In dev mode we use the existing repo database so the developer's seed data
// is visible immediately.  In production we manage a per-user database in the
// OS-appropriate userData directory.
const DEV_DB_PATH = repoPath('data', 'retiree-plan.db');
const TEMPLATE_DB = isDev
  ? path.join(__dirname, '..', 'resources', 'template.db')
  : path.join(process.resourcesPath, 'template.db');

const PORT = '3001'; // use 3001 to avoid collisions with the dev API on 3000

let apiProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let currentDataDir: string | null = null;
const PROFILES_FILE_NAME = 'profiles.json';

// ── Secrets ────────────────────────────────────────────────────────────────────

interface AppSecrets {
  jwtSecret: string;
  tokenEncryptionKey: string;
}

function loadOrCreateSecrets(userDataDir: string): AppSecrets {
  const secretsFile = path.join(userDataDir, 'secrets.json');
  if (fs.existsSync(secretsFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(secretsFile, 'utf8')) as Partial<AppSecrets>;
      if (parsed.jwtSecret && parsed.tokenEncryptionKey) return parsed as AppSecrets;
    } catch {
      // corrupt file – regenerate below
    }
  }

  const secrets: AppSecrets = {
    jwtSecret: crypto.randomBytes(32).toString('hex'),
    tokenEncryptionKey: crypto.randomBytes(32).toString('hex'),
  };
  fs.mkdirSync(userDataDir, { recursive: true });
  // 0o600 = owner read/write only
  fs.writeFileSync(secretsFile, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  return secrets;
}

// ── Database init ──────────────────────────────────────────────────────────────

function ensureDatabase(userDataDir: string): string {
  const dbFile = path.join(userDataDir, 'retiree-plan.db');
  if (!fs.existsSync(dbFile) && fs.existsSync(TEMPLATE_DB)) {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.copyFileSync(TEMPLATE_DB, dbFile);
  }
  return dbFile;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// Prisma/SQLite expect forward-slash paths in the `file:` URI scheme.
// On Windows, path.join produces backslashes; normalise them here so that
// DATABASE_URL is always a valid SQLite file URI on every platform.
function toDbUrl(filePath: string): string {
  return `file:${filePath.replace(/\\/g, '/')}`;
}

// ── Wait for API readiness ─────────────────────────────────────────────────────

function waitForApi(url: string, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const attempt = () => {
      if (Date.now() > deadline) {
        reject(new Error(`API did not become ready within ${timeoutMs / 1000}s.`));
        return;
      }
      http
        .get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) resolve();
          else setTimeout(attempt, 500);
        })
        .on('error', () => setTimeout(attempt, 500));
    };

    attempt();
  });
}

// ── Spawn NestJS API as a child process ────────────────────────────────────────
//   We use fork() with process.execPath (Electron's bundled Node) so that the
//   app is fully self-contained without requiring a system Node installation.
//   Native modules (bcrypt, @prisma/client) MUST be rebuilt for the Electron
//   Node ABI – the build script handles this via @electron/rebuild.

function spawnApi(env: NodeJS.ProcessEnv): void {
  // In production there is no visible console (especially on Windows), so
  // redirect the API's stdout/stderr to a log file so users can share it
  // when diagnosing startup failures.
  let stdio: 'inherit' | [number, number, number, 'ipc'] = 'inherit';
  if (!isDev) {
    try {
      const logDir = app.getPath('logs');
      fs.mkdirSync(logDir, { recursive: true });
      const logFd = fs.openSync(path.join(logDir, 'api.log'), 'w');
      stdio = [0 as unknown as number, logFd, logFd, 'ipc'];
    } catch {
      // If we can't open a log file, fall back to inherit so the app still starts.
    }
  }

  apiProcess = fork(API_ENTRY, [], {
    execPath: process.execPath,
    env,
    stdio,
  });

  apiProcess.on('exit', (code) =>
    console.log(`[desktop] API process exited with code ${code}`),
  );
}

// ── BrowserWindow ──────────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Retiree Plan',
    show: false, // shown after 'ready-to-show' to avoid blank flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(`http://localhost:${PORT}`);
  win.once('ready-to-show', () => win.show());

  // Open <a target="_blank"> links in the OS default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Open DevTools only when explicitly requested to avoid DevTools frontend
  // mismatches (which can spam the console with harmless protocol errors).
  // Set `OPEN_DEVTOOLS=true` in your environment when you want the tools.
  if (isDev && process.env.OPEN_DEVTOOLS === 'true') {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  mainWindow = win;
  return win;
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  const userDataDir = app.getPath('userData');
  const configFile = path.join(userDataDir, 'desktop-config.json');

  // Helper: read persisted data directory from the small config file stored
  // under the Electron `userData` location so we can find it on future runs.
  const readConfiguredDataDir = (): string | null => {
    try {
      if (!fs.existsSync(configFile)) return null;
      const raw = fs.readFileSync(configFile, 'utf8');
      const parsed = JSON.parse(raw) as { dataDir?: string } | null;
      if (parsed && parsed.dataDir) return parsed.dataDir;
    } catch {
      // ignore and fall back
    }
    return null;
  };

  const promptForDataDir = async (defaultPath?: string): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select a folder to store Retiree Plan data',
      defaultPath: defaultPath ?? app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  };

  // Determine the directory to store DB + secrets.
  let dataDir: string;
  const configured = readConfiguredDataDir();
  if (isDev) {
    // Developers: keep using the repo-local DB so existing seeded data is
    // preserved and you don't accidentally overwrite your local profile.
    dataDir = path.dirname(DEV_DB_PATH);
  } else if (configured) {
    dataDir = configured;
  } else {
    // First production run: ask the user where they'd like their data stored.
    const picked = await promptForDataDir(userDataDir);
    dataDir = picked ?? userDataDir;
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(configFile, JSON.stringify({ dataDir }, null, 2), { mode: 0o600 });
    } catch (e) {
      // If persisting the config fails, continue with the chosen dir anyway.
      console.warn('[desktop] could not persist data-dir config', e);
    }
  }

  // Ensure secrets and DB live under the chosen data dir
  const secrets = loadOrCreateSecrets(dataDir);
  const dbFile = isDev ? DEV_DB_PATH : ensureDatabase(dataDir);

  // Track current data dir globally and record it in profiles.json
  currentDataDir = dataDir;
  const profilesFile = path.join(userDataDir, PROFILES_FILE_NAME);

  type Profile = { id: string; label?: string; path: string; createdAt: string; lastUsedAt?: string };

  const readProfiles = (): Profile[] => {
    try {
      if (!fs.existsSync(profilesFile)) return [];
      return JSON.parse(fs.readFileSync(profilesFile, 'utf8')) as Profile[];
    } catch (e) {
      console.warn('[desktop] could not read profiles.json', e);
      return [];
    }
  };

  const writeProfiles = (profiles: Profile[]) => {
    try {
      fs.mkdirSync(path.dirname(profilesFile), { recursive: true });
      fs.writeFileSync(profilesFile, JSON.stringify(profiles, null, 2), { mode: 0o600 });
    } catch (e) {
      console.warn('[desktop] could not write profiles.json', e);
    }
  };

  const ensureProfileForDir = (dir: string, label?: string) => {
    const profiles = readProfiles();
    const existing = profiles.find((p) => path.resolve(p.path) === path.resolve(dir));
    const now = new Date().toISOString();
    if (existing) {
      existing.lastUsedAt = now;
    } else {
      profiles.push({ id: crypto.randomUUID?.() ?? crypto.randomBytes(8).toString('hex'), label, path: dir, createdAt: now, lastUsedAt: now });
    }
    writeProfiles(profiles);
  };

  // Persist initial profile
  ensureProfileForDir(dataDir, path.basename(dataDir));

  // Helper: perform a live switch to a new data directory. Copies or creates
  // the DB as requested, updates profiles.json, restarts the API child process
  // and reloads the renderer.
  const switchToDataDir = async (newDir: string, opts?: { copyExisting?: boolean; fresh?: boolean }) => {
    if (!newDir) return;
    try {
      fs.mkdirSync(newDir, { recursive: true });
    } catch (e) {
      dialog.showErrorBox('Error', `Could not create directory: ${String(e)}`);
      return;
    }

    const oldDir = currentDataDir ?? '';
    const oldDb = path.join(oldDir, 'retiree-plan.db');
    const newDb = path.join(newDir, 'retiree-plan.db');
    const oldSecrets = path.join(oldDir, 'secrets.json');
    const newSecrets = path.join(newDir, 'secrets.json');

    if (opts?.copyExisting && fs.existsSync(oldDb) && !fs.existsSync(newDb)) {
      try {
        fs.copyFileSync(oldDb, newDb);
      } catch (e) {
        dialog.showErrorBox('Error', `Could not copy database: ${String(e)}`);
        return;
      }
      // Always copy secrets alongside the DB so that encrypted tokens remain
      // decryptable with the same key in the new profile.
      if (fs.existsSync(oldSecrets) && !fs.existsSync(newSecrets)) {
        try { fs.copyFileSync(oldSecrets, newSecrets); } catch { /* ignore */ }
      }
    }

    // If the target directory has a DB but no secrets file, a new random key
    // will be generated — this means any stored integration tokens (YNAB etc.)
    // in that DB were encrypted with a different key and will fail to decrypt.
    // Warn the user so they know to reconnect integrations.
    const newDbExists = fs.existsSync(path.join(newDir, 'retiree-plan.db'));
    const newSecretsExist = fs.existsSync(newSecrets);
    if (newDbExists && !newSecretsExist && !opts?.fresh && !opts?.copyExisting) {
      dialog.showMessageBox({
        type: 'warning',
        buttons: ['OK'],
        message: 'Integration tokens need to be reconnected',
        detail:
          'This plan\'s encryption key file (secrets.json) is missing. ' +
          'Any saved integrations (YNAB, etc.) will need to be disconnected and reconnected after switching.',
      }).catch(() => {});
    }

    if (opts?.fresh) {
      // ensureDatabase will create a template DB if missing
      ensureDatabase(newDir);
      loadOrCreateSecrets(newDir);
    }

    // If the new dir already contains a DB, we'll use it as-is.
    ensureProfileForDir(newDir, path.basename(newDir));

    // Update persisted config
    try {
      fs.writeFileSync(configFile, JSON.stringify({ dataDir: newDir }, null, 2), { mode: 0o600 });
    } catch (e) {
      console.warn('[desktop] could not persist data-dir config', e);
    }

    // Restart API with new environment
    try {
      if (apiProcess) {
        apiProcess.kill();
        apiProcess = null;
      }

      const secrets = loadOrCreateSecrets(newDir);
      const dbPath = ensureDatabase(newDir);
      const apiEnv: NodeJS.ProcessEnv = {
        ...process.env,
        NODE_ENV: 'production',
        PORT,
        DATABASE_URL: toDbUrl(dbPath),
        JWT_SECRET: secrets.jwtSecret,
        TOKEN_ENCRYPTION_KEY: secrets.tokenEncryptionKey,
        CORS_ORIGIN: `http://localhost:${PORT}`,
        SERVE_STATIC: 'true',
        STATIC_FILES_PATH: WEB_DIST,
      };

      currentDataDir = newDir;
      spawnApi(apiEnv);
      await waitForApi(`http://localhost:${PORT}/api/health`);

      if (mainWindow) {
        mainWindow.webContents.reload();
      }
    } catch (e) {
      dialog.showErrorBox('Error', `Could not restart application server: ${String(e)}`);
    }
  };

  // IPC handlers for renderer
  ipcMain.handle('desktop:get-data-info', async () => {
    const profiles = readProfiles();
    return { dataDir: currentDataDir, dbFile: currentDataDir ? path.join(currentDataDir, 'retiree-plan.db') : null, profiles };
  });

  ipcMain.handle('desktop:open-data-folder', async () => {
    if (!currentDataDir) return { success: false };
    await shell.openPath(currentDataDir);
    return { success: true };
  });

  ipcMain.handle('desktop:change-data-location', async () => {
    const picked = await promptForDataDir(currentDataDir ?? userDataDir);
    if (!picked) return { success: false };

    // Ask whether to copy existing data or start fresh
    const choice = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Copy existing data', 'Start fresh', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: 'When switching to the new folder, do you want to copy your existing data or start fresh?'
    });

    if (choice.response === 2) return { success: false };
    const opts = { copyExisting: choice.response === 0, fresh: choice.response === 1 };
    await switchToDataDir(picked, opts);
    return { success: true, dataDir: currentDataDir };
  });

  ipcMain.handle('desktop:list-profiles', async () => ({ profiles: readProfiles() }));

  ipcMain.handle('desktop:switch-profile', async (_ev, profileIdOrPath: string) => {
    if (!profileIdOrPath) return { success: false };

    // Accept either a profile ID (from the login page) or a raw directory path (legacy)
    const allProfiles = readProfiles();
    const matched = allProfiles.find((p) => p.id === profileIdOrPath);
    const targetDir = matched ? matched.path : profileIdOrPath;

    // If target directory already has a DB, switch to it directly — no prompts needed
    const hasDb = fs.existsSync(path.join(targetDir, 'retiree-plan.db'));
    if (hasDb) {
      await switchToDataDir(targetDir, { copyExisting: false, fresh: false });
      return { success: true };
    }

    // DB missing — ask whether to copy or create fresh
    const choice = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Copy existing data here', 'Create fresh DB here', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: 'The selected folder does not contain a database. Do you want to copy your current data here or create a fresh database?'
    });
    if (choice.response === 2) return { success: false };
    const opts = { copyExisting: choice.response === 0, fresh: choice.response === 1 };
    await switchToDataDir(targetDir, opts);
    return { success: true };
  });

  ipcMain.handle('desktop:create-fresh-profile', async () => {
    const picked = await promptForDataDir(userDataDir);
    if (!picked) return { success: false };
    await switchToDataDir(picked, { fresh: true });
    return { success: true, dataDir: currentDataDir };
  });

  // Application menu: allow the user to change the data directory later.
  const createAppMenu = () => {
    const changeDataDir = async () => {
      const picked = await promptForDataDir(currentDataDir ?? dataDir);
      if (!picked) return;
      const choice = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Copy existing data', 'Start fresh', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        message: 'When switching to the new folder, do you want to copy your existing data or start fresh?'
      });
      if (choice.response === 2) return;
      const opts = { copyExisting: choice.response === 0, fresh: choice.response === 1 };
      await switchToDataDir(picked, opts);
    };

    const editMenu = {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    };

    const template: any[] = [];
    if (process.platform === 'darwin') {
      template.push({
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { label: 'Change Data Location...', click: changeDataDir },
          { type: 'separator' },
          { role: 'quit' },
        ],
      });
    } else {
      template.push({
        label: 'File',
        submenu: [
          { label: 'Change Data Location...', click: changeDataDir },
          { type: 'separator' },
          { role: 'quit' },
        ],
      });
    }
    template.push(editMenu);
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  };

  createAppMenu();

  const apiEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT,
    DATABASE_URL: toDbUrl(dbFile),
    JWT_SECRET: secrets.jwtSecret,
    TOKEN_ENCRYPTION_KEY: secrets.tokenEncryptionKey,
    // Lock CORS to our own window origin – no wildcard in production.
    CORS_ORIGIN: `http://localhost:${PORT}`,
    // Signal the API to serve the React build as static files.
    SERVE_STATIC: 'true',
    STATIC_FILES_PATH: WEB_DIST,
  };

  spawnApi(apiEnv);

  try {
    await waitForApi(`http://localhost:${PORT}/api/health`);
  } catch (err) {
    const logPath = (() => {
      try { return path.join(app.getPath('logs'), 'api.log'); } catch { return ''; }
    })();
    dialog.showErrorBox(
      'Startup Error',
      `Could not start the application server.\n\n${String(err)}` +
        (logPath ? `\n\nDiagnostic log: ${logPath}` : ''),
    );
    app.quit();
    return;
  }

  createWindow();

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  if (apiProcess) {
    apiProcess.kill();
    apiProcess = null;
  }
});
