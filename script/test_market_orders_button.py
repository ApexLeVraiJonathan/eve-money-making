from __future__ import annotations

import argparse
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

import pyautogui
from dotenv import load_dotenv

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


def env_str(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name, default)
    return value.strip() if isinstance(value, str) else value


def env_float(name: str, default: float) -> float:
    raw = env_str(name)
    if raw is None or raw == "":
        return default
    m = re.search(r"-?\d+(?:\.\d+)?", raw)
    if not m:
        return default
    return float(m.group(0))


def env_int(name: str, default: int) -> int:
    raw = env_str(name)
    if raw is None or raw == "":
        return default
    m = re.search(r"-?\d+", raw)
    if not m:
        return default
    return int(m.group(0))


def parse_point(raw: Optional[str]) -> Optional[Tuple[int, int]]:
    if not raw:
        return None
    nums = re.findall(r"-?\d+", raw)
    if len(nums) < 2:
        return None
    return int(nums[0]), int(nums[1])


def parse_rgb(raw: Optional[str]) -> Optional[Tuple[int, int, int]]:
    if not raw:
        return None
    nums = re.findall(r"-?\d+", raw)
    if len(nums) < 3:
        return None
    return int(nums[0]), int(nums[1]), int(nums[2])


def parse_region(raw: Optional[str]) -> Optional[Tuple[int, int, int, int]]:
    if not raw:
        return None
    nums = re.findall(r"-?\d+", raw)
    if len(nums) < 4:
        return None
    x, y, w, h = [int(n) for n in nums[:4]]
    return x, y, w, h


def read_pixel_rgb(x: int, y: int) -> Optional[Tuple[int, int, int]]:
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


def within_tolerance(
    observed: Tuple[int, int, int], target: Tuple[int, int, int], tolerance: int
) -> bool:
    return (
        abs(observed[0] - target[0]) <= tolerance
        and abs(observed[1] - target[1]) <= tolerance
        and abs(observed[2] - target[2]) <= tolerance
    )


def click_xy(xy: Tuple[int, int], move_duration: float, settle: float) -> None:
    pyautogui.moveTo(xy[0], xy[1], duration=max(0.0, move_duration))
    time.sleep(max(0.0, settle))
    pyautogui.click()


def save_debug_screenshot(out_dir: str) -> Optional[str]:
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    out_path = str(Path(out_dir) / f"market-orders-detect-fail-{ts}.png")
    if mss is not None:
        try:
            with mss.mss() as sct:
                shot = sct.grab(sct.monitors[0])
                if cv2 is not None and np is not None:
                    frame = np.array(shot)
                    bgr = frame[:, :, :3]
                    cv2.imwrite(out_path, bgr)
                    return out_path
        except Exception:
            pass
    try:
        pyautogui.screenshot(out_path)
        return out_path
    except Exception:
        return None


