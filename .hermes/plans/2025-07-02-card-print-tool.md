# Card Print Tool Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** CLI tool that reads images + CSV with count column, packs items into optimal 3×3 print sheets, and outputs PDFs named with their print counts.

**Architecture:** Pure Python CLI (no server). Parses CSV to extract items with counts, runs a bin-packing algorithm that groups items by compatible print counts (GCD-based), then generates PDFs with reportlab. Each PDF is a single 3×3 grid; the filename encodes how many copies to print.

**Tech Stack:** Python 3.10+, Click (CLI), reportlab (PDF), csv/stdlib (parsing)

**Location:** `~/Documents/Projects/sandbox/card-print/`

---

## Algorithm Overview

Each PDF page holds 9 slots (3×3 grid). Items on the same page share a "print count" C where every item's count is divisible by C. An item with count N occupies `N/C` slots. The goal is to minimize total printed sheets = `sum(pages) * print_count` across all PDFs.

Key insight: items with counts 3 and 6 can share a page printed 3× (count-3 items take 1 slot, count-6 items take 2 slots). This beats grouping by exact count match.

The solver uses recursive backtracking with memoization:
1. Pick the unassigned item with highest count
2. Try each divisor of its count as the page group's print count
3. Greedily pack compatible unassigned items into pages (first-fit decreasing by slot cost)
4. Recurse on remaining items
5. Return the grouping with minimum total sheets

---

## Project Structure

```
sandbox/card-print/
├── pyproject.toml
├── README.md
├── card_print/
│   ├── __init__.py
│   ├── __main__.py      # CLI entry point (Click)
│   ├── models.py         # Data classes: Item, Page, PackResult
│   ├── parser.py         # CSV + image discovery
│   ├── packer.py         # Bin-packing algorithm
│   └── pdf.py            # PDF generation (reportlab)
├── tests/
│   ├── test_parser.py
│   ├── test_packer.py
│   └── test_pdf.py
└── fixtures/             # Test fixtures
    ├── test.csv
    └── images/
        ├── img1.png      # 1px transparent PNGs
        └── ...
```

---

### Task 1: Initialize project structure

**Objective:** Create the project skeleton with pyproject.toml and empty modules.

**Files:**
- Create: `sandbox/card-print/pyproject.toml`
- Create: `sandbox/card-print/card_print/__init__.py`
- Create: `sandbox/card-print/card_print/__main__.py`
- Create: `sandbox/card-print/card_print/models.py`
- Create: `sandbox/card-print/card_print/parser.py`
- Create: `sandbox/card-print/card_print/packer.py`
- Create: `sandbox/card-print/card_print/pdf.py`
- Create: `sandbox/card-print/tests/__init__.py` (empty)
- Create: `sandbox/card-print/README.md`

**Step 1: Write pyproject.toml**

```toml
[project]
name = "card-print"
version = "0.1.0"
description = "CLI tool for packing card images into optimal print sheets"
requires-python = ">=3.10"
dependencies = [
    "click>=8.0",
    "reportlab>=4.0",
]

[project.scripts]
card-print = "card_print.__main__:cli"

[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.backends._legacy:_Backend"

[tool.setuptools.packages.find]
include = ["card_print*"]
```

**Step 2: Create empty module files**

Each `.py` file starts with just a docstring:
```python
"""Module description."""
```

**Step 3: Verify import works**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m card_print`
Expected: No error (empty CLI runs without crash) or "Usage:" from Click

**Step 4: Commit**

```bash
cd ~/Documents/Projects/sandbox
git add card-print/
git commit -m "feat: initialize card-print project structure"
```

---

### Task 2: Define data models

**Objective:** Create dataclasses for Item, Page, and PackResult.

**Files:**
- Modify: `sandbox/card-print/card_print/models.py`

**Step 1: Write failing test**

Create: `sandbox/card-print/tests/test_models.py`

```python
from card_print.models import Item, Page, PackResult

def test_item_creation():
    item = Item(index=0, name="img1", path="/fake/img1.png", count=3)
    assert item.index == 0
    assert item.count == 3

def test_page_default_print_count():
    page = Page(items=[Item(0, "img1", "/img1.png", 3)])
    assert page.print_count == 1  # default before packing

