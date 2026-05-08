---
category: enhancement
state: resolved
---

# Verify API/BFF/Shared-Contract Gate

Type: AFK

## Parent

[`../prd/pre-main-tradecraft-acceptance-testing.md`](../prd/pre-main-tradecraft-acceptance-testing.md)

## What to build

Add a lightweight gate that verifies the refactored API, BFF, web hooks, query keys, and shared contracts stay aligned. This slice should catch route or contract drift without introducing a heavier framework unless a real gap appears.

## Acceptance criteria

- [x] Shared request/response shapes used by both apps live in `packages/shared`.
- [x] Consumers import shared types through package exports, not source or build internals.
- [x] Browser-facing Tradecraft calls go through Next route handlers rather than direct Nest URLs.
- [x] Next route handlers proxy to the expected Nest routes for the acceptance surface.
- [x] Tradecraft hooks use query keys that match the affected resources.
- [x] Mutations invalidate or refetch the data needed for the relevant user/admin views.
- [x] Workspace type-check passes as part of the gate.
- [x] Any discovered contract gap is documented before adding heavier schema tooling.

## Blocked by

- [`001-create-canonical-tradecraft-acceptance-seed.md`](001-create-canonical-tradecraft-acceptance-seed.md)
