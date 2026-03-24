from __future__ import annotations

import argparse
import ctypes
import json
import os
import re
import shlex
import subprocess
import time
from pathlib import Path
from typing import Dict, Optional, Tuple

import pyautogui
from dotenv import load_dotenv

LOCATION_TO_PROFILE = {
    "dodixie": "levraimindtrader01",
    "hek": "levraimindtrader02",
    "rens": "levraimindtrader03",
    "amarr": "levraimindtrader04",
}


def env_str(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name, default)
    if value is None:
        return None
    value = value.strip()
    return value if value else None


def parse_point(raw: Optional[str]) -> Optional[Tuple[int, int]]:
    if not raw:
        return None
    nums = re.findall(r"-?\d+", raw)
    if len(nums) < 2:
        return None
    return int(nums[0]), int(nums[1])


def parse_points_map(raw: Optional[str]) -> Dict[str, Tuple[int, int]]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:
        return {}
    out: Dict[str, Tuple[int, int]] = {}
    if not isinstance(parsed, dict):
        return out
    for k, v in parsed.items():
        if isinstance(v, (list, tuple)) and len(v) >= 2:
            out[str(k)] = (int(v[0]), int(v[1]))
    return out


def q_pressed() -> bool:
    return bool(ctypes.windll.user32.GetAsyncKeyState(0x51) & 0x8000)


def wait_or_quit(seconds: float, poll: float = 0.05) -> None:
    end = time.time() + max(0.0, seconds)
    while time.time() < end:
        if q_pressed():
            raise KeyboardInterrupt("User requested quit with q.")
        time.sleep(max(0.01, poll))


def click_xy(xy: Tuple[int, int], move_duration: float, settle: float) -> None:
    pyautogui.moveTo(xy[0], xy[1], duration=max(0.0, move_duration))
    time.sleep(max(0.0, settle))
    pyautogui.click()


def ctrl_click_xy(
    xy: Tuple[int, int], move_duration: float, settle: float, ctrl_hold_seconds: float
) -> None:
    pyautogui.moveTo(xy[0], xy[1], duration=max(0.0, move_duration))
    time.sleep(max(0.0, settle))
    pyautogui.keyDown("ctrl")
    time.sleep(0.04)
    pyautogui.click()
    time.sleep(max(0.0, ctrl_hold_seconds))
    pyautogui.keyUp("ctrl")


def extract_profile_from_title(title: str) -> Optional[str]:
    m = re.search(r"LeVraiMindTrader\s*0*(\d+)", title, flags=re.IGNORECASE)
    if not m:
        return None
    num = int(m.group(1))
    return f"levraimindtrader{num:02d}"


def get_client_title_and_profile() -> Tuple[Optional[str], Optional[str]]:
    active = pyautogui.getActiveWindowTitle()
    if active and "levraimindtrader" in active.lower():
        return active, extract_profile_from_title(active)

    try:
        import pygetwindow as gw  # optional dependency
    except Exception:
        return None, None
    try:
        for t in gw.getAllTitles():
            title = (t or "").strip()
            if not title:
                continue
            if "levraimindtrader" not in title.lower():
                continue
            return title, extract_profile_from_title(title)
    except Exception:
        return None, None
    return None, None


def wait_for_client_title_contains(timeout_seconds: float) -> Tuple[Optional[str], Optional[str]]:
    end = time.time() + max(0.0, timeout_seconds)
    last_seen: Optional[str] = None
    while time.time() < end:
        if q_pressed():
            raise KeyboardInterrupt("User requested quit with q.")
        title, profile = get_client_title_and_profile()
        if title:
            return title, profile
        active = pyautogui.getActiveWindowTitle()
        if active:
            last_seen = active
        time.sleep(0.2)
    return last_seen, None


def wait_for_target_profile(
    target_profile: str, timeout_seconds: float
) -> Tuple[bool, Optional[str], Optional[str]]:
    end = time.time() + max(0.0, timeout_seconds)
    last_title: Optional[str] = None
    last_profile: Optional[str] = None
    while time.time() < end:
        if q_pressed():
            raise KeyboardInterrupt("User requested quit with q.")
        title, profile = get_client_title_and_profile()
        if title:
            last_title = title
        if profile:
            last_profile = profile
        if profile == target_profile:
            return True, last_title, last_profile
        time.sleep(0.2)
    return False, last_title, last_profile


