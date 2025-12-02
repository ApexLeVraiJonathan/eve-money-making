<!-- 7321fbf2-82eb-454a-9976-666a6280b16c 2f41ea76-f87f-4d17-9dd1-4d3023fcc123 -->
# Skill Farm Assistant Implementation Plan

## Scope

Implement the V1 Skill Farm Assistant across **API**, **web app**, and **Discord notifications**, following existing monorepo patterns (NestJS feature module, Prisma schema in `packages/prisma`, Next.js app router, `@api-client` + TanStack Query). The feature will consist of:

- Intro/education page (`/skill-farms`)
- Requirements checker (`/skill-farms/characters`)
- Math/planner (`/skill-farms/math`)
- Tracking dashboard with Discord alerts (`/skill-farms/tracking`)

## High-Level Steps

### 1. Data & Domain Layer (Prisma + API contracts)

1. **Extend Prisma schema** in [`packages/prisma/schema.prisma`](packages/prisma/schema.prisma):

- Add `SkillFarmSettings` model (per-user economic inputs and defaults).
- Add `SkillFarmCharacterConfig` model (per-character flags: candidate/active, linked farm plan id).
- Add any necessary indexes (`userId`, `characterId`).
- Run `prisma migrate` to generate migrations.

2. **Define shared contracts** in [`packages/api-contracts/src/index.ts`](packages/api-contracts/src/index.ts) (or appropriate skill-farm file):

- DTO/response shapes for:
- `SkillFarmSettings` (get/update).
- `SkillFarmCharacterStatus` (requirements checklist per character).
- `SkillFarmCharacterConfig` (active/candidate + farmPlanId).
- `SkillFarmTrackingSnapshot` (tracking data per active character).
- Optional `SkillFarmMathPreview` (inputs/outputs for server-side math).
- Export corresponding TS types for both API and web.

3. **Add query key namespace** in [`packages/api-client/queryKeys.ts`](packages/api-client/queryKeys.ts):

- `qk.skillFarms._root`, `qk.skillFarms.characters`, `qk.skillFarms.settings`, `qk.skillFarms.tracking`, `qk.skillFarms.mathPreview`.

### 2. API: Skill Farm Module in `apps/api`

4. **Create `SkillFarmModule`** under something like [`apps/api/src/skill-farms`](apps/api/src/skill-farms):

- `skill-farms.module.ts` registering controller + service(s).
- `skill-farms.controller.ts` exposing routes:
- `GET /skill-farms/settings` → current user settings.
- `PUT /skill-farms/settings` → update settings (validated DTO).
- `GET /skill-farms/characters` → characters + requirement status + config.
- `PATCH /skill-farms/characters/:characterId` → update candidate/active flags and `farmPlanId`.
- `GET /skill-farms/tracking` → computed tracking snapshot for active farm characters.
- (Optional) `POST /skill-farms/math/preview` → profit preview for given inputs.
- Use DTOs with class-validator/class-transformer per repo standards.

5. **Implement `SkillFarmService`**:

- Inject `PrismaService`, character/skill/plan services.
- Methods:
- `getSettingsForUser(userId)` / `updateSettingsForUser(userId, dto)`.
- `listCharactersWithStatus(userId)` – fetch characters, compute requirements, join with configs.
- `updateCharacterConfig(userId, characterId, dto)` – upsert `SkillFarmCharacterConfig`.
- `getTrackingSnapshot(userId)` – compute tracking data for active farm characters.

6. **Implement `SkillFarmMathService`** (pure logic class, easy to share later):

- Functions to compute:
- SP/day and SP/cycle from SP/hour or explicit SP/day.
- Extractable SP given total SP, fixed non-extractable 5.5M SP, and farm-plan SP.
- Number of full extractors and remainder SP.
- Cost breakdown (PLEX/Omega/MCT, boosters, extractors, taxes/fees) and net profit + ISK/hour.
- Cover core cases with unit tests in `apps/api/test/skill-farms.math.spec.ts` using spreadsheet values as references.

7. **Extend existing skill-plans support** (if needed):

- In the skill-plans domain (likely under `apps/api/src/characters/skills` or similar), add an optional `isSkillFarmPlan` flag and allow associating `farmPlanId` for a character via `SkillFarmCharacterConfig` only (no breaking changes to generic plans).

### 3. Background Tracking & Discord Events

8. **Add tracking evaluation job** (cron or reuse existing polling scheduler):

- New job/service (e.g., `SkillFarmTrackingJob`) that runs on a schedule:
- Loads all active farm characters for users who have skill-farm notifications enabled.
- Computes current tracking snapshot per character via `SkillFarmService`/`SkillFarmMathService`.
- Compares with last-known state (stored in DB or an events table) to detect:
- New full extractors available (increase in `injectorsReady`).
- Queue status transitions to Warning (≤3d), Urgent (≤1d), or Empty.
- Emits internal events like `SkillFarmExtractorReady`, `SkillFarmQueueWarning3d`, etc.

9. **Wire events into existing Discord notification pipeline**:

