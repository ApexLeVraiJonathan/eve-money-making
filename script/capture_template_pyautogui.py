from __future__ import annotations

import argparse
import ctypes
import time
from pathlib import Path
from typing import Optional, Tuple

import pyautogui


VK_SPACE = 0x20
VK_Q = 0x51
VK_R = 0x52


def is_down(user32: ctypes.WinDLL, vk: int) -> bool:
    return bool(user32.GetAsyncKeyState(vk) & 0x8000)


def format_region(a: Tuple[int, int], b: Tuple[int, int]) -> Tuple[int, int, int, int]:
    x1, y1 = a
    x2, y2 = b
    left = min(x1, x2)
    top = min(y1, y2)
    width = abs(x2 - x1)
    height = abs(y2 - y1)
    return left, top, width, height


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=(
            "Capture a template image using pyautogui screenshot pipeline "
            "(space for corners, q to quit)."
        )
    )
    p.add_argument(
        "--out",
        default="market-order-button-pya.png",
        help="Output image path (default: market-order-button-pya.png).",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    out_path = Path(args.out).expanduser()
    if not out_path.is_absolute():
        out_path = Path(__file__).resolve().parent / out_path

    user32 = ctypes.windll.user32
    prev_space = False
    prev_q = False
    prev_r = False
    first: Optional[Tuple[int, int]] = None

    print("Template capture (PyAutoGUI)")
    print("- Press SPACE to capture corners")
    print("  1st SPACE = top-left")
    print("  2nd SPACE = bottom-right")
    print("- Press r to reset, q to quit")
    print("")

    while True:
        space_down = is_down(user32, VK_SPACE)
        q_down = is_down(user32, VK_Q)
        r_down = is_down(user32, VK_R)

        if q_down and not prev_q:
            print("Exiting.")
            break

        if r_down and not prev_r:
            first = None
            print("Capture reset.")

        if space_down and not prev_space:
            x, y = pyautogui.position()
            if first is None:
                first = (int(x), int(y))
                print(f"Point 1: {x},{y}")
            else:
                second = (int(x), int(y))
                rx, ry, rw, rh = format_region(first, second)
                if rw <= 0 or rh <= 0:
                    print("Invalid region size, reset and capture again.")
                    first = None
                    prev_space = space_down
                    prev_q = q_down
                    prev_r = r_down
                    time.sleep(0.02)
                    continue
                print(f"Point 2: {x},{y}")
                print(f"Region: {rx},{ry},{rw},{rh}")
                img = pyautogui.screenshot(region=(rx, ry, rw, rh))
                out_path.parent.mkdir(parents=True, exist_ok=True)
                img.save(str(out_path))
                print(f"Saved template: {out_path}")
                print("Use in .env:")
                print(f"MARKET_ORDERS_BUTTON_IMAGE_PATH={out_path.name}")
                break

        prev_space = space_down
        prev_q = q_down
        prev_r = r_down
        time.sleep(0.02)


if __name__ == "__main__":
    main()
