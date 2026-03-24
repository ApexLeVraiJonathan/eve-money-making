from __future__ import annotations

import ctypes
import time

import pyautogui


VK_SPACE = 0x20
VK_Q = 0x51


def is_down(user32: ctypes.WinDLL, vk: int) -> bool:
    return bool(user32.GetAsyncKeyState(vk) & 0x8000)


def main() -> None:
    user32 = ctypes.windll.user32
    prev_space = False
    prev_q = False

    print("Press SPACE to print cursor XY. Press q to quit.")

    while True:
        space_down = is_down(user32, VK_SPACE)
        q_down = is_down(user32, VK_Q)

        if q_down and not prev_q:
            print("Exiting.")
            break

        if space_down and not prev_space:
            x, y = pyautogui.position()
            print(f"{x},{y}")

        prev_space = space_down
        prev_q = q_down
        time.sleep(0.02)


if __name__ == "__main__":
    main()