def test_pack_result_sheets():
    result = PackResult(pages=[
        Page(items=[], print_count=3),
        Page(items=[], print_count=1),
    ])
    assert result.total_sheets == 4  # 1*3 + 1*1
    assert result.num_pdfs == 2
    assert result.wasted_slots == 18  # 2 pages * 9 slots, no items
```

**Step 2: Run test to verify failure**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/test_models.py -v`
Expected: FAIL — module/classes not defined

**Step 3: Write models**

```python
"""Data models for card printing."""
from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Item:
    """A single card image with its print count."""
    index: int          # 0-based index, maps to img{index+1}
    name: str           # e.g. "img1"
    path: Path          # absolute path to the image file
    count: int          # how many copies needed (0 = skip)


@dataclass
class Page:
    """One 3x3 page in a PDF. All items share the same print count."""
    items: list[Item] = field(default_factory=list)
    print_count: int = 1

    @property
    def used_slots(self) -> int:
        """Number of slots occupied by items on this page."""
        return sum(item.count // self.print_count for item in self.items)

    @property
    def wasted_slots(self) -> int:
        return 9 - self.used_slots


@dataclass
class PackResult:
    """Result of the packing algorithm."""
    pages: list[Page] = field(default_factory=list)

    @property
    def total_sheets(self) -> int:
        """Total printed sheets = sum of (1 page * print_count)."""
        return sum(p.print_count for p in self.pages)

    @property
    def num_pdfs(self) -> int:
        return len(self.pages)

    @property
    def wasted_slots(self) -> int:
        return sum(p.wasted_slots for p in self.pages)

    def summary(self) -> str:
        lines = [f"{self.num_pdfs} PDF(s), {self.total_sheets} sheet(s) printed, {self.wasted_slots} wasted slot(s)"]
        for i, page in enumerate(self.pages, 1):
            items_str = ", ".join(it.name for it in page.items)
            lines.append(f"  p{i}x{page.print_count}.pdf: {items_str} ({page.used_slots}/9 slots)")
        return "\n".join(lines)
```

**Step 4: Run test to verify pass**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/test_models.py -v`
Expected: 3 passed

**Step 5: Commit**

```bash
cd ~/Documents/Projects/sandbox
git add card-print/
git commit -m "feat: add data models (Item, Page, PackResult)"
```

---

### Task 3: Implement CSV and image parser

**Objective:** Parse CSV file (with "count" header) and discover matching images in the input folder.

**Files:**
- Modify: `sandbox/card-print/card_print/parser.py`
- Create: `sandbox/card-print/tests/test_parser.py`
- Create: `sandbox/card-print/fixtures/test.csv`
- Create: `sandbox/card-print/fixtures/images/img1.png` through `img6.png` (1×1 transparent PNGs)

**Step 1: Create test fixtures**

Create `fixtures/test.csv`:
```csv
name,count,notes
img1,3,first
img2,0,skip this
img3,1,normal
img4,,default to 1
img5,2,double
img6,6,many
```

Create 1×1 transparent PNGs in `fixtures/images/` using Python:
```python
# Run this once to generate fixtures
from PIL import Image
import os
os.makedirs("fixtures/images", exist_ok=True)
for i in range(1, 7):
    img = Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    img.save(f"fixtures/images/img{i}.png")
```

If PIL isn't available, use this pure-Python approach to create minimal PNGs:
```python
import zlib, struct, os
os.makedirs("fixtures/images", exist_ok=True)
# Minimal 1x1 transparent PNG bytes
def minimal_png():
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b'\x00\x00\x00\x00\x00')) + chunk(b'IEND', b'')

for i in range(1, 7):
    with open(f"fixtures/images/img{i}.png", "wb") as f:
        f.write(minimal_png())
```

**Step 2: Write failing test**

```python
"""Tests for CSV and image parsing."""
from pathlib import Path
import pytest

FIXTURES = Path(__file__).parent.parent / "fixtures"

from card_print.parser import parse_input


