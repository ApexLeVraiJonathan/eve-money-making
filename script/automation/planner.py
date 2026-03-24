from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Optional, Tuple

from .config import Config


def build_line_map(cycle_lines: Iterable[Dict[str, Any]]) -> Dict[Tuple[int, int], str]:
    out: Dict[Tuple[int, int], str] = {}
    for line in cycle_lines:
        key = (int(line["destinationStationId"]), int(line["typeId"]))
        out[key] = line["id"]
    return out


def flatten_updates(groups: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for group in groups:
        station_id = int(group["stationId"])
        for u in group.get("updates", []):
            rows.append(
                {
                    "lineId": u.get("lineId"),
                    "stationId": station_id,
                    "orderId": int(u["orderId"]),
                    "typeId": int(u["typeId"]),
                    "itemName": str(u["itemName"]),
                    "remaining": int(u["remaining"]),
                    "suggestedNewPriceTicked": float(u["suggestedNewPriceTicked"]),
                    "expectedRelistFeeIsk": u.get("expectedRelistFeeIsk"),
                    "estimatedMarginPercentAfter": u.get("estimatedMarginPercentAfter"),
                    "uiTarget": u.get("uiTarget"),
                }
            )
    return rows


def filter_red_negative_profit(cfg: Config, groups: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if cfg.include_red_negative_profit:
        return groups

    threshold = cfg.red_profit_threshold_percent
    out: List[Dict[str, Any]] = []
    removed = 0
    for g in groups:
        updates = g.get("updates", [])
        kept_updates = []
        for u in updates:
            margin = u.get("estimatedMarginPercentAfter")
            margin_num: Optional[float]
            try:
                margin_num = float(margin) if margin is not None else None
            except (TypeError, ValueError):
                margin_num = None
            is_red = margin_num is not None and margin_num <= threshold
            if is_red:
                removed += 1
                continue
            kept_updates.append(u)
        if kept_updates:
            clone = dict(g)
            clone["updates"] = kept_updates
            out.append(clone)

    if removed > 0:
        print(
            f"Filtered out {removed} red negative-profit updates "
            f"(margin <= {threshold:.2f}%)."
        )
    return out


def choose_location_groups(cfg: Config, groups: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not cfg.enable_location_menu:
        return groups

    buckets: Dict[str, Dict[str, Any]] = {}
    for g in groups:
        updates = g.get("updates", [])
        if not updates:
            continue
        station_id = int(g.get("stationId", 0))
        station_name = str(g.get("stationName") or "").strip()
        label = station_name or f"Station {station_id}"
        key = f"{station_id}|{label.lower()}"
        entry = buckets.get(key)
        if entry is None:
            entry = {"label": label, "stationId": station_id, "groups": [], "updatesCount": 0}
            buckets[key] = entry
        entry["groups"].append(g)
        entry["updatesCount"] += len(updates)

    options = sorted(buckets.values(), key=lambda x: str(x["label"]).lower())
    if not options:
        return groups

    print("")
    print("Select location to process:")
    for idx, opt in enumerate(options, start=1):
        print(f"{idx} - {opt['label']} ({opt['updatesCount']} updates)")
    print("q - quit")

    while True:
        raw = input("Choice: ").strip().lower()
        if raw in {"q", "quit", "exit"}:
            return []
        if raw.isdigit():
            n = int(raw)
            if 1 <= n <= len(options):
                selected = options[n - 1]
                print(f"Selected location: {selected['label']}")
                return selected["groups"]
        print("Invalid choice. Enter one of the numbers above, or q.")


def normalize_name_for_filter(cfg: Config, text: str) -> str:
    cleaned = text or ""
    if cfg.normalize_filter_text:
        if cfg.filter_strip_quotes:
            cleaned = re.sub(r"[\"'`]", " ", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if cfg.filter_force_lowercase:
        cleaned = cleaned.lower()
    return cleaned


def build_filter_query(cfg: Config, text: str) -> str:
    cleaned = normalize_name_for_filter(cfg, text)
    max_chars = max(1, int(cfg.filter_max_chars))
    if len(cleaned) > max_chars:
        return cleaned[-max_chars:]
    return cleaned


def compute_row_rank_for_update(
    cfg: Config, current: Dict[str, Any], all_updates: List[Dict[str, Any]]
) -> int:
    ui_target = current.get("uiTarget") or {}
    if isinstance(ui_target, dict):
        hinted_rank = ui_target.get("rowRank")
        try:
            if hinted_rank is not None and int(hinted_rank) >= 1:
                return int(hinted_rank)
        except (TypeError, ValueError):
            pass

    station_id = int(current["stationId"])
    query = build_filter_query(cfg, str(current["itemName"]))
    if not query:
        return 1

    station_updates = [u for u in all_updates if int(u["stationId"]) == station_id]
    candidates = []
    for u in station_updates:
        name_norm = normalize_name_for_filter(cfg, str(u["itemName"]))
        if query in name_norm:
            candidates.append(u)

    if not candidates:
        cur_name = normalize_name_for_filter(cfg, str(current["itemName"]))
        candidates = [
            u
            for u in station_updates
            if normalize_name_for_filter(cfg, str(u["itemName"])) == cur_name
        ]

    if not candidates:
        return 1

    candidates.sort(
        key=lambda u: (
            int(u["remaining"]),
            normalize_name_for_filter(cfg, str(u["itemName"])),
            int(u.get("orderId", 0)),
        )
    )
    cur_order_id = int(current["orderId"])
    for idx, u in enumerate(candidates, start=1):
        if int(u.get("orderId", -1)) == cur_order_id:
            return idx
    return 1

