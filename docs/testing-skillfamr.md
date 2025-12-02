## Skill Farm – Frontend Manual Test Plan

### 0. One‑time setup

- **Start apps**
  - Backend: `apps/api` dev server running.
  - Frontend: `apps/web` dev server running.
- **Account & characters**
  - Logged in as a user with Discord linked in `/settings/notifications`.
  - At least:
    - One character **below 5.5M SP** (no Biology V, no remap, no implants).
    - One character **above 5.5M SP**, Omega, with **+5 implants**, `Biology V`, `Cybernetics V`, and a long training queue.
    - (Optional) Third character on the same account without MCT to test “no free queue” behaviour.
- **Skill plans**
  - On `/characters/skills/plans`, create at least one “farm” plan (e.g. `Farm – Int/Per`) and add some high‑SP skills to it.
- **Notifications**
  - On `/settings/notifications`, confirm you see and enable:
    - “Skill farm – Extractor ready”
    - “Skill farm – Queue low”

---

### 1. Intro page – `/skill-farms`

1. Navigate to `/skill-farms`.
2. Verify:
   - Page title is “Skill Farm Assistant”.
   - Three cards are visible: **Learn the basics**, **Prepare characters**, **Run the numbers**.
3. Confirm “Next steps” buttons route correctly:
   - “Check my characters” → `/skill-farms/characters`
   - “Run the math” → `/skill-farms/math`
   - “View farm tracking” → `/skill-farms/tracking`
4. Resize window between desktop and mobile widths:
   - Cards stack cleanly.
   - No horizontal scrollbars or layout glitches.

---

### 2. Requirements checker – `/skill-farms/characters`

#### 2.1 Baseline list

1. Open `/skill-farms/characters`.
2. Confirm:
   - All linked characters appear with a line like:  
     `X SP / Y SP non‑extractable`.
   - Characters without required scopes behave like `/characters` (disabled or absent).

#### 2.2 Requirement badges (different character states)

- **Character with &lt; 5.5M SP**
  1. Find a character under 5.5M SP.
  2. Verify:
     - “5.5M SP” badge is **failing/red**.
     - Other badges (Biology V, Cybernetics V, Remap, Can train, Training pod) reflect real state (missing skills/implants → red or warning).
     - “Set as active farm” button is **disabled** while any required badge fails.

- **Character with ≥ 5.5M SP but missing skills/remap**
  1. Find a character above 5.5M SP without Biology V / Cybernetics V / remap.
  2. Verify:
     - “5.5M SP” is **green/passing**.
     - Missing pieces show as **red/yellow**.
     - “Set as active farm” remains **disabled** until all required badges are green.

- **After fixing requirements**
  1. In EVE, train `Biology V` & `Cybernetics V`, add a remap and implants.
  2. Refresh data (via normal `/characters` refresh).
  3. Confirm all requirement badges for that character turn **green**.

#### 2.3 Activate / deactivate farm

1. When all requirements are green for a character:
   - Click **“Set as active farm”**.
2. Verify:
   - Character shows as **Active farm** (badge/label).
   - Hard‑refresh the page and confirm it remains active.
3. Click again to deactivate:
   - Character is no longer marked active.
   - Later it should disappear from `/skill-farms/tracking`.

#### 2.4 Skill plan link

1. On `/skill-farms/characters`, click **“Manage farm skill plan”**.
2. Confirm navigation to `/characters/skills/plans`.
3. Create or pick a plan for that character and return to `/skill-farms/characters`.
4. Confirm the character still appears and can be toggled as active/inactive.

---

### 3. Math / Planner – `/skill-farms/math`

#### 3.1 Initial load & persistence

1. Open `/skill-farms/math`.
2. Confirm:
   - `SkillFarmSettings` load without `NaN` or obviously broken values (blank is fine if unset).
3. Change a field (e.g. **PLEX price**), wait for auto‑save (`PUT /skill-farms/settings`).
4. Hard‑refresh and verify the new value persists.

#### 3.2 Simple profit sanity checks

