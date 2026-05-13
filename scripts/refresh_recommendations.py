#!/usr/bin/env python3
"""
Refresh data/recommendations.json from images in assets/recommendations/.

For each PNG/JPG/JPEG in assets/recommendations/ that doesn't already have an
entry in recommendations.json (matched by basename), run Tesseract OCR with
Japanese + Chinese (Simplified + Traditional) + English language packs to
extract text, then append a new entry.

Designed to run in the GitHub Actions workflow at .github/workflows/refresh-recommendations.yml
on a nightly cron and on push. Idempotent — only writes if something changed.
"""

from __future__ import annotations
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

try:
    import pytesseract
    from PIL import Image
except ImportError:
    print("ERROR: pytesseract and Pillow are required.", file=sys.stderr)
    print("Install: pip install pytesseract pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = ROOT / "data" / "recommendations.json"
IMG_DIR = ROOT / "assets" / "recommendations"
RESERVED_SLUGS = {"bhavika-note", "mural-board"}
LANGS = "jpn+chi_sim+chi_tra+eng"
IMG_EXTS = {".png", ".jpg", ".jpeg"}


def slug_from_name(path: Path) -> str:
    return path.stem.lower().replace("_", "-").replace(" ", "-")


def humanize(slug: str) -> str:
    return " ".join(w.capitalize() for w in slug.replace("-", " ").split())


def ocr_image(path: Path) -> str:
    try:
        img = Image.open(path)
    except Exception as e:
        print(f"  [skip] cannot open {path.name}: {e}", file=sys.stderr)
        return ""
    try:
        text = pytesseract.image_to_string(img, lang=LANGS)
    except pytesseract.TesseractError as e:
        print(f"  [warn] OCR failed with {LANGS}, retrying English-only: {e}", file=sys.stderr)
        try:
            text = pytesseract.image_to_string(img, lang="eng")
        except Exception as e2:
            print(f"  [skip] OCR failed entirely on {path.name}: {e2}", file=sys.stderr)
            return ""
    # Normalize whitespace
    text = re.sub(r"\s+", " ", text or "").strip()
    return text


def detect_direction(ocr_text: str) -> str:
    """Heuristic — LinkedIn captions like 'X was Y's senior/manager/mentor'."""
    t = ocr_text.lower()
    if any(k in t for k in ["was riket's", "riket's senior", "riket's mentor",
                            "リケットの先輩", "リケットのメンター", "リケットの上司"]):
        return "sent"  # Riket wrote it about the other person
    if any(k in t for k in ["riket was", "リケットは", "ロバートはリケット",
                            "managed riket", "mentored riket"]):
        return "received"
    return "received"  # safe default


def load_json() -> dict:
    if not JSON_PATH.exists():
        return {
            "schema": 1,
            "updated_at": str(date.today()),
            "leads": [],
            "linkedin": [],
            "extras": [],
            "stats": [],
        }
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data: dict) -> None:
    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def main() -> int:
    if not IMG_DIR.exists():
        print(f"image dir not found: {IMG_DIR}", file=sys.stderr)
        return 0  # not an error — nothing to do

    data = load_json()
    existing_ids = {r["id"] for r in data.get("linkedin", [])}
    existing_ids |= {e["id"] for e in data.get("extras", [])}

    added: list[str] = []
    for img_path in sorted(IMG_DIR.iterdir()):
        if img_path.suffix.lower() not in IMG_EXTS:
            continue
        slug = slug_from_name(img_path)
        if slug in RESERVED_SLUGS or slug in existing_ids:
            continue

        print(f"OCR'ing new image: {img_path.name}")
        ocr_text = ocr_image(img_path)
        rel_img = "assets/recommendations/" + img_path.name
        entry = {
            "id": slug,
            "image": rel_img,
            "name": humanize(slug),
            "title": "",
            "direction": detect_direction(ocr_text),
            "date": "",
            "summary": "",  # left empty — Riket fills in or an LLM step runs later
            "language": "ja" if any(0x3000 <= ord(c) <= 0x9FFF for c in ocr_text) else "en",
            "ocr_raw": ocr_text[:2000],  # cap to keep JSON readable
        }
        data.setdefault("linkedin", []).append(entry)
        existing_ids.add(slug)
        added.append(slug)

    if not added:
        print("No new recommendations to add.")
        return 0

    data["updated_at"] = str(date.today())
    save_json(data)
    print(f"Added {len(added)} new entries: {', '.join(added)}")
    print(f"JSON written to: {JSON_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