def test_parse_csv_and_images():
    items = parse_input(
        csv_path=FIXTURES / "test.csv",
        image_dir=FIXTURES / "images",
    )
    names = [it.name for it in items]
    counts = [it.count for it in items]

    assert names == ["img1", "img2", "img3", "img4", "img5", "img6"]
    assert counts == [3, 0, 1, 1, 2, 6]  # empty defaults to 1
    assert all(isinstance(it.path, Path) for it in items)


def test_parse_skips_missing_images():
    """Items in CSV but without matching image files are skipped with a warning."""
    items = parse_input(
        csv_path=FIXTURES / "test.csv",
        image_dir=FIXTURES / "images",
    )
    # All 6 images exist, so all 6 items returned
    assert len(items) == 6


def test_parse_empty_count_defaults_to_one():
    items = parse_input(
        csv_path=FIXTURES / "test.csv",
        image_dir=FIXTURES / "images",
    )
    img4 = next(it for it in items if it.name == "img4")
    assert img4.count == 1


def test_parse_zero_count_kept():
    """Zero-count items are kept (packer decides to skip them)."""
    items = parse_input(
        csv_path=FIXTURES / "test.csv",
        image_dir=FIXTURES / "images",
    )
    img2 = next(it for it in items if it.name == "img2")
    assert img2.count == 0
```

**Step 3: Run test to verify failure**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/test_parser.py -v`
Expected: FAIL

**Step 4: Implement parser**

```python
"""CSV and image parsing."""
from __future__ import annotations
import csv
import sys
from pathlib import Path

from .models import Item


SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}


def parse_input(csv_path: Path, image_dir: Path) -> list[Item]:
    """Parse CSV and discover matching images.

    CSV format:
    - First row is headers; must include a "count" column
    - Each subsequent row corresponds to an image file
    - The row's first column (or a "name" column if present) gives the image filename
    - Empty count defaults to 1; "0" means skip
    - Rows without a matching image file are skipped with a warning
    """
    if not csv_path.is_file():
        print(f"Error: CSV file not found: {csv_path}", file=sys.stderr)
        sys.exit(1)
    if not image_dir.is_dir():
        print(f"Error: Image directory not found: {image_dir}", file=sys.stderr)
        sys.exit(1)

    # Discover available images
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

        # Determine which column holds the image name
        name_col = "name" if "name" in reader.fieldnames else reader.fieldnames[0]

        for idx, row in enumerate(reader):
            name = row[name_col].strip()
            if not name:
                continue

            # Parse count: empty -> 1, non-numeric -> warning + skip
            count_str = row["count"].strip() if row["count"] else ""
            if count_str == "":
                count = 1
            else:
                try:
                    count = int(count_str)
                except ValueError:
                    print(f"Warning: non-integer count '{count_str}' for row {idx + 1}, skipping", file=sys.stderr)
                    continue

            # Strip extension if present for matching
            stem = Path(name).stem.lower()
            if stem not in available:
                # Try with the original name as filename
                if name.lower() not in {f.name.lower() for f in image_dir.iterdir()}:
                    print(f"Warning: no image found for '{name}', skipping", file=sys.stderr)
                    continue

            img_path = available.get(stem) or max(
                (f for f in image_dir.iterdir() if f.name.lower() == name.lower()),
                default=None,
            )
            if img_path is None:
                continue

            items.append(Item(
                index=idx,
                name=Path(name).stem,
                path=img_path.resolve(),
                count=max(0, count),  # clamp negative to 0
            ))

    return items
```

**Step 5: Run test to verify pass**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/test_parser.py -v`
Expected: 4 passed

**Step 6: Commit**

```bash
cd ~/Documents/Projects/sandbox
git add card-print/
git commit -m "feat: implement CSV and image parser"
```

---

### Task 4: Implement the packing algorithm

**Objective:** Given items with counts, group them into pages minimizing total printed sheets.

**Files:**
- Modify: `sandbox/card-print/card_print/packer.py`
- Create: `sandbox/card-print/tests/test_packer.py`

**Step 1: Write failing tests**

```python
"""Tests for the bin-packing algorithm."""
from card_print.models import Item, Page
from card_print.packer import pack_items, _divisors


def test_divisors():
    assert sorted(_divisors(1)) == [1]
    assert sorted(_divisors(6)) == [1, 2, 3, 6]
    assert sorted(_divisors(12)) == [1, 2, 3, 4, 6, 12]