def locate_center_with_mss_cv2(
    image_path: str,
    region: Optional[Tuple[int, int, int, int]],
    confidence: float,
) -> Tuple[Optional[Tuple[int, int]], Optional[float], Optional[str]]:
    if mss is None:
        return None, None, "mss is not installed"
    if cv2 is None or np is None:
        return None, None, "opencv-python or numpy is not installed"
    if not image_path:
        return None, None, "empty image path"

    template = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if template is None:
        return None, None, f"could not read template image: {image_path}"

    try:
        with mss.mss() as sct:
            if region:
                x, y, w, h = region
                monitor = {"left": int(x), "top": int(y), "width": int(w), "height": int(h)}
                left, top = int(x), int(y)
            else:
                mon = sct.monitors[0]
                monitor = {
                    "left": int(mon["left"]),
                    "top": int(mon["top"]),
                    "width": int(mon["width"]),
                    "height": int(mon["height"]),
                }
                left, top = monitor["left"], monitor["top"]
            shot = sct.grab(monitor)
    except Exception as exc:
        return None, None, f"screen grab failed: {exc}"

    haystack = np.array(shot)[:, :, :3]
    th, tw = template.shape[:2]
    hh, hw = haystack.shape[:2]
    if th > hh or tw > hw:
        return None, None, (
            f"template {tw}x{th} is bigger than search area {hw}x{hh}; "
            "increase region or use full-screen search"
        )

    result = cv2.matchTemplate(haystack, template, cv2.TM_CCOEFF_NORMED)
    _, max_val, _, max_loc = cv2.minMaxLoc(result)
    score = float(max_val)
    if score < confidence:
        return None, score, None

    mx = int(left + max_loc[0] + (tw // 2))
    my = int(top + max_loc[1] + (th // 2))
    return (mx, my), score, None


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=(
            "Test detection/wait strategy for Market Orders button before integrating "
            "into launcher automation."
        )
    )
    p.add_argument(
        "--mode",
        choices=["auto", "pixel", "image", "xy"],
        default="auto",
        help="Detection strategy. auto tries pixel, then image, then xy fallback.",
    )
    p.add_argument("--timeout", type=float, default=35.0, help="Max wait seconds.")
    p.add_argument("--poll", type=float, default=0.25, help="Poll interval seconds.")
    p.add_argument("--move-duration", type=float, default=0.15)
    p.add_argument("--settle", type=float, default=0.06)
    p.add_argument("--confidence", type=float, default=0.80, help="Image match confidence.")
    p.add_argument(
        "--image-engine",
        choices=["mss_cv2", "pyautogui"],
        default="mss_cv2",
        help="Image matching engine (default: mss_cv2).",
    )
    p.add_argument(
        "--debug-scores",
        action="store_true",
        help="Print best image match confidence while polling.",
    )
    p.add_argument(
        "--no-click",
        action="store_true",
        help="Detect only; do not click when found.",
    )
    p.add_argument(
        "--screenshot-on-fail",
        action="store_true",
        help="Save full-screen screenshot if button not detected in time.",
    )
    p.add_argument(
        "--screenshot-dir",
        default="./market-orders-debug",
        help="Directory for failure screenshots.",
    )
    return p.parse_args()


def main() -> None:
    load_dotenv(Path(__file__).resolve().parent / ".env")
    args = parse_args()

    target_xy = parse_point(env_str("LAUNCHER_MARKET_ORDERS_XY", ""))
    pixel_xy = parse_point(env_str("MARKET_ORDERS_PIXEL_XY", ""))
    pixel_rgb = parse_rgb(env_str("MARKET_ORDERS_PIXEL_RGB", ""))
    pixel_tol = env_int("MARKET_ORDERS_PIXEL_TOLERANCE", 24)
    image_path = env_str("MARKET_ORDERS_BUTTON_IMAGE_PATH", "") or ""
    image_region = parse_region(env_str("MARKET_ORDERS_SEARCH_REGION", ""))

    print("Market Orders detection test")
    print(f"- mode: {args.mode}")
    print(f"- timeout: {args.timeout:.1f}s poll={args.poll:.2f}s")
    print(f"- target click xy: {target_xy}")
    print(f"- pixel gate: xy={pixel_xy} rgb={pixel_rgb} tol={pixel_tol}")
    print(f"- image gate: path={image_path or '<none>'} region={image_region}")
    print(f"- image engine: {args.image_engine}")
    print("")

    end = time.time() + max(0.0, args.timeout)
    found = False
    found_reason = ""
    click_at: Optional[Tuple[int, int]] = target_xy

    while time.time() < end:
        if args.mode in {"auto", "pixel"} and pixel_xy and pixel_rgb:
            observed = read_pixel_rgb(pixel_xy[0], pixel_xy[1])
            if observed and within_tolerance(observed, pixel_rgb, pixel_tol):
                found = True
                found_reason = (
                    f"pixel match at {pixel_xy[0]},{pixel_xy[1]} "
                    f"observed={observed[0]},{observed[1]},{observed[2]}"
                )
                break

        if args.mode in {"auto", "image"} and image_path:
            locate_region = image_region if image_region else None
            match = None
            score: Optional[float] = None
            if args.image_engine == "mss_cv2":
                match, score, err = locate_center_with_mss_cv2(
                    image_path=image_path,
                    region=locate_region,
                    confidence=max(0.1, min(0.99, args.confidence)),
                )
                if err:
                    print(f"Image engine warning: {err}")
            else:
                try:
                    match = pyautogui.locateCenterOnScreen(
                        image_path,
                        confidence=max(0.1, min(0.99, args.confidence)),
                        region=locate_region,
                    )
                except Exception as exc:
                    # Treat image-not-found and region-size errors as "no match yet".
                    # Keep polling until timeout instead of crashing immediately.
                    exc_name = exc.__class__.__name__
                    if exc_name in {"ImageNotFoundException", "ValueError"}:
                        match = None
                    else:
                        raise
            if args.debug_scores and score is not None:
                print(f"image best score={score:.3f} (target {args.confidence:.3f})")
            if match:
                mx, my = int(match[0]), int(match[1])
                found = True
                if score is not None:
                    found_reason = f"image match at {mx},{my} score={score:.3f}"
                else:
                    found_reason = f"image match at {mx},{my}"
                if click_at is None:
                    click_at = (mx, my)
                break

        if args.mode == "xy" and target_xy:
            found = True
            found_reason = "xy mode (no detection gate)"
            break

        time.sleep(max(0.05, args.poll))

    if not found:
        print("NOT FOUND within timeout.")
        if args.screenshot_on_fail:
            shot = save_debug_screenshot(args.screenshot_dir)
            if shot:
                print(f"Saved debug screenshot: {shot}")
        raise SystemExit(2)

    print(f"FOUND: {found_reason}")
    if args.no_click:
        print("No-click mode: done.")
        return

    if click_at is None:
        print("No click target configured. Set LAUNCHER_MARKET_ORDERS_XY or use image mode.")
        raise SystemExit(3)

    print(f"Clicking Market Orders at {click_at[0]},{click_at[1]}...")
    click_xy(click_at, args.move_duration, args.settle)
    print("Done.")


if __name__ == "__main__":
    main()