def close_active_client(
    quit_button_xy: Tuple[int, int],
    move_duration: float,
    settle: float,
    close_wait_seconds: float,
) -> None:
    # Preferred close path: Esc menu -> Quit button click.
    pyautogui.press("esc")
    wait_or_quit(0.4)
    click_xy(quit_button_xy, move_duration, settle)
    wait_or_quit(max(0.0, close_wait_seconds))
    # Fallback if still open.
    title, _ = get_client_title_and_profile()
    if title and "levraimindtrader" in title.lower():
        pyautogui.hotkey("alt", "f4")
        wait_or_quit(max(0.0, close_wait_seconds))


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Test launcher orchestration and profile switching."
    )
    p.add_argument(
        "--location",
        required=False,
        choices=["dodixie", "hek", "rens", "amarr"],
        help="Single target location/profile.",
    )
    p.add_argument(
        "--full-flow",
        action="store_true",
        help="Run full cycle: p01 -> p02 -> p03 -> close -> p04 -> close.",
    )
    p.add_argument("--start-launcher", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--move-duration", type=float, default=0.15)
    p.add_argument("--settle", type=float, default=0.06)
    p.add_argument("--post-launch-wait", type=float, default=10.0)
    p.add_argument("--client-open-timeout", type=float, default=20.0)
    p.add_argument("--pre-ctrl-click-wait", type=float, default=2.0)
    p.add_argument("--post-title-detect-wait", type=float, default=7.0)
    p.add_argument("--switch-menu-wait", type=float, default=5.0)
    p.add_argument("--max-switch-attempts", type=int, default=6)
    p.add_argument("--ctrl-hold-seconds", type=float, default=1.2)
    p.add_argument("--market-hold-seconds", type=float, default=3.0)
    p.add_argument("--close-wait-seconds", type=float, default=2.5)
    return p.parse_args()


def main() -> None:
    load_dotenv(Path(__file__).resolve().parent / ".env")
    args = parse_args()

    if not args.full_flow and not args.location:
        raise SystemExit("Provide --location or --full-flow.")

    launcher_cmd = env_str("LAUNCHER_EXECUTABLE", "")
    launcher_start_delay = float(env_str("LAUNCHER_START_DELAY", "2.5") or "2.5")
    account_points = parse_points_map(env_str("LAUNCHER_ACCOUNT_POINTS", "{}"))

    # Defaults from your calibration.
    account1_xy = account_points.get("account1") or (2521, 465)
    account2_xy = account_points.get("account2") or (2563, 397)
    switch_menu_xy = parse_point(env_str("LAUNCHER_SWITCH_MENU_XY", "3139,987")) or (3139, 987)
    switch_next_xy = parse_point(env_str("LAUNCHER_SWITCH_NEXT_XY", "3161,409")) or (3161, 409)
    market_orders_xy = parse_point(env_str("LAUNCHER_MARKET_ORDERS_XY", "3745,488")) or (3745, 488)
    quit_button_xy = parse_point(env_str("LAUNCHER_QUIT_BUTTON_XY", "3303,982")) or (3303, 982)

    print("Launcher test plan")
    print(f"- mode: {'full-flow' if args.full_flow else 'single-location'}")
    if args.location:
        print(f"- location: {args.location}")
    print(f"- account1 xy: {account1_xy[0]},{account1_xy[1]}")
    print(f"- account2 xy: {account2_xy[0]},{account2_xy[1]}")
    print(f"- switch menu xy: {switch_menu_xy[0]},{switch_menu_xy[1]}")
    print(f"- switch next xy: {switch_next_xy[0]},{switch_next_xy[1]}")
    print(f"- market orders xy: {market_orders_xy[0]},{market_orders_xy[1]}")
    print(f"- quit button xy: {quit_button_xy[0]},{quit_button_xy[1]}")
    print(f"- pre-ctrl-click wait: {args.pre_ctrl_click_wait:.1f}s")
    print(f"- post-title-detect wait: {args.post_title_detect_wait:.1f}s")
    print(f"- switch-menu wait: {args.switch_menu_wait:.1f}s")
    print(f"- market hold: {args.market_hold_seconds:.1f}s")
    print(f"- close wait: {args.close_wait_seconds:.1f}s")
    print("- press q any time to stop")
    print("")

    if args.dry_run:
        return

    def open_market_and_hold() -> None:
        print("Opening market orders...")
        click_xy(market_orders_xy, args.move_duration, args.settle)
        wait_or_quit(args.market_hold_seconds)

    def wait_after_launch() -> None:
        wait_or_quit(args.post_launch_wait)
        print("Waiting for client window title to contain LeVraiMindTrader...")
        title, profile = wait_for_client_title_contains(args.client_open_timeout)
        if title and "levraimindtrader" in title.lower():
            print(f"Detected title: {title}")
            print(f"Detected profile: {profile or '<unknown>'}")
            wait_or_quit(args.post_title_detect_wait)
        else:
            print("Warning: did not detect LeVraiMindTrader title within timeout.")

    def switch_until_profile(target_profile: str) -> bool:
        for attempt in range(1, max(1, args.max_switch_attempts) + 1):
            title, current = get_client_title_and_profile()
            print(
                f"  attempt {attempt}: current={current or '<unknown>'} "
                f"title={title or '<unknown>'}"
            )
            if current == target_profile:
                return True

            pyautogui.press("esc")
            click_xy(switch_menu_xy, args.move_duration, args.settle)
            wait_or_quit(args.switch_menu_wait)
            click_xy(switch_next_xy, args.move_duration, args.settle)

            found, seen_title, seen_profile = wait_for_target_profile(
                target_profile, args.client_open_timeout
            )
            print(
                f"    seen after switch: profile={seen_profile or '<unknown>'} "
                f"title={seen_title or '<unknown>'}"
            )
            wait_or_quit(args.post_title_detect_wait)
            if found:
                return True
            _, current = get_client_title_and_profile()
            if current == target_profile:
                return True
        return False

    def launch_account(account_xy: Tuple[int, int], target_profile: str) -> None:
        print(f"Ctrl+click launch at {account_xy[0]},{account_xy[1]} ...")
        ctrl_click_xy(account_xy, args.move_duration, args.settle, args.ctrl_hold_seconds)
        wait_after_launch()
        if target_profile != "levraimindtrader04":
            ok = switch_until_profile(target_profile)
            if not ok:
                title, current = get_client_title_and_profile()
                print(
                    "Warning: target profile not confirmed. "
                    f"target={target_profile}, current={current}, title={title}"
                )

    try:
        if args.start_launcher:
            if not launcher_cmd:
                raise SystemExit("LAUNCHER_EXECUTABLE is empty in .env.")
            print(f"Starting launcher command: {launcher_cmd}")
            subprocess.Popen(shlex.split(launcher_cmd, posix=False))  # noqa: S603,S607
            wait_or_quit(launcher_start_delay)
            wait_or_quit(args.pre_ctrl_click_wait)

        if args.full_flow:
            required_profiles = {
                "levraimindtrader01",
                "levraimindtrader02",
                "levraimindtrader03",
            }
            visited_profiles: set[str] = set()

            print("Step 1/6: launch account1 (any profile order accepted)")
            launch_account(account1_xy, "levraimindtrader01")
            _, current_profile = get_client_title_and_profile()
            if current_profile in required_profiles:
                print(f"Visited {current_profile} on account1.")
                visited_profiles.add(current_profile)
                open_market_and_hold()

            # Keep cycling account1 profiles until all 3 were visited at least once.
            cycle_attempts = 0
            max_cycles = max(3, args.max_switch_attempts * 3)
            while len(visited_profiles) < 3 and cycle_attempts < max_cycles:
                cycle_attempts += 1
                pyautogui.press("esc")
                click_xy(switch_menu_xy, args.move_duration, args.settle)
                wait_or_quit(max(0.0, args.switch_menu_wait))
                click_xy(switch_next_xy, args.move_duration, args.settle)
                _, _ = wait_for_client_title_contains(args.client_open_timeout)
                wait_or_quit(args.post_title_detect_wait)
                _, current_profile = get_client_title_and_profile()
                if current_profile in required_profiles and current_profile not in visited_profiles:
                    print(f"Visited {current_profile} on account1.")
                    visited_profiles.add(current_profile)
                    open_market_and_hold()
                else:
                    print(
                        f"Cycle {cycle_attempts}: profile={current_profile or '<unknown>'} "
                        f"(visited={sorted(visited_profiles)})"
                    )

            if len(visited_profiles) < 3:
                print(
                    "Warning: account1 full coverage not reached. "
                    f"Visited={sorted(visited_profiles)}"
                )

            print("Step 4/6: close account1 client")
            close_active_client(
                quit_button_xy, args.move_duration, args.settle, args.close_wait_seconds
            )

            print("Step 5/6: launch account2 profile04 (Amarr)")
            launch_account(account2_xy, "levraimindtrader04")
            open_market_and_hold()

            print("Step 6/6: close account2 client")
            close_active_client(
                quit_button_xy, args.move_duration, args.settle, args.close_wait_seconds
            )
            print("Full flow completed.")
        else:
            target = LOCATION_TO_PROFILE[args.location]  # type: ignore[index]
            account_xy = account2_xy if target == "levraimindtrader04" else account1_xy
            launch_account(account_xy, target)
            open_market_and_hold()
            print("Single-location test completed.")
    except KeyboardInterrupt:
        print("Stopped by user (q).")


if __name__ == "__main__":
    main()
