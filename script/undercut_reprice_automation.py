from __future__ import annotations

import argparse
import json
import uuid
import pyautogui
from typing import Any, List, Optional, Tuple

from automation.api_client import ApiClient
from automation.app_driver import AppDriver
from automation.config import Config
from automation.controls import RuntimeControls
from automation.launcher import LauncherOrchestrator
from automation.planner import (
    choose_location_groups,
    compute_row_rank_for_update,
    filter_red_negative_profit,
    flatten_updates,
)
from automation.run_guard import single_instance_lock


def run(cfg: Config) -> None:
    client = ApiClient(cfg)
    controls = RuntimeControls(cfg.stop_hotkey, cfg.stop_hold_seconds, cfg.pause_hotkey)
    app = AppDriver(cfg, controls=controls)
    launcher = LauncherOrchestrator(cfg, controls=controls)

    print("Fetching undercut updates...")
    groups = client.undercut_check()
    filtered_groups = filter_red_negative_profit(cfg, groups)
    if not filtered_groups:
        print("No updates returned after filtering. Exiting.")
        return

    run_id = uuid.uuid4().hex

    total_processed = 0
    total_failures: List[str] = []
    stopped = False
    remaining_groups = list(filtered_groups)
    launcher.start_launcher_if_needed()

    while remaining_groups:
        if controls.checkpoint():
            stopped = True
            break

        if cfg.run_mode == "scheduled":
            preferred_location = (
                launcher.active_location_label() if cfg.enable_launcher_orchestration else None
            )
            selected_groups = choose_scheduled_location_groups(
                cfg, remaining_groups, preferred_location=preferred_location
            )
            if selected_groups and cfg.enable_launcher_orchestration:
                location_label = str(selected_groups[0].get("stationName") or "").strip()
                if location_label:
                    launcher.switch_for_location(location_label)
        else:
            selected_groups = choose_location_groups(cfg, remaining_groups)
        if not selected_groups:
            print("No location selected. Exiting.")
            break

        station_ids_in_selection = {int(g.get("stationId", 0)) for g in selected_groups}
        updates = flatten_updates(selected_groups)
        print(f"Selected location updates: {len(updates)}")
        if not updates:
            remaining_groups = [
                g for g in remaining_groups if int(g.get("stationId", 0)) not in station_ids_in_selection
            ]
            continue
        missing_expected_fee = [
            str(u.get("itemName") or "<unknown>")
            for u in updates
            if u.get("expectedRelistFeeIsk") is None
        ]
        if missing_expected_fee:
            sample = ", ".join(missing_expected_fee[:5])
            raise RuntimeError(
                "Script undercut response is missing expectedRelistFeeIsk for "
                f"{len(missing_expected_fee)} update(s). "
                f"Examples: {sample}"
            )

        processed = 0
        failures: List[str] = []
        successful_confirms: List[dict[str, Any]] = []
        client_failed_items: List[dict[str, Any]] = []
        last_filter_key: Optional[Tuple[int, str]] = None

        for u in updates:
            if controls.checkpoint():
                stopped = True
                break
            if cfg.max_updates is not None and total_processed >= cfg.max_updates:
                print(f"Reached MAX_UPDATES={cfg.max_updates}, stopping.")
                stopped = True
                break

            line_id = str(u.get("lineId") or "").strip()
            if not line_id:
                msg = f"Missing lineId for {u['itemName']} station={u['stationId']} type={u['typeId']}"
                failures.append(msg)
                client_failed_items.append(
                    {
                        "itemName": str(u.get("itemName") or "<unknown>"),
                        "reason": msg,
                    }
                )
                continue

            print(
                f"[{total_processed + 1}] {u['itemName']} -> {u['suggestedNewPriceTicked']:.2f} "
                f"(qty={u['remaining']}, lineId={line_id})"
            )

            rank_key = (int(u["stationId"]), str(u["itemName"]).lower())
            row_rank = compute_row_rank_for_update(cfg, u, updates)
            refresh_filter = not (row_rank >= 2 and last_filter_key == rank_key)
            if row_rank > 6:
                msg = (
                    f"Row rank {row_rank} unsupported for {u['itemName']} "
                    f"(station={u['stationId']}, orderId={u['orderId']}). "
                    "Configure row coordinates up to rank 6 or narrow filters."
                )
                failures.append(msg)
                client_failed_items.append(
                    {
                        "lineId": line_id,
                        "itemName": str(u.get("itemName") or "<unknown>"),
                        "reason": msg,
                    }
                )
                continue

            try:
                expected_relist_fee = float(u["expectedRelistFeeIsk"])
                app.update_item_price(
                    u["itemName"],
                    u["suggestedNewPriceTicked"],
                    expected_relist_fee=expected_relist_fee,
                    row_rank=row_rank,
                    refresh_filter=refresh_filter,
                    should_stop=controls.is_stop_requested,
                )
                if controls.checkpoint():
                    stopped = True
                    break
                processed += 1
                total_processed += 1
                if cfg.dry_run and controls.wait(cfg.dry_run_step_delay):
                    stopped = True
                    break
                if refresh_filter:
                    last_filter_key = rank_key
                if cfg.confirm_mode == "listing":
                    successful_confirms.append(
                        {
                            "lineId": line_id,
                            "mode": "listing",
                            "quantity": int(u["remaining"]),
                            "unitPrice": float(u["suggestedNewPriceTicked"]),
                        }
                    )
                else:
                    successful_confirms.append(
                        {
                            "lineId": line_id,
                            "mode": "reprice",
                            "quantity": int(u["remaining"]),
                            "newUnitPrice": float(u["suggestedNewPriceTicked"]),
                        }
                    )
            except KeyboardInterrupt:
                stopped = True
                break
            except Exception as exc:
                msg = f"{u['itemName']}: {exc}"
                failures.append(msg)
                client_failed_items.append(
                    {
                        "lineId": line_id,
                        "itemName": str(u.get("itemName") or "<unknown>"),
                        "reason": str(exc),
                    }
                )

        if not cfg.dry_run and (successful_confirms or client_failed_items):
            station_for_batch = int(selected_groups[0].get("stationId", 0))
            idem_key = f"{run_id}:{station_for_batch}:{cfg.confirm_mode}"
            try:
                batch_result = client.confirm_batch(
                    idempotency_key=idem_key,
                    updates=successful_confirms,
                    failed_items=client_failed_items,
                )
                failed_count = int(batch_result.get("failedCount", 0))
                client_failed_count = int(batch_result.get("clientFailedCount", 0))
                if failed_count > 0:
                    failures.append(
                        f"confirm-batch reported {failed_count} failed item(s): "
                        + json.dumps(batch_result.get("results", [])[:8])
                    )
                if client_failed_count > 0:
                    failures.append(
                        f"confirm-batch accepted {client_failed_count} client-side failed item(s)"
                    )
            except Exception as exc:
                failures.append(f"confirm-batch failed: {exc}")

        total_failures.extend(failures)
        print("")
        print("Location run complete.")
        print(f"Processed this location: {processed}")
        print(f"Failures this location: {len(failures)}")
        if failures:
            print(json.dumps(failures, indent=2))

        # Remove completed location(s) and go back to menu without refetching.
        remaining_groups = [
            g for g in remaining_groups if int(g.get("stationId", 0)) not in station_ids_in_selection
        ]
        if stopped or not cfg.enable_location_menu:
            break
        if remaining_groups:
            print("")
            print(
                f"{len(remaining_groups)} location group(s) remaining. Returning to menu..."
            )

    print("")
    print("Run complete.")
    print(f"Total processed: {total_processed}")
    print(f"Total failures: {len(total_failures)}")
    if stopped:
        if cfg.stop_hold_seconds <= 0:
            print(f"Stopped by user (pressed {cfg.stop_hotkey}).")
        else:
            print(f"Stopped by user (held {cfg.stop_hotkey} for {cfg.stop_hold_seconds:.2f}s).")
    if total_failures:
        print(json.dumps(total_failures, indent=2))
    report_lines = [
        f"Mode: {cfg.run_mode}",
        f"Processed: {total_processed}",
        f"Failures: {len(total_failures)}",
    ]
    if stopped:
        report_lines.append("Stopped by user.")
    try:
        client.report_run(
            status="failure" if total_failures or stopped else "success",
            lines=report_lines + total_failures[:20],
            label=cfg.run_mode,
        )
    except Exception as exc:
        print(f"Warning: failed to send run report: {exc}")

    if cfg.run_mode == "scheduled" and cfg.close_app_when_done:
        close_app(cfg)


