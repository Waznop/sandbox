# Card Print Tool Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** CLI tool that reads images + CSV with count column, packs items into optimal 3×3 print sheets, and outputs PDFs named with their print counts.

**Architecture:** Pure Python CLI (no server). Parses CSV to extract items with counts, runs a bounded knapsack solver that allows multiple copies per item per page and item demand split across pages, then generates PDFs with reportlab.

**Tech Stack:** Python 3.10+, Click (CLI), reportlab (PDF), Pillow (image dims), csv/stdlib (parsing)

**Location:** `~/Documents/Projects/sandbox/card-print/`

---

## Algorithm Overview

Each PDF page holds 9 slots (3×3 grid). A page has a `print_count` C. An item can appear multiple times on the same page (e.g., 4 copies of img1 = 4 slots). Items can span pages — img2's demand of 10 can be split as 2 copies on `p1x3` + 4 copies on `p2x1` = 2×3 + 4×1 = 10.

**Key properties:**
- An item can occupy 0–9 slots on any single page
- An item's total printed copies = `sum(slots_on_page_i × print_count_i)` across all pages
- This must be ≥ the item's demand (extras = over-printed copies)
- Items can appear on multiple pages with different print counts

**Optimization priorities (in order):**
1. Minimize total sheets = `sum(print_count per page)`
2. Minimize extras (over-printed copies)
3. Minimize empty slots (unfilled capacity)
4. Minimize number of PDF files

**Lower bound:** `ceil(total_demand / 9)` sheets. Start here and try to construct a valid solution; if impossible, increment.

**Solver approach — iterative deepening + backtracking:**
1. Compute `min_sheets = ceil(sum(demands) / 9)`
2. For `target_sheets` from `min_sheets` upward:
   a. Enumerate partitions of `target_sheets` into page print counts (e.g., 4 sheets → {4}, {3,1}, {2,2}, {2,1,1}, {1,1,1,1})
   b. For each partition, greedily fill pages: for each page, pick items with highest remaining demand, fill up to 9 slots
   c. Check if all demands are met (≥ demand), compute extras/empty
   d. Keep best by scoring tuple `(sheets, extras, empty, num_pdfs)`
3. Return first valid solution found (since we iterate sheets upward, first valid is optimal)

**Greedy fill per page (print_count C):**
- Sort remaining items by remaining demand descending
- For each item, compute max copies that fit: `min(remaining_demand, remaining_slots)`
- Place copies, update remaining demand and slots
- If demand not fully met, item carries over to next page

