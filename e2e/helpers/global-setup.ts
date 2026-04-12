/**
 * Playwright global setup — re-seeds the test account before every run.
 * Ensures regression tests always start from a known, clean state.
 */
import { execSync } from 'child_process';
import path from 'path';

export default async function globalSetup() {
  const root = path.resolve(__dirname, '../../');
  const dbUrl = `file:${path.resolve(root, 'data/retiree-plan.db')}`;
  const env = { ...process.env, DATABASE_URL: dbUrl };

  console.log(`[global-setup] Using DATABASE_URL=${dbUrl}`);
  console.log('[global-setup] Applying prisma migrations…');
  execSync('npx prisma migrate deploy', {
    cwd: root,
    stdio: 'inherit',
    env,
  });

  // Use npm script so the predb:seed-test lifecycle hook fires and
  // auto-backs up the database before overwriting it.
  console.log('[global-setup] Re-seeding regression test account…');
  execSync('npm run db:seed-test', {
    cwd: root,
    stdio: 'inherit',
    env,
  });
}
