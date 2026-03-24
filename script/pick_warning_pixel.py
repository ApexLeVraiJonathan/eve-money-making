from __future__ import annotations

import argparse
import ctypes
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

import pyautogui

try:
    import mss
except Exception:  # pragma: no cover
    mss = None

try:
    from PIL import Image, ImageDraw
except Exception:  # pragma: no cover
    Image = None
    ImageDraw = None


class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]


def enable_dpi_awareness() -> str:
    user32 = ctypes.windll.user32
    try:
        # DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4
        if user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4)):
            return "per-monitor-v2"
    except Exception:
        pass
    try:
        shcore = ctypes.windll.shcore
        shcore.SetProcessDpiAwareness(2)
        return "per-monitor"
    except Exception:
        pass
    try:
        if user32.SetProcessDPIAware():
            return "system-dpi-aware"
    except Exception:
        pass
    return "unknown"


def get_cursor_pos() -> Tuple[int, int, str]:
    user32 = ctypes.windll.user32
    pt = POINT()
    try:
        if user32.GetPhysicalCursorPos(ctypes.byref(pt)):
            return int(pt.x), int(pt.y), "physical"
    except Exception:
        pass
    try:
        if user32.GetCursorPos(ctypes.byref(pt)):
            return int(pt.x), int(pt.y), "logical"
    except Exception:
        pass
    x, y = pyautogui.position()
    return int(x), int(y), "pyautogui"


def read_pixel_rgb_mss(x: int, y: int) -> Optional[Tuple[int, int, int]]:
    if mss is None:
        return None
    try:
        with mss.mss() as sct:
            shot = sct.grab({"left": x, "top": y, "width": 1, "height": 1})
            b, g, r = shot.pixel(0, 0)
            return int(r), int(g), int(b)
    except Exception:
        return None


def read_pixel_rgb_pyautogui(x: int, y: int) -> Optional[Tuple[int, int, int]]:
    try:
        c = pyautogui.pixel(x, y)
        return int(c[0]), int(c[1]), int(c[2])
    except Exception:
        return None


def read_3x3_pyautogui(cx: int, cy: int) -> list[tuple[int, int, Optional[Tuple[int, int, int]]]]:
    out: list[tuple[int, int, Optional[Tuple[int, int, int]]]] = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            x = max(0, cx + dx)
            y = max(0, cy + dy)
            out.append((x, y, read_pixel_rgb_pyautogui(x, y)))
    return out


