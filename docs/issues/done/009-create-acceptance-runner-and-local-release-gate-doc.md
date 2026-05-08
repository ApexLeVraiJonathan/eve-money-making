---
category: enhancement
state: resolved
---

# Create Acceptance Runner And Local Release Gate Doc

Type: AFK

## Parent

[`../prd/pre-main-tradecraft-acceptance-testing.md`](../prd/pre-main-tradecraft-acceptance-testing.md)

## What to build

Tie the technical commands, deterministic seeded acceptance pass, dirty-data smoke pass, browser smoke, performance smoke, and human signoff into one local release gate. This slice should make the final pre-main process repeatable and easy to run.

## Acceptance criteria

- [x] The release gate lists the exact commands for type-check, lint, build, and test.
- [x] The release gate documents how to run the canonical seeded acceptance pass.
- [x] The release gate documents how to run a separate dirty-data smoke pass.
- [x] The release gate documents browser smoke and performance smoke expectations.
- [x] The release gate includes final domain-owner signoff as an explicit step.
- [x] The release gate reports or records pass/fail state for each major section.
- [x] The release gate links back to the PRD, operational testing plan, and local issue set.
- [x] The process avoids starting dev servers automatically; it asks the user to run server commands when needed.

## Blocked by

- [`002-verify-cycle-lifecycle-and-settlement-report-acceptance.md`](002-verify-cycle-lifecycle-and-settlement-report-acceptance.md)
- [`003-verify-participation-caps-payment-matching-and-rollover-intent.md`](003-verify-participation-caps-payment-matching-and-rollover-intent.md)
- [`004-verify-admin-recovery-flows.md`](004-verify-admin-recovery-flows.md)
- [`005-verify-jingleyield-program-acceptance.md`](005-verify-jingleyield-program-acceptance.md)
- [`006-verify-financial-reporting-acceptance.md`](006-verify-financial-reporting-acceptance.md)
- [`007-verify-api-bff-shared-contract-gate.md`](007-verify-api-bff-shared-contract-gate.md)
- [`008-create-browser-smoke-and-human-signoff-checklist.md`](008-create-browser-smoke-and-human-signoff-checklist.md)
