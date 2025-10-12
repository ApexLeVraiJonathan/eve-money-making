/*
 Per-worker isolated Prisma schema for tests.
 We derive DATABASE_URL from DATABASE_URL_TEST and append schema=jest_${JEST_WORKER_ID}.
*/
import { execSync } from 'node:child_process';

const base =
  process.env.DATABASE_URL_TEST ||
  process.env.DATABASE_URL_DEV ||
  process.env.DATABASE_URL;
if (base) {
  const wid = process.env.JEST_WORKER_ID || '1';
  const url = new URL(base);
  url.searchParams.set('schema', `jest_${wid}`);
  process.env.DATABASE_URL = url.toString();
  // Ensure schema exists by running migrate deploy once per worker lazily.
  try {
    execSync('pnpm prisma migrate deploy', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch {
    // ignore, tests may handle setup explicitly
  }
}
