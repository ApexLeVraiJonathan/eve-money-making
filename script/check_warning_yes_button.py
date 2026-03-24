from __future__ import annotations

import os
import re
import time
from typing import Optional, Tuple

import pyautogui
from dotenv import load_dotenv

try:
    import mss
except Exception:  # pragma: no cover
    mss = None


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


def parse_region(raw: Optional[str]) -> Optional[Tuple[int, int, int, int]]:
    if not raw:
        return None
    parts = [int(p.strip()) for p in raw.split(",")]
    if len(parts) != 4:
        raise ValueError("WARNING_SEARCH_REGION must be x,y,width,height")
    x, y, w, h = parts
    if w <= 0 or h <= 0:
        raise ValueError("WARNING_SEARCH_REGION width/height must be > 0")
    return x, y, w, h


def parse_point(raw: Optional[str]) -> Optional[Tuple[int, int]]:
    if not raw:
        return None
    x, y = [int(p.strip()) for p in raw.split(",")]
    return x, y


def parse_rgb(raw: Optional[str]) -> Optional[Tuple[int, int, int]]:
    if not raw:
        return None
    r, g, b = [int(p.strip()) for p in raw.split(",")]
    return r, g, b


def read_pixel_rgb(x: int, y: int) -> Optional[Tuple[int, int, int]]:
    # Prefer pyautogui channel ordering for this environment.
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
    observed: Tuple[int, int, int], target: Tuple[int, int, int], tol: int
) -> bool:
    return (
        abs(observed[0] - target[0]) <= tol
        and abs(observed[1] - target[1]) <= tol
        and abs(observed[2] - target[2]) <= tol
    )


def main() -> None:
    load_dotenv()

    pixel_xy = parse_point(env_str("WARNING_PIXEL_XY"))
    pixel_rgb = parse_rgb(env_str("WARNING_PIXEL_RGB"))
    tolerance = int(env_float("WARNING_PIXEL_TOLERANCE", 24))

    if not pixel_xy or not pixel_rgb:
        raise ValueError("Set WARNING_PIXEL_XY and WARNING_PIXEL_RGB in .env first.")

    print(f"Pixel XY: {pixel_xy[0]},{pixel_xy[1]}")
    print(f"Target RGB: {pixel_rgb[0]},{pixel_rgb[1]},{pixel_rgb[2]}")
    print(f"Tolerance: {tolerance}")
    screen_w, screen_h = pyautogui.size()
    print(f"PyAutoGUI screen size: {screen_w}x{screen_h}")
    if pixel_xy[0] < 0 or pixel_xy[1] < 0 or pixel_xy[0] > 10000 or pixel_xy[1] > 10000:
        print("Warning: pixel XY looks unusual; verify coordinates.")
    print("Checking in 2 seconds... keep popup visible.")
    time.sleep(2.0)

    observed = read_pixel_rgb(pixel_xy[0], pixel_xy[1])
    if observed is None:
        print("Could not read pixel color at configured coordinate.")
        print("Tip: install deps in venv: pip install -r requirements.txt --upgrade")
        return

    print(f"Observed RGB: {observed[0]},{observed[1]},{observed[2]}")
    if within_tolerance(observed, pixel_rgb, tolerance):
        print("MATCH: warning pixel detected (popup likely open).")
    else:
        dr = observed[0] - pixel_rgb[0]
        dg = observed[1] - pixel_rgb[1]
        db = observed[2] - pixel_rgb[2]
        print("NO MATCH: warning pixel not detected.")
        print(f"Delta RGB: {dr},{dg},{db}")
        print("Tips:")
        print("- Ensure popup is visible and not occluded.")
        print("- Re-capture WARNING_PIXEL_RGB from the same UI state.")
        print("- Increase WARNING_PIXEL_TOLERANCE (e.g. 30-40).")


if __name__ == "__main__":
    main()
