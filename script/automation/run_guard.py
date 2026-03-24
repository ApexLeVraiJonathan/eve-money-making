from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


@contextmanager
def single_instance_lock(lock_path: str) -> Iterator[None]:
    path = Path(lock_path).resolve()
    if path.exists():
        raise RuntimeError(f"Another automation instance appears active: {path}")
    path.write_text(str(os.getpid()), encoding="utf-8")
    try:
        yield
    finally:
        try:
            path.unlink(missing_ok=True)
        except Exception:
            pass
