/**
 * prisma/restore.js — SQLite database restore utility
 * ──────────────────────────────────────────────────────
 * Restores a backup from data/backups/ back to data/retiree-plan.db.
 *
 * Usage:
 *   node prisma/restore.js               → lists backups + restores latest
 *   node prisma/restore.js --list        → list only
 *   node prisma/restore.js <filename>    → restore specific file
 *   node prisma/restore.js --latest      → restore latest without prompt
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const DB_PATH    = path.join(ROOT, 'data', 'retiree-plan.db');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('retiree-plan_') && f.endsWith('.db'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
}

function sizeKB(filePath) {
  return (fs.statSync(filePath).size / 1024).toFixed(1);
}

function restore(filename) {
  const src = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(src)) {
    console.error(`[restore] ERROR: ${filename} not found in data/backups/`);
    process.exit(1);
  }

  // Back up the current DB before overwriting
  if (fs.existsSync(DB_PATH)) {
    const { execSync } = require('child_process');
    execSync(`node ${path.join(__dirname, 'backup.js')} --label pre-restore`, { stdio: 'inherit' });
  }

  fs.copyFileSync(src, DB_PATH);
  console.log(`[restore] ✓ Restored: ${filename} → data/retiree-plan.db`);
}

const args = process.argv.slice(2);
const backups = listBackups();

if (backups.length === 0) {
  console.log('[restore] No backups found in data/backups/');
  process.exit(0);
}

if (args.includes('--list')) {
  console.log('\nAvailable backups (newest first):\n');
  backups.forEach(({ name }, i) => {
    const kb = sizeKB(path.join(BACKUP_DIR, name));
    console.log(`  [${i + 1}] ${name}  (${kb} KB)`);
  });
  console.log('');
  process.exit(0);
}

if (args[0] && !args[0].startsWith('--')) {
  restore(args[0]);
  process.exit(0);
}

if (args.includes('--latest') || args.includes('--yes') || args.includes('-y')) {
  restore(backups[0].name);
  process.exit(0);
}

// Default: show list and restore latest
console.log('\nAvailable backups (newest first):\n');
backups.slice(0, 10).forEach(({ name }, i) => {
  const kb = sizeKB(path.join(BACKUP_DIR, name));
  console.log(`  [${i + 1}] ${name}  (${kb} KB)`);
});

console.log(`\nRestoring latest: ${backups[0].name}`);
restore(backups[0].name);
