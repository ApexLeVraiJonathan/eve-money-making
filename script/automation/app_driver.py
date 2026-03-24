from __future__ import annotations

import time
from typing import Callable, Optional, Tuple

import cv2
import numpy as np
import pyautogui

try:
    import pygetwindow as gw
except Exception:  # pragma: no cover
    gw = None

try:
    import pydirectinput as directinput
except Exception:  # pragma: no cover
    directinput = None

try:
    import pyperclip
except Exception:  # pragma: no cover
    pyperclip = None

try:
    import mss
except Exception:  # pragma: no cover
    mss = None

try:
    from rapidocr_onnxruntime import RapidOCR
except Exception:  # pragma: no cover
    RapidOCR = None

from .config import Config
from .controls import RuntimeControls
from .planner import build_filter_query


class AppDriver:
    def __init__(self, cfg: Config, controls: Optional[RuntimeControls] = None):
        self.cfg = cfg
        self.controls = controls
        self._focus_warning_printed = False
        self._ocr_engine = None

    def _sleep(self, seconds: float) -> None:
        if self.controls is not None:
            if self.controls.wait(seconds):
                raise KeyboardInterrupt("Stop hotkey requested by user.")
            return
        time.sleep(max(0.0, seconds))

    def focus_window(self) -> None:
        if not self.cfg.enable_window_focus:
            return
        if gw is None:
            return
        title = (self.cfg.window_title_contains or "").strip()
        if not title:
            return
        try:
            windows = gw.getWindowsWithTitle(title)
        except Exception:
            return
        if not windows:
            return

        # Try each matched window; some handles can be stale/invalid.
        for win in windows:
            try:
                if win.isMinimized:
                    win.restore()
                    self._sleep(0.1)
                win.activate()
                self._sleep(0.15)
                return
            except Exception:
                continue

        # Don't fail the whole run if activation fails; absolute clicks may still work.
        if not self._focus_warning_printed:
            print(
                "Warning: could not activate target window (invalid handle). "
                "Continuing with current foreground window."
            )
            self._focus_warning_printed = True

    def _type_text(self, text: str) -> None:
        if directinput:
            directinput.write(text)
        else:
            pyautogui.write(text, interval=max(0.0, self.cfg.type_interval_seconds))

    def _type_filter_text(self, text: str) -> None:
        pyautogui.write(text, interval=max(0.0, self.cfg.type_interval_seconds))

    def _ctrl_combo(self, key: str) -> None:
        pyautogui.keyDown("ctrl")
        self._sleep(max(0.0, self.cfg.hotkey_keydown_delay))
        pyautogui.press(key)
        self._sleep(max(0.0, self.cfg.hotkey_keydown_delay))
        pyautogui.keyUp("ctrl")
        self._sleep(max(0.0, self.cfg.hotkey_after_delay))

    def _paste_text(self, text: str) -> None:
        if pyperclip is None:
            self._type_text(text)
            return
        pyperclip.copy(text)
        self._sleep(0.05)
        self._ctrl_combo("v")

    def _enter_text(self, text: str) -> None:
        if self.cfg.use_clipboard_paste:
            self._paste_text(text)
        else:
            self._type_text(text)

    def _enter_filter_text(self, text: str) -> None:
        mode = self.cfg.filter_input_method.strip().lower()
        if mode == "type":
            self._type_filter_text(text)
            return
        if mode == "paste_then_type":
            self._ctrl_combo("a")
            self._sleep(max(0.0, self.cfg.filter_replace_delay))
            self._paste_text(text)
            self._sleep(0.08)
            self._ctrl_combo("a")
            self._sleep(0.04)
            self._type_filter_text(text)
            return
        self._ctrl_combo("a")
        self._sleep(max(0.0, self.cfg.filter_replace_delay))
        self._paste_text(text)

    def _clear_filter_input(self) -> None:
        for _ in range(2):
            self._ctrl_combo("a")
            self._sleep(0.03)
            pyautogui.press("backspace")
            self._sleep(0.03)
            self._ctrl_combo("a")
            self._sleep(0.03)
            pyautogui.press("delete")
            self._sleep(0.04)

    def _move_to(self, point: Tuple[int, int]) -> None:
        pyautogui.moveTo(
            point[0],
            point[1],
            duration=max(0.0, self.cfg.mouse_move_duration),
        )
        self._sleep(max(0.0, self.cfg.click_settle_seconds))

    def _click(self, point: Tuple[int, int]) -> None:
        self._move_to(point)
        pyautogui.click()

    def _right_click(self, point: Tuple[int, int]) -> None:
        self._move_to(point)
        pyautogui.rightClick()

    def _locate_on_screen(
        self, image_path: str, region: Optional[Tuple[int, int, int, int]]
    ) -> Optional[Tuple[int, int]]:
        if not image_path:
            return None

        def locate(region_arg: Optional[Tuple[int, int, int, int]]):
            return pyautogui.locateCenterOnScreen(
                image_path,
                region=region_arg,
                confidence=self.cfg.warning_match_confidence,
                grayscale=True,
            )

        try:
            center = locate(region)
        except pyautogui.ImageNotFoundException:
            return None
        except TypeError:
            try:
                center = pyautogui.locateCenterOnScreen(
                    image_path,
                    region=region,
                    grayscale=True,
                )
            except pyautogui.ImageNotFoundException:
                return None
            except pyautogui.PyAutoGUIException:
                return None
            except ValueError:
                if region is not None:
                    try:
                        center = pyautogui.locateCenterOnScreen(
                            image_path,
                            region=None,
                            grayscale=True,
                        )
                    except pyautogui.ImageNotFoundException:
                        return None
                    except Exception:
                        return None
                else:
                    return None
        except ValueError:
            if region is not None:
                try:
                    center = locate(None)
                except pyautogui.ImageNotFoundException:
                    return None
                except Exception:
                    return None
            else:
                return None
        except pyautogui.PyAutoGUIException:
            return None
        if center is None:
            return None
        return int(center.x), int(center.y)

    def _read_pixel_rgb(self, x: int, y: int) -> Optional[Tuple[int, int, int]]:
        # Prefer pyautogui color order on this setup; MSS remains fallback.
        try:
            c = pyautogui.pixel(x, y)
            return int(c[0]), int(c[1]), int(c[2])
        except Exception:
            pass
        if mss is not None:
            try:
                with mss.mss() as sct:
                    shot = sct.grab({"left": x, "top": y, "width": 1, "height": 1})
                    b, g, r = shot.pixel(0, 0)
                    return int(r), int(g), int(b)
            except Exception:
                pass
        return None

    def _warning_pixel_matches(self) -> bool:
        if not self.cfg.warning_pixel_xy or not self.cfg.warning_pixel_rgb:
            return False
        observed = self._read_pixel_rgb(
            self.cfg.warning_pixel_xy[0], self.cfg.warning_pixel_xy[1]
        )
        if observed is None:
            return False
        target = self.cfg.warning_pixel_rgb
        tol = max(0, int(self.cfg.warning_pixel_tolerance))
        return (
            abs(observed[0] - target[0]) <= tol
            and abs(observed[1] - target[1]) <= tol
            and abs(observed[2] - target[2]) <= tol
        )

    def _handle_warning_dialog_if_present(self) -> None:
        image_path = self.cfg.warning_yes_image_path.strip()
        region = self.cfg.warning_search_region
        end_at = time.time() + max(0.0, self.cfg.warning_lookup_seconds)

        while time.time() < end_at:
            if self._warning_pixel_matches() and self.cfg.warning_yes_xy:
                self._click(self.cfg.warning_yes_xy)
                self._sleep(max(0.2, self.cfg.pause_seconds))
                return

            yes_point = self._locate_on_screen(image_path, region)
            if yes_point is not None:
                self._click(yes_point)
                self._sleep(max(0.2, self.cfg.pause_seconds))
                return
            self._sleep(max(0.02, self.cfg.warning_poll_seconds))

        if self.cfg.warning_force_click_yes and self.cfg.warning_yes_xy:
            self._click(self.cfg.warning_yes_xy)
            self._sleep(max(0.2, self.cfg.pause_seconds))

    def _parse_isk_candidates(self, text: str) -> list[float]:
        def parse_compact_number(compact: str) -> list[float]:
            out: list[float] = []
            if not compact:
                return out
            s = "".join(ch for ch in compact if ch.isdigit() or ch in ",.")
            if not s:
                return out
            if "." in s:
                parts = s.split(".")
                int_part = "".join(ch for ch in "".join(parts[:-1]) if ch.isdigit())
                frac_part = "".join(ch for ch in parts[-1] if ch.isdigit())
                if int_part:
                    out.append(float(f"{int_part}.{frac_part}") if frac_part else float(int_part))
            digits = "".join(ch for ch in s if ch.isdigit())
            if digits:
                out.append(float(digits))
                if len(digits) >= 3:
                    out.append(float(f"{digits[:-2]}.{digits[-2:]}"))
            return out

        if not text:
            return []
        import re

        matches = re.findall(r"\d[\d,\.\s]{2,}", text)
        out: list[float] = []
        for m in matches:
            compact = re.sub(r"\s+", "", m)
            out.extend(v for v in parse_compact_number(compact) if v > 0)
        out.extend(v for v in parse_compact_number(re.sub(r"\s+", "", text)) if v > 0)
        dedup: list[float] = []
        seen: set[float] = set()
        for val in out:
            key = round(val, 6)
            if key in seen:
                continue
            seen.add(key)
            dedup.append(val)
        return dedup

    def _reconstruct_candidates_from_digit_stream(
        self, text: str, expected_total: float
    ) -> list[float]:
        import re

        # Keep only OCR-visible digits and try expected-length windows.
        digit_stream = "".join(re.findall(r"\d+", text or ""))
        if not digit_stream:
            return []

        expected_digits = len(re.sub(r"\D", "", f"{max(0.0, expected_total):.2f}"))
        lengths = sorted(
            {
                max(3, expected_digits - 2),
                max(3, expected_digits - 1),
                max(3, expected_digits),
                max(3, expected_digits + 1),
                max(3, expected_digits + 2),
            }
        )

        out: list[float] = []
        n = len(digit_stream)
        for ln in lengths:
            if ln > n:
                continue
            for start in range(0, n - ln + 1):
                window = digit_stream[start : start + ln]
                # Candidate as integer
                out.append(float(window))
                # Candidate as .2 decimal (ISK cents)
                if len(window) >= 3:
                    out.append(float(f"{window[:-2]}.{window[-2:]}"))

        dedup: list[float] = []
        seen: set[float] = set()
        for val in out:
            key = round(val, 6)
            if key in seen:
                continue
            seen.add(key)
            dedup.append(val)
        return dedup

    def _capture_region_bgr(self, region: Tuple[int, int, int, int]) -> np.ndarray:
        if mss is None:
            raise RuntimeError("mss is required for OCR guard (pip install -r requirements.txt).")
        x, y, w, h = region
        with mss.mss() as sct:
            shot = sct.grab({"left": x, "top": y, "width": w, "height": h})
            return np.array(shot)[:, :, :3]

    def _preprocess_ocr_variants(self, img_bgr: np.ndarray) -> list[np.ndarray]:
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        big = cv2.resize(gray, None, fx=2.2, fy=2.2, interpolation=cv2.INTER_CUBIC)
        # Improve local contrast for bright-on-dark numeric UI text.
        norm = cv2.equalizeHist(big)
        _, th = cv2.threshold(norm, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        th_adapt = cv2.adaptiveThreshold(
            norm,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            31,
            2,
        )
        return [big, norm, th, th_adapt]

    def _get_ocr_engine(self):
        if self._ocr_engine is not None:
            return self._ocr_engine
        if RapidOCR is None:
            raise RuntimeError(
                "rapidocr-onnxruntime is required for OCR guard (pip install -r requirements.txt)."
            )
        self._ocr_engine = RapidOCR()
        return self._ocr_engine

    def _read_relist_total_ocr(self, expected_total: float) -> Optional[float]:
        if not self.cfg.ocr_total_region:
            return None
        engine = self._get_ocr_engine()
        observed: list[float] = []
        for idx in range(max(1, int(self.cfg.ocr_samples))):
            img = self._capture_region_bgr(self.cfg.ocr_total_region)
            variants = self._preprocess_ocr_variants(img)
            values: list[float] = []
            for v in variants:
                result, _ = engine(v)
                text_parts: list[str] = []
                if result:
                    for row in result:
                        if isinstance(row, (list, tuple)) and len(row) >= 2:
                            text_parts.append(str(row[1]))
                text = " ".join(text_parts)
                values.extend(self._parse_isk_candidates(text))
                values.extend(self._reconstruct_candidates_from_digit_stream(text, expected_total))
            if values:
                observed.append(min(values, key=lambda v: abs(v - expected_total)))
            if idx < max(1, int(self.cfg.ocr_samples)) - 1:
                self._sleep(max(0.0, self.cfg.ocr_sample_interval))
        if not observed:
            return None
        observed.sort()
        mid = len(observed) // 2
        if len(observed) % 2:
            return observed[mid]
        return (observed[mid - 1] + observed[mid]) / 2.0

    def _ocr_total_check(
        self, expected_total: float
    ) -> Tuple[bool, Optional[float], Optional[float]]:
        observed = self._read_relist_total_ocr(expected_total)
        if observed is None:
            return False, None, None
        if expected_total == 0:
            pct = abs(observed) * 100.0
            return abs(observed) <= abs(self.cfg.ocr_tolerance_pct), observed, pct
        pct = abs((observed - expected_total) / expected_total) * 100.0
        return pct <= self.cfg.ocr_tolerance_pct, observed, pct

    def update_item_price(
        self,
        item_name: str,
        new_price: float,
        expected_relist_fee: float,
        row_rank: int = 1,
        refresh_filter: bool = True,
        should_stop: Optional[Callable[[], bool]] = None,
    ) -> None:
        def check_stop() -> None:
            if should_stop and should_stop():
                raise KeyboardInterrupt("Stop hotkey requested by user.")

        expected_relist_total = round(float(expected_relist_fee), 2)

        if row_rank <= 1:
            row_xy = self.cfg.first_row_xy
            modify_xy = self.cfg.modify_order_xy
        elif row_rank == 2:
            row_xy = self.cfg.second_row_xy or self.cfg.first_row_xy
            modify_xy = self.cfg.second_modify_order_xy or self.cfg.modify_order_xy
        elif row_rank == 3:
            row_xy = self.cfg.third_row_xy or self.cfg.second_row_xy or self.cfg.first_row_xy
            modify_xy = (
                self.cfg.third_modify_order_xy
                or self.cfg.second_modify_order_xy
                or self.cfg.modify_order_xy
            )
        elif row_rank == 4:
            row_xy = (
                self.cfg.fourth_row_xy
                or self.cfg.third_row_xy
                or self.cfg.second_row_xy
                or self.cfg.first_row_xy
            )
            modify_xy = (
                self.cfg.fourth_modify_order_xy
                or self.cfg.third_modify_order_xy
                or self.cfg.second_modify_order_xy
                or self.cfg.modify_order_xy
            )
        elif row_rank == 5:
            row_xy = (
                self.cfg.fifth_row_xy
                or self.cfg.fourth_row_xy
                or self.cfg.third_row_xy
                or self.cfg.second_row_xy
                or self.cfg.first_row_xy
            )
            modify_xy = (
                self.cfg.fifth_modify_order_xy
                or self.cfg.fourth_modify_order_xy
                or self.cfg.third_modify_order_xy
                or self.cfg.second_modify_order_xy
                or self.cfg.modify_order_xy
            )
        elif row_rank == 6:
            row_xy = (
                self.cfg.sixth_row_xy
                or self.cfg.fifth_row_xy
                or self.cfg.fourth_row_xy
                or self.cfg.third_row_xy
                or self.cfg.second_row_xy
                or self.cfg.first_row_xy
            )
            modify_xy = (
                self.cfg.sixth_modify_order_xy
                or self.cfg.fifth_modify_order_xy
                or self.cfg.fourth_modify_order_xy
                or self.cfg.third_modify_order_xy
                or self.cfg.second_modify_order_xy
                or self.cfg.modify_order_xy
            )
        else:
            raise ValueError(f"Unsupported row_rank={row_rank}; max supported is 6.")

        needs_refresh_filter = refresh_filter
        max_full_attempts = 2 if self.cfg.ocr_guard_enabled else 1
        for full_attempt in range(1, max_full_attempts + 1):
            check_stop()
            self.focus_window()
            if needs_refresh_filter:
                check_stop()
                self._click(self.cfg.filter_input_xy)
                self._sleep(0.08)
                filter_text = build_filter_query(self.cfg, item_name)
                check_stop()
                if self.cfg.filter_input_method.strip().lower() == "type":
                    self._clear_filter_input()
                    check_stop()
                self._enter_filter_text(filter_text)
                pyautogui.press("enter")
                self._sleep(max(0.4, self.cfg.pause_seconds))

            check_stop()
            self._right_click(row_xy)
            self._sleep(self.cfg.pause_seconds)
            check_stop()
            self._click(modify_xy)
            self._sleep(max(0.35, self.cfg.pause_seconds))

            check_stop()
            self._click(self.cfg.price_input_xy)
            self._ctrl_combo("a")
            check_stop()
            self._enter_text(f"{new_price:.2f}")
            self._sleep(self.cfg.pause_seconds)

            if self.cfg.ocr_guard_enabled:
                first_match, first_observed, first_pct = self._ocr_total_check(
                    expected_relist_total
                )
                if first_observed is None:
                    print(
                        f"OCR_CHECK pass=1 item={item_name} expected={expected_relist_total:,.2f} "
                        "observed=NO_NUMBER match=NO"
                    )
                else:
                    print(
                        f"OCR_CHECK pass=1 item={item_name} expected={expected_relist_total:,.2f} "
                        f"observed={first_observed:,.2f} delta={first_observed-expected_relist_total:+,.2f} "
                        f"pct={first_pct:.4f}% match={'YES' if first_match else 'NO'}"
                    )
                if not first_match:
                    self._sleep(max(0.0, self.cfg.ocr_recheck_seconds))
                    second_match, second_observed, second_pct = self._ocr_total_check(
                        expected_relist_total
                    )
                    if second_observed is None:
                        print(
                            f"OCR_CHECK pass=2 item={item_name} expected={expected_relist_total:,.2f} "
                            "observed=NO_NUMBER match=NO"
                        )
                    else:
                        print(
                            f"OCR_CHECK pass=2 item={item_name} expected={expected_relist_total:,.2f} "
                            f"observed={second_observed:,.2f} delta={second_observed-expected_relist_total:+,.2f} "
                            f"pct={second_pct:.4f}% match={'YES' if second_match else 'NO'}"
                        )
                    if not second_match:
                        if self.cfg.cancel_button_xy:
                            self._click(self.cfg.cancel_button_xy)
                            self._sleep(max(0.2, self.cfg.pause_seconds))
                        if full_attempt >= max_full_attempts:
                            raise RuntimeError(
                                "OCR total mismatch after retry; skipped to avoid wrong relist."
                            )
                        needs_refresh_filter = True
                        continue

            check_stop()
            if self.cfg.dry_run:
                if not self.cfg.cancel_button_xy:
                    raise RuntimeError(
                        "DRY_RUN requires APP_CANCEL_BUTTON_XY to close Modify Order dialog."
                    )
                self._click(self.cfg.cancel_button_xy)
                self._sleep(max(0.3, self.cfg.pause_seconds))
                print(f"DRY_RUN item={item_name}: clicked Cancel (no OK, no confirm).")
                return
            self._click(self.cfg.ok_button_xy)
            self._handle_warning_dialog_if_present()
            self._sleep(max(0.4, self.cfg.pause_seconds))
            return