def test_pack_zero_count_items_skipped():
    items = [Item(0, "img1", "/img1.png", 0)]
    result = pack_items(items)
    assert result.num_pdfs == 0
    assert result.total_sheets == 0


def test_pack_single_item():
    items = [Item(0, "img1", "/img1.png", 1)]
    result = pack_items(items)
    assert result.num_pdfs == 1
    assert result.total_sheets == 1
    assert result.pages[0].print_count == 1


def test_pack_example_from_spec():
    """The example from the spec: counts 3,3,3,6,6,6,1,1,1,1,1,1,0,1,1
    Optimal: p1x3 (9 slots) + p2x1 (7 slots) = 4 sheets, 2 wasted."""
    counts = [3, 3, 3, 6, 6, 6, 1, 1, 1, 1, 1, 1, 0, 1, 1]
    items = [Item(i, f"img{i+1}", f"/img{i+1}.png", c) for i, c in enumerate(counts)]
    result = pack_items(items)
    assert result.total_sheets == 4
    assert result.num_pdfs == 2
    assert result.wasted_slots == 2


def test_pack_fills_pages_efficiently():
    """9 items with count 1 should fit on exactly 1 page."""
    items = [Item(i, f"img{i+1}", f"/img{i+1}.png", 1) for i in range(9)]
    result = pack_items(items)
    assert result.num_pdfs == 1
    assert result.total_sheets == 1
    assert result.wasted_slots == 0


def test_pack_10_items_needs_two_pages():
    """10 items with count 1 need 2 pages."""
    items = [Item(i, f"img{i+1}", f"/img{i+1}.png", 1) for i in range(10)]
    result = pack_items(items)
    assert result.num_pdfs == 2
    assert result.total_sheets == 2
    assert result.wasted_slots == 8  # 1 slot used on second page


def test_pack_high_count_single_item():
    """Single item with count 9 needs 1 page printed 1x (takes all 9 slots)."""
    items = [Item(0, "img1", "/img1.png", 9)]
    result = pack_items(items)
    assert result.num_pdfs == 1
    assert result.total_sheets == 1
    assert result.pages[0].used_slots == 9
```

**Step 2: Run test to verify failure**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/test_packer.py -v`
Expected: FAIL

**Step 3: Implement packer**

