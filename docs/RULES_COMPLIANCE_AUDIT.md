# Rules Compliance Audit

This is a living audit for tracking where the codebase breaks project rules and how to prioritize refactoring work.

## Goal

- Make rule violations explicit and easy to triage.
- Drive refactoring by impact, not by random file edits.
- Keep a repeatable process for deep analysis across multiple passes.

## Scope

- Rules source: `.cursor/rules/*.mdc`
- Current active rules:
  - `core.mdc`
  - `types.mdc`
  - `nestjs.mdc`
  - `nextjs.mdc`
  - `api-contracts.mdc`
  - `prisma-db.mdc`

## Tracking System

- Canonical technical audit: this document.
- Operational hub (Notion): `https://www.notion.so/312cadbcdb7581aa858fe41556e87688`
- Issues data source id: `collection://4a0d1631-1590-489c-95e7-04c6ab29e426`
- Initiatives data source id: `collection://9f1a5d7b-aea7-4763-bc18-7acca42b8519`
- Accepted decision (contracts canonical): `https://www.notion.so/312cadbcdb75810aac95e86994943341`
- Baseline findings synced: `T-001..T-003`, `C-001..C-003`, `N-001..N-005`, `X-001..X-004`, `A-001..A-003`, `P-001..P-002`

## How To Use This Audit

- Add findings in the rule section where they belong.
- One finding should describe one concrete issue pattern, not a vague concern.
- Link all impacted files for each finding.
- Mark status:
  - `open`: not refactored
  - `planned`: accepted for an upcoming batch
  - `in-progress`: currently being fixed
  - `resolved`: fixed and verified
  - `accepted`: intentionally not fixing for now

## Severity Model

- `P0` - security, data corruption, or high risk runtime break
- `P1` - architecture drift causing frequent bugs or high change cost
- `P2` - maintainability debt with moderate day-to-day impact
- `P3` - style/convention drift with low immediate impact

## Iterative Analysis Workflow

### Pass 0 - Baseline (done)

- Fast pattern scan to identify obvious rule breaks.
- Output is broad and incomplete by design.

### Pass 1 - Structural scan (recommended next)

- Focus on architecture-level drift:
  - barrel exports
  - package boundary violations
  - controller/service layering violations
  - page/component structure violations
- Output should include counts and top hotspot files.

### Pass 2 - Contract and boundary deep dive

- Validate request/response contract ownership and consistency:
  - `packages/shared` vs `packages/api-contracts`
  - DTO runtime class usage
  - Prisma types crossing HTTP boundary
  - BFF boundaries in web app

### Pass 3 - Runtime behavior and risk review

- Focus on risky behavior:
  - `console.*` and error handling leakage
  - heavy synchronous flows and sequential async loops
  - oversized files with mixed responsibilities

### Pass 4 - Refactor planning pack

- Group findings into refactor batches:
  - quick wins (low risk, high clarity)
  - medium slices (single feature area)
  - large migrations (cross-package or cross-app)
- Add order, expected blast radius, and test strategy for each batch.

## Findings (Baseline)

## Rule: `types.mdc`

### Finding T-001

- **Status:** `open`
- **Severity:** `P1`
- **Issue:** Shared package still uses a barrel file, which is explicitly disallowed.
- **Evidence files:**
  - `packages/shared/src/index.ts`

### Finding T-002

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** App tsconfig deep aliases to `packages/shared/src/*` were removed; apps now resolve shared imports through package dependencies/exports.
- **Evidence files:**
  - `apps/api/tsconfig.json`
  - `apps/web/tsconfig.json`

### Finding T-003

- **Status:** `resolved`
- **Severity:** `P2`
- **Issue:** Shared contracts were decomposed from a monolithic `types/index.ts` into focused domain files under `packages/shared/src/types/` with `index.ts` reduced to a compatibility re-export surface.
- **Evidence files:**
  - `packages/shared/src/types/index.ts`
  - `packages/shared/src/types/cycles.ts`
  - `packages/shared/src/types/market-arbitrage.ts`
  - `packages/shared/src/types/strategy-lab.ts`

### Finding T-004

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** Shared export surface mismatch fixed by publishing `./skills` in `packages/shared` package `exports`.
- **Evidence files:**
  - `packages/shared/package.json`
  - `apps/api/src/skill-farm/skill-farm.service.ts`
  - `apps/web/app/characters/skills/page.tsx`

### Finding T-005

