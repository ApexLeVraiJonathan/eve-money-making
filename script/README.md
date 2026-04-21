# LeVraiMindTrader Automation (Python)

This script automates your desktop app flow:

1. Call `POST /pricing/script/undercut-check` to get updates.
2. Use `lineId` returned directly by the script endpoint.
3. In `LeVraiMindTrader`, filter item -> right click row -> `Modify Order` -> set new price -> `OK`.
4. Confirm processed updates back to API with one batched call per location (`POST /pricing/script/confirm-batch`).

## Files

- `undercut_reprice_automation.py`
- `requirements.txt`

## Install

```powershell
cd script
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If image matching errors mention `pyscreeze`/`Pillow`, reinstall:

```powershell
pip install -r requirements.txt --upgrade
```

## Configure

Create `script/.env`:

```env
API_BASE_URL=http://localhost:3000
SCRIPT_API_KEY=
# Optional override; if omitted backend uses script API key user
SCRIPT_REPORT_USER_ID=
UNDERCUT_CYCLE_ID=YOUR_CYCLE_UUID
UNDERCUT_GROUPING_MODE=perCharacter
UNDERCUT_STATION_IDS=
ENABLE_LOCATION_MENU=true
RUN_MODE=interactive
SCHEDULED_LOCATION_ORDER=Dodixie,Hek,Rens,Amarr
SINGLE_INSTANCE_LOCK_PATH=.automation.lock
INCLUDE_RED_NEGATIVE_PROFIT=false
RED_PROFIT_THRESHOLD_PERCENT=-10
APP_WINDOW_TITLE_CONTAINS=LeVraiMindTrader
ENABLE_WINDOW_FOCUS=true
PAUSE_SECONDS=0.25
MOUSE_MOVE_DURATION=0.15
CLICK_SETTLE_SECONDS=0.05
HOTKEY_KEYDOWN_DELAY=0.03
HOTKEY_AFTER_DELAY=0.03
DRY_RUN=false
CONFIRM_MODE=reprice
USE_CLIPBOARD_PASTE=true
FILTER_INPUT_METHOD=paste
NORMALIZE_FILTER_TEXT=true
FILTER_FORCE_LOWERCASE=true
FILTER_STRIP_QUOTES=false
FILTER_MAX_CHARS=37
FILTER_REPLACE_DELAY=0.1
TYPE_INTERVAL_SECONDS=0.01
STOP_HOTKEY=q
STOP_HOLD_SECONDS=0.6
PAUSE_HOTKEY=\
DRY_RUN_STEP_DELAY=0.2

# Screen coordinates (x,y) - calibrate for your setup:
APP_FILTER_INPUT_XY=610,108
APP_FIRST_ROW_XY=177,167
APP_MODIFY_ORDER_XY=230,190
APP_SECOND_ROW_XY=177,192
APP_SECOND_MODIFY_ORDER_XY=230,215
APP_THIRD_ROW_XY=
APP_THIRD_MODIFY_ORDER_XY=
APP_FOURTH_ROW_XY=
APP_FOURTH_MODIFY_ORDER_XY=
APP_FIFTH_ROW_XY=
APP_FIFTH_MODIFY_ORDER_XY=
APP_SIXTH_ROW_XY=
APP_SIXTH_MODIFY_ORDER_XY=
APP_PRICE_INPUT_XY=320,440
APP_OK_BUTTON_XY=320,615
APP_CANCEL_BUTTON_XY=

# Optional warning-dialog handling after OK (click "Yes")
APP_WARNING_YES_XY=
WARNING_YES_IMAGE_PATH=
WARNING_SEARCH_REGION=
WARNING_MATCH_CONFIDENCE=0.8
WARNING_LOOKUP_SECONDS=1.6
WARNING_POLL_SECONDS=0.12
WARNING_FORCE_CLICK_YES=false

# Optional multi-monitor-safe pixel trigger for warning popup:
WARNING_PIXEL_XY=
WARNING_PIXEL_RGB=
WARNING_PIXEL_TOLERANCE=24

# Optional OCR safety guard before clicking OK
OCR_GUARD_ENABLED=false
OCR_TOTAL_REGION=
OCR_TOLERANCE_PCT=0.15
OCR_RECHECK_SECONDS=2.0
OCR_SAMPLES=1
OCR_SAMPLE_INTERVAL=0.12

