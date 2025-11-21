<!-- 07697beb-3044-4257-9b68-fc99640848e8 535afe81-d4c2-4e4c-a351-3062caefd566 -->
# Fix strategy for item_types names and volumes

### Goals

- Make the existing Adam4Eve + ESI import flows **overwrite incorrect metadata** in `item_types` (`TypeId` model) while keeping `type_id` and foreign keys intact.
- Ensure **item names** and **volumes/sizes** can be fully re-synchronized from source data, correcting any past mistakes without truncating large tables like `market_order_trades_daily`.

### Files to touch

- `apps/api/src/game-data/services/import.service.ts`
- `apps/api/src/game-data/import.controller.ts` (only for docs/description, no API shape change needed if we keep the same request body)

### Step-by-step plan

1. **Change type ID import to overwrite existing rows**

- In `ImportService.importTypeIds`, replace the current `createMany({ skipDuplicates: true })` logic with a batched **upsert** approach using Prisma.
- For each batch of parsed CSV rows, run `prisma.$transaction([...upsert ops...])` where:
- `where: { id: item.id }`
- `create: { id, published, name }`
- `update: { name: item.name, published: item.published }` (do not change `id` or `volume`).
- Keep the same streaming and batching structure so performance characteristics remain similar; adjust logging to reflect that rows may be updated, not just inserted.

2. **Update controller/docs to reflect overwrite behaviour**

- In `ImportController.importTypeIds`, keep the same `POST /import/type-ids` signature so existing callers still work.
- Update the Swagger `@ApiOperation` summary/description to mention that this endpoint will **insert missing type IDs and update names/published flags for existing ones**.

3. **Make size/volume import overwrite existing values (Option A)**

- In `ImportService.importTypeVolumes`, remove the `volume: null` filter so we can refresh volumes even if they are already set.
- Fetch all `published: true` types in ascending `id` pages and, for each type, call ESI and `update` its `volume` from the API result, regardless of its current value.
- Preserve the existing concurrency and paging logic to avoid hammering ESI but allow a full re-sync over time.

4. **(Optional) Align any callers/UX expectations**

- Review any admin tooling or docs that assume `import/type-ids` is append-only and update wording to clarify that it now corrects existing data too.
- If needed, add a short note in the docs (`docs/` directory) explaining that running `POST /import/type-ids` and `POST /import/type-volumes` is the recommended way to repair bad item names/volumes without touching `market_order_trades_daily`.

### To-dos

- [ ] Change ImportService.importTypeIds to use batched Prisma upserts that update name and published for existing TypeId rows while creating missing ones.
- [ ] Update ImportController and any relevant docs to describe that /import/type-ids overwrites existing item names/published flags.
- [ ] Adjust ImportService.importTypeVolumes so it can refresh volumes for all published types, not just rows where volume is null, using the existing paged + concurrent ESI fetch pattern.