- **Status:** `resolved`
- **Severity:** `P2`
- **Issue:** Shared contract usage is now balanced in app source: both `apps/api` and `apps/web` consume `@eve/shared/*` contracts directly for feature request/response types.
- **Evidence files (sample):**
  - `apps/api/src/skill-farm/skill-farm.service.ts`
  - `apps/api/src/skill-plans/skill-plans.service.ts`
  - `apps/web/app/tradecraft/api/cycles/cycles.hooks.ts`
  - `apps/web/app/tradecraft/admin/arbitrage/page.tsx`

## Rule: `core.mdc`

### Finding C-001

- **Status:** `open`
- **Severity:** `P2`
- **Issue:** Broad barrel export usage across the repo conflicts with default no-barrel guidance.
- **Evidence files (sample):**
  - `apps/web/app/tradecraft/api/index.ts`
  - `packages/shared/src/index.ts`
  - `apps/api/libs/data-import/src/index.ts`

### Finding C-002

- **Status:** `open`
- **Severity:** `P1`
- **Issue:** Multiple oversized files exceed the rule threshold and mix concerns.
- **Evidence files (sample):**
  - `apps/api/src/characters/auth.controller.ts`
  - `apps/web/app/characters/page.tsx`
  - `apps/web/app/characters/skills/plans/page.tsx`

### Finding C-003

- **Status:** `open`
- **Severity:** `P2`
- **Issue:** Many sequential loops in service code suggest missed opportunities for batched parallelism where independent work exists.
- **Evidence files (sample):**
  - `apps/api/src/tradecraft/market/services/pricing.service.ts`
  - `apps/api/src/skill-plans/skill-plans.service.ts`
  - `apps/api/src/skill-farm/skill-farm.service.ts`

### Finding C-004

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** Deep `@eve/* -> packages/*/src/*` tsconfig aliases were removed from app tsconfigs and replaced with explicit workspace package dependencies.
- **Evidence files:**
  - `apps/api/tsconfig.json`
  - `apps/web/tsconfig.json`
  - `packages/shared/package.json`
  - `packages/api-client/package.json`
  - `packages/api-contracts/package.json`

## Rule: `nestjs.mdc`

### Finding N-001

- **Status:** `open`
- **Severity:** `P1`
- **Issue:** Controllers include direct Prisma and business logic, violating thin-controller guidance.
- **Evidence files:**
  - `apps/api/src/tradecraft/npc-market/npc-market.controller.ts`
  - `apps/api/src/tradecraft/self-market/self-market.controller.ts`
  - `apps/api/src/characters/auth.controller.ts`

### Finding N-002

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** API code uses `console.*` rather than Nest `Logger`.
- **Evidence files:**
  - `apps/api/src/characters/auth.controller.ts`
  - `apps/api/src/tradecraft/market/services/pricing.service.ts`

### Finding N-003

- **Status:** `open`
- **Severity:** `P2`
- **Issue:** Some DTO-like payloads are type aliases rather than runtime classes, and are imported with `import type`.
- **Evidence files:**
  - `apps/api/src/tradecraft/market/dto/liquidity-item.dto.ts`
  - `apps/api/src/tradecraft/market/liquidity.controller.ts`
  - `apps/api/src/tradecraft/market/services/liquidity.service.ts`

### Finding N-004

- **Status:** `open`
- **Severity:** `P2`
- **Issue:** Swagger response decorators are sparse across controllers.
- **Evidence files (sample):**
  - `apps/api/src/support/support.controller.ts` (has `@ApiResponse`)
  - Most other `*.controller.ts` files do not

### Finding N-005

- **Status:** `resolved`
- **Severity:** `P2`
- **Issue:** Swagger is mounted unconditionally instead of being dev-only by default.
- **Evidence files:**
  - `apps/api/src/main.ts`

### Finding N-006

- **Status:** `open`
- **Severity:** `P2`
- **Issue:** Config stack diverges from rule guidance: app uses custom `AppConfig` + dotenv bootstrap instead of `@nestjs/config` + `ConfigModule.forRoot(...)`.
- **Evidence files:**
  - `apps/api/src/main.ts`
  - `apps/api/src/app.module.ts`
  - `apps/api/src/common/config.ts`

### Finding N-007

