from __future__ import annotations

import argparse
import re
import time
from pathlib import Path
from typing import Optional, Tuple

import pyautogui
from dotenv import load_dotenv

try:
    import mss
except Exception:  # pragma: no cover
    mss = None


def _env_str(name: str) -> Optional[str]:
    import os

    value = os.getenv(name)
    if value is None:
        return None
    value = value.strip()
    return value if value else None


def _parse_point(raw: Optional[str]) -> Optional[Tuple[int, int]]:
    if not raw:
        return None
    nums = re.findall(r"-?\d+", raw)
    if len(nums) < 2:
        return None
    return int(nums[0]), int(nums[1])


def _parse_rgb(raw: Optional[str]) -> Optional[Tuple[int, int, int]]:
    if not raw:
        return None
    nums = re.findall(r"-?\d+", raw)
    if len(nums) < 3:
        return None
    return int(nums[0]), int(nums[1]), int(nums[2])


def _read_pixel_rgb(x: int, y: int) -> Optional[Tuple[int, int, int]]:
    # Prefer pyautogui channel ordering for this setup; MSS is fallback.
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


def _is_match(
    observed: Tuple[int, int, int], target: Tuple[int, int, int], tolerance: int
) -> bool:
    return (
        abs(observed[0] - target[0]) <= tolerance
        and abs(observed[1] - target[1]) <= tolerance
        and abs(observed[2] - target[2]) <= tolerance
    )


def main() -> None:
    load_dotenv(Path(__file__).resolve().parent / ".env")

    parser = argparse.ArgumentParser(
        description="Check WARNING_PIXEL_* detection against live screen."
    )
    parser.add_argument(
        "--xy",
        default=None,
        help='Override pixel coordinates, e.g. "3079,616".',
    )
    parser.add_argument(
        "--rgb",
        default=None,
        help='Override target RGB, e.g. "90,168,192".',
    )
    parser.add_argument(
        "--tolerance",
        type=int,
        default=None,
        help="Override tolerance (default from WARNING_PIXEL_TOLERANCE).",
    )
    parser.add_argument(
        "--seconds",
        type=float,
        default=5.0,
        help="How long to sample (default: 5.0).",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=0.2,
        help="Sampling interval seconds (default: 0.2).",
    )
    args = parser.parse_args()

    xy = _parse_point(args.xy) or _parse_point(_env_str("WARNING_PIXEL_XY"))
    rgb = _parse_rgb(args.rgb) or _parse_rgb(_env_str("WARNING_PIXEL_RGB"))
    tol_raw = args.tolerance if args.tolerance is not None else _env_str("WARNING_PIXEL_TOLERANCE")
    tolerance = int(re.findall(r"-?\d+", str(tol_raw or "24"))[0])

    if not xy:
        raise SystemExit("Missing WARNING_PIXEL_XY (or provide --xy).")
    if not rgb:
        raise SystemExit("Missing WARNING_PIXEL_RGB (or provide --rgb).")

    print(f"Using XY: {xy[0]},{xy[1]}")
    print(f"Target RGB: {rgb[0]},{rgb[1]},{rgb[2]}")
    print(f"Tolerance: {tolerance}")
    print(f"Sampling for {args.seconds:.1f}s every {args.interval:.2f}s")
    print("")

    deadline = time.time() + max(0.2, args.seconds)
    samples = 0
    matches = 0

    while time.time() < deadline:
        observed = _read_pixel_rgb(xy[0], xy[1])
        samples += 1
        if observed is None:
            print(f"[{samples:03d}] OBSERVED=UNAVAILABLE MATCH=NO")
            time.sleep(max(0.05, args.interval))
            continue

        matched = _is_match(observed, rgb, tolerance)
        if matched:
            matches += 1

        dr = observed[0] - rgb[0]
        dg = observed[1] - rgb[1]
        db = observed[2] - rgb[2]
        print(
            f"[{samples:03d}] OBSERVED={observed[0]},{observed[1]},{observed[2]} "
            f"DELTA={dr:+d},{dg:+d},{db:+d} MATCH={'YES' if matched else 'NO'}"
        )
        time.sleep(max(0.05, args.interval))

    print("")
    print(f"Summary: {matches}/{samples} samples matched.")
    if matches == 0:
        print("No matches. Recheck WARNING_PIXEL_XY / WARNING_PIXEL_RGB / WARNING_PIXEL_TOLERANCE.")


if __name__ == "__main__":
    main()

