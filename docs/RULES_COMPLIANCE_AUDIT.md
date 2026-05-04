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
  - `notion-project-ops.mdc`

## Tracking System

- Canonical technical audit: this document.
- Operational hub (Notion): `https://www.notion.so/312cadbcdb7581aa858fe41556e87688`
- Issues data source id: `collection://4a0d1631-1590-489c-95e7-04c6ab29e426`
- Initiatives data source id: `collection://9f1a5d7b-aea7-4763-bc18-7acca42b8519`
- Accepted decision (contracts canonical): `https://www.notion.so/312cadbcdb75810aac95e86994943341`
- Baseline findings synced: `T-001..T-003`, `C-001..C-003`, `N-001..N-005`, `X-001..X-004`, `A-001..A-003`, `P-001..P-002`
- Additional findings synced: `T-004..T-005`, `C-004`, `N-006..N-008`, `X-005..X-007`, `A-004..A-006`

## Current Recovery Snapshot

- **Branch:** `rules-refactor`
- **Last known stopping point:** Batch 8, after removing retired skill-farm, skill-issue, and user-owned skill-plan products while preserving Tradecraft and character-management.
- **Repo/Notion drift to reconcile:** Notion and this audit both contain resolved contract findings, but some stale evidence and issue statuses lag the current code. Keep this document as the technical source of truth and sync Notion after each verified slice.
- **Documentation cleanup posture:** Conservative. Keep `docs/old` as archive material unless a document or code path is proven stale, unreferenced, and safe to remove.
- **Recovery verification:** Batch 8 full verification passed: `pnpm type-check`, `pnpm lint`, `pnpm test:api`, `pnpm test:web`, and `pnpm build`. Batch 9 cleanup and lint-warning cleanup now pass `pnpm lint`, `pnpm type-check`, and the full API Jest suite.
- **Notion sync:** Batch 6 changelog entry created after Strategy Lab removal and pricing structure-market extraction; Batch 7 changelog entry created after Skill Farm tracking/notification async cleanup; Batch 8 changelog entry created after retired skill product removal and merge hardening; Batch 9 and lint-cleanup changelog entries created after final cleanup verification.
- **Next recommended work:** After Batch 9 and lint cleanup, avoid new feature refactors until the removal migration and product-scope change are reviewed for deployment impact.

## Batch 8 Notes - Skill Product Removal

- Removed retired `skill-farm`, `skill-issue`, and user-owned `skill-plans` API/web product surfaces.
- Preserved character-domain skill training and browser functionality by moving catalog/encyclopedia reads to `apps/api/src/game-data`.
- Added destructive migration `packages/prisma/migrations/20260504030500_remove_skill_products/migration.sql`; it intentionally drops skill farm/settings/configs and user-owned skill plan tables and prunes retired notification enum values.
- Kept `SkillDefinition` and SDE import support because the skill browser depends on them.
- Completed merge-hardening items: removed public `POST /auth/link-character`, sanitized Discord OAuth return URLs, restored GET aliases for Tradecraft job endpoints, and clamped market DTO limits before validation.

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

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** Shared package root barrel was removed; shared contracts are exposed through explicit `@eve/shared/*` subpath exports only.
- **Evidence files:**
  - `packages/shared/package.json`
  - `packages/shared/README.md`

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
- **Issue:** Shared contracts were decomposed from a monolithic `types/index.ts` into focused domain files and public package subpath exports. The temporary compatibility barrel was removed once unused.
- **Evidence files:**
  - `packages/shared/src/types/cycles.ts`
  - `packages/shared/src/types/market-arbitrage.ts`
  - `packages/shared/src/types/pricing.ts`
  - `packages/shared/package.json`

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

- **Status:** `in-progress`
- **Severity:** `P2`
- **Issue:** Broad barrel export usage was narrowed in app/shared contract surfaces. Remaining `index.ts` files are package entrypoints, local test helper entrypoints, or route-local convenience exports that need case-by-case review before removal.
- **Evidence files (sample):**
  - `apps/web/app/tradecraft/api/index.ts`
  - `packages/ui/src/index.ts`
  - `packages/eve-core/src/index.ts`
  - `apps/api/libs/data-import/src/index.ts`
  - `apps/api/libs/arbitrage-packager/src/index.ts`

### Finding C-002