**Partition generation:** Integer partitions of `target_sheets` into parts ≤ 9 (since print_count can't exceed 9 meaningful slots). Try larger print counts first (fewer PDFs).

---

## Test Cases

14 test cases covering edge cases, optimal packing, and scoring priorities.

| # | Counts (non-zero) | Demand | Sheets | Extras | Empty | PDFs | Solution |
|---|---|---|---|---|---|---|---|
| **1** | `3,3,3,6,6,6,1,1,1,1,1,1,1,1` | 36 | 4 | 0 | 1 | 2 | `p1x3`: img1-3×1, img4-6×2 (9/9); `p2x1`: img7-14×1 (8/9) |
| **2** | `1×9` | 9 | 1 | 0 | 0 | 1 | `p1x1`: all ×1 (9/9) |
| **3** | `9` | 9 | 1 | 0 | 0 | 1 | `p1x1`: img1×9 (9/9) |
| **4** | `12,12,12` | 36 | 4 | 0 | 0 | 1 | `p1x4`: each ×3 (9/9) |
| **5** | `5,7` | 12 | 2 | 6 | 0 | 1 | `p1x1`: img1×4, img2×5 (9/9) → 4+5=9 filled, 3 extras each balanced |
| **6** | `(all zero)` | 0 | 0 | 0 | 0 | 0 | empty |
| **7** | `18,3,3,3` | 27 | 3 | 0 | 0 | 1 | `p1x3`: img1×6, img2-4×1 (9/9) |
| **8** | `6,10,15` | 31 | 4 | 0 | 5 | 2 | `p1x3`: img1×2, img2×2, img3×5 (9/9); `p2x1`: img2×4 (4/9) |
| **9** | `2×10` | 20 | 3 | 0 | 7 | 2 | `p1x1`: 9 items ×1 (9/9); `p2x1`: 1 item ×1 (1/9) |
| **10** | `4×10` | 40 | 5 | 0 | 5 | 2 | `p1x4`: 9 items ×1 (9/9); `p2x4`: 1 item ×1 (1/9) |
| **11** | `6,6,6,3,3,3,3,3,3,3` | 30 | 5 | 0 | 6 | 2 | `p1x2`: img1-3×3 (9/9); `p2x3`: img4-10×1 (7/9) |
| **12** | `9,9,9,9,9,3,3,3,3,3` | 60 | 7 | 0 | 3 | 3 | `p1x3`: img1-3×3 (9/9); `p2x1`: img4×9 (9/9); `p3x3`: img5×3, img6-10×1 (8/9) |
| **13** | `8×9` | 72 | 8 | 0 | 0 | 1 | `p1x8`: all 9 items ×1 (9/9) |
| **14** | `6×9, 5` | 59 | 7 | 0 | 4 | 2 | `p1x6`: img1-9×1 (9/9); `p2x1`: img10×5 (5/9) |

---

## Project Structure

```
sandbox/card-print/
├── pyproject.toml
├── README.md
├── card_print/
│   ├── __init__.py
│   ├── __main__.py      # CLI entry point (Click)
│   ├── models.py         # Data classes: Item, SlotEntry, Page, PackResult
│   ├── parser.py         # CSV + image discovery
│   ├── packer.py         # Bounded knapsack packing algorithm
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
    "Pillow>=10.0",
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

**Objective:** Create dataclasses for Item, SlotEntry, Page, and PackResult with extras/empty tracking.

**Files:**
- Modify: `sandbox/card-print/card_print/models.py`
- Create: `sandbox/card-print/tests/test_models.py`

**Step 1: Write failing test**

```python
"""Tests for data models."""
from pathlib import Path
from card_print.models import Item, SlotEntry, Page, PackResult


def test_item_creation():
    item = Item(index=0, name="img1", path=Path("/fake/img1.png"), demand=3)
    assert item.index == 0
    assert item.demand == 3


def test_slot_entry():
    entry = SlotEntry(item=Item(0, "img1", Path("/a.png"), 3), copies=2)
    assert entry.copies == 2


def test_page_calculations():
    item = Item(0, "img1", Path("/a.png"), 6)
    entry = SlotEntry(item=item, copies=3)
    page = Page(entries=[entry], print_count=2)
    assert page.used_slots == 3
    assert page.empty_slots == 6
    assert page.printed_copies == {item.name: 6}  # 3 copies * print_count 2


def test_page_with_extras():
    """When printed copies exceed demand, that's extras."""
    item = Item(0, "img1", Path("/a.png"), 4)
    entry = SlotEntry(item=item, copies=3)
    page = Page(entries=[entry], print_count=2)
    assert page.printed_copies == {item.name: 6}
    assert page.extras == {item.name: 2}  # 6 printed - 4 demanded = 2 extras


def test_pack_result_sheets():
    result = PackResult(pages=[
        Page(entries=[], print_count=3),
        Page(entries=[], print_count=1),
    ])
    assert result.total_sheets == 4
    assert result.num_pdfs == 2


def test_pack_result_summary():
    item = Item(0, "img1", Path("/a.png"), 3)
    page = Page(entries=[SlotEntry(item=item, copies=1)], print_count=3)
    result = PackResult(pages=[page])
    summary = result.summary()
    assert "1 PDF" in summary
    assert "3 sheet" in summary
```

**Step 2: Run test to verify failure**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/test_models.py -v`
Expected: FAIL — classes not defined

**Step 3: Write models**

```python
"""Data models for card printing."""
from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Item:
    """A single card image with its print demand."""
    index: int          # 0-based index
    name: str           # e.g. "img1"
    path: Path          # absolute path to the image file
    demand: int         # how many copies needed (0 = skip)


@dataclass
class SlotEntry:
    """One item appearing on a page, with a copy count for that page."""
    item: Item
    copies: int         # how many copies of this item on this page (1-9)


@dataclass
class Page:
    """One 3x3 page in a PDF. Has a print count C.

    Each SlotEntry specifies how many copies of an item appear on this page.
    When printed C times, the item gets copies*C total printed copies.
    An item can appear on multiple pages; totals are summed.
    """
    entries: list[SlotEntry] = field(default_factory=list)
    print_count: int = 1

    @property
    def used_slots(self) -> int:
        """Number of slots occupied on this page."""
        return sum(e.copies for e in self.entries)

    @property
    def empty_slots(self) -> int:
        """Unfilled slots on this page."""
        return 9 - self.used_slots

    @property
    def printed_copies(self) -> dict[str, int]:
        """Total printed copies per item name on this page."""
        return {e.item.name: e.copies * self.print_count for e in self.entries}

    @property
    def extras(self, demands: dict[str, int] | None = None) -> dict[str, int]:
        """Over-printed copies per item (only if demands provided)."""
        if demands is None:
            return {}
        result = {}
        for name, printed in self.printed_copies.items():
            over = printed - demands.get(name, 0)
            if over > 0:
                result[name] = over
        return result


@dataclass
class PackResult:
    """Result of the packing algorithm.

    Scoring priorities (lower is better):
    1. total_sheets
    2. total_extras (over-printed copies)
    3. total_empty (unfilled slots across pages)
    4. num_pdfs
    """
    pages: list[Page] = field(default_factory=list)
    demands: dict[str, int] = field(default_factory=dict)

    @property
    def total_sheets(self) -> int:
        return sum(p.print_count for p in self.pages)

    @property
    def num_pdfs(self) -> int:
        return len(self.pages)

    @property
    def total_printed(self) -> dict[str, int]:
        """Total printed copies per item across all pages."""
        totals: dict[str, int] = {}
        for page in self.pages:
            for name, copies in page.printed_copies.items():
                totals[name] = totals.get(name, 0) + copies
        return totals

    @property
    def total_extras(self) -> int:
        """Total over-printed copies across all items."""
        printed = self.total_printed
        return sum(
            max(0, printed.get(name, 0) - demand)
            for name, demand in self.demands.items()
        )

    @property
    def total_empty(self) -> int:
        """Total unfilled slots across all pages."""
        return sum(p.empty_slots for p in self.pages)

    @property
    def score(self) -> tuple[int, ...]:
        """Comparison tuple: (sheets, extras, empty, num_pdfs)."""
        return (self.total_sheets, self.total_extras, self.total_empty, self.num_pdfs)

    def is_valid(self) -> bool:
        """Check if all demands are met."""
        printed = self.total_printed
        return all(
            printed.get(name, 0) >= demand
            for name, demand in self.demands.items()
        )

    def summary(self) -> str:
        lines = [
            f"{self.num_pdfs} PDF(s), {self.total_sheets} sheet(s) printed, "
            f"{self.total_extras} extra(s), {self.total_empty} empty slot(s)"
        ]
        for i, page in enumerate(self.pages, 1):
            entries_str = ", ".join(
                f"{e.item.name}x{e.copies}" for e in page.entries
            )
            lines.append(
                f"  p{i}x{page.print_count}.pdf: {entries_str} "
                f"({page.used_slots}/9 slots)"
            )
        return "\n".join(lines)
```

**Step 4: Run test to verify pass**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/test_models.py -v`
Expected: 6 passed

**Step 5: Commit**

```bash
cd ~/Documents/Projects/sandbox
git add card-print/
git commit -m "feat: add data models with extras/empty tracking"
```

---

### Task 3: Implement CSV and image parser

**Objective:** Parse CSV file (with "count" header) and discover matching images.

**Files:**
- Modify: `sandbox/card-print/card_print/parser.py`
- Create: `sandbox/card-print/tests/test_parser.py`
- Create: `sandbox/card-print/fixtures/test.csv`
- Create: `sandbox/card-print/fixtures/images/` with test PNGs

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

Create 1×1 transparent PNGs in `fixtures/images/`:
```python
import zlib, struct, os
os.makedirs("fixtures/images", exist_ok=True)
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
from card_print.parser import parse_input

FIXTURES = Path(__file__).parent.parent / "fixtures"


def test_parse_csv_and_images():
    items = parse_input(FIXTURES / "test.csv", FIXTURES / "images")
    names = [it.name for it in items]
    demands = [it.demand for it in items]
    assert names == ["img1", "img2", "img3", "img4", "img5", "img6"]
    assert demands == [3, 0, 1, 1, 2, 6]
    assert all(isinstance(it.path, Path) for it in items)


def test_parse_empty_count_defaults_to_one():
    items = parse_input(FIXTURES / "test.csv", FIXTURES / "images")
    img4 = next(it for it in items if it.name == "img4")
    assert img4.demand == 1


def test_parse_zero_count_kept():
    items = parse_input(FIXTURES / "test.csv", FIXTURES / "images")
    img2 = next(it for it in items if it.name == "img2")
    assert img2.demand == 0
```

**Step 3: Implement parser**

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

    - First row must have a "count" column
    - First column (or "name" column) gives image filename
    - Empty count → 1, "0" → skip, negative → clamped to 0
    - Missing images → warning + skip
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
```

**Step 4: Run test to verify pass**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/test_parser.py -v`
Expected: 3 passed

**Step 5: Commit**

```bash
cd ~/Documents/Projects/sandbox
git add card-print/
git commit -m "feat: implement CSV and image parser"
```

---

### Task 4: Implement the packing algorithm

**Objective:** Bounded knapsack solver that packs items into pages, allowing multiple copies per item per page and demand split across pages.

**Files:**
- Modify: `sandbox/card-print/card_print/packer.py`
- Create: `sandbox/card-print/tests/test_packer.py`

**Step 1: Write failing tests (14 cases)**

```python
"""Tests for the packing algorithm — 14 cases."""
from card_print.models import Item
from card_print.packer import pack_items


def _items(counts: list[int]) -> list[Item]:
    return [Item(i, f"img{i+1}", f"/img{i+1}.png", c) for i, c in enumerate(counts)]


def test_tc1_spec_example():
    """counts 3,3,3,6,6,6,1,1,1,1,1,1,0,1,1 -> 4 sheets, 0 extras, 1 empty."""
    r = pack_items(_items([3,3,3,6,6,6,1,1,1,1,1,1,0,1,1]))
    assert r.total_sheets == 4
    assert r.total_extras == 0
    assert r.total_empty == 1
    assert r.num_pdfs == 2


def test_tc2_exact_fit():
    """9 items count 1 -> 1 sheet, 0 extras, 0 empty."""
    r = pack_items(_items([1]*9))
    assert r.total_sheets == 1
    assert r.total_extras == 0
    assert r.total_empty == 0


def test_tc3_single_fill():
    """Single item count 9 -> 1 sheet, 0 extras, 0 empty."""
    r = pack_items(_items([9]))
    assert r.total_sheets == 1
    assert r.total_extras == 0
    assert r.total_empty == 0


def test_tc4_divisible_group():
    """12,12,12 -> 4 sheets, 0 extras, 0 empty (p1x4: each x3)."""
    r = pack_items(_items([12,12,12]))
    assert r.total_sheets == 4
    assert r.total_extras == 0
    assert r.total_empty == 0


def test_tc5_coprime():
    """5,7 -> 2 sheets, 6 extras, 0 empty (img1x4, img2x5, both over by 3)."""
    r = pack_items(_items([5,7]))
    assert r.total_sheets == 2
    assert r.total_extras == 6
    assert r.total_empty == 0


def test_tc6_all_zero():
    """All zeros -> 0 sheets."""
    r = pack_items(_items([0,0,0]))
    assert r.total_sheets == 0
    assert r.num_pdfs == 0


def test_tc7_large_plus_small():
    """18,3,3,3 -> 3 sheets, 0 extras, 0 empty (p1x3: img1x6, rest x1)."""
    r = pack_items(_items([18,3,3,3]))
    assert r.total_sheets == 3
    assert r.total_extras == 0
    assert r.total_empty == 0


def test_tc8_split_demand():
    """6,10,15 -> 4 sheets, 0 extras, 5 empty."""
    r = pack_items(_items([6,10,15]))
    assert r.total_sheets == 4
    assert r.total_extras == 0
    assert r.total_empty == 5


def test_tc9_ten_items():
    """2x10 -> 3 sheets, 0 extras, 7 empty."""
    r = pack_items(_items([2]*10))
    assert r.total_sheets == 3
    assert r.total_extras == 0
    assert r.total_empty == 7


def test_tc10_ten_items_high_count():
    """4x10 -> 5 sheets, 0 extras, 5 empty."""
    r = pack_items(_items([4]*10))
    assert r.total_sheets == 5
    assert r.total_extras == 0
    assert r.total_empty == 5


def test_tc11_mixed_six_and_three():
    """6,6,6,3,3,3,3,3,3,3 -> 5 sheets, 0 extras, 6 empty."""
    r = pack_items(_items([6,6,6,3,3,3,3,3,3,3]))
    assert r.total_sheets == 5
    assert r.total_extras == 0
    assert r.total_empty == 6


def test_tc12_nine_and_threes():
    """9,9,9,9,9,3,3,3,3,3 -> 7 sheets, 0 extras, 3 empty."""
    r = pack_items(_items([9,9,9,9,9,3,3,3,3,3]))
    assert r.total_sheets == 7
    assert r.total_extras == 0
    assert r.total_empty == 3


def test_tc13_nine_eights():
    """8x9 -> 8 sheets, 0 extras, 0 empty (p1x8: all x1)."""
    r = pack_items(_items([8]*9))
    assert r.total_sheets == 8
    assert r.total_extras == 0
    assert r.total_empty == 0


def test_tc14_nine_sixes_plus_five():
    """6x9, 5 -> 7 sheets, 0 extras, 4 empty."""
    r = pack_items(_items([6]*9 + [5]))
    assert r.total_sheets == 7
    assert r.total_extras == 0
    assert r.total_empty == 4
```

**Step 2: Run test to verify failure**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/test_packer.py -v`
Expected: FAIL

**Step 3: Implement packer**

```python
"""Bounded knapsack packing algorithm for card print sheets.

Allows multiple copies per item per page. Items can span pages with
different print counts. Minimizes (sheets, extras, empty, num_pdfs).
"""
from __future__ import annotations
from itertools import combinations_with_replacement
from typing import NamedTuple

from .models import Item, SlotEntry, Page, PackResult


SLOTS_PER_PAGE = 9


def _partitions(n: int, max_part: int = 9) -> list[list[int]]:
    """Generate integer partitions of n into parts <= max_part, sorted
    by number of parts ascending (fewer PDFs preferred)."""
    if n == 0:
        return [[]]
    result = []
    for first in range(min(n, max_part), 0, -1):
        for rest in _partitions(n - first, first):
            result.append([first] + rest)
    return result


def _fill_page(
    print_count: int,
    remaining: dict[str, int],
    items_by_name: dict[str, Item],
) -> tuple[list[SlotEntry], dict[str, int]]:
    """Greedy fill a page with given print_count.

    Prioritize items with highest remaining demand.
    Returns (entries, updated remaining demands).
    """
    entries: list[SlotEntry] = []
    slots_left = SLOTS_PER_PAGE

    # Sort by remaining demand descending, then by index for stability
    sorted_items = sorted(
        remaining.items(),
        key=lambda kv: (-kv[1], items_by_name[kv[0]].index),
    )

    for name, demand_left in sorted_items:
        if slots_left <= 0 or demand_left <= 0:
            continue

        # Max copies we can place: limited by slots and by what's needed
        # We can over-print, so copies = min(slots_left, ceil(demand_left / print_count))
        # But for greedy, just fill slots with highest-demand items
        copies = min(slots_left, (demand_left + print_count - 1) // print_count)
        if copies <= 0:
            continue

        entries.append(SlotEntry(item=items_by_name[name], copies=copies))
        slots_left -= copies
        # Update remaining: printed = copies * print_count
        remaining[name] = max(0, demand_left - copies * print_count)

    return entries, remaining


def pack_items(items: list[Item]) -> PackResult:
    """Pack items into optimal print sheets.

    Strategy:
    1. Compute min_sheets = ceil(total_demand / 9)
    2. For target_sheets from min_sheets upward:
       a. Generate partitions of target_sheets into print counts
       b. For each partition, greedily fill pages
       c. Check validity, track best by (sheets, extras, empty, pdfs)
    3. Return best valid solution
    """
    active = [it for it in items if it.demand > 0]
    if not active:
        return PackResult(pages=[], demands={})

    demands = {it.name: it.demand for it in active}
    total_demand = sum(demands.values())
    min_sheets = (total_demand + SLOTS_PER_PAGE - 1) // SLOTS_PER_PAGE
    items_by_name = {it.name: it for it in active}

    best: PackResult | None = None

    for target_sheets in range(min_sheets, total_demand + 1):
        partitions = _partitions(target_sheets)

        for partition in partitions:
            # Try this partition: each element is a page's print_count
            remaining = dict(demands)  # copy
            pages: list[Page] = []

            for pc in partition:
                entries, remaining = _fill_page(pc, remaining, items_by_name)
                if entries:
                    pages.append(Page(entries=entries, print_count=pc))

            result = PackResult(pages=pages, demands=demands)

            if not result.is_valid():
                continue

            if best is None or result.score < best.score:
                best = result

        # If we found valid solutions at this sheet count, check if any
        # have 0 extras and 0 empty — can't do better on those dimensions
        if best and best.total_extras == 0 and best.total_empty == 0:
            break  # perfect packing, stop

        # If we've gone too far without finding anything, give up
        if target_sheets > min_sheets * 3:
            break

    return best if best else PackResult(pages=[], demands=demands)
```

**Step 4: Run test to verify pass**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/test_packer.py -v`
Expected: 14 passed

**Step 5: Commit**

```bash
cd ~/Documents/Projects/sandbox
git add card-print/
git commit -m "feat: implement bounded knapsack packing algorithm"
```

---

### Task 5: Implement PDF generation

**Objective:** Generate a single-page PDF with a 3×3 grid of images, handling multiple copies of the same item.

**Files:**
- Modify: `sandbox/card-print/card_print/pdf.py`
- Create: `sandbox/card-print/tests/test_pdf.py`

**Step 1: Write failing test**

```python
"""Tests for PDF generation."""
import tempfile
from pathlib import Path
import zlib, struct

from card_print.models import Item, SlotEntry, Page
from card_print.pdf import render_page


def _minimal_png() -> bytes:
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack(">IIBBBBB", 100, 100, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b'\x00' * 400)) + chunk(b'IEND', b'')