```python
"""Bin-packing algorithm for card print sheets.

Groups items into pages (3x3 grids) minimizing total printed sheets.
Items on the same page share a print count C where every item's count
is divisible by C. An item with count N takes N//C slots.
"""
from __future__ import annotations
from functools import lru_cache

from .models import Item, Page, PackResult


SLOTS_PER_PAGE = 9


def _divisors(n: int) -> list[int]:
    """Return all positive divisors of n in descending order."""
    if n <= 0:
        return []
    divs = set()
    i = 1
    while i * i <= n:
        if n % i == 0:
            divs.add(i)
            divs.add(n // i)
        i += 1
    return sorted(divs, reverse=True)


def _pack_group(items: list[Item], print_count: int) -> list[Page]:
    """Pack items into pages with the given print count using first-fit decreasing.

    Items are sorted by slot cost (descending) for better packing.
    Returns list of pages, each with up to SLOTS_PER_PAGE slots filled.
    """
    # Calculate slot cost for each item
    item_slots = [
        (item, item.count // print_count)
        for item in items
        if item.count > 0 and item.count % print_count == 0
    ]

    # Sort by slot cost descending (first-fit decreasing heuristic)
    item_slots.sort(key=lambda x: x[1], reverse=True)

    pages: list[Page] = []
    remaining_capacity: list[int] = []  # slots remaining per page

    for item, slots_needed in item_slots:
        placed = False
        for i, capacity in enumerate(remaining_capacity):
            if capacity >= slots_needed:
                pages[i].items.append(item)
                remaining_capacity[i] -= slots_needed
                placed = True
                break
        if not placed:
            pages.append(Page(items=[item], print_count=print_count))
            remaining_capacity.append(SLOTS_PER_PAGE - slots_needed)

    return pages


def _solve(
    remaining: tuple[Item, ...],
    memo: dict[tuple[Item, ...], PackResult],
    depth: int = 0,
) -> PackResult:
    """Recursive solver with memoization.

    Picks the item with the highest count, tries each divisor as print count,
    packs compatible items into pages, then recurses on the remainder.
    """
    if not remaining:
        return PackResult(pages=[])

    if remaining in memo:
        return memo[remaining]

    # Filter out zero-count items
    active = tuple(it for it in remaining if it.count > 0)
    if not active:
        return PackResult(pages=[])

    # Pick the item with the highest count (most constrained first)
    pivot = max(active, key=lambda it: it.count)

    best = None

    # Try each divisor of the pivot's count as the print count
    for pc in _divisors(pivot.count):
        # Find compatible items (count divisible by pc)
        compatible = [it for it in active if it.count % pc == 0]

        # Pack compatible items into pages with this print count
        pages = _pack_group(compatible, pc)

        # Remaining items not packed
        packed_names = {it.name for p in pages for it in p.items}
        leftover = tuple(it for it in active if it.name not in packed_names)

        # Recurse on leftover
        sub_result = _solve(leftover, memo, depth + 1)

        # Combine results
        combined = PackResult(pages=pages + sub_result.pages)

        # Keep the best (minimize total sheets, then num PDFs, then wasted slots)
        if best is None or _score(combined) < _score(best):
            best = combined

        # Early exit: if we've used only 1 page for everything, can't do better
        if best.total_sheets == 1 and best.num_pdfs == 1:
            break

    memo[remaining] = best
    return best


def _score(result: PackResult) -> tuple[int, ...]:
    """Score for comparison: lower is better.
    Primary: total sheets, Secondary: number of PDFs, Tertiary: wasted slots."""
    return (result.total_sheets, result.num_pdfs, result.wasted_slots)


def pack_items(items: list[Item]) -> PackResult:
    """Pack items into optimal print sheets.

    Returns a PackResult with pages grouped by print count,
    minimizing total printed sheets.
    """
    # Filter zero-count items
    active = [it for it in items if it.count > 0]
    if not active:
        return PackResult(pages=[])

    # Sort by count descending for consistent ordering
    active.sort(key=lambda it: (-it.count, it.index))

    memo: dict[tuple[Item, ...], PackResult] = {}
    return _solve(tuple(active), memo)
```

**Step 4: Run test to verify pass**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/test_packer.py -v`
Expected: 7 passed

**Step 5: Commit**

```bash
cd ~/Documents/Projects/sandbox
git add card-print/
git commit -m "feat: implement bin-packing algorithm with recursive solver"
```

---

### Task 5: Implement PDF generation

**Objective:** Generate a single-page PDF with a 3×3 grid of images.

**Files:**
- Modify: `sandbox/card-print/card_print/pdf.py`
- Create: `sandbox/card-print/tests/test_pdf.py`

**Step 1: Install reportlab**

Run: `pip install reportlab`

**Step 2: Write failing test**

```python
"""Tests for PDF generation."""
import os
import tempfile
from pathlib import Path

from card_print.models import Item, Page
from card_print.pdf import render_page


def test_render_page_creates_pdf():
    """Render a page with test images produces a valid PDF file."""
    # Create temp images
    with tempfile.TemporaryDirectory() as tmpdir:
        img_paths = []
        for i in range(3):
            img_path = Path(tmpdir) / f"img{i+1}.png"
            # Create minimal PNG
            import zlib, struct
            def minimal_png():
                def chunk(ctype, data):
                    c = ctype + data
                    return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
                return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack(">IIBBBBB", 100, 100, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b'\x00' * 400)) + chunk(b'IEND', b'')
            img_path.write_bytes(minimal_png())
            img_paths.append(img_path)

        items = [Item(i, f"img{i+1}", img_paths[i], 1) for i in range(3)]
        page = Page(items=items, print_count=1)

        output = Path(tmpdir) / "test.pdf"
        render_page(page, output)

        assert output.exists()
        assert output.stat().st_size > 0
        # Verify it's a valid PDF
        assert output.read_bytes()[:4] == b"%PDF"
```

**Step 3: Run test to verify failure**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/test_pdf.py -v`
Expected: FAIL

**Step 4: Implement PDF generation**