- **Status:** `in-progress`
- **Severity:** `P1`
- **Issue:** Multiple oversized files exceed the rule threshold and mix concerns. Batch 6 removed the retired Strategy Lab feature instead of splitting it, extracted C-N/self-market structure pricing support from `PricingService`, and Batch 9 split NPC market daily aggregate/comparison reads out of `NpcMarketQueryService`. Remaining large services should be split opportunistically when the boundary is clear and covered by tests; Auth remains deferred because it delegates Prisma persistence and mainly coordinates OAuth/cookies/responses.
- **Evidence files (priority order):**
  - `packages/prisma/migrations/20260504010500_remove_strategy_lab/migration.sql`
  - `apps/api/src/tradecraft/market/services/pricing.service.ts`
  - `apps/api/src/tradecraft/market/services/structure-market-pricing.service.ts`
  - `apps/api/src/tradecraft/npc-market/npc-market-aggregates.service.ts`
  - `apps/api/src/tradecraft/npc-market/npc-market-comparison.service.ts`
  - `apps/api/src/tradecraft/cycles/services/cycle.service.ts`
  - `apps/api/src/game-data/services/import.service.ts`
  - `apps/api/src/characters/auth.controller.ts`

### Finding C-003

- **Status:** `open`
- **Severity:** `P2`
- **Issue:** Many sequential loops in service code suggest missed opportunities for batched parallelism where independent work exists. Batch 7 closed the low-risk Skill Farm slice before the skill products were retired in Batch 8. Remaining `C-003` work should be targeted to active tradecraft/character services where independence is clear and tests can pin behavior.
- **Evidence files (sample):**
  - `apps/api/src/tradecraft/cycles/services/cycle.service.ts`
  - `apps/api/src/tradecraft/wallet/services/wallet.service.ts`

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

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** Known direct Prisma/business logic was moved out of Batch 5 controllers. Market read logic now lives in focused query services, and `auth.controller.ts` no longer injects `PrismaService`; OAuth state and character/token persistence are delegated to character auth services.
- **Evidence files:**
  - `apps/api/src/tradecraft/npc-market/npc-market-query.service.ts`
  - `apps/api/src/tradecraft/self-market/self-market-query.service.ts`
  - `apps/api/src/characters/services/oauth-state.service.ts`
  - `apps/api/src/characters/services/auth.service.ts`
  - `apps/api/src/characters/auth.controller.ts`

### Finding N-002

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** Runtime API source under `apps/api/src` no longer uses `console.*`; remaining API-package console output is limited to manual scripts/test runners where stdout/stderr is intentional CLI UX rather than Nest runtime logging.
- **Evidence files:**
  - `apps/api/src`
  - `apps/api/scripts/tests/participation-rollover/participation-rollover.suite.ts`
  - `apps/api/scripts/tests/jingle-yield/jingle-yield.suite.ts`

### Finding N-003

- **Status:** `resolved`
- **Severity:** `P2`
- **Issue:** Liquidity response DTOs now use runtime classes with Swagger metadata. Service-only type imports may remain where the class is used only as a TypeScript shape, but controllers no longer import this boundary DTO as a type-only alias.
- **Evidence files:**
  - `apps/api/src/tradecraft/market/dto/liquidity-item.dto.ts`
  - `apps/api/src/tradecraft/market/liquidity.controller.ts`

### Finding N-004

- **Status:** `in-progress`
- **Severity:** `P2`
- **Issue:** Targeted Swagger success response metadata was added to the Batch 5 touched controllers, and Batch 6 extended useful response metadata across high-value controllers. Broad all-controller response schema annotation remains regular follow-up work rather than a blocker for the current refactor slice.
- **Evidence files (sample):**
  - `apps/api/src/tradecraft/npc-market/npc-market.controller.ts`
  - `apps/api/src/tradecraft/self-market/self-market.controller.ts`
  - `apps/api/src/tradecraft/market/liquidity.controller.ts`
  - `apps/api/src/tradecraft/jobs/jobs.controller.ts`
  - `apps/api/src/tradecraft/cycles/cycles.controller.ts`
  - `apps/api/src/characters/auth.controller.ts`
  - `apps/api/src/notifications/notifications.controller.ts`
  - `apps/api/src/characters/users.controller.ts`
  - `apps/api/src/character-management/character-management.controller.ts`
  - `apps/api/src/skill-plans/skill-plans.controller.ts`
  - `apps/api/src/skill-farm/skill-farm.controller.ts`

### Finding N-005

- **Status:** `resolved`
- **Severity:** `P2`
- **Issue:** Swagger is mounted unconditionally instead of being dev-only by default.
- **Evidence files:**
  - `apps/api/src/main.ts`

### Finding N-006

