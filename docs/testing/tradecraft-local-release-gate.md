# Tradecraft Local Release Gate

Use this runbook before pushing the Tradecraft refactor to `main`.

This gate does not start the API or web dev servers. Start them yourself in separate terminals when API or browser checks need them:

```powershell
pnpm dev:api
pnpm dev:web
```

## Source Documents

- [`../prd/pre-main-tradecraft-acceptance-testing.md`](../prd/pre-main-tradecraft-acceptance-testing.md)
- [`pre-main-tradecraft-acceptance.md`](pre-main-tradecraft-acceptance.md)
- [`tradecraft-browser-smoke-and-signoff.md`](tradecraft-browser-smoke-and-signoff.md)
- [`../issues/README.md`](../issues/README.md)

## One-Command Technical Gate

List the commands without running them:

```powershell
pnpm acceptance:tradecraft:list
```

Run the automated local technical gate:

```powershell
pnpm acceptance:tradecraft
```

The runner writes a markdown report to:

```text
docs/testing/runs/
```

Dry-run report generation:

```powershell
pnpm acceptance:tradecraft:dry-run
```

## Automated Sections

The runner executes these sections in order and stops on the first required failure.

- [ ] Workspace type-check

```powershell
pnpm type-check
```

- [ ] Workspace lint

```powershell
pnpm lint
```

- [ ] Workspace build

```powershell
pnpm build
```

- [ ] API and web tests

```powershell
pnpm test:api
pnpm test:web
```

- [ ] Canonical seeded Tradecraft API acceptance

```powershell
pnpm -C apps/e2e exec playwright test tests/api/tradecraft/acceptance-seed/tradecraft-acceptance-seed.spec.ts tests/api/tradecraft/cycle-lifecycle/cycle-lifecycle-acceptance.spec.ts tests/api/tradecraft/participations/participation-acceptance.spec.ts tests/api/tradecraft/admin-recovery/admin-recovery-acceptance.spec.ts tests/api/tradecraft/jingle-yield/jingle-yield-acceptance.spec.ts tests/api/tradecraft/financial-reporting/financial-reporting-acceptance.spec.ts tests/api/tradecraft/contract-gate/tradecraft-contract-gate.spec.ts --project api
```

This seeded API pass resets and reseeds Tradecraft data through the testkit. Do not point it at production.

Do not replace these explicit test commands with root `pnpm test` for this gate. Root recursive tests can run API seeded DB tests and E2E database-resetting tests at the same time, which makes the release gate nondeterministic.

## Canonical Seed Command

Run the seed directly when preparing browser/manual smoke:

```powershell
pnpm -C apps/e2e seed:tradecraft acceptance:tradecraft
```

Expected seed state:

- One Open Cycle.
- One Planned Cycle.
- Normal Participations, pending payment state, refund state, and rollover-linked Participations.
- Payment Matching wallet journals.
- Cycle Lines and fees with deterministic profit/NAV/payout values.
- One active JingleYield Program.
- Admin Recovery Flow states.

## Dirty-Data Smoke

Run this after the clean seeded gate. Do not reset the database first.

Purpose:

- Catch migration/refactor assumptions that only appear with realistic local/dev data.
- Verify no existing local Tradecraft data shape makes key pages or API endpoints unusable.

Suggested checks:

- [ ] `pnpm type-check` still passes.
- [ ] Admin cycle list loads with realistic data.
- [ ] Admin participations list loads with realistic data.
- [ ] Profit/capital pages load for at least one real-ish Cycle.
- [ ] No release-blocking errors appear in API/web logs.

Record result:

- Dirty-data smoke status:
- Database/environment:
- Notes:

## Browser And Performance Smoke

Use the dedicated checklist:

```text
docs/testing/tradecraft-browser-smoke-and-signoff.md
```

Optional existing UI smoke command:

```powershell
pnpm -C apps/e2e exec playwright test tests/ui --project ui
```

If UI auth storage is missing or expired:

```powershell
pnpm -C apps/e2e test:setup
```

Performance smoke is measured, not benchmarked. Block only if a core page/action times out, crashes, or is too slow to operate safely.

Record timings for:

- [ ] `/tradecraft` overview.
- [ ] Cycle details.
- [ ] My investments.
- [ ] Admin cycles.
- [ ] Cycle Settlement action.
- [ ] Admin participations.
- [ ] Admin profit/capital.
- [ ] Admin JingleYield.

## Human Domain Signoff

Domain-owner signoff is required after automated gates and browser smoke.

- [ ] Displayed ISK values match business expectations.
- [ ] Participation statuses and Rollover Intent controls are understandable.
- [ ] Payment Matching and Transaction Allocation are not confused in the UI.
- [ ] Refund, payout, and recovery states are safe for admin operation.
- [ ] Settlement Report strict/recoverable states are clear.
- [ ] JingleYield is represented as first-class behavior.

Signoff:

- Domain owner:
- Date:
- Result:
- Notes:

## Final Pass/Fail Record

- [ ] Automated technical gate passed.
- [ ] Canonical seeded acceptance passed.
- [ ] Dirty-data smoke passed or non-blocking findings are documented.
- [ ] Browser smoke passed or non-blocking findings are documented.
- [ ] Performance smoke found no unusable slowdown.
- [ ] Human domain signoff completed.
- [ ] Live integration smoke checked separately or consciously deferred.

Final release gate result:

- Status:
- Report path:
- Follow-up issues:
