<!-- d1c26e80-717f-4d5b-9265-61db6c43fa2d f76e02a9-49cd-4181-89ec-e00b9b915aa2 -->
# Undercut-Checker Optimization Plan

### Scope

Implement focused changes to the Undercut-Checker on both backend and frontend to:

- Group multiple orders per item more intelligently (configurable modes).
- Ignore undercuts with trivial competitor volume (using original order volume).
- Flag reprices that would become unprofitable and auto-deselect them.
- Speed up manual repricing with copy-price shortcuts and safer bulk toggles.

### Backend Changes (API: `apps/api`)

1. Add grouping mode support to `undercutCheck`

   - Update `UndercutCheckRequest` DTO (`apps/api/src/market/dto/undercut-check.dto.ts`) to accept an optional `groupingMode?: "perOrder" | "perCharacter" | "global"`.
   - In `PricingService.undercutCheck` (`apps/api/src/market/services/pricing.service.ts`), after `byStationType` is built, alter how `updatesByCharStation` is populated based on `groupingMode`:
     - `perOrder` (current behavior): keep existing logic.
     - `perCharacter`: for each `(stationId, typeId)` + `characterId` set, pick a single “primary” order (highest `volume_remain` or highest `volume_remain * price`) and only emit an `UndercutUpdate` for that order.
     - `global`: for each `(stationId, typeId)` across all characters, pick a single primary order to update (e.g. highest `volume_remain`) and emit only one `UndercutUpdate` in the appropriate character/station group.

2. Implement undercut volume thresholds using original order volume

   - Extend `UndercutCheckRequest` to include optional parameters such as `minUndercutVolumeRatio?: number` and/or `minUndercutUnits?: number` (even if for now we primarily tune against ratio).
   - In `PricingService.undercutCheck`, while processing `stationSells` for each `(stationId, typeId)`:
     - Use the ESI order data to obtain each of our orders’ original volume (`volume_total`), if available (we may need to extend the `ourOrders` structure if it’s not already there via `EsiCharactersService`).
     - For each candidate competitor price level below our price, compute the cumulative competitor volume at or below that price.
     - For each of our orders, compare `cumulativeCompetitorVolumeBelowUs` against `minUndercutVolumeRatio * order.volumeTotal` (using your chosen 15% default in configuration) and/or `minUndercutUnits`.
     - If competitor volume is below threshold, skip emitting an `UndercutUpdate` for that order.
     - For mixed-price scenarios (e.g. 1 unit at -20%, 50 units at -0.1%), select a target competitor price that is both:
       - Supported by enough competitor volume (passes the threshold), and
       - Not an excessively deep discount vs the current price.
     - Feed that chosen price into `nextCheaperTick` to compute `suggestedNewPriceTicked`.

3. Add profitability awareness when `cycleId` is provided

   - Extend `UndercutUpdate` (`packages/shared/src/types/index.ts`) with extra read-only fields, e.g.:
     - `estimatedMarginPercentAfter: number;`
     - `estimatedProfitIskAfter: number;`
     - `wouldBeLossAfter: boolean;`
   - In `PricingService.undercutCheck`, when `cycleId` is provided and after cycle-line filtering:
     - For each `(stationId, typeId)` / order pair, locate the corresponding `CycleLine` (similar to how the frontend does it now).
     - Compute unit cost from the line (e.g. `unitCost = buyCostIsk / unitsBought`), guarding against zero.
     - Use existing fee helpers (e.g. `getEffectiveSell`) and the `suggestedNewPriceTicked` to determine effective net sell price after taxes/fees.
     - Calculate `marginPercentAfter` and `estimatedProfitIskAfter = marginPerUnit * remaining`.
     - Set `wouldBeLossAfter` if `estimatedProfitIskAfter < 0` or `marginPercentAfter < 0`.
   - Ensure these fields are only set when `cycleId` is passed or when the data is available; otherwise use safe defaults (e.g. null or zero) so the frontend can handle both cases.

4. Wire API contracts

   - Update shared types in `packages/shared/src/types/index.ts` to reflect new `UndercutUpdate` fields and possible new inputs on `UndercutCheckRequest` (if mirrored there).
   - If the frontend imports `UndercutCheckRequest`-like types from `@eve/api-contracts`, update those contracts/generated types accordingly.

### Frontend Changes (UI: `apps/web`)

5. Add grouping mode selector to Undercut-Checker page

   - In `apps/web/app/tradecraft/admin/undercut-checker/page.tsx`:
     - Add local state for `groupingMode` with initial value `"perCharacter"`.
     - Introduce a small UI control (e.g. `Select` or radio group) in the Configuration card allowing the user to choose between `Per order`, `Per character (primary order)`, and `Global (single order)`.
     - Pass `groupingMode` to `useUndercutCheck` mutation payload so the backend can apply the desired grouping behavior.

6. Surface profitability warnings and auto-deselect loss-making reprices

   - Consume the new `UndercutUpdate` fields (`wouldBeLossAfter`, margin, profit) in the `UndercutCheckerPage` table.
   - Visual feedback:
     - If `wouldBeLossAfter` is true, render the row with a warning style (e.g. red-tinted background or warning icon in a new column).
     - Optionally show margin/profit numbers in a tooltip or an extra column when helpful.
   - Selection behavior:
     - When initializing `selected` after a successful `onRun`, default to selecting only rows where `wouldBeLossAfter` is false; leave loss-making rows unchecked so you must opt in explicitly.

7. Improve per-group bulk toggle behavior

   - Fix the group header checkbox logic in `UndercutCheckerPage` so that toggling a group updates only that group’s keys while preserving the selection state for other groups:
```tsx
onChange={(e) => {
  const keys = group.updates.map(
    (u) => `${group.characterId}:${group.stationId}:${u.orderId}`,
  );
  setSelected((prev) => {
    const next = { ...prev };
    for (const k of keys) next[k] = e.target.checked;
    return next;
  });
}}
```

   - Ensure header checkbox `checked` / indeterminate state correctly reflects whether all, some, or none of the rows in that group are selected.

8. Add row-level “Copy suggested price” shortcut

   - In the table’s `Suggested` column, add a small button or clickable region for each row that:
     - Copies `u.suggestedNewPriceTicked` as a plain number to the clipboard using the browser Clipboard API.
     - Optionally provides a subtle visual confirmation (e.g. a quick “Copied” toast or icon change).
   - Consider keyboard accessibility:
     - Make the copy control focusable and triggerable via keyboard (e.g. `Enter`/`Space`) to support a more efficient keyboard-driven flow.

### Validation & Docs

9. Testing and verification

   - Add or update unit tests where present for `PricingService.undercutCheck` to cover:
     - Grouping modes (`perOrder`, `perCharacter`, `global`).
     - Undercut volume thresholds, including edge cases (tiny undercut volume, large undercut volume, mixed deep/ shallow undercuts).
     - Profitability flags when `cycleId` is provided.
   - Manually verify the Undercut-Checker UI for:
     - Correct grouping behavior per mode.
     - Reduced noise rows from trivial undercuts.
     - Clear visual flags and auto-deselection of loss-making items.
     - Reliable copy-to-clipboard behavior and stable group bulk toggles.

10. Documentation updates

   - Update or add a short section in an appropriate doc (`docs/CYCLE_ACCOUNTING_TEST_PLAN.md` or a new Undercut-Checker-focused doc) summarizing:
     - The meaning and use of grouping modes.
     - How undercut volume thresholds work conceptually (15% of original order volume) and how to change them if needed.
     - How loss-making reprices are flagged and that they are not auto-selected by default.
     - How to use the copy-price shortcut for faster manual repricing.

### To-dos

- [ ] Add groupingMode support and implement perOrder / perCharacter / global behaviors in PricingService.undercutCheck and UndercutCheckRequest DTO.
- [ ] Implement undercut volume-based filtering using original order volume (15% threshold) and ensure competitor price selection respects volume thresholds.
- [ ] Compute profitability after suggested reprice when cycleId is provided and extend UndercutUpdate with margin/profit/loss flags.
- [ ] Update shared UndercutCheck types and any related contracts to include new fields and request parameters.
- [ ] Add grouping mode selector on Undercut-Checker page and pass groupingMode through to the undercut-check mutation.
- [ ] Add loss-making visual indicators and auto-deselect logic in Undercut-Checker UI based on backend profitability flags.
- [ ] Fix group-level bulk select checkbox behavior to merge selections instead of overwriting other groups.
- [ ] Add row-level copy-suggested-price action with keyboard support in Undercut-Checker table.
- [ ] Add/update tests for new pricing behavior and update docs to describe grouping modes, undercut thresholds, profitability warnings, and copy shortcut.