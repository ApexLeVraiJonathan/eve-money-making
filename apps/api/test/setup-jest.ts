/*
 Per-worker isolated Prisma schema for tests.
 We derive DATABASE_URL from DATABASE_URL_TEST and append schema=jest_${JEST_WORKER_ID}.
*/
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

// Jest does not automatically load .env files. Load the API env files here so
// tests can pick up DATABASE_URL_TEST / DATABASE_URL_DEV without requiring the
// user to export them in the shell.
//
// We do NOT override already-set environment variables.
for (const p of [
  path.resolve(__dirname, '../.env.test'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env.test'),
  path.resolve(__dirname, '../../.env'),
]) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: false });
  }
}

const base =
  process.env.DATABASE_URL_TEST ||
  process.env.DATABASE_URL_DEV ||
  process.env.DATABASE_URL;
if (base) {
  const wid = process.env.JEST_WORKER_ID || '1';
  const url = new URL(base);
  url.searchParams.set('schema', `jest_${wid}`);
  process.env.DATABASE_URL = url.toString();
  // Ensure schema exists (only when needed).
  //
  // This repo commonly uses `prisma db push` during development (not migrations),
  // so use `db push` here as the default to create tables in the per-worker schema.
  // Running via the `packages/prisma` workspace package ensures the Prisma CLI exists.
  try {
    // Fast path: if the schema already has core tables, skip push.
    // We can't use top-level await in Jest setup files, so do the check via a
    // short-lived node script executed synchronously.
    const schemaName = `jest_${wid}`;
    const tmp = path.join(os.tmpdir(), `eve-mm-jest-schema-check-${wid}.js`);
    fs.writeFileSync(
      tmp,
      `
const { Client } = require('pg');
(async () => {
  const url = process.env.DATABASE_URL;
  const schema = process.env.JEST_SCHEMA;
  const client = new Client({ connectionString: url });
  await client.connect();
  const res = await client.query(
    "select exists (select 1 from information_schema.tables where table_schema = $1 and table_name in ('cycles','cycle_participations','discord_accounts','notification_preferences','app_users')) as exists",
    [schema]
  );
  await client.end();
  process.stdout.write(res.rows[0] && res.rows[0].exists ? "1" : "0");
})().catch((e) => {
  // If the check fails, fall back to running db push.
  process.stdout.write("0");
});
`,
      'utf8',
    );

    const out = execSync(`node "${tmp}"`, {
      cwd: path.resolve(__dirname, '../../..'),
      env: { ...process.env, JEST_SCHEMA: schemaName },
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore
    }

    const hasTables = out === '1';
    if (!hasTables) {
      const cleanup = path.join(
        os.tmpdir(),
        `eve-mm-jest-retired-notifications-${wid}.js`,
      );
      fs.writeFileSync(
        cleanup,
        `
const { Client } = require('pg');
(async () => {
  const url = process.env.DATABASE_URL;
  const schema = process.env.JEST_SCHEMA;
  const client = new Client({ connectionString: url });
  await client.connect();
  for (const targetSchema of [schema, 'public']) {
    await client.query(\`set search_path to "\${targetSchema}", public\`);
    const exists = await client.query(
      "select to_regclass($1) as table_name",
      [\`\${targetSchema}.notification_preferences\`]
    );
    if (!exists.rows[0] || !exists.rows[0].table_name) continue;
    await client.query(
      "delete from notification_preferences where notification_type::text = any($1::text[])",
      [[
        'SKILL_PLAN_REMAP_REMINDER',
        'SKILL_PLAN_COMPLETION',
        'SKILL_FARM_EXTRACTOR_READY',
        'SKILL_FARM_QUEUE_LOW',
      ]]
    );
  }
  await client.end();
})().catch(() => {});
`,
        'utf8',
      );
      execSync(`node "${cleanup}"`, {
        cwd: path.resolve(__dirname, '../../..'),
        env: { ...process.env, JEST_SCHEMA: schemaName },
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      try {
        fs.unlinkSync(cleanup);
      } catch {
        // ignore
      }
      execSync(
        'pnpm -C packages/prisma exec prisma db push --accept-data-loss',
        {
          stdio: 'inherit',
          // Run from repo root so pnpm can resolve workspace filters reliably.
          cwd: path.resolve(__dirname, '../../..'),
        },
      );
    }
  } catch {
    // ignore, tests may handle setup explicitly
  }
}