- **Status:** `open`
- **Severity:** `P2`
- **Issue:** Some controller request payloads are inline object types (`@Body`/`@Query`) rather than DTO classes, reducing runtime validation/schema consistency.
- **Evidence files:**
  - `apps/api/src/character-management/character-management.controller.ts`
  - `apps/api/src/tradecraft/npc-market/npc-market.controller.ts`
  - `apps/api/src/tradecraft/self-market/self-market.controller.ts`
  - `apps/api/src/skill-plans/skill-plans.controller.ts`

### Finding N-008

- **Status:** `open`
- **Severity:** `P2`
- **Issue:** Job organization and trigger conventions diverge from the schedule section of the rule (`src/schedule/**` + POST manual run endpoints).
- **Evidence files:**
  - `apps/api/src/tradecraft/jobs/jobs.controller.ts`
  - `apps/api/src/tradecraft/jobs/jobs.module.ts`
  - `apps/api/src/tradecraft/jobs/market-gathering.job.ts`

## Rule: `nextjs.mdc`

### Finding X-001

- **Status:** `in-progress`
- **Severity:** `P1`
- **Issue:** Many `page.tsx` files are not yet composition-only. Initial migration pattern is in place: `page.tsx` as server wrapper and client-heavy UI moved to route `_components`.
- **Evidence files (sample):**
  - `apps/web/app/account-settings/page.tsx`
  - `apps/web/app/account-settings/_components/account-settings-page-client.tsx`
  - `apps/web/app/tradecraft/cycles/page.tsx`
  - `apps/web/app/tradecraft/cycles/_components/cycles-overview-page-client.tsx`
  - `apps/web/app/tradecraft/admin/arbitrage/page.tsx`
  - `apps/web/app/tradecraft/admin/arbitrage/_components/arbitrage-page-client.tsx`
  - `apps/web/app/tradecraft/admin/arbitrage/_components/sections/arbitrage-parameters-card.tsx`
  - `apps/web/app/tradecraft/admin/arbitrage/_components/sections/arbitrage-results-section.tsx`
  - `apps/web/app/tradecraft/admin/undercut-checker/page.tsx`
  - `apps/web/app/tradecraft/admin/undercut-checker/_components/undercut-checker-page-client.tsx`
  - `apps/web/app/tradecraft/admin/undercut-checker/_components/sections/undercut-config-card.tsx`
  - `apps/web/app/tradecraft/admin/undercut-checker/_components/sections/undercut-results-section.tsx`
  - `apps/web/app/tradecraft/admin/profit/page.tsx`
  - `apps/web/app/tradecraft/admin/profit/_components/cycle-profit-page-client.tsx`
  - `apps/web/app/tradecraft/admin/profit/_components/sections/profit-statement-section.tsx`
  - `apps/web/app/tradecraft/admin/sell-appraiser/page.tsx`
  - `apps/web/app/tradecraft/admin/sell-appraiser/_components/sell-appraiser-page-client.tsx`
  - `apps/web/app/tradecraft/admin/sell-appraiser/_components/sections/sell-appraiser-config-card.tsx`
  - `apps/web/app/tradecraft/admin/sell-appraiser/_components/sections/sell-appraiser-results-section.tsx`
  - `apps/web/app/tradecraft/admin/cycleintel/page.tsx`
  - `apps/web/app/tradecraft/admin/cycleintel/_components/cycle-intel-page-client.tsx`
  - `apps/web/app/tradecraft/admin/cycleintel/_components/sections/intel-sections.tsx`
  - `apps/web/app/tradecraft/admin/cycleintel/_components/tables/intel-tables.tsx`
  - `apps/web/app/tradecraft/admin/packages/page.tsx`
  - `apps/web/app/tradecraft/admin/packages/_components/packages-page-client.tsx`
  - `apps/web/app/tradecraft/admin/packages/_components/sections/packages-list-section.tsx`
  - `apps/web/app/tradecraft/admin/packages/_components/sections/mark-failed-dialog.tsx`
  - `apps/web/app/tradecraft/admin/participations/page.tsx`
  - `apps/web/app/tradecraft/admin/participations/_components/participations-page-client.tsx`
  - `apps/web/app/tradecraft/admin/participations/_components/sections/participants-overview-card.tsx`
  - `apps/web/app/tradecraft/admin/participations/_components/sections/manual-matching-card.tsx`
  - `apps/web/app/tradecraft/admin/participations/_components/sections/refunds-card.tsx`
  - `apps/web/app/tradecraft/admin/participations/_components/sections/payouts-card.tsx`
  - `apps/web/app/tradecraft/admin/users/page.tsx`
  - `apps/web/app/tradecraft/admin/users/_components/tradecraft-users-admin-page-client.tsx`
  - `apps/web/app/tradecraft/admin/users/_components/sections/manage-caps-card.tsx`
  - `apps/web/app/tradecraft/admin/triggers/page.tsx`
  - `apps/web/app/tradecraft/admin/triggers/_components/triggers-page-client.tsx`
  - `apps/web/app/tradecraft/admin/cycles/page.tsx`
  - `apps/web/app/tradecraft/admin/cycles/_components/cycles-page-client.tsx`
  - `apps/web/app/tradecraft/admin/cycles/_components/sections/cycles-list-card.tsx`
  - `apps/web/app/tradecraft/admin/cycles/_components/sections/cycle-creation-card.tsx`
  - `apps/web/app/tradecraft/admin/cycles/_components/sections/capital-card.tsx`
  - `apps/web/app/tradecraft/admin/jingle-yield/page.tsx`
  - `apps/web/app/tradecraft/admin/jingle-yield/_components/jingle-yield-admin-page-client.tsx`
  - `apps/web/app/tradecraft/admin/jingle-yield/_components/sections/jingle-yield-create-card.tsx`
  - `apps/web/app/tradecraft/admin/jingle-yield/_components/sections/jingle-yield-programs-card.tsx`
  - `apps/web/app/tradecraft/admin/self-market/page.tsx`
  - `apps/web/app/tradecraft/admin/self-market/_components/sections/type-orders-expanded.tsx`
  - `apps/web/app/tradecraft/admin/self-market/_components/sections/npc-type-orders-expanded.tsx`
  - `apps/web/app/tradecraft/admin/self-market/_components/self-market-page-client.tsx`
  - `apps/web/app/tradecraft/admin/self-market/_components/sections/cn-market-tab.tsx`
  - `apps/web/app/tradecraft/admin/self-market/_components/sections/rens-market-tab.tsx`
  - `apps/web/app/tradecraft/admin/strategy-lab/[runId]/page.tsx`
  - `apps/web/app/tradecraft/admin/strategy-lab/[runId]/_components/strategy-run-detail-page-client.tsx`
  - `apps/web/app/tradecraft/admin/strategy-lab/page.tsx`
  - `apps/web/app/tradecraft/admin/strategy-lab/_components/strategy-lab-page-client.tsx`
  - `apps/web/app/tradecraft/admin/strategy-lab/_components/sections/strategy-params-dialog.tsx`
  - `apps/web/app/tradecraft/admin/planner/page.tsx`
  - `apps/web/app/tradecraft/admin/planner/_components/planner-page-client.tsx`
  - `apps/web/app/tradecraft/admin/planner/_components/sections/planner-results-section.tsx`
  - `apps/web/app/tradecraft/admin/liquidity/page.tsx`
  - `apps/web/app/tradecraft/admin/liquidity/_components/liquidity-page-client.tsx`
  - `apps/web/app/tradecraft/admin/liquidity/_components/sections/station-liquidity-tab.tsx`
  - `apps/web/app/tradecraft/admin/liquidity/_components/sections/item-liquidity-stats-tab.tsx`
  - `apps/web/app/settings/notifications/page.tsx`
  - `apps/web/app/settings/notifications/_components/notification-settings-page-client.tsx`
  - `apps/web/app/settings/notifications/_components/sections/preferences-group-card.tsx`
  - `apps/web/app/tradecraft/lib/station-sorting.ts`
  - `apps/web/app/characters/page.tsx`
  - `apps/web/app/characters/skills/page.tsx`
  - `apps/web/app/characters/skills/browser/page.tsx`
  - `apps/web/app/characters/skills/browser/_components/skill-browser-page-client.tsx`
  - `apps/web/app/characters/skills/plans/page.tsx`
  - `apps/web/app/characters/skills/plans/_components/skill-plans-page-client.tsx`
  - `apps/web/app/characters/skill-farms/characters/page.tsx`
  - `apps/web/app/characters/skill-farms/characters/_components/skill-farm-characters-page-client.tsx`
  - `apps/web/app/characters/skill-farms/tracking/page.tsx`
  - `apps/web/app/characters/skill-farms/tracking/_components/skill-farm-tracking-page-client.tsx`
  - `apps/web/app/characters/skill-farms/math/page.tsx`
  - `apps/web/app/characters/skill-farms/math/_components/skill-farm-math-page-client.tsx`
  - `apps/web/app/tradecraft/cycle-history/page.tsx`
  - `apps/web/app/tradecraft/cycle-history/_components/cycle-history-page-client.tsx`
  - `apps/web/app/tradecraft/cycle-details/page.tsx`
  - `apps/web/app/tradecraft/cycle-details/_components/cycle-details-page-client.tsx`
  - `apps/web/app/tradecraft/my-investments/page.tsx`
  - `apps/web/app/tradecraft/my-investments/_components/my-investments-page-client.tsx`
  - `apps/web/app/tradecraft/cycles/[cycleId]/lines/page.tsx`
  - `apps/web/app/tradecraft/cycles/[cycleId]/lines/_components/cycle-lines-page-client.tsx`
  - `apps/web/app/tradecraft/cycles/[cycleId]/profit/page.tsx`
  - `apps/web/app/tradecraft/cycles/[cycleId]/profit/_components/cycle-profit-page-client.tsx`
  - `apps/web/app/skill-issue/page.tsx`
  - `apps/web/app/skill-issue/_components/skill-issue-page-client.tsx`
  - `apps/web/app/brokerage/consignments/page.tsx`
  - `apps/web/app/brokerage/consignments/_components/consignments-page-client.tsx`
  - `apps/web/app/brokerage/consignments/new/page.tsx`
  - `apps/web/app/brokerage/consignments/new/_components/new-consignment-page-client.tsx`
  - `apps/web/app/brokerage/consignments/details/page.tsx`
  - `apps/web/app/brokerage/consignments/details/_components/consignment-details-page-client.tsx`