def test_render_page_creates_valid_pdf():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        img_path = tmp / "img1.png"
        img_path.write_bytes(_minimal_png())

        item = Item(0, "img1", img_path, 3)
        page = Page(
            entries=[
                SlotEntry(item=item, copies=4),
                SlotEntry(item=Item(1, "img2", img_path, 1), copies=3),
                SlotEntry(item=Item(2, "img3", img_path, 1), copies=2),
            ],
            print_count=1,
        )

        output = tmp / "test.pdf"
        render_page(page, output)

        assert output.exists()
        assert output.read_bytes()[:4] == b"%PDF"


def test_render_page_multiple_copies():
    """Same item appearing multiple times fills different cells."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        img_path = tmp / "img1.png"
        img_path.write_bytes(_minimal_png())

        item = Item(0, "img1", img_path, 9)
        page = Page(
            entries=[SlotEntry(item=item, copies=9)],
            print_count=1,
        )

        output = tmp / "full.pdf"
        render_page(page, output)
        assert output.read_bytes()[:4] == b"%PDF"
```

**Step 2: Implement PDF generation**

```python
"""PDF generation for card print sheets."""
from __future__ import annotations
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

from .models import Page


MARGIN = 0.5 * inch
GRID_COLS = 3
GRID_ROWS = 3


def _cell_geometry() -> tuple[float, float, float, float]:
    """Return (cell_w, cell_h, page_w, page_h)."""
    pw, ph = letter
    return ((pw - 2*MARGIN)/GRID_COLS, (ph - 2*MARGIN)/GRID_ROWS, pw, ph)


def render_page(page: Page, output_path: Path) -> None:
    """Render a 3x3 grid of card images to a PDF.

    Each SlotEntry's copies are placed in sequential cells (left→right, top→down).
    Images are scaled to fit within their cell, maintaining aspect ratio.
    """
    cell_w, cell_h, pw, ph = _cell_geometry()
    c = canvas.Canvas(str(output_path), pagesize=letter)

    # Footer: print count annotation
    if page.print_count > 1:
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(pw / 2, 0.3 * inch,
                           f"Print {page.print_count}x  |  {page.used_slots}/9 slots")

    # Expand entries into individual cell placements
    cell_idx = 0
    for entry in page.entries:
        for _ in range(entry.copies):
            col = cell_idx % GRID_COLS
            row = cell_idx // GRID_COLS
            x = MARGIN + col * cell_w
            y = ph - MARGIN - (row + 1) * cell_h

            # Cell border
            c.setStrokeColorRGB(0.85, 0.85, 0.85)
            c.setLineWidth(0.5)
            c.rect(x, y, cell_w, cell_h, fill=0)

            # Image fitted to cell
            try:
                with PILImage.open(str(entry.item.path)) as img:
                    iw, ih = img.size
                    ir = iw / ih
                    cr = cell_w / cell_h
                    if ir > cr:
                        dw = cell_w * 0.95
                        dh = dw / ir
                    else:
                        dh = cell_h * 0.95
                        dw = dh * ir
                    dx = x + (cell_w - dw) / 2
                    dy = y + (cell_h - dh) / 2
                    c.drawImage(str(entry.item.path), dx, dy,
                               width=dw, height=dh,
                               preserveAspectRatio=True, anchor='c')
            except Exception:
                c.setFont("Helvetica", 8)
                c.drawCentredString(x + cell_w/2, y + cell_h/2, entry.item.name)

            cell_idx += 1

    c.save()
```

**Step 3: Run test to verify pass**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/test_pdf.py -v`
Expected: 2 passed

**Step 4: Commit**

```bash
cd ~/Documents/Projects/sandbox
git add card-print/
git commit -m "feat: implement PDF generation with multi-copy support"
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
              help="Directory containing card images")
@click.option("--csv", "-c", required=True, type=click.Path(exists=True, file_okay=True, dir_okay=False),
              help="CSV file with headers including 'count' column")
@click.option("--output", "-o", default=".", type=click.Path(file_okay=False, dir_okay=True),
              help="Output directory for PDFs (default: current directory)")
@click.option("--dry-run", is_flag=True, default=False,
              help="Show packing plan without generating PDFs")
def cli(images: str, csv: str, output: str, dry_run: bool) -> None:
    """Pack card images into optimal print sheets."""
    image_dir = Path(images).resolve()
    csv_path = Path(csv).resolve()
    output_dir = Path(output).resolve()

    click.echo(f"Reading images from: {image_dir}")
    click.echo(f"Reading CSV from: {csv_path}")
    items = parse_input(csv_path, image_dir)

    if not items:
        click.echo("Error: no valid items found", err=True)
        sys.exit(1)

    active = [it for it in items if it.demand > 0]
    skipped = [it for it in items if it.demand == 0]
    click.echo(f"Found {len(active)} item(s) to print"
               f"{f', {len(skipped)} skipped (count=0)' if skipped else ''}")

    result = pack_items(items)

    if not result.pages:
        click.echo("No pages to generate (all counts are 0)")
        return

    click.echo(f"\n{result.summary()}")

    if dry_run:
        click.echo("\n(Dry run — no PDFs generated)")
        return

    output_dir.mkdir(parents=True, exist_ok=True)

    for i, page in enumerate(result.pages, 1):
        filename = f"p{i}x{page.print_count}.pdf"
        output_path = output_dir / filename
        render_page(page, output_path)
        click.echo(f"  Written: {output_path} ({page.used_slots}/9 slots)")

    click.echo(f"\nDone! {result.num_pdfs} PDF(s) in {output_dir}")
    if result.total_sheets > result.num_pdfs:
        click.echo(f"Total print jobs: {result.total_sheets} sheet(s)")


if __name__ == "__main__":
    cli()
```

**Step 2: Test the CLI manually**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m card_print --images fixtures/images --csv fixtures/test.csv --dry-run`

Expected: Shows packing plan summary without generating PDFs.

**Step 3: Test actual PDF generation**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m card_print --images fixtures/images --csv fixtures/test.csv --output /tmp/card-print-test`

**Step 4: Commit**

```bash
cd ~/Documents/Projects/sandbox
git add card-print/
git commit -m "feat: wire up CLI entry point with full pipeline"
```

---

### Task 7: Add README and integration test

**Objective:** Document usage, add end-to-end test, and polish.

**Files:**
- Modify: `sandbox/card-print/README.md`
- Create: `sandbox/card-print/tests/test_integration.py`

**Step 1: Write integration test**

```python
"""Integration test: full pipeline from CSV to PDF."""
import tempfile
from pathlib import Path
import zlib, struct

from card_print.parser import parse_input
from card_print.packer import pack_items
from card_print.pdf import render_page


def _create_png(path: Path) -> None:
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    path.write_bytes(
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack(">IIBBBBB", 100, 100, 8, 6, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(b'\x00' * 400))
        + chunk(b'IEND', b'')
    )


def test_full_pipeline_spec_example():
    """End-to-end: the spec example produces optimal results."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        img_dir = tmp / "images"
        img_dir.mkdir()
        for i in range(1, 16):
            _create_png(img_dir / f"img{i}.png")

        csv_path = tmp / "test.csv"
        csv_path.write_text(
            "name,count\n"
            "img1,3\nimg2,3\nimg3,3\nimg4,6\nimg5,6\nimg6,6\n"
            "img7,1\nimg8,1\nimg9,1\nimg10,\nimg11,1\nimg12,1\n"
            "img13,0\nimg14,1\nimg15,1\n"
        )

        items = parse_input(csv_path, img_dir)
        result = pack_items(items)

        assert result.total_sheets == 4
        assert result.total_extras == 0
        assert result.total_empty == 1
        assert result.num_pdfs == 2

        out_dir = tmp / "output"
        out_dir.mkdir()
        for i, page in enumerate(result.pages, 1):
            pdf_path = out_dir / f"p{i}x{page.print_count}.pdf"
            render_page(page, pdf_path)
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