def capture_debug_zone(
    center_x: int,
    center_y: int,
    zone_size: int,
    out_dir: str,
    capture_idx: int,
) -> Optional[str]:
    size = max(21, int(zone_size))
    half = size // 2
    left = center_x - half
    top = center_y - half

    img = None
    if mss is not None:
        try:
            with mss.mss() as sct:
                shot = sct.grab({"left": left, "top": top, "width": size, "height": size})
                # mss returns BGRA bytes
                if Image is not None:
                    img = Image.frombytes("RGB", shot.size, shot.rgb)
        except Exception:
            img = None

    if img is None:
        try:
            img = pyautogui.screenshot(region=(left, top, size, size))
        except Exception:
            return None

    if ImageDraw is not None:
        draw = ImageDraw.Draw(img)
        cx = size // 2
        cy = size // 2
        marker = max(3, size // 20)
        draw.line((cx - marker, cy, cx + marker, cy), fill=(255, 0, 0), width=1)
        draw.line((cx, cy - marker, cx, cy + marker), fill=(255, 0, 0), width=1)
        draw.rectangle((0, 0, size - 1, size - 1), outline=(255, 255, 0), width=1)

    Path(out_dir).mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    filename = f"warning-pixel-{ts}-{capture_idx:03d}-x{center_x}-y{center_y}.png"
    out_path = str(Path(out_dir) / filename)
    img.save(out_path)
    return out_path


def _key_pressed_once(vk_code: int) -> bool:
    # Works on Windows to detect edge transitions.
    return bool(ctypes.windll.user32.GetAsyncKeyState(vk_code) & 1)


def interactive(
    interval: float,
    screenshot_size: int,
    screenshot_dir: str,
    sample_offset_x: int,
    sample_offset_y: int,
) -> None:
    print("Interactive pixel picker")
    print("- Move mouse to target pixel")
    print("- Press Space to capture x,y and RGB")
    print(
        f"- Capture samples pixel at cursor offset ({sample_offset_x},{sample_offset_y})"
    )
    print(f"- Saves debug screenshot each capture ({screenshot_size}x{screenshot_size})")
    print("- Press q to quit")
    print("")

    captures = 0
    try:
        while True:
            if _key_pressed_once(0x20):  # Space
                aim_x, aim_y, cursor_source = get_cursor_pos()
                sample_x = max(0, aim_x + int(sample_offset_x))
                sample_y = max(0, aim_y + int(sample_offset_y))
                rgb_mss = read_pixel_rgb_mss(sample_x, sample_y)
                rgb_pya = read_pixel_rgb_pyautogui(sample_x, sample_y)
                rgb = rgb_pya or rgb_mss
                captures += 1
                if rgb is None:
                    print(
                        f"[{captures}] aim={aim_x},{aim_y} source={cursor_source} "
                        f"sampled={sample_x},{sample_y} rgb=?"
                    )
                else:
                    mss_text = (
                        f"{rgb_mss[0]},{rgb_mss[1]},{rgb_mss[2]}"
                        if rgb_mss is not None
                        else "n/a"
                    )
                    pya_text = (
                        f"{rgb_pya[0]},{rgb_pya[1]},{rgb_pya[2]}"
                        if rgb_pya is not None
                        else "n/a"
                    )
                    print(
                        f"[{captures}] aim={aim_x},{aim_y} "
                        f"source={cursor_source} sampled={sample_x},{sample_y} "
                        f"rgb={rgb[0]},{rgb[1]},{rgb[2]}"
                    )
                    print(f"    mss={mss_text}  pyautogui={pya_text}")
                    if rgb_mss is not None and rgb_pya is not None and rgb_mss != rgb_pya:
                        print("    Warning: MSS and PyAutoGUI differ at this pixel.")
                    neighbors = read_3x3_pyautogui(sample_x, sample_y)
                    print("    3x3 neighborhood (PyAutoGUI):")
                    for row in range(3):
                        parts: list[str] = []
                        for col in range(3):
                            x, y, color = neighbors[row * 3 + col]
                            if color is None:
                                parts.append(f"({x},{y})=n/a")
                            else:
                                parts.append(
                                    f"({x},{y})={color[0]},{color[1]},{color[2]}"
                                )
                        print("      " + " | ".join(parts))
                    shot_path = capture_debug_zone(
                        sample_x, sample_y, screenshot_size, screenshot_dir, captures
                    )
                    if shot_path:
                        print(f"    debug screenshot: {shot_path}")
                    else:
                        print("    debug screenshot: failed to capture")
                    print("Use in .env:")
                    print(f"WARNING_PIXEL_XY={sample_x},{sample_y}")
                    print(f"WARNING_PIXEL_RGB={rgb[0]},{rgb[1]},{rgb[2]}")
                    print("")
            if _key_pressed_once(0x51):  # q
                break
            time.sleep(max(0.01, interval))
    except KeyboardInterrupt:
        pass


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Interactive pixel picker (Space to capture).")
    p.add_argument(
        "--interval",
        type=float,
        default=0.03,
        help="Key polling interval seconds (default: 0.03).",
    )
    p.add_argument(
        "--screenshot-size",
        type=int,
        default=120,
        help="Debug screenshot square size in pixels (default: 120).",
    )
    p.add_argument(
        "--screenshot-dir",
        default=os.path.join(".", "pixel-debug-shots"),
        help="Directory to save debug screenshots (default: ./pixel-debug-shots).",
    )
    p.add_argument(
        "--sample-offset-x",
        type=int,
        default=0,
        help="Sample X offset from cursor (default: 0).",
    )
    p.add_argument(
        "--sample-offset-y",
        type=int,
        default=0,
        help="Sample Y offset from cursor (default: 0).",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    mode = enable_dpi_awareness()
    print(f"DPI awareness mode: {mode}")
    interactive(
        args.interval,
        args.screenshot_size,
        args.screenshot_dir,
        args.sample_offset_x,
        args.sample_offset_y,
    )


if __name__ == "__main__":
    main()