### Finding X-002

- **Status:** `in-progress`
- **Severity:** `P2`
- **Issue:** Route-level `_components` structure was introduced and is now used in migrated routes; adoption is still partial across the app tree.
- **Evidence files:**
  - `apps/web/app/account-settings/_components/account-settings-page-client.tsx`
  - `apps/web/app/tradecraft/cycles/_components/cycles-overview-page-client.tsx`
  - `apps/web/app/tradecraft/admin/arbitrage/_components/arbitrage-page-client.tsx`
  - `apps/web/app/tradecraft/admin/liquidity/_components/liquidity-page-client.tsx`
  - `apps/web/app/tradecraft/admin/undercut-checker/_components/undercut-checker-page-client.tsx`
  - `apps/web/app/tradecraft/admin/profit/_components/cycle-profit-page-client.tsx`
  - `apps/web/app/tradecraft/admin/sell-appraiser/_components/sell-appraiser-page-client.tsx`
  - `apps/web/app/tradecraft/admin/cycleintel/_components/cycle-intel-page-client.tsx`
  - `apps/web/app/tradecraft/admin/packages/_components/packages-page-client.tsx`
  - `apps/web/app/tradecraft/admin/participations/_components/participations-page-client.tsx`
  - `apps/web/app/tradecraft/admin/users/_components/tradecraft-users-admin-page-client.tsx`
  - `apps/web/app/tradecraft/admin/triggers/_components/triggers-page-client.tsx`
  - `apps/web/app/tradecraft/admin/cycles/_components/cycles-page-client.tsx`
  - `apps/web/app/tradecraft/admin/jingle-yield/_components/jingle-yield-admin-page-client.tsx`
  - `apps/web/app/tradecraft/admin/self-market/_components/sections/type-orders-expanded.tsx`
  - `apps/web/app/tradecraft/admin/strategy-lab/[runId]/_components/strategy-run-detail-page-client.tsx`
  - `apps/web/app/tradecraft/admin/self-market/_components/self-market-page-client.tsx`
  - `apps/web/app/tradecraft/admin/strategy-lab/_components/strategy-lab-page-client.tsx`
  - `apps/web/app/tradecraft/admin/planner/_components/planner-page-client.tsx`
  - `apps/web/app/settings/notifications/_components/notification-settings-page-client.tsx`
  - `apps/web/app/characters/skills/browser/_components/skill-browser-page-client.tsx`
  - `apps/web/app/characters/skills/plans/_components/skill-plans-page-client.tsx`
  - `apps/web/app/characters/skill-farms/characters/_components/skill-farm-characters-page-client.tsx`
  - `apps/web/app/characters/skill-farms/tracking/_components/skill-farm-tracking-page-client.tsx`
  - `apps/web/app/characters/skill-farms/math/_components/skill-farm-math-page-client.tsx`
  - `apps/web/app/tradecraft/cycle-history/_components/cycle-history-page-client.tsx`
  - `apps/web/app/tradecraft/cycle-details/_components/cycle-details-page-client.tsx`
  - `apps/web/app/tradecraft/my-investments/_components/my-investments-page-client.tsx`
  - `apps/web/app/tradecraft/cycles/[cycleId]/lines/_components/cycle-lines-page-client.tsx`
  - `apps/web/app/tradecraft/cycles/[cycleId]/profit/_components/cycle-profit-page-client.tsx`
  - `apps/web/app/skill-issue/_components/skill-issue-page-client.tsx`
  - `apps/web/app/characters/_components/characters-page-client.tsx`
  - `apps/web/app/characters/skills/_components/skills-page-client.tsx`
  - `apps/web/app/brokerage/consignments/_components/consignments-page-client.tsx`
  - `apps/web/app/brokerage/consignments/new/_components/new-consignment-page-client.tsx`
  - `apps/web/app/brokerage/consignments/details/_components/consignment-details-page-client.tsx`

