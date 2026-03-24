from __future__ import annotations

import os
import re
import json
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv


def env_str(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name, default)
    return value.strip() if isinstance(value, str) else value


def env_int(name: str, default: int) -> int:
    raw = env_str(name)
    if raw is None or raw == "":
        return default
    m = re.search(r"-?\d+", raw)
    if not m:
        return default
    return int(m.group(0))


def env_float(name: str, default: float) -> float:
    raw = env_str(name)
    if raw is None or raw == "":
        return default
    m = re.search(r"-?\d+(?:\.\d+)?", raw)
    if not m:
        return default
    return float(m.group(0))


def parse_point(name: str) -> Optional[Tuple[int, int]]:
    raw = env_str(name)
    if not raw:
        return None
    nums = re.findall(r"-?\d+", raw)
    if len(nums) < 2:
        return None
    return int(nums[0]), int(nums[1])


def parse_region(name: str) -> Optional[Tuple[int, int, int, int]]:
    raw = env_str(name)
    if not raw:
        return None
    nums = re.findall(r"-?\d+", raw)
    if len(nums) < 4:
        return None
    x, y, w, h = [int(n) for n in nums[:4]]
    return x, y, w, h


def parse_rgb(name: str) -> Optional[Tuple[int, int, int]]:
    raw = env_str(name)
    if not raw:
        return None
    nums = re.findall(r"-?\d+", raw)
    if len(nums) < 3:
        return None
    r, g, b = [int(n) for n in nums[:3]]
    return r, g, b


def parse_json(name: str) -> Dict[str, object]:
    raw = env_str(name)
    if not raw:
        return {}
    try:
        obj = json.loads(raw)
        if isinstance(obj, dict):
            return obj
    except Exception:
        return {}
    return {}