First row must be headers including `count`. Each row maps to an image:

```csv
name,count,notes
img1,3,print 3 copies
img2,0,skip
img3,,defaults to 1
```

- Empty count → defaults to 1
- `0` → item is skipped
- Image names must match files in the images directory

### Output

PDFs named `p{N}x{C}.pdf` where N = page number, C = print count.
Each PDF: 3×3 grid on letter paper (8.5 × 11"), 0.5" margins.

### Algorithm

Items can appear multiple times per page and span pages with different print counts.
The solver minimizes: total sheets → over-printed extras → empty slots → number of PDFs.

Uses iterative deepening from `ceil(total_demand/9)` sheets upward, trying integer
partitions as page print counts with greedy first-fit fill per page.

### Future

- Configurable paper size (A4, legal, custom)
- Configurable grid (2×2, 4×3, etc.)
- Adjustable margins
- Image borders and labels
```

**Step 4: Run full test suite**

Run: `cd ~/Documents/Projects/sandbox/card-print && python3 -m pytest tests/ -v`
Expected: all 26 tests pass (6 models + 3 parser + 14 packer + 2 pdf + 1 integration)

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
| 2 | Data models (Item, SlotEntry, Page, PackResult) | 6 tests |
| 3 | CSV + image parser | 3 tests |
| 4 | Bounded knapsack packing algorithm | 14 tests |
| 5 | PDF generation (reportlab) | 2 tests |
| 6 | CLI entry point (Click) | manual test |
| 7 | README + integration test | 1 test |

**Total:** 26 tests, 7 tasks.

**Key design decisions:**
- Items can appear multiple times per page (up to 9 copies of same item)
- Items can span pages with different print counts (demand split)
- Scoring: `(sheets, extras, empty, num_pdfs)` — sheets first, then extras over empty
- Iterative deepening from theoretical minimum sheets upward
- Greedy fill per page: highest remaining demand first
- Integer partitions of target sheets into page print counts
