import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';

// __dirname at runtime = apps/api/dist/database  →  4 levels up = project root
const ROOT       = path.resolve(__dirname, '../../../..');
const DB_PATH    = path.join(ROOT, 'data', 'retiree-plan.db');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
/** Keep the N most recent backups from the scheduled job. Manual backups are never auto-pruned. */
const DAILY_KEEP = 7;

export interface BackupInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string; // ISO string
  label?: string;
}

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  onModuleInit() {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    this.logger.log(`Database backup dir: ${BACKUP_DIR}`);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private timestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
    );
  }

  private parseBackupInfo(filename: string): BackupInfo {
    const full = path.join(BACKUP_DIR, filename);
    const stat = fs.statSync(full);
    // pattern: retiree-plan_YYYY-MM-DD_HH-MM-SS[_label].db
    const match = filename.match(/^retiree-plan_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})(?:_(.+))?\.db$/);
    const label = match?.[2];
    return {
      filename,
      sizeBytes: stat.size,
      createdAt: stat.birthtime?.toISOString() ?? stat.mtime.toISOString(),
      ...(label ? { label } : {}),
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  listBackups(): BackupInfo[] {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('retiree-plan_') && f.endsWith('.db'))
      .map(f => this.parseBackupInfo(f))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  createBackup(label?: string): BackupInfo {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error('Database file not found');
    }
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const safeLbl = label?.replace(/[^a-zA-Z0-9_-]/g, '_');
    const name    = safeLbl
      ? `retiree-plan_${this.timestamp()}_${safeLbl}.db`
      : `retiree-plan_${this.timestamp()}.db`;
    const dest = path.join(BACKUP_DIR, name);

    fs.copyFileSync(DB_PATH, dest);
    this.logger.log(`Backup created: ${name}`);
    return this.parseBackupInfo(name);
  }

  restoreBackup(filename: string): void {
    const src = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(src)) {
      throw new Error(`Backup not found: ${filename}`);
    }
    // Safety: back up the current DB before overwriting
    if (fs.existsSync(DB_PATH)) {
      this.createBackup('pre-restore');
    }
    fs.copyFileSync(src, DB_PATH);
    this.logger.log(`Restored: ${filename} → retiree-plan.db`);
  }

  deleteBackup(filename: string): void {
    const target = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(target)) throw new Error(`Backup not found: ${filename}`);
    fs.unlinkSync(target);
    this.logger.log(`Deleted backup: ${filename}`);
  }

  // ── Daily scheduled backup ─────────────────────────────────────────────────
  // Runs at 02:00 every day. Keeps the DAILY_KEEP most recent daily backups.
  @Cron('0 2 * * *', { name: 'daily-db-backup' })
  async runDailyBackup() {
    this.logger.log('Running daily scheduled backup…');
    try {
      this.createBackup('daily');

      // Prune old daily backups only — leave manual/labeled ones untouched
      const dailyFiles = this.listBackups()
        .filter(b => b.label === 'daily');

      dailyFiles.slice(DAILY_KEEP).forEach(b => {
        try {
          this.deleteBackup(b.filename);
          this.logger.log(`Pruned old daily backup: ${b.filename}`);
        } catch (e) {
          this.logger.warn(`Could not prune ${b.filename}: ${e}`);
        }
      });
    } catch (e) {
      this.logger.error(`Daily backup failed: ${e}`);
    }
  }
}