### Finding X-003

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** Server-first wrappers are now applied across `apps/web/app/**/page.tsx`; route client logic lives in route-local `_components` files.
- **Evidence files (sample):**
  - `apps/web/app/account-settings/page.tsx`
  - `apps/web/app/tradecraft/cycles/page.tsx`
  - `apps/web/app/tradecraft/admin/arbitrage/page.tsx`
  - `apps/web/app/tradecraft/admin/undercut-checker/page.tsx`
  - `apps/web/app/tradecraft/admin/profit/page.tsx`
  - `apps/web/app/tradecraft/admin/sell-appraiser/page.tsx`
  - `apps/web/app/tradecraft/admin/cycleintel/page.tsx`
  - `apps/web/app/tradecraft/admin/packages/page.tsx`
  - `apps/web/app/tradecraft/admin/participations/page.tsx`
  - `apps/web/app/tradecraft/admin/users/page.tsx`
  - `apps/web/app/tradecraft/admin/triggers/page.tsx`
  - `apps/web/app/tradecraft/admin/cycles/page.tsx`
  - `apps/web/app/tradecraft/admin/jingle-yield/page.tsx`
  - `apps/web/app/tradecraft/admin/self-market/page.tsx`
  - `apps/web/app/tradecraft/admin/strategy-lab/[runId]/page.tsx`
  - `apps/web/app/tradecraft/admin/strategy-lab/page.tsx`
  - `apps/web/app/tradecraft/admin/planner/page.tsx`
  - `apps/web/app/settings/notifications/page.tsx`
  - `apps/web/app/characters/page.tsx`
  - `apps/web/app/characters/skills/page.tsx`
  - `apps/web/app/characters/skills/browser/page.tsx`
  - `apps/web/app/characters/skills/plans/page.tsx`
  - `apps/web/app/characters/skill-farms/characters/page.tsx`
  - `apps/web/app/characters/skill-farms/tracking/page.tsx`
  - `apps/web/app/characters/skill-farms/math/page.tsx`
  - `apps/web/app/tradecraft/cycle-history/page.tsx`
  - `apps/web/app/tradecraft/cycle-details/page.tsx`
  - `apps/web/app/tradecraft/my-investments/page.tsx`
  - `apps/web/app/tradecraft/cycles/[cycleId]/lines/page.tsx`
  - `apps/web/app/tradecraft/cycles/[cycleId]/profit/page.tsx`
  - `apps/web/app/skill-issue/page.tsx`
  - `apps/web/app/brokerage/consignments/page.tsx`
  - `apps/web/app/brokerage/consignments/new/page.tsx`
  - `apps/web/app/brokerage/consignments/details/page.tsx`

