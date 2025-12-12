## E2E tests (Playwright)

This repo uses a lightweight Playwright harness for E2E-style feature scenarios:
- **API-first tests** (backend behavior): `apps/e2e/tests/api/*.spec.ts`
- Optional **UI tests** (web + api): `apps/e2e/tests/ui/*.spec.ts` (add as needed)

### Assumptions (simple on purpose)
- You have already started:
  - API at `API_URL` (default `http://localhost:3000`)
  - Web at `WEB_URL` (default `http://localhost:3001`)
- You run tests against your dev DB (not production).

### Required env
- `E2E_API_KEY`: dev API key that your running API accepts (`DEV_API_KEY` on the API side)

Optional:
- `API_URL`
- `WEB_URL`
- `DATABASE_URL` (if not set, defaults to `postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public`)
- `ENCRYPTION_KEY` (required for UI tests that log in by setting the `session` cookie)

### Run

From repo root:

```bash
pnpm -C apps/e2e test
```

Filter to one test:

```bash
pnpm -C apps/e2e test -- -g "Auto rollover"
```

### UI login (manual once)

UI tests use a saved Playwright `storageState.json` so they can run headless without automating EVE SSO.

1) Run setup once (headed), log in manually, then click "Resume" in Playwright:

```bash
pnpm -C apps/e2e test:setup
```

2) Then run UI tests normally:

```bash
pnpm -C apps/e2e test -- --project ui
```

Notes:
- Setup writes: `apps/e2e/.playwright/storageState.json`
- UI tests will **skip** if storageState is missing/invalid.

### Seed UI states for UX review (Tradecraft)

To make UI/UX review easier (e.g. planned/open/opted-in/rollover states), we provide a small scenario seeder.

List scenarios:

```bash
pnpm -C apps/e2e seed:tradecraft:list
```

Seed a scenario:

```bash
pnpm -C apps/e2e seed:tradecraft cycles:open+planned
```

Open:
- `WEB_URL/tradecraft/cycles` (defaults to `http://localhost:3001/tradecraft/cycles`)

### Notes
- Tests reset only **tradecraft cycle data** (cycles, participations, allocations, etc.) but do not delete users/characters.
- The test harness ensures an admin user exists in the DB so `x-api-key` auth maps to a real `userId`.
- UI tests authenticate by generating the same encrypted `session` cookie the API expects. This requires `ENCRYPTION_KEY` to match the running API's config.