```python
"""PDF generation for card print sheets."""
from __future__ import annotations
from pathlib import Path

from reportlab.lib.pagesizes import letter  # 8.5 x 11 inches
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

from .models import Page


# Page layout constants
MARGIN = 0.5 * inch          # 0.5 inch margin on all sides
GRID_COLS = 3
GRID_ROWS = 3


def _compute_cell_size() -> tuple[float, float]:
    """Compute cell width and height for a 3x3 grid on letter paper with margins."""
    page_w, page_h = letter  # 612 x 792 points (8.5 x 11 inches)
    usable_w = page_w - 2 * MARGIN
    usable_h = page_h - 2 * MARGIN
    cell_w = usable_w / GRID_COLS
    cell_h = usable_h / GRID_ROWS
    return cell_w, cell_h


def _cell_origin(col: int, row: int, cell_w: float, cell_h: float) -> tuple[float, float]:
    """Return bottom-left corner of a cell in PDF coordinates (origin at bottom-left)."""
    page_w, page_h = letter
    x = MARGIN + col * cell_w
    # row 0 is the top row, but PDF y goes bottom-up
    y = page_h - MARGIN - (row + 1) * cell_h
    return x, y


def render_page(page: Page, output_path: Path) -> None:
    """Render a single page of cards to a PDF file.

    Layout: 3x3 grid on 8.5x11 inch paper with 0.5 inch margins.
    Images are scaled to fit within their cell, maintaining aspect ratio.
    """
    cell_w, cell_h = _compute_cell_size()
    c = canvas.Canvas(str(output_path), pagesize=letter)

    # Add print count annotation in the footer
    if page.print_count > 1:
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(letter[0] / 2, 0.3 * inch,
                           f"Print {page.print_count}x  |  {page.used_slots}/9 slots")

    for idx, item in enumerate(page.items):
        col = idx % GRID_COLS
        row = idx // GRID_COLS  # top-to-bottom row index
        x, y = _cell_origin(col, row, cell_w, cell_h)

        # Draw cell border (thin gray line)
        c.setStrokeColorRGB(0.85, 0.85, 0.85)
        c.setLineWidth(0.5)
        c.rect(x, y, cell_w, cell_h, fill=0)

        # Draw image centered in cell, fitted to cell size
        try:
            # Get image dimensions to maintain aspect ratio
            from PIL import Image as PILImage
            with PILImage.open(str(item.path)) as img:
                img_w, img_h = img.size
                img_ratio = img_w / img_h
                cell_ratio = cell_w / cell_h

                if img_ratio > cell_ratio:
                    # Image is wider than cell - constrain by width
                    draw_w = cell_w * 0.95  # 5% padding
                    draw_h = draw_w / img_ratio
                else:
                    # Image is taller than cell - constrain by height
                    draw_h = cell_h * 0.95
                    draw_w = draw_h * img_ratio

                draw_x = x + (cell_w - draw_w) / 2
                draw_y = y + (cell_h - draw_h) / 2

                c.drawImage(str(item.path), draw_x, draw_y,
                           width=draw_w, height=draw_h,
                           preserveAspectRatio=True,
                           anchor='c')
        except Exception:
            # Fallback: just draw the item name if image can't be loaded
            c.setFont("Helvetica", 8)
            c.drawCentredString(x + cell_w / 2, y + cell_h / 2, item.name)

    c.save()
```

**Note on PIL dependency:** The PDF renderer uses PIL/Pillow for image dimension detection. Add `Pillow>=10.0` to `pyproject.toml` dependencies.

Update `pyproject.toml` dependencies:
```toml
dependencies = [
    "click>=8.0",
    "reportlab>=4.0",
    "Pillow>=10.0",
]
```

**Step 5: Run test to verify pass**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/test_pdf.py -v`
Expected: 1 passed

**Step 6: Commit**

```bash
cd ~/Documents/Projects/sandbox
git add card-print/
git commit -m "feat: implement PDF generation with 3x3 grid layout"
```

---

### Task 6: Wire up CLI entry point

**Objective:** Connect CLI arguments to parser → packer → PDF generator pipeline.

**Files:**
- Modify: `sandbox/card-print/card_print/__main__.py`

**Step 1: Write CLI**

```python
"""CLI entry point for card-print."""
from __future__ import annotations
import sys
from pathlib import Path

