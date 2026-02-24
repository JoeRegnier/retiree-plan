/**
 * Playwright global setup — re-seeds the test account before every run.
 * Ensures regression tests always start from a known, clean state.
 */
import { execSync } from 'child_process';
import path from 'path';

export default async function globalSetup() {
  const root = path.resolve(__dirname, '../../');
  console.log('[global-setup] Re-seeding regression test account…');
  execSync('node prisma/seed-test-account.js', {
    cwd: root,
    stdio: 'inherit',
  });
}