# Launcher/profile orchestration (optional)
ENABLE_LAUNCHER_ORCHESTRATION=false
LAUNCHER_EXECUTABLE=
LAUNCHER_START_DELAY=2.5
LAUNCHER_ACCOUNT_POINTS={}
LAUNCHER_SWITCH_MENU_XY=3139,987
LAUNCHER_SWITCH_NEXT_XY=3161,409
LAUNCHER_MARKET_ORDERS_XY=3745,488
MARKET_ORDERS_BUTTON_IMAGE_PATH=
MARKET_ORDERS_SEARCH_REGION=
MARKET_ORDERS_MATCH_CONFIDENCE=0.80
LAUNCHER_MARKET_BUTTON_TIMEOUT=300
LAUNCHER_MARKET_BUTTON_POLL_SECONDS=0.25
LAUNCHER_QUIT_BUTTON_XY=3303,982
LAUNCHER_PRE_CTRL_CLICK_WAIT=2.0
LAUNCHER_POST_LAUNCH_WAIT=10.0
LAUNCHER_CLIENT_OPEN_TIMEOUT=20.0
LAUNCHER_POST_TITLE_DETECT_WAIT=7.0
LAUNCHER_SWITCH_MENU_WAIT=5.0
LAUNCHER_AFTER_ESC_WAIT=0.4
LAUNCHER_MAX_SWITCH_ATTEMPTS=6
LAUNCHER_CTRL_HOLD_SECONDS=1.2
LAUNCHER_MARKET_HOLD_SECONDS=3.0
LAUNCHER_CLOSE_WAIT_SECONDS=2.5
LOCATION_ACCOUNT_PROFILE_MAP={}