### Finding X-004

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** Browser API traffic no longer depends on a public backend origin variable; web client uses app-scoped Next BFF routes and backend origin is server-side (`API_URL` / `API_BASE_URL`).
- **Evidence files:**
  - `packages/api-client/src/index.ts`
  - `apps/web/app/api/core/[...path]/route.ts`
  - `apps/web/app/api/tradecraft/[...path]/route.ts`
  - `apps/web/app/api/characters/[...path]/route.ts`
  - `apps/web/next.config.ts`

### Finding X-005

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** Next BFF coverage now uses app-scoped catch-all routes by app/domain (`tradecraft`, `characters`, `core`) instead of a generic fallback proxy.
- **Evidence files:**
  - `apps/web/app/api/tradecraft/[...path]/route.ts`
  - `apps/web/app/api/characters/[...path]/route.ts`
  - `apps/web/app/api/core/[...path]/route.ts`
  - `apps/web/app/api/auth/login/user/route.ts`

### Finding X-006

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** Feature data hooks in browser now route through Next handler boundaries by default (`clientForApp(appId)` -> `/api/<app>/*` in browser runtime), avoiding direct browser-to-backend calls.
- **Evidence files (sample):**
  - `apps/web/app/api-hooks/useApiClient.ts`
  - `packages/api-client/src/index.ts`
  - `apps/web/app/api/tradecraft/[...path]/route.ts`
  - `apps/web/app/tradecraft/api/cycles/cycles.hooks.ts`

