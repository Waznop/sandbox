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
    - Row N (after header) corresponds to img[N-1] (positional mapping)
    - Looks for img1.png, img2.png, ... in the image directory
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

        for row_num, row in enumerate(reader, start=1):
            img_name = f"img{row_num}"

            count_str = row["count"].strip() if row["count"] else ""
            if count_str == "":
                count = 1
            else:
                try:
                    count = int(count_str)
                except ValueError:
                    print(f"Warning: non-integer count '{count_str}' row {row_num}, skipping", file=sys.stderr)
                    continue

            img_path = available.get(img_name.lower())
            if img_path is None:
                print(f"Warning: no image for '{img_name}', skipping", file=sys.stderr)
                continue

            items.append(Item(
                index=row_num - 1,
                name=img_name,
                path=img_path.resolve(),
                demand=max(0, count),
            ))

    return items