# Scheduled end-of-run behavior
CLOSE_APP_WHEN_DONE=false
APP_CLOSE_HOTKEY=alt+f4
```

## Calibrate Coordinates

Use this quick helper in Python to print mouse position:

```python
import pyautogui, time
print("Move mouse to target point...")
time.sleep(3)
print(pyautogui.position())
```

Set each `APP_*_XY` value from your own screen and UI scale.

When the API returns 2 updates for the same item, the script will:

- use first-row coordinates for the first update
- use second-row coordinates for the second update
- supports optional row coordinates up to row 6 for crowded filter results

If `APP_SECOND_ROW_XY` / `APP_SECOND_MODIFY_ORDER_XY` are not set, it falls back to first-row coordinates.
For second-row updates of the same item/station, it reuses the current filter and does not retype.

`USE_CLIPBOARD_PASTE=true` is recommended to avoid missed first characters and speed up entry.

If clicks fire too early on your machine, increase:

- `MOUSE_MOVE_DURATION` (e.g. `0.20` or `0.30`)
- `CLICK_SETTLE_SECONDS` (e.g. `0.08` or `0.12`)

If Ctrl-combos are flaky (`Ctrl+A`, `Ctrl+V`), increase:

- `HOTKEY_KEYDOWN_DELAY` (e.g. `0.05` to `0.10`)
- `HOTKEY_AFTER_DELAY` (e.g. `0.05` to `0.10`)

Emergency stop during live run:

- hold `STOP_HOTKEY` for `STOP_HOLD_SECONDS` (default: hold `q` for `0.6s`)
- if you want zero chance of conflict with typing, use e.g. `STOP_HOTKEY=f8`
- for instant stop, set `STOP_HOLD_SECONDS=0` (recommended with `STOP_HOTKEY=f8`)
- pause/resume toggle: `PAUSE_HOTKEY` (default `\`)

In dry-run, stopping is checked between items. Increase `DRY_RUN_STEP_DELAY` if your dry-run
finishes too quickly to catch the hotkey (e.g. `0.5` or `1.0`).

If item-name entry is unreliable in the filter box, use:

- `FILTER_INPUT_METHOD=type` (most reliable)
- or `FILTER_INPUT_METHOD=paste_then_type` (tries paste, then rewrites by typing)

`TYPE_INTERVAL_SECONDS` controls typing speed (raise to `0.02` or `0.03` if needed).
`FILTER_REPLACE_DELAY` is the pause between `Ctrl+A` and paste/type replacement.
`FILTER_MAX_CHARS` limits filter query length; when item name is longer, the script uses the
suffix (last N chars) to keep discriminators like `... EG-602`.

`NORMALIZE_FILTER_TEXT=true` normalizes whitespace in the filter query (and can also strip
quotes if `FILTER_STRIP_QUOTES=true`).

`FILTER_FORCE_LOWERCASE=true` avoids uppercase/Shift issues in some clients by sending
lowercase filter text (search is typically case-insensitive).

`FILTER_STRIP_QUOTES=false` keeps apostrophes/quotes in filter text. Set to `true` only if
your client drops characters around quote keys.

Warning popup handling:

- Preferred: set `WARNING_YES_IMAGE_PATH` to a small screenshot of the warning "Yes" button.
- Optional: set `WARNING_SEARCH_REGION=x,y,w,h` to speed up/strengthen matching.
- Optional fallback: set `APP_WARNING_YES_XY` and `WARNING_FORCE_CLICK_YES=true` to click a fixed
  coordinate if image match isn't available.
- Multi-monitor robust option: set `WARNING_PIXEL_XY` + `WARNING_PIXEL_RGB` (a blue pixel on the
  Yes button) and `APP_WARNING_YES_XY`. When that pixel color appears, script clicks Yes directly.

Important: the warning click is handled **before** confirm API reporting.

OCR safety guard:

- Enable with `OCR_GUARD_ENABLED=true` and set `OCR_TOTAL_REGION=x,y,w,h`.
- Also set `APP_CANCEL_BUTTON_XY=x,y` (required for mismatch recovery).
- The script computes expected relist total as
  `expectedRelistFeeIsk` from `/pricing/script/undercut-check`.
- In script endpoint mode, `expectedRelistFeeIsk` is required and the run fails fast
  if any update is missing it.
- Flow on mismatch:
  - first mismatch: wait `OCR_RECHECK_SECONDS`, then recheck (no Cancel on this first mismatch)
  - second mismatch: click Cancel, restart from filter/search for that item
  - second full-attempt mismatch again: click Cancel and skip item (no confirm for that line)

### Helper: pick pixel color

Use this helper to capture `.env` values for warning button pixel detection:

```powershell
python pick_warning_pixel.py
```

One-shot flow:

- put mouse on a blue pixel of the `Yes` button
- wait for capture
- copy printed `WARNING_PIXEL_XY` and `WARNING_PIXEL_RGB` to `.env`

Optional watch mode:

```powershell
python pick_warning_pixel.py --watch --seconds 20 --interval 0.2
```

### Helper: guided coordinate calibration

Use this wizard to capture most `.env` coordinates in one pass:

```powershell
python calibrate_env_coordinates.py
```

Options:

- `--minimal`: only core app coordinates
- `--no-with-launcher-accounts`: skip launcher account capture (enabled by default)
- `--no-save`: skip writing output file (saving enabled by default)
- `--save-path <path>`: choose output file path (default `calibrated.env`)

### Helper: market orders button detection

Use this side script to test reliable detection/wait logic for Market Orders:

```powershell
python test_market_orders_button.py --mode auto --timeout 35
```

Optional detection envs (only if you want detection gates instead of blind click):

```env
MARKET_ORDERS_PIXEL_XY=
MARKET_ORDERS_PIXEL_RGB=
MARKET_ORDERS_PIXEL_TOLERANCE=24
MARKET_ORDERS_BUTTON_IMAGE_PATH=
MARKET_ORDERS_SEARCH_REGION=
```

If image matching seems different from manual screenshots, capture the template using
PyAutoGUI itself (same screenshot path as matching):

```powershell
python capture_template_pyautogui.py --out market-order-button-pya.png
```

If PyAutoGUI screenshots look black/inaccurate on your machine, use MSS capture instead:

```powershell
python capture_template_mss.py --out market-order-button-mss.png
```

For detection, prefer MSS+OpenCV engine:

```powershell
python test_market_orders_button.py --mode image --image-engine mss_cv2 --timeout 40 --confidence 0.80
```

## Run

Default run (live):

```powershell
python undercut_reprice_automation.py
```

Dry-run validation mode:

```powershell
python undercut_reprice_automation.py --dry-run
```

In dry-run, the script performs the normal UI navigation and OCR checks, then clicks
`Cancel` instead of `OK` for each item, and skips confirm-batch calls.

Scheduled mode (no menu prompts):

```powershell
python undercut_reprice_automation.py --run-mode scheduled
```

Windows Task Scheduler helper:

```bat
run_undercut_scheduled.bat
```

Optional args can be appended, for example:

```bat
run_undercut_scheduled.bat --dry-run
```

Live run (explicit):

```powershell
python undercut_reprice_automation.py --live
```

Live run with cap:

```powershell
python undercut_reprice_automation.py --live --max-updates 5
```

If `--max-updates` is omitted, processing is unlimited.

## Minimal undercut-check body

For your first endpoint call, this is enough:

```json
{
  "cycleId": "YOUR_CYCLE_UUID",
  "groupingMode": "perCharacter"
}
```

`stationIds` is optional.

With `ENABLE_LOCATION_MENU=true`, the script shows a dynamic menu of locations found in the
undercut-check response and processes only the location you select for that run.
After a location completes, the script returns to the menu with remaining locations (no refetch).
If you run multiple game clients, set `ENABLE_WINDOW_FOCUS=false` to avoid title-based window activation.

By default, "red" negative-profit updates are excluded (same intent as undercut-checker):

- red when `estimatedMarginPercentAfter <= RED_PROFIT_THRESHOLD_PERCENT` (default `-10`)
- set `INCLUDE_RED_NEGATIVE_PROFIT=true` to include them
- or use CLI override: `--include-red-negative-profit`

## Auth

All script endpoints use API key auth:

- `SCRIPT_API_KEY` is required
- header used by the script: `x-script-api-key`
- `SCRIPT_REPORT_USER_ID` is optional (backend defaults to authenticated script user)

## Endpoint Notes

- Script update list endpoint: `POST /pricing/script/undercut-check` (requires `x-script-api-key`)
- Script confirm endpoint: `POST /pricing/script/confirm`
- Script batched confirm endpoint: `POST /pricing/script/confirm-batch`
- Script run reporting endpoint: `POST /pricing/script/run-report`

For your current workflow ("Modify Order"), `reprice` is the correct mode.
