# E2E tests (Playwright)

This folder is organized **by feature first**, then by test type:

- `api/`: API-level E2E (fast, stable, high-signal)
- `ui/`: UI E2E (slower; reserve for critical flows)

## Folder conventions

- **Tradecraft**
  - `api/tradecraft/caps/*`
  - `api/tradecraft/rollover/*`
  - `ui/tradecraft/*`
- **Auto rollover**
  - `api/auto-rollover/*`
  - `ui/auto-rollover/*`

## Running tests

Run everything:

```bash
pnpm -C apps/e2e test
```

Run one feature (API):

```bash
pnpm -C apps/e2e test -- --project api -- tests/api/tradecraft
pnpm -C apps/e2e test -- --project api -- tests/api/auto-rollover
```

Run one feature (UI):

```bash
pnpm -C apps/e2e test -- --project ui -- tests/ui/tradecraft
pnpm -C apps/e2e test -- --project ui -- tests/ui/auto-rollover
```

## UI auth (storageState)

UI tests require an authenticated Playwright `storageState`:

```bash
pnpm -C apps/e2e test:setup
```

This writes `apps/e2e/.playwright/storageState.json`. UI tests will **skip with a clear message**
if the storage state is missing/invalid.


