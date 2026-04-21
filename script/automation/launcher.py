from __future__ import annotations

import os
import re
import shlex
import subprocess
import time
from typing import Optional, Tuple

import pyautogui

from .config import Config
from .controls import RuntimeControls

try:
    import mss
except Exception:  # pragma: no cover
    mss = None

try:
    import cv2
except Exception:  # pragma: no cover
    cv2 = None

try:
    import numpy as np
except Exception:  # pragma: no cover
    np = None


class LauncherOrchestrator:
    def __init__(self, cfg: Config, controls: Optional[RuntimeControls] = None):
        self.cfg = cfg
        self.controls = controls
        self._launcher_started = False
        self._current_account: Optional[str] = None
        self._current_profile: Optional[str] = None

    def _wait(self, seconds: float) -> None:
        if self.controls is not None and self.controls.wait(seconds):
            raise KeyboardInterrupt("Stop hotkey requested by user.")
        if self.controls is None:
            time.sleep(max(0.0, seconds))

    def _click(self, xy: tuple[int, int]) -> None:
        pyautogui.moveTo(xy[0], xy[1], duration=0.15)
        self._wait(0.05)
        pyautogui.click()

    def _ctrl_click(self, xy: tuple[int, int]) -> None:
        pyautogui.moveTo(xy[0], xy[1], duration=0.15)
        self._wait(0.05)
        pyautogui.keyDown("ctrl")
        self._wait(0.04)
        pyautogui.click()
        self._wait(self.cfg.launcher_ctrl_hold_seconds)
        pyautogui.keyUp("ctrl")

    def _infer_profile_for_location_key(self, key: str) -> Optional[str]:
        if "dodixie" in key:
            return "levraimindtrader01"
        if "hek" in key:
            return "levraimindtrader02"
        if "rens" in key:
            return "levraimindtrader03"
        if "amarr" in key:
            return "levraimindtrader04"
        return None

    def _infer_location_for_profile(self, profile: Optional[str]) -> Optional[str]:
        p = (profile or "").strip().lower()
        if p.endswith("01"):
            return "dodixie"
        if p.endswith("02"):
            return "hek"
        if p.endswith("03"):
            return "rens"
        if p.endswith("04"):
            return "amarr"
        return None

    def _map_for_location(self, location_label: str) -> Optional[dict[str, str]]:
        key = (location_label or "").strip().lower()
        mapped = self.cfg.location_account_profile_map.get(key)
        if mapped:
            return mapped
        default_profile = self._infer_profile_for_location_key(key)
        if not default_profile:
            return None
        return {
            "account": "account2" if default_profile == "levraimindtrader04" else "account1",
            "profile": default_profile,
        }

    def _extract_profile_from_title(self, title: str) -> Optional[str]:
        m = re.search(r"LeVraiMindTrader\s*0*(\d+)", title, flags=re.IGNORECASE)
        if not m:
            return None
        num = int(m.group(1))
        return f"levraimindtrader{num:02d}"

    def _get_client_title_and_profile(self) -> Tuple[Optional[str], Optional[str]]:
        active = pyautogui.getActiveWindowTitle()
        if active and "levraimindtrader" in active.lower():
            return active, self._extract_profile_from_title(active)

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
                return title, self._extract_profile_from_title(title)
        except Exception:
            return None, None
        return None, None

    def _wait_for_client_title_contains(self) -> tuple[Optional[str], Optional[str]]:
        end = time.time() + max(0.0, self.cfg.launcher_client_open_timeout)
        last_seen: Optional[str] = None
        while time.time() < end:
            if self.controls is not None and self.controls.checkpoint():
                raise KeyboardInterrupt("Stop hotkey requested by user.")
            title, profile = self._get_client_title_and_profile()
            if title:
                return title, profile
            active = pyautogui.getActiveWindowTitle()
            if active:
                last_seen = active
            self._wait(0.2)
        return last_seen, None

    def _switch_next_profile_once(self) -> None:
        pyautogui.press("esc")
        self._wait(self.cfg.launcher_after_esc_wait)
        self._click(self.cfg.launcher_switch_menu_xy)
        self._wait(self.cfg.launcher_switch_menu_wait)
        self._click(self.cfg.launcher_switch_next_xy)
        self._wait_for_client_title_contains()
        self._wait(self.cfg.launcher_post_title_detect_wait)

    def _open_market_orders(self) -> None:
        image_path = (self.cfg.launcher_market_button_image_path or "").strip()
        if not image_path:
            self._click(self.cfg.launcher_market_orders_xy)
            self._wait(self.cfg.launcher_market_hold_seconds)
            return

        resolved_image_path = image_path
        if not os.path.isabs(resolved_image_path):
            resolved_image_path = os.path.join(
                os.path.dirname(os.path.dirname(__file__)), resolved_image_path
            )
        if not os.path.exists(resolved_image_path):
            raise RuntimeError(
                f"Market Orders image template not found: {resolved_image_path}"
            )

        found_xy = self._wait_for_market_orders_button(
            image_path=resolved_image_path,
            timeout_seconds=self.cfg.launcher_market_button_timeout,
            poll_seconds=self.cfg.launcher_market_button_poll_seconds,
            confidence=self.cfg.launcher_market_button_confidence,
            region=self.cfg.launcher_market_button_search_region,
        )
        if found_xy is None:
            raise RuntimeError(
                "Timed out waiting for Market Orders button to appear "
                f"(timeout={self.cfg.launcher_market_button_timeout:.1f}s)."
            )
        self._click(found_xy)
        self._wait(self.cfg.launcher_market_hold_seconds)

    def _wait_for_market_orders_button(
        self,
        image_path: str,
        timeout_seconds: float,
        poll_seconds: float,
        confidence: float,
        region: Optional[Tuple[int, int, int, int]],
    ) -> Optional[Tuple[int, int]]:
        if mss is None or cv2 is None or np is None:
            raise RuntimeError(
                "MSS/OpenCV/Numpy are required for MARKET_ORDERS_BUTTON_IMAGE_PATH matching."
            )
        template = cv2.imread(image_path, cv2.IMREAD_COLOR)
        if template is None:
            raise RuntimeError(f"Could not read Market Orders template image: {image_path}")

        conf = max(0.10, min(0.99, float(confidence)))
        end = time.time() + max(0.0, timeout_seconds)
        with mss.mss() as sct:
            while time.time() < end:
                if self.controls is not None and self.controls.checkpoint():
                    raise KeyboardInterrupt("Stop hotkey requested by user.")

                if region:
                    x, y, w, h = region
                    monitor = {
                        "left": int(x),
                        "top": int(y),
                        "width": int(w),
                        "height": int(h),
                    }
                    left, top = int(x), int(y)
                else:
                    mon = sct.monitors[0]
                    monitor = {
                        "left": int(mon["left"]),
                        "top": int(mon["top"]),
                        "width": int(mon["width"]),
                        "height": int(mon["height"]),
                    }
                    left, top = int(mon["left"]), int(mon["top"])

                shot = sct.grab(monitor)
                haystack = np.array(shot)[:, :, :3]
                th, tw = template.shape[:2]
                hh, hw = haystack.shape[:2]
                if th <= hh and tw <= hw:
                    result = cv2.matchTemplate(haystack, template, cv2.TM_CCOEFF_NORMED)
                    _, max_val, _, max_loc = cv2.minMaxLoc(result)
                    if float(max_val) >= conf:
                        mx = int(left + max_loc[0] + (tw // 2))
                        my = int(top + max_loc[1] + (th // 2))
                        return mx, my
                self._wait(max(0.05, poll_seconds))
        return None

    def _close_active_client(self) -> None:
        pyautogui.press("esc")
        self._wait(self.cfg.launcher_after_esc_wait)
        self._click(self.cfg.launcher_quit_button_xy)
        self._wait(self.cfg.launcher_close_wait_seconds)
        title, _ = self._get_client_title_and_profile()
        if title and "levraimindtrader" in title.lower():
            pyautogui.hotkey("alt", "f4")
            self._wait(self.cfg.launcher_close_wait_seconds)
        self._current_account = None
        self._current_profile = None

    def _sync_current_profile(self) -> None:
        _, profile = self._get_client_title_and_profile()
        if profile:
            self._current_profile = profile
            self._current_account = (
                "account2" if profile.lower().endswith("04") else "account1"
            )

    def _ensure_target_profile(self, target_profile: str) -> None:
        target = (target_profile or "").strip().lower()
        self._sync_current_profile()
        if (self._current_profile or "").lower() == target:
            self._open_market_orders()
            return
        attempts = max(1, self.cfg.launcher_max_switch_attempts)
        for _ in range(attempts):
            self._switch_next_profile_once()
            self._sync_current_profile()
            if (self._current_profile or "").lower() == target:
                self._open_market_orders()
                return
        title, current = self._get_client_title_and_profile()
        raise RuntimeError(
            "Failed to switch to target profile. "
            f"target={target_profile} current={current} title={title}"
        )

    def active_location_label(self) -> Optional[str]:
        self._sync_current_profile()
        return self._infer_location_for_profile(self._current_profile)

    def start_launcher_if_needed(self) -> None:
        if not self.cfg.enable_launcher_orchestration:
            return
        exe = (self.cfg.launcher_executable or "").strip()
        if not exe:
            raise ValueError("ENABLE_LAUNCHER_ORCHESTRATION=true but LAUNCHER_EXECUTABLE is empty.")
        if self._launcher_started:
            return
        subprocess.Popen(shlex.split(exe, posix=False))  # noqa: S603,S607 - trusted local config
        self._wait(self.cfg.launcher_start_delay)
        self._wait(self.cfg.launcher_pre_ctrl_click_wait)
        self._launcher_started = True

    def switch_for_location(self, location_label: str) -> None:
        if not self.cfg.enable_launcher_orchestration:
            return
        mapping = self._map_for_location(location_label)
        if not mapping:
            return

        account = (mapping.get("account", "") or "").strip().lower()
        profile = (mapping.get("profile", "") or "").strip().lower()
        if not account or not profile:
            return

        account_xy = self.cfg.launcher_account_points.get(account)
        if account_xy is None:
            raise ValueError(
                f"Missing launcher coordinates for account={account} profile={profile}."
            )

        self._sync_current_profile()
        if self._current_account and self._current_account != account:
            self._close_active_client()
            self._wait(0.6)

        if not self._current_account:
            self._ctrl_click(account_xy)
            self._wait(self.cfg.launcher_post_launch_wait)
            self._wait_for_client_title_contains()
            self._wait(self.cfg.launcher_post_title_detect_wait)
            self._sync_current_profile()
            self._current_account = account

        self._ensure_target_profile(profile)

    def close_current_client_if_open(self) -> bool:
        """Close the active LeVraiMindTrader client using launcher quit flow."""
        self._sync_current_profile()
        if not self._current_account:
            return False
        self._close_active_client()
        return True
