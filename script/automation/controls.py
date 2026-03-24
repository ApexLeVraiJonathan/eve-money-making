from __future__ import annotations

import ctypes
import time
from typing import Dict, Optional


class RuntimeControls:
    def __init__(self, stop_key: str, stop_hold_seconds: float, pause_key: str):
        self.stop_key = (stop_key or "q").strip().lower()
        self.stop_hold_seconds = max(0.0, stop_hold_seconds)
        self.pause_key = (pause_key or "\\").strip().lower()
        self._stop_pressed_since: Optional[float] = None
        self._stop_requested = False
        self._paused = False
        self._pause_prev_down = False
        self._user32 = ctypes.windll.user32
        self._stop_vk = self._resolve_vk(self.stop_key, "STOP_HOTKEY")
        self._pause_vk = self._resolve_vk(self.pause_key, "PAUSE_HOTKEY")

    def _resolve_vk(self, key: str, field_name: str) -> int:
        special: Dict[str, int] = {
            "esc": 0x1B,
            "escape": 0x1B,
            "f1": 0x70,
            "f2": 0x71,
            "f3": 0x72,
            "f4": 0x73,
            "f5": 0x74,
            "f6": 0x75,
            "f7": 0x76,
            "f8": 0x77,
            "f9": 0x78,
            "f10": 0x79,
            "f11": 0x7A,
            "f12": 0x7B,
            "pause": 0x13,
            "scrolllock": 0x91,
        }
        if key in special:
            return special[key]
        if len(key) == 1:
            vk = self._user32.VkKeyScanW(ord(key))
            if vk == -1:
                raise ValueError(f"Unsupported {field_name}: {key}")
            return vk & 0xFF
        raise ValueError(f"Unsupported {field_name}: {key}")

    def _is_down(self, vk: int) -> bool:
        return bool(self._user32.GetAsyncKeyState(vk) & 0x8000)

    def poll(self) -> None:
        stop_down = self._is_down(self._stop_vk)
        if self.stop_hold_seconds <= 0:
            if stop_down:
                self._stop_requested = True
        else:
            now = time.time()
            if stop_down:
                if self._stop_pressed_since is None:
                    self._stop_pressed_since = now
                elif (now - self._stop_pressed_since) >= self.stop_hold_seconds:
                    self._stop_requested = True
            else:
                self._stop_pressed_since = None

        pause_down = self._is_down(self._pause_vk)
        if pause_down and not self._pause_prev_down:
            self._paused = not self._paused
            print("Paused." if self._paused else "Resumed.")
        self._pause_prev_down = pause_down

    def is_stop_requested(self) -> bool:
        self.poll()
        return self._stop_requested

    def checkpoint(self) -> bool:
        self.poll()
        if self._stop_requested:
            return True
        while self._paused:
            self.poll()
            if self._stop_requested:
                return True
            time.sleep(0.02)
        return False

    def wait(self, seconds: float, poll_seconds: float = 0.02) -> bool:
        remaining = max(0.0, seconds)
        while remaining > 0:
            if self.checkpoint():
                return True
            step = min(max(0.01, poll_seconds), remaining)
            time.sleep(step)
            remaining -= step
        return self.checkpoint()

