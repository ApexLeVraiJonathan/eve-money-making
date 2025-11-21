<!-- ed1023f7-2549-4e4b-b439-5ebc7a3e48a5 9640e717-df28-4885-8f60-8a71f240159f -->
# Parameter Profiles for Tradecraft Admin

#### Goal

Implement reusable **parameter profiles** (full CRUD) that let admins save/load sets of parameters on:

- `/tradecraft/admin/liquidity`
- `/tradecraft/admin/arbitrage`
- `/tradecraft/admin/planner`

Profiles are **app-wide (global)**, not per-user, and are scoped to a specific tool/page.

---

### 1. Data model & persistence

- **Add Prisma model** (e.g. in `prisma/schema.prisma`) for a generic profile entity:
- `id`, `name`, `description?`, `scope` (enum: `LIQUIDITY`, `ARBITRAGE`, `PLANNER`), `params` (JSON), `createdAt`, `updatedAt`, `createdByUserId?`.
- Optionally a `schemaVersion` field to future‑proof parameter shape changes.
- **Run migrations** to create the table in PostgreSQL according to existing tooling.

---

### 2. Backend module & API

- **Create a NestJS module** (e.g. `apps/api/src/modules/parameter-profiles`) encapsulating:
- `ParameterProfilesService` for DB access via Prisma.
- `ParameterProfilesController` exposing endpoints like:
- `GET /parameter-profiles?scope=ARBITRAGE` (list)
- `POST /parameter-profiles` (create)
- `PATCH /parameter-profiles/:id` (update name/params)
- `DELETE /parameter-profiles/:id` (delete)
- **Enforce auth/permissions** via existing guards/decorators so only admins can create/update/delete; reading can be admin‑only or broader depending on existing tradecraft rules.
- **Define DTOs & validation** that allow arbitrary JSON in `params` but validate `scope` and `name`.

---

### 3. Frontend shared client logic

- **Add a small client helper/hooks layer** in the web app (e.g. `apps/web/lib/parameterProfiles.ts`):
- Functions or hooks like `useParameterProfiles(scope)`, `createProfile(scope, params)`, `updateProfile(id, patch)`, `deleteProfile(id)` calling the new API.
- Types defining `ParameterProfile` shape aligned with the backend DTOs.
- Ensure **error handling and loading states** are standardized across pages.

---

### 4. Integrate on arbitrage page

- In the arbitrage admin page component (e.g. `apps/web/app/tradecraft/admin/arbitrage/page.tsx` or its equivalent):
- Identify the existing **parameters state object** that is used to run arbitrage (the shape we want to save as `params`).
- Add a **top‑right UI block** above the parameters form with:
- A **profile selector** (dropdown/autocomplete) to choose a profile and load it.
- A **“Save as profile”** button that:
- Opens a dialog to enter a profile name (and description), with options to create or overwrite an existing profile.
- Implement **load behavior**: when a profile is selected, replace the current parameters state with `profile.params` and refresh the form fields.
- Implement **basic CRUD controls** in the UI (rename/overwrite and delete) in the dialog or via a small “Manage profiles” sub‑view.

---

### 5. Integrate on liquidity and planner pages

- Repeat the integration pattern on:
- `.../tradecraft/admin/liquidity` page component.
- `.../tradecraft/admin/planner` page component.
- For each page:
- Map its existing parameters state into/from the generic `params` JSON.
- Call the hooks with the appropriate `scope` (`LIQUIDITY`, `PLANNER`).
- Reuse as much of the **profile selector / save dialog UI** as possible via a shared component (e.g. `ParameterProfileBar`) to keep UX consistent.

---

### 6. UX details and safeguards

- Show **confirmation** before deleting a profile and a short toast/snackbar on successful create/update/delete.
- If loading a profile would override unsaved parameters, optionally show a **confirmation dialog** (or at least a subtle warning) when switching profiles.
- Handle **edge cases**:
- No profiles yet → show an empty state with a "Create your first profile" CTA.
- Profile deleted/renamed in another session → fallback gracefully on stale IDs.

---

### 7. Tests & verification

- **Backend tests** for `ParameterProfilesService` and controller: creation, listing by scope, update, delete, and permission enforcement.
- **Frontend tests** (unit/integration) for the shared profile hooks/component and key flows on at least one page (e.g. arbitrage): save, load, rename/overwrite, delete.
- Manual QA pass on all three pages to confirm:
- Profiles are scoped correctly by page.
- Loading a profile reliably updates all associated parameter controls.
- CRUD actions behave as expected with proper feedback and no console errors.

### To-dos

- [ ] Define Prisma `ParameterProfile` model with scope enum and JSON params, and add DB migration.
- [ ] Create NestJS parameter profiles module (service, controller, DTOs, routes, auth).
- [ ] Implement shared frontend client helpers/hooks for parameter profile API access.
- [ ] Integrate profile selector and save/manage UI with arbitrage parameters state.
- [ ] Integrate shared profile UI on liquidity and planner pages with their parameter states.
- [ ] Add backend/frontend tests and perform manual QA for profiles on all three pages.