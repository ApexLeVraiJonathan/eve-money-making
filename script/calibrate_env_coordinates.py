from __future__ import annotations

import argparse
import ctypes
import json
from pathlib import Path
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import pyautogui


VK_SPACE = 0x20
VK_Q = 0x51
VK_S = 0x53


@dataclass
class PointPrompt:
    env_key: str
    label: str
    required: bool = False
    default: Optional[Tuple[int, int]] = None


@dataclass
class RegionPrompt:
    env_key: str
    label: str
    required: bool = False


def is_down(user32: ctypes.WinDLL, vk: int) -> bool:
    return bool(user32.GetAsyncKeyState(vk) & 0x8000)


def wait_key_release(user32: ctypes.WinDLL, keys: List[int]) -> None:
    while any(is_down(user32, vk) for vk in keys):
        time.sleep(0.02)


def format_point(p: Tuple[int, int]) -> str:
    return f"{p[0]},{p[1]}"


def format_region(a: Tuple[int, int], b: Tuple[int, int]) -> Tuple[int, int, int, int]:
    x1, y1 = a
    x2, y2 = b
    left = min(x1, x2)
    top = min(y1, y2)
    width = abs(x2 - x1)
    height = abs(y2 - y1)
    return left, top, width, height


def capture_point(user32: ctypes.WinDLL, prompt: PointPrompt) -> Optional[Tuple[int, int]]:
    print("")
    required_text = "required" if prompt.required else "optional"
    default_text = f" (default {format_point(prompt.default)})" if prompt.default else ""
    print(f"{prompt.env_key} [{required_text}]{default_text}")
    print(f"  Target: {prompt.label}")
    print("  Move mouse to target and press SPACE.")
    print("  Press 's' to skip optional field, 'q' to quit.")

    # Debounce: if a key is still held from the previous prompt,
    # wait for release before accepting a new capture keypress.
    wait_key_release(user32, [VK_SPACE, VK_S, VK_Q])
    prev_space = is_down(user32, VK_SPACE)
    prev_q = is_down(user32, VK_Q)
    prev_s = is_down(user32, VK_S)
    while True:
        space_down = is_down(user32, VK_SPACE)
        q_down = is_down(user32, VK_Q)
        s_down = is_down(user32, VK_S)

        if q_down and not prev_q:
            raise KeyboardInterrupt("Quit requested by user.")

        if space_down and not prev_space:
            x, y = pyautogui.position()
            print(f"  Captured {x},{y}")
            return int(x), int(y)

        if s_down and not prev_s:
            if prompt.required:
                if prompt.default is not None:
                    print(f"  Required field: using default {format_point(prompt.default)}.")
                    return prompt.default
                print("  Required field cannot be skipped.")
            else:
                print("  Skipped.")
                return None

        prev_space = space_down
        prev_q = q_down
        prev_s = s_down
        time.sleep(0.02)


def capture_region(user32: ctypes.WinDLL, prompt: RegionPrompt) -> Optional[Tuple[int, int, int, int]]:
    print("")
    required_text = "required" if prompt.required else "optional"
    print(f"{prompt.env_key} [{required_text}]")
    print(f"  Target: {prompt.label}")
    print("  Press SPACE on top-left corner, then SPACE on bottom-right corner.")
    print("  Press 's' to skip optional field, 'q' to quit.")

    # Debounce: require fresh keypresses for region corners too.
    wait_key_release(user32, [VK_SPACE, VK_S, VK_Q])
    prev_space = is_down(user32, VK_SPACE)
    prev_q = is_down(user32, VK_Q)
    prev_s = is_down(user32, VK_S)
    first: Optional[Tuple[int, int]] = None
    while True:
        space_down = is_down(user32, VK_SPACE)
        q_down = is_down(user32, VK_Q)
        s_down = is_down(user32, VK_S)

        if q_down and not prev_q:
            raise KeyboardInterrupt("Quit requested by user.")

        if s_down and not prev_s:
            if prompt.required:
                print("  Required field cannot be skipped.")
            else:
                print("  Skipped.")
                return None

        if space_down and not prev_space:
            x, y = pyautogui.position()
            if first is None:
                first = (int(x), int(y))
                print(f"  First corner: {x},{y}")
            else:
                second = (int(x), int(y))
                region = format_region(first, second)
                print(f"  Second corner: {x},{y}")
                print(f"  Captured region: {region[0]},{region[1]},{region[2]},{region[3]}")
                return region

        prev_space = space_down
        prev_q = q_down
        prev_s = s_down
        time.sleep(0.02)