- **Status:** `accepted-deferred`
- **Severity:** `P2`
- **Issue:** Config stack diverges from rule guidance: app uses custom `AppConfig` + dotenv bootstrap instead of `@nestjs/config` + `ConfigModule.forRoot(...)`. Decision for Batch 5: keep `AppConfig` and existing startup validation for now because the current app is small, env validation already exists, and a full `ConfigService` migration would be broad churn without immediate product value.
- **Evidence files:**
  - `apps/api/src/main.ts`
  - `apps/api/src/app.module.ts`
  - `apps/api/src/common/config.ts`

### Finding N-007

- **Status:** `resolved`
- **Severity:** `P2`
- **Issue:** Inline controller `@Body`/`@Query` object types were replaced with DTO classes in the scanned controller set, including the later-discovered NPC market query objects.
- **Evidence files:**
  - `apps/api/src/character-management/character-management.controller.ts`
  - `apps/api/src/tradecraft/npc-market/npc-market.controller.ts`
  - `apps/api/src/tradecraft/self-market/self-market.controller.ts`
  - `apps/api/src/skill-plans/skill-plans.controller.ts`
  - `apps/api/src/tradecraft/npc-market/dto/npc-market.dto.ts`
  - `apps/api/src/tradecraft/market/dto/self-market.dto.ts`
  - `apps/api/src/character-management/dto/character-management.dto.ts`
  - `apps/api/src/skill-plans/dto/skill-plans.dto.ts`

### Finding N-008

- **Status:** `resolved`
- **Severity:** `P2`
- **Issue:** Manual job trigger endpoints now use protected `POST` routes. Decision for Batch 5: keep the current feature-local `apps/api/src/tradecraft/jobs/**` module as an accepted small-app exception rather than moving the whole scheduler to `src/schedule/**`.
- **Evidence files:**
  - `apps/api/src/tradecraft/jobs/jobs.controller.ts`
  - `apps/api/src/tradecraft/jobs/jobs.module.ts`
  - `apps/api/src/tradecraft/jobs/market-gathering.job.ts`

## Rule: `nextjs.mdc`

### Finding X-001

- **Status:** `resolved`
- **Severity:** `P1`
- **Issue:** Remaining large route pages were split into small server wrappers plus route-local `_components`.
- **Evidence files (migration pattern sample):**
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
- **Closed hotspots:**
  - `apps/web/app/tradecraft/page.tsx`
  - `apps/web/app/tradecraft/_components/tradecraft-overview-content.tsx`
  - `apps/web/app/characters/skill-farms/page.tsx`
  - `apps/web/app/characters/skill-farms/_components/skill-farm-intro-content.tsx`
  - `apps/web/app/brokerage/reports/page.tsx`
  - `apps/web/app/brokerage/reports/_components/brokerage-reports-content.tsx`
  - `apps/web/app/tradecraft/cycles/details/page.tsx`
  - `apps/web/app/tradecraft/cycles/details/_components/cycle-details-content.tsx`
  - `apps/web/app/brokerage/consignments/details/_components/consignment-details-page-client.tsx`

### Finding X-002

- **Status:** `resolved`
- **Severity:** `P2`
- **Issue:** Route-level `_components` structure is now used for the previously remaining page hotspots.
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
  - `apps/web/app/tradecraft/admin/self-market/_components/self-market-page-client.tsx`
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
- **Issue:** Root route UX boundary files were added (`loading.tsx`, `error.tsx`, `not-found.tsx`). Feature-level boundaries can still be added later where user-facing routes need custom states.
- **Evidence files:**
  - `apps/web/app/loading.tsx`
  - `apps/web/app/error.tsx`
  - `apps/web/app/not-found.tsx`

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
- **Issue:** App-local API request/response contract shapes in active API hook/client layers were consolidated into `packages/shared` modules (`character-management`, `notifications`, `tradecraft-market`, `parameter-profiles`, `tradecraft-ops`, `tradecraft-participations`, `tradecraft-data-ops`, `tradecraft-cycles`, `tradecraft-arbitrage`, `skill-contracts`, and `support-feedback`). Retired Strategy Lab contracts were removed with the feature.
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
- **Recovery status:** Resolved for page architecture. Static scan shows all `apps/web/app/**/page.tsx` files are small wrappers; the remaining frontend cleanup is regular component maintenance rather than Batch 4 page migration.

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
- **Recovery status:** Complete for the conservative Batch 5 slice. NPC/self-market controller read logic moved into feature query services with characterization tests; later-discovered NPC inline query objects were replaced with DTO classes; liquidity response DTOs now have runtime classes; touched endpoints gained targeted Swagger success metadata; manual job triggers now use protected `POST` routes; `auth.controller.ts` no longer owns OAuth state or character/token Prisma persistence. The controller remains large because it still coordinates OAuth redirects/cookies/responses, so any further split should be a focused maintainability follow-up rather than a Batch 5 blocker.

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
