from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

import requests

from .config import Config


class ApiClient:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def _url(self, path: str) -> str:
        return f"{self.cfg.api_base_url.rstrip('/')}{path}"

    def _auth_headers(self) -> Dict[str, str]:
        if self.cfg.script_api_key:
            return {"x-script-api-key": self.cfg.script_api_key}
        raise ValueError("SCRIPT_API_KEY is required for /pricing/script/* endpoints.")

    def undercut_check(self) -> List[Dict[str, Any]]:
        payload: Dict[str, Any] = {
            "cycleId": self.cfg.cycle_id or None,
            "groupingMode": self.cfg.grouping_mode,
            "filterMaxChars": self.cfg.filter_max_chars,
            "normalizeFilterText": self.cfg.normalize_filter_text,
            "filterForceLowercase": self.cfg.filter_force_lowercase,
            "filterStripQuotes": self.cfg.filter_strip_quotes,
        }
        if self.cfg.station_ids:
            payload["stationIds"] = self.cfg.station_ids
        payload = {k: v for k, v in payload.items() if v is not None}
        res = self.session.post(
            self._url("/pricing/script/undercut-check"),
            json=payload,
            headers=self._auth_headers(),
            timeout=90,
        )
        res.raise_for_status()
        return res.json()

    def confirm_batch(
        self,
        idempotency_key: str,
        updates: List[Dict[str, Any]],
        failed_items: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            "idempotencyKey": idempotency_key,
        }
        if updates:
            body["updates"] = updates
        if failed_items:
            body["failedItems"] = failed_items
        retries = 3
        backoff = 1.0
        last_err: Optional[Exception] = None
        for attempt in range(1, retries + 1):
            try:
                res = self.session.post(
                    self._url("/pricing/script/confirm-batch"),
                    json=body,
                    headers=self._auth_headers(),
                    timeout=60,
                )
                if 500 <= res.status_code < 600:
                    raise requests.HTTPError(
                        f"Server error {res.status_code}: {res.text}",
                        response=res,
                    )
                res.raise_for_status()
                return res.json()
            except (requests.Timeout, requests.ConnectionError, requests.HTTPError) as exc:
                last_err = exc
                if isinstance(exc, requests.HTTPError):
                    code = exc.response.status_code if exc.response is not None else 0
                    if code and code < 500:
                        raise
                if attempt == retries:
                    break
                time.sleep(backoff)
                backoff *= 2
        raise RuntimeError(f"confirm-batch failed after retries: {last_err}")

    def report_run(self, status: str, lines: List[str], label: str = "") -> None:
        body = {
            "status": status,
            "label": label or None,
            "lines": lines,
        }
        if self.cfg.script_report_user_id:
            body["userId"] = self.cfg.script_report_user_id
        res = self.session.post(
            self._url("/pricing/script/run-report"),
            json=body,
            headers=self._auth_headers(),
            timeout=30,
        )
        res.raise_for_status()