def build_point_prompts(include_optional: bool) -> List[PointPrompt]:
    prompts: List[PointPrompt] = [
        PointPrompt("APP_FILTER_INPUT_XY", "Filter input box", required=True),
        PointPrompt("APP_FIRST_ROW_XY", "First order row", required=True),
        PointPrompt("APP_MODIFY_ORDER_XY", "First row right-click -> Modify Order target", required=True),
        PointPrompt("APP_SECOND_ROW_XY", "Second order row"),
        PointPrompt("APP_SECOND_MODIFY_ORDER_XY", "Second row right-click -> Modify Order target"),
        PointPrompt("APP_THIRD_ROW_XY", "Third order row"),
        PointPrompt("APP_THIRD_MODIFY_ORDER_XY", "Third row right-click -> Modify Order target"),
        PointPrompt("APP_FOURTH_ROW_XY", "Fourth order row"),
        PointPrompt("APP_FOURTH_MODIFY_ORDER_XY", "Fourth row right-click -> Modify Order target"),
        PointPrompt("APP_FIFTH_ROW_XY", "Fifth order row"),
        PointPrompt("APP_FIFTH_MODIFY_ORDER_XY", "Fifth row right-click -> Modify Order target"),
        PointPrompt("APP_SIXTH_ROW_XY", "Sixth order row"),
        PointPrompt("APP_SIXTH_MODIFY_ORDER_XY", "Sixth row right-click -> Modify Order target"),
        PointPrompt("APP_PRICE_INPUT_XY", "Modify dialog price input", required=True),
        PointPrompt("APP_OK_BUTTON_XY", "Modify dialog OK button", required=True),
        PointPrompt("APP_CANCEL_BUTTON_XY", "Modify dialog Cancel button", required=True),
    ]
    if include_optional:
        prompts.extend(
            [
                PointPrompt("APP_WARNING_YES_XY", "Warning popup Yes button"),
                PointPrompt("WARNING_PIXEL_XY", "Warning popup color-check pixel (use blue pixel)"),
                PointPrompt("LAUNCHER_SWITCH_MENU_XY", "ESC menu switch-profile menu entry", default=(3139, 987)),
                PointPrompt("LAUNCHER_SWITCH_NEXT_XY", "Switch-profile next button", default=(3161, 409)),
                PointPrompt("LAUNCHER_MARKET_ORDERS_XY", "Market orders button", default=(3745, 488)),
                PointPrompt("LAUNCHER_QUIT_BUTTON_XY", "ESC menu Quit button", default=(3303, 982)),
            ]
        )
    return prompts


def build_region_prompts(include_optional: bool) -> List[RegionPrompt]:
    if not include_optional:
        return []
    return [
        RegionPrompt("OCR_TOTAL_REGION", "OCR read region around 'Total' value"),
    ]


def collect_warning_pixel_rgb(
    captured_points: Dict[str, Tuple[int, int]],
) -> Optional[Tuple[int, int, int]]:
    xy = captured_points.get("WARNING_PIXEL_XY")
    if not xy:
        return None
    try:
        c = pyautogui.pixel(xy[0], xy[1])
        return int(c[0]), int(c[1]), int(c[2])
    except Exception:
        return None