@dataclass
class Config:
    api_base_url: str
    script_api_key: str
    script_report_user_id: str
    cycle_id: str
    grouping_mode: str
    station_ids: Optional[List[int]]
    window_title_contains: str
    enable_window_focus: bool
    max_updates: Optional[int]
    pause_seconds: float
    mouse_move_duration: float
    click_settle_seconds: float
    hotkey_keydown_delay: float
    hotkey_after_delay: float
    dry_run: bool
    confirm_mode: str
    use_clipboard_paste: bool
    filter_input_method: str
    normalize_filter_text: bool
    filter_force_lowercase: bool
    filter_strip_quotes: bool
    filter_max_chars: int
    filter_replace_delay: float
    type_interval_seconds: float
    stop_hotkey: str
    stop_hold_seconds: float
    pause_hotkey: str
    dry_run_step_delay: float
    warning_yes_xy: Optional[Tuple[int, int]]
    warning_yes_image_path: str
    warning_search_region: Optional[Tuple[int, int, int, int]]
    warning_match_confidence: float
    warning_lookup_seconds: float
    warning_poll_seconds: float
    warning_force_click_yes: bool
    warning_pixel_xy: Optional[Tuple[int, int]]
    warning_pixel_rgb: Optional[Tuple[int, int, int]]
    warning_pixel_tolerance: int
    ocr_guard_enabled: bool
    ocr_total_region: Optional[Tuple[int, int, int, int]]
    ocr_tolerance_pct: float
    ocr_recheck_seconds: float
    ocr_samples: int
    ocr_sample_interval: float
    enable_location_menu: bool
    run_mode: str
    single_instance_lock_path: str
    scheduled_location_order: List[str]
    include_red_negative_profit: bool
    red_profit_threshold_percent: float
    filter_input_xy: Tuple[int, int]
    first_row_xy: Tuple[int, int]
    modify_order_xy: Tuple[int, int]
    second_row_xy: Optional[Tuple[int, int]]
    second_modify_order_xy: Optional[Tuple[int, int]]
    third_row_xy: Optional[Tuple[int, int]]
    third_modify_order_xy: Optional[Tuple[int, int]]
    fourth_row_xy: Optional[Tuple[int, int]]
    fourth_modify_order_xy: Optional[Tuple[int, int]]
    fifth_row_xy: Optional[Tuple[int, int]]
    fifth_modify_order_xy: Optional[Tuple[int, int]]
    sixth_row_xy: Optional[Tuple[int, int]]
    sixth_modify_order_xy: Optional[Tuple[int, int]]
    price_input_xy: Tuple[int, int]
    ok_button_xy: Tuple[int, int]
    cancel_button_xy: Optional[Tuple[int, int]]
    enable_launcher_orchestration: bool
    launcher_executable: str
    launcher_start_delay: float
    launcher_account_points: Dict[str, Tuple[int, int]]
    launcher_switch_menu_xy: Tuple[int, int]
    launcher_switch_next_xy: Tuple[int, int]
    launcher_market_orders_xy: Tuple[int, int]
    launcher_quit_button_xy: Tuple[int, int]
    launcher_pre_ctrl_click_wait: float
    launcher_post_launch_wait: float
    launcher_client_open_timeout: float
    launcher_post_title_detect_wait: float
    launcher_switch_menu_wait: float
    launcher_after_esc_wait: float
    launcher_max_switch_attempts: int
    launcher_ctrl_hold_seconds: float
    launcher_market_hold_seconds: float
    launcher_close_wait_seconds: float
    location_account_profile_map: Dict[str, Dict[str, str]]
    close_app_when_done: bool
    app_close_hotkey: str

    @staticmethod
    def from_env() -> "Config":
        load_dotenv()
        station_ids_raw = env_str("UNDERCUT_STATION_IDS")
        station_ids = (
            [int(x.strip()) for x in station_ids_raw.split(",") if x.strip()]
            if station_ids_raw
            else None
        )
        filter_xy = parse_point("APP_FILTER_INPUT_XY")
        first_row_xy = parse_point("APP_FIRST_ROW_XY")
        modify_xy = parse_point("APP_MODIFY_ORDER_XY")
        second_row_xy = parse_point("APP_SECOND_ROW_XY")
        second_modify_xy = parse_point("APP_SECOND_MODIFY_ORDER_XY")
        third_row_xy = parse_point("APP_THIRD_ROW_XY")
        third_modify_xy = parse_point("APP_THIRD_MODIFY_ORDER_XY")
        fourth_row_xy = parse_point("APP_FOURTH_ROW_XY")
        fourth_modify_xy = parse_point("APP_FOURTH_MODIFY_ORDER_XY")
        fifth_row_xy = parse_point("APP_FIFTH_ROW_XY")
        fifth_modify_xy = parse_point("APP_FIFTH_MODIFY_ORDER_XY")
        sixth_row_xy = parse_point("APP_SIXTH_ROW_XY")
        sixth_modify_xy = parse_point("APP_SIXTH_MODIFY_ORDER_XY")
        price_xy = parse_point("APP_PRICE_INPUT_XY")
        ok_xy = parse_point("APP_OK_BUTTON_XY")
        cancel_xy = parse_point("APP_CANCEL_BUTTON_XY")
        warning_yes_xy = parse_point("APP_WARNING_YES_XY")
        warning_search_region = parse_region("WARNING_SEARCH_REGION")
        warning_pixel_xy = parse_point("WARNING_PIXEL_XY")
        warning_pixel_rgb = parse_rgb("WARNING_PIXEL_RGB")
        ocr_total_region = parse_region("OCR_TOTAL_REGION")
        account_points_raw = parse_json("LAUNCHER_ACCOUNT_POINTS")
        location_map_raw = parse_json("LOCATION_ACCOUNT_PROFILE_MAP")
        launcher_switch_menu_xy = (
            parse_point("LAUNCHER_SWITCH_MENU_XY") or (3139, 987)
        )
        launcher_switch_next_xy = (
            parse_point("LAUNCHER_SWITCH_NEXT_XY") or (3161, 409)
        )
        launcher_market_orders_xy = (
            parse_point("LAUNCHER_MARKET_ORDERS_XY") or (3745, 488)
        )
        launcher_quit_button_xy = (
            parse_point("LAUNCHER_QUIT_BUTTON_XY") or (3303, 982)
        )

        account_points: Dict[str, Tuple[int, int]] = {}
        for k, v in account_points_raw.items():
            if isinstance(v, (list, tuple)) and len(v) >= 2:
                account_points[str(k)] = (int(v[0]), int(v[1]))

        location_map: Dict[str, Dict[str, str]] = {}
        for k, v in location_map_raw.items():
            if not isinstance(v, dict):
                continue
            account = str(v.get("account", "")).strip()
            profile = str(v.get("profile", "")).strip()
            if account and profile:
                location_map[str(k).strip().lower()] = {"account": account, "profile": profile}
        if not all([filter_xy, first_row_xy, modify_xy, price_xy, ok_xy]):
            raise ValueError(
                "Missing one or more required APP_*_XY coordinates in .env. "
                "Set APP_FILTER_INPUT_XY, APP_FIRST_ROW_XY, APP_MODIFY_ORDER_XY, "
                "APP_PRICE_INPUT_XY, APP_OK_BUTTON_XY."
            )
        ocr_guard_enabled = (env_str("OCR_GUARD_ENABLED", "false") or "false").lower() == "true"
        if ocr_guard_enabled and not ocr_total_region:
            raise ValueError("OCR_GUARD_ENABLED=true requires OCR_TOTAL_REGION=x,y,w,h in .env.")
        if ocr_guard_enabled and not cancel_xy:
            raise ValueError("OCR_GUARD_ENABLED=true requires APP_CANCEL_BUTTON_XY=x,y in .env.")

        return Config(
            api_base_url=env_str("API_BASE_URL", "http://localhost:3000") or "",
            script_api_key=env_str("SCRIPT_API_KEY", "") or "",
            script_report_user_id=env_str("SCRIPT_REPORT_USER_ID", "") or "",
            cycle_id=env_str("UNDERCUT_CYCLE_ID", "") or "",
            grouping_mode=env_str("UNDERCUT_GROUPING_MODE", "perCharacter") or "perCharacter",
            station_ids=station_ids,
            window_title_contains=env_str("APP_WINDOW_TITLE_CONTAINS", "LeVraiMindTrader")
            or "LeVraiMindTrader",
            enable_window_focus=(
                env_str("ENABLE_WINDOW_FOCUS", "true") or "true"
            ).lower()
            == "true",
            max_updates=None,
            pause_seconds=env_float("PAUSE_SECONDS", 0.25),
            mouse_move_duration=env_float("MOUSE_MOVE_DURATION", 0.15),
            click_settle_seconds=env_float("CLICK_SETTLE_SECONDS", 0.05),
            hotkey_keydown_delay=env_float("HOTKEY_KEYDOWN_DELAY", 0.03),
            hotkey_after_delay=env_float("HOTKEY_AFTER_DELAY", 0.03),
            dry_run=(env_str("DRY_RUN", "false") or "false").lower() == "true",
            confirm_mode=env_str("CONFIRM_MODE", "reprice") or "reprice",
            use_clipboard_paste=(env_str("USE_CLIPBOARD_PASTE", "true") or "true").lower()
            == "true",
            filter_input_method=env_str("FILTER_INPUT_METHOD", "paste") or "paste",
            normalize_filter_text=(
                env_str("NORMALIZE_FILTER_TEXT", "true") or "true"
            ).lower()
            == "true",
            filter_force_lowercase=(
                env_str("FILTER_FORCE_LOWERCASE", "true") or "true"
            ).lower()
            == "true",
            filter_strip_quotes=(env_str("FILTER_STRIP_QUOTES", "false") or "false").lower()
            == "true",
            filter_max_chars=env_int("FILTER_MAX_CHARS", 37),
            filter_replace_delay=env_float("FILTER_REPLACE_DELAY", 0.1),
            type_interval_seconds=env_float("TYPE_INTERVAL_SECONDS", 0.01),
            stop_hotkey=env_str("STOP_HOTKEY", "q") or "q",
            stop_hold_seconds=env_float("STOP_HOLD_SECONDS", 0.6),
            pause_hotkey=env_str("PAUSE_HOTKEY", "\\") or "\\",
            dry_run_step_delay=env_float("DRY_RUN_STEP_DELAY", 0.2),
            warning_yes_xy=warning_yes_xy,
            warning_yes_image_path=env_str("WARNING_YES_IMAGE_PATH", "") or "",
            warning_search_region=warning_search_region,
            warning_match_confidence=env_float("WARNING_MATCH_CONFIDENCE", 0.8),
            warning_lookup_seconds=env_float("WARNING_LOOKUP_SECONDS", 1.6),
            warning_poll_seconds=env_float("WARNING_POLL_SECONDS", 0.12),
            warning_force_click_yes=(
                env_str("WARNING_FORCE_CLICK_YES", "false") or "false"
            ).lower()
            == "true",
            warning_pixel_xy=warning_pixel_xy,
            warning_pixel_rgb=warning_pixel_rgb,
            warning_pixel_tolerance=env_int("WARNING_PIXEL_TOLERANCE", 24),
            ocr_guard_enabled=ocr_guard_enabled,
            ocr_total_region=ocr_total_region,
            ocr_tolerance_pct=env_float("OCR_TOLERANCE_PCT", 0.15),
            ocr_recheck_seconds=env_float("OCR_RECHECK_SECONDS", 2.0),
            ocr_samples=max(1, env_int("OCR_SAMPLES", 1)),
            ocr_sample_interval=env_float("OCR_SAMPLE_INTERVAL", 0.12),
            enable_location_menu=(
                env_str("ENABLE_LOCATION_MENU", "true") or "true"
            ).lower()
            == "true",
            run_mode=env_str("RUN_MODE", "interactive") or "interactive",
            single_instance_lock_path=env_str("SINGLE_INSTANCE_LOCK_PATH", ".automation.lock")
            or ".automation.lock",
            scheduled_location_order=[
                x.strip()
                for x in (env_str("SCHEDULED_LOCATION_ORDER", "") or "").split(",")
                if x.strip()
            ],
            include_red_negative_profit=(
                env_str("INCLUDE_RED_NEGATIVE_PROFIT", "false") or "false"
            ).lower()
            == "true",
            red_profit_threshold_percent=env_float("RED_PROFIT_THRESHOLD_PERCENT", -10.0),
            filter_input_xy=filter_xy,  # type: ignore[arg-type]
            first_row_xy=first_row_xy,  # type: ignore[arg-type]
            modify_order_xy=modify_xy,  # type: ignore[arg-type]
            second_row_xy=second_row_xy,
            second_modify_order_xy=second_modify_xy,
            third_row_xy=third_row_xy,
            third_modify_order_xy=third_modify_xy,
            fourth_row_xy=fourth_row_xy,
            fourth_modify_order_xy=fourth_modify_xy,
            fifth_row_xy=fifth_row_xy,
            fifth_modify_order_xy=fifth_modify_xy,
            sixth_row_xy=sixth_row_xy,
            sixth_modify_order_xy=sixth_modify_xy,
            price_input_xy=price_xy,  # type: ignore[arg-type]
            ok_button_xy=ok_xy,  # type: ignore[arg-type]
            cancel_button_xy=cancel_xy,
            enable_launcher_orchestration=(
                env_str("ENABLE_LAUNCHER_ORCHESTRATION", "false") or "false"
            ).lower()
            == "true",
            launcher_executable=env_str("LAUNCHER_EXECUTABLE", "") or "",
            launcher_start_delay=env_float("LAUNCHER_START_DELAY", 2.5),
            launcher_account_points=account_points,
            launcher_switch_menu_xy=launcher_switch_menu_xy,
            launcher_switch_next_xy=launcher_switch_next_xy,
            launcher_market_orders_xy=launcher_market_orders_xy,
            launcher_quit_button_xy=launcher_quit_button_xy,
            launcher_pre_ctrl_click_wait=env_float("LAUNCHER_PRE_CTRL_CLICK_WAIT", 2.0),
            launcher_post_launch_wait=env_float("LAUNCHER_POST_LAUNCH_WAIT", 10.0),
            launcher_client_open_timeout=env_float("LAUNCHER_CLIENT_OPEN_TIMEOUT", 20.0),
            launcher_post_title_detect_wait=env_float("LAUNCHER_POST_TITLE_DETECT_WAIT", 7.0),
            launcher_switch_menu_wait=env_float("LAUNCHER_SWITCH_MENU_WAIT", 5.0),
            launcher_after_esc_wait=env_float("LAUNCHER_AFTER_ESC_WAIT", 0.4),
            launcher_max_switch_attempts=max(1, env_int("LAUNCHER_MAX_SWITCH_ATTEMPTS", 6)),
            launcher_ctrl_hold_seconds=env_float("LAUNCHER_CTRL_HOLD_SECONDS", 1.2),
            launcher_market_hold_seconds=env_float("LAUNCHER_MARKET_HOLD_SECONDS", 3.0),
            launcher_close_wait_seconds=env_float("LAUNCHER_CLOSE_WAIT_SECONDS", 2.5),
            location_account_profile_map=location_map,
            close_app_when_done=(env_str("CLOSE_APP_WHEN_DONE", "false") or "false").lower()
            == "true",
            app_close_hotkey=env_str("APP_CLOSE_HOTKEY", "alt+f4") or "alt+f4",
        )