def close_app(cfg: Config) -> None:
    hotkey = (cfg.app_close_hotkey or "").strip().lower()
    if hotkey == "alt+f4":
        pyautogui.hotkey("alt", "f4")
    elif hotkey:
        keys = [k.strip() for k in hotkey.split("+") if k.strip()]
        if len(keys) >= 2:
            pyautogui.hotkey(*keys)


def choose_scheduled_location_groups(
    cfg: Config,
    groups: List[dict[str, Any]],
    preferred_location: Optional[str] = None,
) -> List[dict[str, Any]]:
    if not groups:
        return []
    if preferred_location:
        preferred_key = preferred_location.strip().lower()
        preferred_matches = [
            g
            for g in groups
            if preferred_key in str(g.get("stationName") or "").strip().lower()
        ]
        if preferred_matches:
            print(f"Scheduled selection (active profile): {preferred_matches[0].get('stationName')}")
            return preferred_matches
    if not cfg.scheduled_location_order:
        station_id = int(groups[0].get("stationId", 0))
        return [g for g in groups if int(g.get("stationId", 0)) == station_id]

    indexed: dict[str, List[dict[str, Any]]] = {}
    for g in groups:
        label = str(g.get("stationName") or "").strip().lower()
        if not label:
            continue
        indexed.setdefault(label, []).append(g)

    for wanted in cfg.scheduled_location_order:
        wanted_key = wanted.strip().lower()
        for key, grouped in indexed.items():
            if wanted_key in key:
                print(f"Scheduled selection: {grouped[0].get('stationName')}")
                return grouped

    station_id = int(groups[0].get("stationId", 0))
    return [g for g in groups if int(g.get("stationId", 0)) == station_id]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Automate EVE order repricing from /pricing/script/undercut-check."
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Run live mode explicitly (default behavior).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run dry-run validation mode (click Cancel, no confirm).",
    )
    parser.add_argument(
        "--max-updates",
        type=int,
        default=None,
        help="Override MAX_UPDATES from env.",
    )
    parser.add_argument(
        "--include-red-negative-profit",
        action="store_true",
        help="Include red negative-profit updates (normally excluded).",
    )
    parser.add_argument(
        "--run-mode",
        choices=["interactive", "scheduled"],
        default=None,
        help="interactive (menu) or scheduled (non-interactive).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    cfg = Config.from_env()
    if args.dry_run:
        cfg.dry_run = True
    elif args.live:
        cfg.dry_run = False
    # Cap only when explicitly provided via CLI. Default is unlimited.
    cfg.max_updates = args.max_updates if args.max_updates is not None else None
    if args.include_red_negative_profit:
        cfg.include_red_negative_profit = True
    if args.run_mode:
        cfg.run_mode = args.run_mode

    if cfg.confirm_mode not in {"reprice", "listing"}:
        raise ValueError("CONFIRM_MODE must be 'reprice' or 'listing'.")
    if cfg.filter_input_method.strip().lower() not in {"paste", "type", "paste_then_type"}:
        raise ValueError(
            "FILTER_INPUT_METHOD must be one of: paste, type, paste_then_type."
        )

    print(f"Mode: {'DRY-RUN' if cfg.dry_run else 'LIVE'}")
    print(f"Run mode: {cfg.run_mode}")
    print("API mode: script")
    print(f"Confirm mode: {cfg.confirm_mode}")
    print(
        "OCR guard: "
        + (
            f"enabled (region={cfg.ocr_total_region}, tolerance={cfg.ocr_tolerance_pct:.4f}%)"
            if cfg.ocr_guard_enabled
            else "disabled"
        )
    )
    print(
        "Negative-profit filtering: "
        + (
            f"INCLUDING red (<= {cfg.red_profit_threshold_percent:.2f}%)"
            if cfg.include_red_negative_profit
            else f"excluding red (<= {cfg.red_profit_threshold_percent:.2f}%)"
        )
    )
    if cfg.stop_hold_seconds <= 0:
        print(f"Emergency stop: press '{cfg.stop_hotkey}'")
    else:
        print(f"Emergency stop: hold '{cfg.stop_hotkey}' for {cfg.stop_hold_seconds:.2f}s")
    print(f"Pause/resume toggle: press '{cfg.pause_hotkey}'")
    if cfg.dry_run:
        print("Dry-run validation mode: executes UI flow, logs OCR, clicks Cancel (no OK, no confirm).")

    with single_instance_lock(cfg.single_instance_lock_path):
        run(cfg)


if __name__ == "__main__":
    main()