def emit_env_lines(
    points: Dict[str, Tuple[int, int]],
    regions: Dict[str, Tuple[int, int, int, int]],
    rgb: Optional[Tuple[int, int, int]],
    launcher_accounts_json: Optional[str],
) -> List[str]:
    lines: List[str] = []
    ordered_keys = [
        "APP_FILTER_INPUT_XY",
        "APP_FIRST_ROW_XY",
        "APP_MODIFY_ORDER_XY",
        "APP_SECOND_ROW_XY",
        "APP_SECOND_MODIFY_ORDER_XY",
        "APP_THIRD_ROW_XY",
        "APP_THIRD_MODIFY_ORDER_XY",
        "APP_FOURTH_ROW_XY",
        "APP_FOURTH_MODIFY_ORDER_XY",
        "APP_FIFTH_ROW_XY",
        "APP_FIFTH_MODIFY_ORDER_XY",
        "APP_SIXTH_ROW_XY",
        "APP_SIXTH_MODIFY_ORDER_XY",
        "APP_PRICE_INPUT_XY",
        "APP_OK_BUTTON_XY",
        "APP_CANCEL_BUTTON_XY",
        "APP_WARNING_YES_XY",
        "WARNING_PIXEL_XY",
        "LAUNCHER_SWITCH_MENU_XY",
        "LAUNCHER_SWITCH_NEXT_XY",
        "LAUNCHER_MARKET_ORDERS_XY",
        "LAUNCHER_QUIT_BUTTON_XY",
    ]
    for key in ordered_keys:
        if key in points:
            lines.append(f"{key}={format_point(points[key])}")

    if rgb is not None:
        lines.append(f"WARNING_PIXEL_RGB={rgb[0]},{rgb[1]},{rgb[2]}")
    if "OCR_TOTAL_REGION" in regions:
        r = regions["OCR_TOTAL_REGION"]
        lines.append(f"OCR_TOTAL_REGION={r[0]},{r[1]},{r[2]},{r[3]}")
    if launcher_accounts_json:
        lines.append(f"LAUNCHER_ACCOUNT_POINTS={launcher_accounts_json}")
    return lines


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Guided capture for script/.env coordinates (SPACE to capture)."
    )
    p.add_argument(
        "--minimal",
        action="store_true",
        help="Capture only core app coordinates (skip warning/OCR/launcher extras).",
    )
    p.add_argument(
        "--with-launcher-accounts",
        action="store_true",
        default=True,
        help="Capture account1/account2 launcher ctrl-click points (default: enabled).",
    )
    p.add_argument(
        "--no-with-launcher-accounts",
        action="store_false",
        dest="with_launcher_accounts",
        help="Skip launcher account-point capture.",
    )
    p.add_argument(
        "--save",
        action="store_true",
        default=True,
        help="Save output lines to file (default: enabled).",
    )
    p.add_argument(
        "--no-save",
        action="store_false",
        dest="save",
        help="Do not save output to file.",
    )
    p.add_argument(
        "--save-path",
        default="calibrated.env",
        help="Output file path for saved env lines (default: calibrated.env).",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    include_optional = not args.minimal
    user32 = ctypes.windll.user32

    print("Guided .env coordinate calibration")
    print("- Press SPACE to capture current mouse position")
    print("- Press 's' to skip optional prompts")
    print("- Press 'q' any time to quit")
    print("")

    points: Dict[str, Tuple[int, int]] = {}
    regions: Dict[str, Tuple[int, int, int, int]] = {}
    try:
        for prompt in build_point_prompts(include_optional=include_optional):
            captured = capture_point(user32, prompt)
            if captured is not None:
                points[prompt.env_key] = captured
            elif prompt.default is not None:
                points[prompt.env_key] = prompt.default

        for prompt in build_region_prompts(include_optional=include_optional):
            captured_region = capture_region(user32, prompt)
            if captured_region is not None:
                regions[prompt.env_key] = captured_region

        launcher_accounts_json: Optional[str] = None
        if args.with_launcher_accounts:
            print("")
            print("Capture launcher account points")
            account1 = capture_point(
                user32,
                PointPrompt(
                    env_key="LAUNCHER_ACCOUNT1",
                    label="Launcher account 1 ctrl-click target",
                    required=True,
                ),
            )
            account2 = capture_point(
                user32,
                PointPrompt(
                    env_key="LAUNCHER_ACCOUNT2",
                    label="Launcher account 2 ctrl-click target",
                    required=True,
                ),
            )
            if account1 and account2:
                launcher_accounts_json = json.dumps(
                    {"account1": [account1[0], account1[1]], "account2": [account2[0], account2[1]]},
                    separators=(",", ":"),
                )

        rgb = collect_warning_pixel_rgb(points) if include_optional else None
        lines = emit_env_lines(points, regions, rgb, launcher_accounts_json)

        print("")
        print("Calibration complete. Paste these into script/.env:")
        print("----------------------------------------------------")
        for line in lines:
            print(line)
        print("----------------------------------------------------")
        if args.save:
            out_path = Path(args.save_path).expanduser()
            out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
            print(f"Saved calibration lines to: {out_path}")
    except KeyboardInterrupt:
        print("")
        print("Calibration cancelled by user.")


if __name__ == "__main__":
    main()
