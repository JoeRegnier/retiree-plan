/**
 * prisma/backup.js — SQLite database backup utility
 * ────────────────────────────────────────────────────
 * Creates a timestamped copy of retiree-plan.db in data/backups/ before any
 * destructive Prisma operation (migrate reset, seed, etc.).
 *
 * Usage:  node prisma/backup.js
 *         node prisma/backup.js --label "before-migration"
 *
 * Keeps the 20 most recent backups automatically (older ones are pruned).
 */

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const DB_PATH   = path.join(ROOT, 'data', 'retiree-plan.db');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const MAX_KEEP  = 20;

const label = process.argv.includes('--label')
  ? process.argv[process.argv.indexOf('--label') + 1].replace(/[^a-zA-Z0-9_-]/g, '_')
  : '';

function pad(n) { return String(n).padStart(2, '0'); }

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
         `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.log('[backup] No database file found, skipping backup.');
    return;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const name  = label ? `retiree-plan_${timestamp()}_${label}.db` : `retiree-plan_${timestamp()}.db`;
  const dest  = path.join(BACKUP_DIR, name);

  fs.copyFileSync(DB_PATH, dest);
  console.log(`[backup] ✓ Saved → data/backups/${name}`);

  // Prune old backups, keep newest MAX_KEEP
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('retiree-plan_') && f.endsWith('.db'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  files.slice(MAX_KEEP).forEach(({ name: f }) => {
    fs.unlinkSync(path.join(BACKUP_DIR, f));
    console.log(`[backup]   pruned ${f}`);
  });
}

main();
