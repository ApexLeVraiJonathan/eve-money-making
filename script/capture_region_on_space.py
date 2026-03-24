from __future__ import annotations

import ctypes
import time
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


def main() -> None:
    user32 = ctypes.windll.user32
    prev_space = False
    prev_q = False
    prev_r = False

    first: Optional[Tuple[int, int]] = None

    print("Press SPACE to capture points for region.")
    print("  1st SPACE = top-left (or first corner)")
    print("  2nd SPACE = bottom-right (or opposite corner)")
    print("Press r to reset current capture. Press q to quit.")

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
                first = (x, y)
                print(f"Point 1: {x},{y}")
            else:
                second = (x, y)
                print(f"Point 2: {x},{y}")
                rx, ry, rw, rh = format_region(first, second)
                print(f"Region: {rx},{ry},{rw},{rh}")
                print(f"CLI: --region \"{rx},{ry},{rw},{rh}\"")
                first = None

        prev_space = space_down
        prev_q = q_down
        prev_r = r_down
        time.sleep(0.02)


if __name__ == "__main__":
    main()