1. Set example values:
   - PLEX price: `4,000,000`
   - PLEX per Omega: `500`
   - PLEX per MCT: `0` (or your own value)
   - Extractor cost: `400,000,000`
   - Injector price: `800,000,000`
   - Booster cost per cycle: `100,000,000`
   - Sales tax: `2`
   - Broker fee: `3`
   - Cycle length: `30`
   - Management minutes: `60`
   - Accounts: `1`
   - Farm characters per account: `1`
   - SP/day per character: `50,000`
2. Click **Recalculate** and verify:
   - SP per cycle ≈ **1,500,000** (`50k × 30`).
   - Injectors per cycle ≈ **3.00** (`1.5M ÷ 500k`).
   - Net profit per character is **positive** and roughly matches your spreadsheet.
   - Total net profit per cycle ≈ **per‑character net × number of characters**.
   - ISK/hour ≈ `netProfit / (managementMinutes / 60)`.

#### 3.3 Edge cases

1. Set SP/day to `0` and recalc:
   - SP per cycle → `0`.
   - Injectors per cycle → `0`.
   - Net profit and ISK/hour → `0`.
2. Change **cycle length** (e.g. 15 vs 60 days) and confirm SP per cycle and profits scale reasonably.
3. Toggle **“Sold via contracts / direct trades (skip market tax & broker fees)”**:
   - With toggle **on**, net profit ignores sales tax and broker fee.
   - With toggle **off**, those fees apply again and net profit changes accordingly.

---

### 4. Tracking dashboard – `/skill-farms/tracking`

#### 4.1 No active farms

1. Ensure no characters are marked as **active farm**.
2. Open `/skill-farms/tracking`.
3. Confirm a clear message indicates there are **no active farm characters**.

#### 4.2 With active farms

1. Mark one or more characters as active on `/skill-farms/characters`.
2. Navigate to `/skill-farms/tracking`.
3. For each active character, confirm:
   - Name plus SP totals (`totalSp` and `nonExtractableSp`) are shown.
   - Extractable SP and “X full injector(s) ready” reflect current SP above the 5.5M floor.
   - Queue status badge shows:
     - **OK** when queue &gt; 3 days.
     - **Queue ≤ 3 days** when queue is ~2 days.
     - **Queue ≤ 1 day** when queue is nearly empty.
     - **Queue empty** once queue fully expires.
   - ETA to next injector appears only when:
     - No full injector is already ready, and
     - Queue still has remaining time.

#### 4.3 Live updates

1. Keep `/skill-farms/tracking` open while a farm character trains until crossing a **500k SP boundary**.
2. Trigger a refresh and verify:
   - Full injector count increments by `+1`.
   - Extractable SP increases appropriately.
3. Pause or empty the character’s queue in‑game:
   - After refresh, confirm queue status transitions through **WARNING → URGENT → EMPTY** as thresholds are crossed.

---

### 5. Discord notifications

#### 5.1 Extractor ready

1. Ensure **“Skill farm – Extractor ready”** is enabled.
2. With at least one active farm character, allow it to gain enough SP for a **new full injector**.
3. After the hourly job runs (or you manually trigger it), verify:
   - You receive a DM like `Character X has 1/2/... injector(s) ready…`.
   - The DM includes a link back to `/skill-farms/tracking`.
4. Add some SP **without** reaching another full injector:
   - Confirm no new “extractor ready” DMs are sent (no spam for same injector count).

#### 5.2 Queue low / empty

1. Ensure **“Skill farm – Queue low”** is enabled.
2. For an active farm character:
   - Set the queue to end in ~**2.5 days** and wait for the job → expect one DM indicating a low queue.
   - Reduce queue to **&lt; 1 day** and wait for the next run → expect another DM indicating urgent/near empty queue.
   - Let the queue fully empty and wait again → expect at most one “queue empty” DM per empty event.

#### 5.3 Notification toggles

1. Turn **off** “Skill farm – Extractor ready” and keep **“Skill farm – Queue low”** **on**:
   - Repeat extractor‑ready scenario → no extractor‑ready DMs, but queue‑low DMs still arrive.
2. Turn **off** both toggles:
   - Trigger both extractor‑ready and low‑queue conditions.
   - Verify no further skill‑farm DMs are sent while toggles are disabled.


