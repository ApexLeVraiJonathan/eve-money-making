from __future__ import annotations

import argparse
import re
import statistics
import time
from typing import List, Optional, Tuple

import cv2
import numpy as np

try:
    import mss
except Exception:  # pragma: no cover
    mss = None

try:
    from rapidocr_onnxruntime import RapidOCR
except Exception:  # pragma: no cover
    RapidOCR = None


def parse_region(raw: str) -> Tuple[int, int, int, int]:
    nums = re.findall(r"-?\d+", raw or "")
    if len(nums) < 4:
        raise ValueError("Region must be x,y,w,h")
    x, y, w, h = [int(n) for n in nums[:4]]
    if w <= 0 or h <= 0:
        raise ValueError("Region width/height must be > 0")
    return x, y, w, h


def capture_region(region: Tuple[int, int, int, int]) -> np.ndarray:
    if mss is None:
        raise RuntimeError("mss is required. Install dependencies: pip install -r requirements.txt")
    x, y, w, h = region
    with mss.mss() as sct:
        shot = sct.grab({"left": x, "top": y, "width": w, "height": h})
        # BGRA -> BGR
        img = np.array(shot)[:, :, :3]
        return img


def preprocess_variants(img_bgr: np.ndarray) -> List[np.ndarray]:
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    # Upscale so OCR sees small UI fonts better.
    big = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)

    variants: List[np.ndarray] = [big]

    # Variant 1: binary threshold
    _, th1 = cv2.threshold(big, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants.append(th1)

    # Keep variant count low for speed; two variants are usually enough for this UI.
    # (More variants increase latency a lot with detection-based OCR.)

    return variants


def _parse_compact_number(compact: str) -> List[float]:
    out: List[float] = []
    if not compact:
        return out

    # Keep only digits and separators.
    s = re.sub(r"[^0-9,\.]", "", compact)
    if not s:
        return out

    # Strategy A: decimal dot at last dot, commas as thousand separators.
    if "." in s:
        parts = s.split(".")
        int_part = re.sub(r"[^0-9]", "", "".join(parts[:-1]))
        frac_part = re.sub(r"[^0-9]", "", parts[-1])
        if int_part:
            if frac_part:
                out.append(float(f"{int_part}.{frac_part}"))
            else:
                out.append(float(int_part))

    # Strategy B: remove all separators, interpret as integer.
    digits = re.sub(r"[^0-9]", "", s)
    if digits:
        out.append(float(digits))
        # Strategy C: interpret trailing 2 digits as cents.
        if len(digits) >= 3:
            out.append(float(f"{digits[:-2]}.{digits[-2:]}"))

    return out


def parse_isk_candidates_from_text(text: str) -> List[float]:
    if not text:
        return []

    # Keep likely number chunks, including OCR-broken separators/spaces.
    matches = re.findall(r"\d[\d,\.\s]{2,}", text)
    out: List[float] = []
    for m in matches:
        compact = re.sub(r"\s+", "", m)
        for val in _parse_compact_number(compact):
            if val > 0:
                out.append(val)
    # Also try parsing the full line once (helps when OCR splits oddly).
    for val in _parse_compact_number(re.sub(r"\s+", "", text)):
        if val > 0:
            out.append(val)

    # Deduplicate while preserving order.
    dedup: List[float] = []
    seen = set()
    for v in out:
        k = round(v, 6)
        if k in seen:
            continue
        seen.add(k)
        dedup.append(v)
    return dedup


def read_total_once(
    region: Tuple[int, int, int, int], ocr_engine: "RapidOCR"
) -> Tuple[List[float], str]:
    if RapidOCR is None:
        raise RuntimeError(
            "rapidocr-onnxruntime is missing. Install dependencies: pip install -r requirements.txt"
        )

    img = capture_region(region)
    variants = preprocess_variants(img)

    texts: List[str] = []
    values: List[float] = []

    for v in variants:
        # RapidOCR returns (result, elapse). result items usually: [box, text, score]
        result, _ = ocr_engine(v)
        if not result:
            txt = ""
        else:
            parts: List[str] = []
            for row in result:
                if isinstance(row, (list, tuple)) and len(row) >= 2:
                    parts.append(str(row[1]))
            txt = " ".join(parts)
        texts.append(txt)
        vals = parse_isk_candidates_from_text(txt)
        if vals:
            values.extend(vals)

    merged_text = "\n---\n".join(t.strip() for t in texts if t.strip())
    return values, merged_text


def within_pct(observed: float, expected: float, tolerance_pct: float) -> bool:
    if expected == 0:
        return abs(observed) <= abs(tolerance_pct)
    pct = abs((observed - expected) / expected) * 100.0
    return pct <= tolerance_pct


def main() -> None:
    p = argparse.ArgumentParser(
        description="OCR-check relist total from screen region and compare with expected."
    )
    p.add_argument(
        "--region",
        required=True,
        help="Capture region as x,y,w,h around the total value.",
    )
    p.add_argument(
        "--expected",
        type=float,
        default=None,
        help="Expected total (ISK) to compare against.",
    )
    p.add_argument(
        "--tolerance-pct",
        type=float,
        default=0.15,
        help="Allowed percent deviation (default: 0.15%%).",
    )
    p.add_argument(
        "--samples",
        type=int,
        default=1,
        help="Number of OCR reads to take (default: 1).",
    )
    p.add_argument(
        "--interval",
        type=float,
        default=0.15,
        help="Delay between samples seconds (default: 0.15).",
    )
    p.add_argument(
        "--show-debug",
        action="store_true",
        help="Print OCR raw text and parsed candidates for tuning.",
    )
    args = p.parse_args()

    region = parse_region(args.region)
    if RapidOCR is None:
        raise RuntimeError(
            "rapidocr-onnxruntime not installed. Run: pip install -r requirements.txt"
        )
    ocr_engine = RapidOCR()
    reads: List[float] = []
    debug_texts: List[str] = []

    for _ in range(max(1, args.samples)):
        values, text = read_total_once(region, ocr_engine)
        if args.show_debug:
            print("OCR_TEXT:", text if text else "<empty>")
            print("OCR_VALUES:", values if values else "[]")
        if values:
            if args.expected is not None:
                # Use domain knowledge: pick candidate nearest expected fee.
                best = min(values, key=lambda v: abs(v - args.expected))
                reads.append(best)
            else:
                # Without expectation, use largest candidate as heuristic.
                reads.append(max(values))
        if text:
            debug_texts.append(text)
        time.sleep(max(0.0, args.interval))

    if not reads:
        print("OCR_RESULT: NO_NUMBER")
        if debug_texts:
            print("OCR_RAW_TEXT:")
            print("\n====\n".join(debug_texts[:2]))
        print("Tip: verify region with capture_region_on_space.py and make it wider/taller.")
        return

    observed = statistics.median(reads)
    print(f"OCR_RESULT: {observed:,.2f}")

    if args.expected is None:
        return

    delta = observed - args.expected
    pct = abs(delta / args.expected) * 100.0 if args.expected else 0.0
    ok = within_pct(observed, args.expected, args.tolerance_pct)
    print(f"EXPECTED: {args.expected:,.2f}")
    print(f"DELTA: {delta:+,.2f} ({pct:.4f}%)")
    print(f"MATCH: {'YES' if ok else 'NO'} (tolerance={args.tolerance_pct:.4f}%)")


if __name__ == "__main__":
    main()