### Finding X-007

- **Status:** `resolved`
- **Severity:** `P2`
- **Issue:** Route-level UX boundary files are missing (`loading.tsx`, `error.tsx`, `not-found.tsx`), indicating route error/loading handling is not using Next boundary conventions.
- **Evidence files:**
  - No matches under `apps/web/app/**/loading.tsx`
  - No matches under `apps/web/app/**/error.tsx`
  - No matches under `apps/web/app/**/not-found.tsx`

## Rule: `api-contracts.mdc`

### Finding A-001

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** Contract ownership for app TypeScript request/response shapes was consolidated to `packages/shared`; `packages/api-contracts` is now a runtime-schema/tooling placeholder and no longer an app contract source.
- **Evidence files:**
  - `packages/shared/src/skill-contracts.ts`
  - `packages/api-contracts/src/index.ts`
  - `apps/api/package.json`
  - `apps/web/package.json`

### Finding A-002

- **Status:** `resolved`
- **Severity:** `P2`
- **Issue:** App-local API request/response contract shapes in active API hook/client layers were consolidated into `packages/shared` modules (`character-management`, `notifications`, `tradecraft-market`, `parameter-profiles`, `tradecraft-ops`, `tradecraft-participations`, `tradecraft-strategy-lab`, `tradecraft-data-ops`, `tradecraft-cycles`, `tradecraft-arbitrage`, `skill-contracts`, and `support-feedback`).
- **Evidence files (sample):**
  - `apps/web/app/tradecraft/api/cycles/cycles.hooks.ts`
  - `apps/web/app/tradecraft/api/market/arbitrage.hooks.ts`
  - `apps/web/app/characters/skills/api.ts`
  - `packages/shared/src/skill-contracts.ts`

### Finding A-003

- **Status:** `open`
- **Severity:** `P2`
- **Issue:** Web API routes do not yet show a clean one-feature-to-one-catchall route handler mapping pattern.
- **Evidence files (sample):**
  - `apps/web/app/api/auth/login/user/route.ts`
  - `apps/web/app/api/auth/login/admin/route.ts`
  - `apps/web/app/api/auth/link-character/start/route.ts`

### Finding A-004

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** Same contract names were defined in multiple places with divergent shapes (example: `CharacterOverviewResponse`), creating silent drift risk.
- **Evidence files:**
  - `packages/shared/src/character-management.ts`
  - `packages/api-contracts/src/index.ts`
  - `apps/web/app/characters/api.ts`

### Finding A-005

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** Contract source usage was unified so app code (`apps/web` and `apps/api`) now consumes shared contracts from `@eve/shared/*` subpath exports; local inline response contracts were removed from API client calls.
- **Evidence files (sample):**
  - `apps/web/app/characters/api.ts`
  - `apps/web/app/characters/skills/page.tsx`
  - `apps/api/src/skill-farm/skill-farm.service.ts`
  - `apps/api/src/skill-plans/skill-plans.service.ts`

### Finding A-006

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** Governance is now aligned: app contract imports are standardized on `@eve/shared/*`, and `@eve/api-contracts` is reserved for runtime contract tooling artifacts only.
- **Evidence files:**
  - `.cursor/rules/api-contracts.mdc`
  - `packages/api-contracts/src/index.ts`
  - `apps/api/package.json`
  - `apps/web/package.json`

## Rule: `prisma-db.mdc`

### Finding P-001

- **Status:** `resolved`
- **Severity:** `P3`
- **Issue:** Rule path alignment was fixed to target `packages/prisma/**` and matching doc references.
- **Evidence files:**
  - `.cursor/rules/prisma-db.mdc`
  - `packages/prisma/prisma.config.ts`

### Finding P-002

