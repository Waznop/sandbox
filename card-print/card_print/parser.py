"""CSV and image parsing."""
from __future__ import annotations
import csv
import sys
from pathlib import Path

from .models import Item

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}


def parse_input(csv_path: Path, image_dir: Path) -> list[Item]:
    """Parse CSV and discover matching images.

    - First row must have a "count" column
    - First column (or "name" column) gives image filename
    - Empty count -> 1, "0" -> skip, negative -> clamped to 0
    - Missing images -> warning + skip
    """
    if not csv_path.is_file():
        print(f"Error: CSV not found: {csv_path}", file=sys.stderr)
        sys.exit(1)
    if not image_dir.is_dir():
        print(f"Error: Image dir not found: {image_dir}", file=sys.stderr)
        sys.exit(1)

    available = {
        f.stem.lower(): f
        for f in image_dir.iterdir()
        if f.suffix.lower() in SUPPORTED_EXTENSIONS
    }

    items = []
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None or "count" not in reader.fieldnames:
            print("Error: CSV must have a 'count' header", file=sys.stderr)
            sys.exit(1)

        name_col = "name" if "name" in reader.fieldnames else reader.fieldnames[0]

        for idx, row in enumerate(reader):
            name = row[name_col].strip()
            if not name:
                continue

            count_str = row["count"].strip() if row["count"] else ""
            if count_str == "":
                count = 1
            else:
                try:
                    count = int(count_str)
                except ValueError:
                    print(f"Warning: non-integer count '{count_str}' row {idx+1}, skipping", file=sys.stderr)
                    continue

            stem = Path(name).stem.lower()
            img_path = available.get(stem)
            if img_path is None:
                print(f"Warning: no image for '{name}', skipping", file=sys.stderr)
                continue

            items.append(Item(
                index=idx,
                name=Path(name).stem,
                path=img_path.resolve(),
                demand=max(0, count),
            ))

    return items