import click

from .parser import parse_input
from .packer import pack_items
from .pdf import render_page


@click.command()
@click.option("--images", "-i", required=True, type=click.Path(exists=True, file_okay=False, dir_okay=True),
              help="Directory containing card images (img1.png, img2.png, ...)")
@click.option("--csv", "-c", required=True, type=click.Path(exists=True, file_okay=True, dir_okay=False),
              help="CSV file with headers including 'count' column")
@click.option("--output", "-o", default=".", type=click.Path(file_okay=False, dir_okay=True),
              help="Output directory for PDFs (default: current directory)")
@click.option("--dry-run", is_flag=True, default=False,
              help="Show packing plan without generating PDFs")
def cli(images: str, csv: str, output: str, dry_run: bool) -> None:
    """Pack card images into optimal print sheets.

    Reads images from a directory and a CSV file specifying print counts,
    then generates PDF files with 3x3 grids optimized to minimize
    total printed sheets.
    """
    image_dir = Path(images).resolve()
    csv_path = Path(csv).resolve()
    output_dir = Path(output).resolve()

    # Parse input
    click.echo(f"Reading images from: {image_dir}")
    click.echo(f"Reading CSV from: {csv_path}")
    items = parse_input(csv_path, image_dir)

    if not items:
        click.echo("Error: no valid items found", err=True)
        sys.exit(1)

    active = [it for it in items if it.count > 0]
    skipped = [it for it in items if it.count == 0]
    click.echo(f"Found {len(active)} item(s) to print{f', {len(skipped)} skipped (count=0)' if skipped else ''}")

    # Pack items
    result = pack_items(items)

    if not result.pages:
        click.echo("No pages to generate (all counts are 0)")
        return

    # Show summary
    click.echo(f"\n{result.summary()}")

    if dry_run:
        click.echo("\n(Dry run — no PDFs generated)")
        return

    # Generate PDFs
    output_dir.mkdir(parents=True, exist_ok=True)

    for i, page in enumerate(result.pages, 1):
        filename = f"p{i}x{page.print_count}.pdf"
        output_path = output_dir / filename
        render_page(page, output_path)
        click.echo(f"  Written: {output_path} ({len(page.items)} cards, {page.used_slots}/9 slots)")

    click.echo(f"\nDone! {result.num_pdfs} PDF(s) in {output_dir}")
    if result.total_sheets > result.num_pdfs:
        click.echo(f"Total print jobs: {result.total_sheets} sheet(s)")


if __name__ == "__main__":
    cli()
```

**Step 2: Test the CLI manually**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m card_print --images fixtures/images --csv fixtures/test.csv --dry-run`

Expected output similar to:
```
Reading images from: /.../fixtures/images
Reading CSV from: /.../fixtures/test.csv
Found 5 item(s) to print, 1 skipped (count=0)

2 PDF(s), 3 sheet(s) printed, X wasted slot(s)
  p1x3.pdf: img1, img6 (3/9 slots)
  p2x1.pdf: img3, img4, img5 (3/9 slots)

(Dry run — no PDFs generated)
```

**Step 3: Test actual PDF generation**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m card_print --images fixtures/images --csv fixtures/test.csv --output /tmp/card-print-test`

Expected: PDF files created in `/tmp/card-print-test/`

**Step 4: Commit**

```bash
cd ~/Documents/Projects/sandbox
git add card-print/
git commit -m "feat: wire up CLI entry point with full pipeline"
```

---

### Task 7: Add README and finalize

**Objective:** Document usage, add edge case tests, and polish.

**Files:**
- Modify: `sandbox/card-print/README.md`
- Create: `sandbox/card-print/tests/test_integration.py`

**Step 1: Write integration test**

```python
"""Integration test: full pipeline from CSV to PDF."""
import tempfile
from pathlib import Path

import zlib, struct


def _create_png(path: Path) -> None:
    """Create a minimal 100x100 transparent PNG."""
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    path.write_bytes(
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack(">IIBBBBB", 100, 100, 8, 6, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(b'\x00' * 400))
        + chunk(b'IEND', b'')
    )


