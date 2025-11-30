<!-- 98a32ec2-6c6f-423b-a251-2e6e5d3f4b26 8a840dab-8f49-44af-ab29-aef08f48baaa -->
# Multi-app character/skill-farm architecture prep

### 1. Clarify backend module boundaries

- **Define new product-level modules** in the API: `CharacterManagementModule` (general character/account management UX) and `SkillFarmModule` (skill-queue/SP optimization & injector economics), planned under `apps/api/src/character-management` and `apps/api/src/skill-farm`.
- **Decide responsibilities vs `CharactersModule`**:
- Keep `apps/api/src/characters` focused on **auth, users, character linking, guards, decorators, auth services**.
- Plan to route non-auth character functionality (dashboards, overviews, aggregates, “all my characters across accounts”, etc.) through `CharacterManagementModule`.
- **Update `AppModule` wiring** conceptually so that the new modules can be imported alongside `CharactersModule`, without changing existing behavior yet.

### 2. Identify and stage shared-domain extractions

- **Map existing reusable logic**:
- `apps/api/src/common/money.ts` and cycle profit utilities (e.g. `cycles/services/profit.service.ts`, `cycles/utils/capital-helpers.ts`) as candidates for generic ISK/money & profitability helpers.
- ESI integration helpers and adapters (e.g. `apps/api/src/esi/esi.adapter.ts`, `esi.service.ts`, `esi-characters.service.ts`, `market-helpers.ts`).
- Any character/account domain functions in `apps/api/src/characters/services/*.ts` that don’t depend on Nest.
- **Plan a pure domain package** (e.g. `packages/eve-core` or `packages/shared-eve`):
- Holds **pure TypeScript** types and functions for characters, skills, wallets, ISK/money, profit calculations, and skillpoint math.
- No Nest, no HTTP, no env access; only domain logic that both Tradecraft and Skill Farm/character-management will need.
- **Plan an ESI client package** (e.g. `packages/eve-esi`):
- Wraps ESI HTTP calls, rate limiting, error handling, with reusable functions used by `EsiModule`, `CharacterManagementModule`, and `SkillFarmModule`.
- Keeps Nest-specific injection (e.g. `EsiService` providers) thin and inside `apps/api`, delegating heavy lifting to this package.

### 3. Prepare API contracts and shared types

- **Extend `packages/api-contracts`** plan for new app:
- Define Zod/OpenAPI schemas and TS types for key upcoming endpoints (character overview, skill farm profiles, SP/ISK break-even, etc.).
- Ensure these types are importable from both `apps/api` and `apps/web` so the new app starts fully typed.
- **Centralize reusable DTO shapes**:
- Keep Nest DTO classes in `apps/api`, but standardize payload shapes via `packages/api-contracts` so different modules (Tradecraft vs. Skill Farm) share compatible request/response models when appropriate (e.g., shared `CharacterSummary`, `WalletSnapshot`).

### 4. Frontend structure preparation

- **Choose and document the new frontend segment** under `apps/web/app` (e.g. `app/characters` or `app/skillfarm`):
- Plan feature folders for `features/character-management` and/or `features/skill-farm` (hooks, components, api.ts using TanStack Query).
- **Align API client usage**:
- Decide a new `AppId` string for the character-management app (e.g. `"web-character-management"`) and plan to add it to `packages/api-client` mapping, even if it still points to the same API base URL initially.

### 5. Documentation and migration notes

- **Update `docs/ARCHITECTURE.md`** (or add a new doc like `CHARACTER_MANAGEMENT_ARCHITECTURE.md`) to describe:
- The split between `CharactersModule` (auth/identity) vs `CharacterManagementModule`/`SkillFarmModule` (product features).
- The role of `packages/eve-core`, `packages/eve-esi`, and updated `packages/api-contracts`.
- **Capture migration rules** for future refactors:
- New EVE-domain calculations go to `packages/eve-core`.
- New ESI endpoints or flows build on `packages/eve-esi`.
- New frontend/server communication shapes start in `packages/api-contracts` so both apps stay in sync.

### To-dos

- [ ] Define clear responsibilities and planned folder structure for `CharacterManagementModule` and `SkillFarmModule` in the Nest API, and how they relate to the existing `CharactersModule`.
- [ ] Review existing API modules (characters, cycles, esi, wallet, common) to list functions and services that can be moved into pure shared EVE-domain logic and ESI client packages.
- [ ] Design the structure and naming for new shared packages (e.g. `packages/eve-core`, `packages/eve-esi`) and how they will be consumed by both current and future apps.
- [ ] Extend or plan `packages/api-contracts` types and schemas to cover upcoming character-management and skill-farm endpoints, keeping DTO shapes consistent across modules.
- [ ] Decide and document the new frontend app segment and feature folders for character-management/skill-farm, and how they will use the shared API client and query keys.
- [ ] Update or add architecture documentation describing the multi-app backend strategy, new modules, and shared packages so future work follows the same patterns.