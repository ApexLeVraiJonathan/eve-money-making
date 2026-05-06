# Tradecraft Browser Smoke And Human Signoff Checklist

Use this after the deterministic API acceptance gate passes and before pushing the Tradecraft refactor to `main`.

Start from the canonical dataset unless you are doing the separate dirty-data smoke:

```powershell
pnpm -C apps/e2e seed:tradecraft acceptance:tradecraft
```

Do not run the seed against production. It resets Tradecraft data in the configured local/dev database.

## Blocker Threshold

Block the push when a browser issue makes a money flow, auth boundary, or admin operational path unusable or misleading.

Release-blocking examples:

- Wrong displayed ISK totals, payout values, cap values, NAV, profit, rollover, or JingleYield state.
- Admin cannot plan/open/settle Cycles or inspect the Settlement Report.
- Admin cannot match/validate Participation payments, mark refunds, mark payout sent, or inspect recovery states.
- User cannot see Participation state or choose/update Rollover Intent where the UI supports it.
- A core page or Cycle Settlement action times out, crashes, or is obviously unusable.

Non-blocking examples, unless they obscure the workflow:

- Minor copy issues.
- Small layout polish.
- Performance variance that does not make the flow unusable.

## Browser-Automated Smoke

These checks are suitable for Playwright/browser automation. Capture screenshots or notes for failures only.

Suggested command for existing UI smoke tests:

```powershell
pnpm -C apps/e2e exec playwright test tests/ui --project ui
```

If a UI auth storage state is missing or expired, refresh it with the existing setup flow:

```powershell
pnpm -C apps/e2e test:setup
```

### Public And User Pages

- [ ] `/tradecraft` loads without runtime errors.
- [ ] Overview shows an Open Cycle and Planned Cycle from the acceptance seed.
- [ ] `/tradecraft/cycles/history` loads and shows completed Cycle history.
- [ ] Cycle detail routes load for the seeded Open Cycle and show profit/inventory context.
- [ ] `/tradecraft/my-investments` loads for an authenticated user.
- [ ] User investment UI shows Participation state clearly.
- [ ] Rollover Intent controls render where applicable and do not crash when opened/closed.

### Admin Cycle Operations

- [ ] Admin cycles page loads.
- [ ] Seeded Planned Cycle is visible.
- [ ] Admin can inspect the Planned Cycle before opening.
- [ ] Open/settle action is reachable and guarded by the expected UI confirmation.
- [ ] After opening the Planned Cycle, UI shows the new Open Cycle state.
- [ ] Settlement Report panel appears after the lifecycle action.
- [ ] Settlement Report shows strict steps and recoverable steps distinctly.
- [ ] No Open Cycle Period copy/state is visible when settling without a successor in a dedicated smoke run.

### Admin Participation And Recovery

- [ ] Admin participations page loads.
- [ ] Pending, validated, refunded, payout, and rollover-linked Participations are distinguishable.
- [ ] Unmatched donations/payment inputs are visible.
- [ ] Payment Matching action is reachable.
- [ ] Manual validation action is reachable and updates visible Participation state.
- [ ] Refund action is reachable and displays refund state/amount after completion.
- [ ] Payout-sent action is reachable for `AWAITING_PAYOUT` rows.
- [ ] Recovery states remain inspectable after a recoverable Settlement Report failure.

### Admin Financial Pages

- [ ] Admin profit page loads.
- [ ] Profit summary shows values coherent with the seeded API acceptance math.
- [ ] Capital/NAV sections load without runtime errors.
- [ ] Transport fee list loads.
- [ ] Broker/relist fee UI is reachable from Cycle Lines or profit/admin context.
- [ ] Collateral recovery UI is reachable and labels recovery as income/negative fee behavior.
- [ ] Snapshot action is reachable.
- [ ] Snapshot history displays after a snapshot is created.

### JingleYield Pages

- [ ] Admin JingleYield page loads.
- [ ] Seeded active JingleYield Program is visible.
- [ ] Program row shows locked principal, cumulative interest, target progress, and min-cycle progress.
- [ ] Create JingleYield form renders and requires the expected user/cycle/admin-character inputs.
- [ ] User-facing JingleYield status/promotion area loads without runtime errors.

## Human Domain Signoff

These checks require business judgment from the domain owner. Browser automation can navigate and capture evidence, but the human confirms whether the displayed state is correct.

- [ ] Public overview wording and Cycle state match expected business language.
- [ ] User Participation statuses are understandable to a real investor.
- [ ] Rollover Intent labels match the intended choices: full payout, initial-only, and custom amount.
- [ ] Payment Matching distinguishes Participation payments from Transaction Allocation.
- [ ] Refund and payout follow-up states are clear enough for an admin to operate safely.
- [ ] Settlement Report wording makes strict vs recoverable failures operationally clear.
- [ ] JingleYield Program page treats JingleYield as first-class behavior, not just a normal Participation.
- [ ] Profit, NAV, payout, and snapshot numbers visually match the expected seeded money values.
- [ ] Admin can explain what action they would take for each imperfect/recovery state.
- [ ] No UI issue found would cause a wrong money movement decision.

Human signoff:

- Domain owner:
- Date:
- Seed/database used:
- Notes:

## Performance Smoke

This is a measured smoke check, not a hard benchmark. Record rough timings from browser navigation or DevTools/network timing.

Block only if a core page/action times out, crashes, or is slow enough to make the workflow unusable.

Suggested baseline log:

- [ ] `/tradecraft` overview: loads and stabilizes in a few seconds. Measured: . Notes:
- [ ] Cycle details: main Cycle data visible in a few seconds. Measured: . Notes:
- [ ] My investments: Participation state visible in a few seconds. Measured: . Notes:
- [ ] Admin cycles: Cycle list/actions visible in a few seconds. Measured: . Notes:
- [ ] Cycle Settlement action: completes or reports failure without timeout. Measured: . Notes:
- [ ] Admin participations: Participation table/actions visible in a few seconds. Measured: . Notes:
- [ ] Admin profit/capital: financial sections visible in a few seconds. Measured: . Notes:
- [ ] Admin JingleYield: program list visible in a few seconds. Measured: . Notes:

## Final Result

- [ ] Browser-automated smoke passed or failures are documented as non-blocking.
- [ ] Human domain signoff completed.
- [ ] Performance smoke found no unusable slowdown.
- [ ] Any live integration checks were run separately or consciously deferred.
- [ ] Branch is cleared for the final pre-main release gate.