def test_full_pipeline():
    """End-to-end: parse CSV, pack items, generate PDFs."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create test images
        img_dir = tmp / "images"
        img_dir.mkdir()
        for i in range(1, 16):
            _create_png(img_dir / f"img{i}.png")

        # Create test CSV matching the spec example
        csv_path = tmp / "test.csv"
        csv_path.write_text(
            "name,count\n"
            "img1,3\nimg2,3\nimg3,3\nimg4,6\nimg5,6\nimg6,6\n"
            "img7,1\nimg8,1\nimg9,1\nimg10,\nimg11,1\nimg12,1\n"
            "img13,0\nimg14,1\nimg15,1\n"
        )

        # Run pipeline
        from card_print.parser import parse_input
        from card_print.packer import pack_items
        from card_print.pdf import render_page

        items = parse_input(csv_path, img_dir)
        result = pack_items(items)

        # Verify optimal packing
        assert result.total_sheets == 4, f"Expected 4 sheets, got {result.total_sheets}"
        assert result.num_pdfs == 2, f"Expected 2 PDFs, got {result.num_pdfs}"
        assert result.wasted_slots == 2, f"Expected 2 wasted, got {result.wasted_slots}"

        # Generate PDFs
        out_dir = tmp / "output"
        out_dir.mkdir()
        for i, page in enumerate(result.pages, 1):
            pdf_path = out_dir / f"p{i}x{page.print_count}.pdf"
            render_page(page, pdf_path)
            assert pdf_path.exists()
            assert pdf_path.read_bytes()[:4] == b"%PDF"
```

**Step 2: Run integration test**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/test_integration.py -v`
Expected: 1 passed

**Step 3: Write README**

```markdown
# card-print

CLI tool for packing card images into optimal print sheets.

## Install

```bash
cd card-print
pip install -e .
```

## Usage

```bash
card-print --images ./cards --csv ./counts.csv --output ./pdfs
```

### Options

| Flag | Required | Description |
|------|----------|-------------|
| `--images`, `-i` | yes | Directory with card images |
| `--csv`, `-c` | yes | CSV file with `count` column |
| `--output`, `-o` | no | Output directory (default: `.`) |
| `--dry-run` | no | Show plan without generating PDFs |

### CSV Format

First row must be headers including `count`. Each subsequent row maps to an image:

```csv
name,count,notes
img1,3,print 3 copies
img2,0,skip
img3,,defaults to 1
```

- Empty count → defaults to 1
- `0` → item is skipped
- Image names must match files in the images directory (extension optional)

### Output

PDFs are named `p{N}x{C}.pdf` where N is the page number and C is the print count.

Example: `p1x3.pdf` means "print this PDF 3 times".

Each PDF contains a 3×3 grid of card images on standard letter paper (8.5 × 11").

## Algorithm

Items are grouped into pages where all items share a common print count (GCD-based).
An item with count N on a page with print count C occupies N÷C slots.
The solver minimizes total printed sheets using recursive backtracking with memoization.

## Future

- Configurable paper size (A4, legal, custom)
- Configurable grid (2×2, 4×3, etc.)
- Adjustable margins
- Image borders and labels
```

**Step 4: Run full test suite**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/ -v`
Expected: all tests pass

**Step 5: Final commit**

```bash
cd ~/Documents/Projects/sandbox
git add card-print/
git commit -m "feat: add README, integration test, finalize card-print"
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Project skeleton | import check |
| 2 | Data models (Item, Page, PackResult) | 3 tests |
| 3 | CSV + image parser | 4 tests |
| 4 | Bin-packing algorithm | 7 tests |
| 5 | PDF generation (reportlab) | 1 test |
| 6 | CLI entry point (Click) | manual test |
| 7 | README + integration test | 1 test |

**Total:** ~20 tests, 7 tasks, ~30 minutes of implementation.

**Key design decisions:**
- GCD-based grouping allows items with different counts (3 and 6) to share pages
- Recursive solver tries all divisor combinations for optimal packing
- First-fit decreasing heuristic within each group for efficient slot filling
- reportlab + Pillow for PDF generation with aspect-ratio-preserving image placement
- Letter paper (8.5×11"), 3×3 grid, 0.5" margins as defaults (configurable in future)