- Define new notification types in the notifications domain (e.g., `NotificationType.SkillFarmExtractorReady`).
- Map internal events to outbound Discord messages, reusing existing Discord client/config.
- Message content: character name, event type, short description, link to `/skill-farms/tracking`.
- Respect global notification toggles from `/settings/notifications` (no per-character granularity in V1).

10. **Update `/settings/notifications` backend** to expose the new types so the web app can render toggles.

### 4. Web App: Feature Hooks & API Integration

11. **Create feature hooks in `apps/web/features/skill-farms/api.ts`**:

- Initialize `client` via `clientForApp("web-…")`.
- Hooks using TanStack Query:
- `useSkillFarmSettings()` – `GET /skill-farms/settings`.
- `useUpdateSkillFarmSettings()` – `PUT /skill-farms/settings` + invalidate settings/math.
- `useSkillFarmCharacters()` – `GET /skill-farms/characters`.
- `useUpdateSkillFarmCharacter()` – `PATCH /skill-farms/characters/:id` + invalidate characters/tracking.
- `useSkillFarmTracking()` – `GET /skill-farms/tracking`.
- (Optional) `useSkillFarmMathPreview()` – if math is computed server-side.

12. **Ensure notification settings page fetches new types** via existing notifications feature hooks, so the UI can show global toggles for the four new skill-farm-related types.

### 5. Web App: Pages & UI

13. **Intro page `app/skill-farms/page.tsx`**:

- Server component rendering structured content:
- High-level explanation, pros/cons, and “Is this for you?” checklist.
- Use `@ui` components (cards, headings, buttons) per design guide.
- Primary CTAs linking to `/skill-farms/characters`, `/skill-farms/math`, `/skill-farms/tracking`.

14. **Requirements checker `app/skill-farms/characters/page.tsx`**:

- Server component wrapper + client component for interactive list.
- Use `useSkillFarmCharacters()` to fetch data.
- UI:
- Table or card list of characters with:
- Name, portrait, Omega/Alpha badge.
- Checklist of requirements (SP ≥ 5.5M, Biology V, Cybernetics V, remap, training eligibility, implants).
- Visual SP bar showing first 5.5M SP as non-extractable.
- Toggle/checkbox to mark character as **active farm** when all requirements are satisfied.
- Link/button to “Manage farm skill plan” for that character (navigates to existing skill-plans UI with character preselected).

15. **Math planner `app/skill-farms/math/page.tsx`**:

- Fetch and update `SkillFarmSettings` via hooks.
- Layout:
- **Settings form**: PLEX price, PLEX per Omega/MCT, extractor/injector prices, booster cost, taxes, contract/Discord flag, cycle length, management minutes.
- **Topology section**: #accounts, #farm chars per account, per-account “ignore Omega cost” toggle, plus “Use my active farm characters” button.
- **Results panel (simple view)**: per-character and per-account profit per cycle, total profit, ISK/hour.
- **Advanced breakdown** inside collapsible or tab: SP/day assumptions, SP/cycle, #extractors, cost table.
- Use form components from shared UI; provide tooltips on key fields (especially PLEX per Omega/MCT).

16. **Tracking dashboard `app/skill-farms/tracking/page.tsx`**:

- Use `useSkillFarmTracking()` to load all active farm characters’ tracking data.
- Table layout:
- Columns: Character, Farm Plan name, queue status chip (OK/≤3d/≤1d/Empty), extractable SP, injectors ready, ETA to next injector.
- Actions: open character details; open Farm Plan.
- Status chips must use icons + text labels (not color-only) and match design system state colors.

### 6. Testing & Validation

17. **Unit tests**:

- `SkillFarmMathService` SP and profit calculations vs reference spreadsheet scenarios.
- Requirement evaluation logic (SP thresholds, skill levels, implants) with fixtures.

18. **API tests**:

- Controller tests for settings, characters, tracking endpoints (auth, validation, basic happy paths).

19. **E2E/manual validation**:

- Use a small set of test characters to:
- Verify requirements checker states.
- Verify math outputs align with spreadsheet expectations for at least 2–3 scenarios.
- Verify tracking updates and that Discord messages fire correctly when forcing state transitions in dev.

20. **UX review**:

- Check all four pages against design principles: clear hierarchy, good spacing, readable text, proper status indicators.
- Confirm navigation between intro → characters → math → tracking feels smooth and obvious.

### To-dos

- [ ] Extend Prisma schema and shared API contracts for SkillFarmSettings and SkillFarmCharacterConfig, run migrations, and add query keys for skill-farm APIs.
- [ ] Implement SkillFarmModule in the API (controllers, services, math service) and expose endpoints for settings, characters with requirement statuses, tracking, and optional math preview.
- [ ] Implement background tracking job and wire new skill farm events into the existing Discord notification pipeline with new notification types.
- [ ] Create skill-farm feature hooks in the web app using the shared API client and query keys, plus ensure notification settings can toggle new types.
- [ ] Build the four Skill Farm pages (intro, characters, math, tracking) using shared UI components and feature hooks, ensuring a clear, consistent UX.
- [ ] Add unit/API tests for math and requirement logic, manually validate flows against spreadsheet expectations, and polish UX per design guidelines.