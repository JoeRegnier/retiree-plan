/**
 * Playwright global setup — re-seeds the test account before every run.
 * Ensures regression tests always start from a known, clean state.
 */
import { execSync } from 'child_process';
import path from 'path';

export default async function globalSetup() {
  const root = path.resolve(__dirname, '../../');
  // Use npm script so the predb:seed-test lifecycle hook fires and
  // auto-backs up the database before overwriting it.
  console.log('[global-setup] Re-seeding regression test account…');
  execSync('npm run db:seed-test', {
    cwd: root,
    stdio: 'inherit',
  });
}