- **Status:** `accepted`
- **Severity:** `P3`
- **Issue:** Prisma v7 datasource URL handling appears compliant (tracked for confirmation only).
- **Evidence files:**
  - `packages/prisma/prisma.config.ts`
  - `packages/prisma/schema.prisma`

## Refactor Execution Plan (V1)

This plan sequences work by dependency and blast radius so we can make progress safely.

## Batch 0 - Governance lock (already decided)

- **Goal:** Freeze contract direction before deep code moves.
- **Decision:** `packages/shared` is canonical for cross-app contracts (accepted).
- **Tracking link:** `https://www.notion.so/312cadbcdb75810aac95e86994943341`
- **Findings covered:** `A-006` (policy alignment anchor), supports all contract-related work.

## Batch 1 - Quick Wins (low-risk, high-signal)

- **Target findings:** `N-002`, `N-005`, `X-007`, `P-001`
- **Scope:**
  - Replace API `console.*` with Nest `Logger`
  - Gate Swagger by env (dev default, prod opt-in)
  - Add route-level `loading.tsx` / `error.tsx` / `not-found.tsx` where most impactful
  - Align Prisma rule path naming with actual repo layout
- **Expected impact:** Better operational safety and clearer rule compliance with minimal architecture churn.
- **Validation:**
  - API boots and docs route behavior matches env
  - No regressions in existing API/web smoke flows

## Batch 2 - Package Boundary Hardening

- **Target findings:** `C-004`, `T-002`, `T-004`
- **Scope:**
  - Stop relying on `packages/*/src/*` aliases from app tsconfigs
  - Enforce package `exports` as the public contract surface
  - Publish missing shared subpath exports required by current usage (or migrate usage)
- **Expected impact:** Stronger package contracts, fewer hidden coupling paths.
- **Validation:**
  - Typecheck/build succeeds without `src/*` deep alias reliance
  - Imports resolve through package exports only

## Batch 3 - Contract Consolidation (canonical shared contracts)

- **Target findings:** `A-001`, `A-004`, `A-005`, `T-005`, `T-003`
- **Scope:**
  - Deduplicate same-meaning types to one canonical contract in `packages/shared`
  - Remove or narrow local response/request types in app layers
  - Rationalize `packages/api-contracts` role so it does not compete as a second TS source of truth
- **Expected impact:** Lower drift risk and clearer API boundary ownership.
- **Validation:**
  - Contract name appears in only one canonical location
  - API and web compile against shared contracts without local duplicates

## Batch 4 - Next.js BFF and Page Architecture

- **Target findings:** `X-005`, `X-006`, `X-001`, `X-002`, `X-003`, `X-004`
- **Scope:**
  - Introduce feature-level route handler proxies (catch-all where appropriate)
  - Move browser data access to `/api/*` boundary
  - Break heavy `page.tsx` files into route-scoped components and reduce client-only pages
- **Expected impact:** Better frontend maintainability and cleaner browser/backend boundary.
- **Validation:**
  - Browser traffic to backend goes through Next routes
  - Largest page hotspots shrink and remain behaviorally equivalent

## Batch 5 - NestJS Controller/DTO/Jobs Alignment

- **Target findings:** `N-001`, `N-003`, `N-004`, `N-006`, `N-007`, `N-008`
- **Scope:**
  - Move Prisma/business logic out of controllers into services
  - Replace inline payload typings with DTO classes where runtime validation/docs matter
  - Improve Swagger response metadata coverage
  - Align jobs structure and manual trigger conventions with agreed rule direction
- **Expected impact:** Clearer module boundaries and more predictable API behavior/docs.
- **Validation:**
  - Controller surface is thin; service tests cover moved logic
  - Swagger docs are coherent and endpoint metadata is explicit

## Cross-Batch Risks

- Contract migration (`Batch 3`) and BFF migration (`Batch 4`) can touch many files and should be sliced by feature.
- Large-file refactors should preserve API/UX behavior; prefer incremental PRs by domain.

## Recommended Implementation Order

- Batch 1 -> Batch 2 -> Batch 3 -> Batch 4 -> Batch 5
- Rationale:
  - Quick wins reduce noise first
  - Package boundaries must stabilize before contract consolidation
  - Contract model should be stable before full BFF/page architecture migration

## Next Audit Session Template

- **Session date:** TBD
- **Pass type:** Pass 1 / Pass 2 / Pass 3 / Pass 4
- **Rules analyzed this session:**
  - `...`
- **New findings added:** `...`
- **Findings status changes:** `...`
- **Open questions for user:** `...`

