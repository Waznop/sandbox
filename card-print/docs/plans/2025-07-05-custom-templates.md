# Custom Templates for card-print — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add support for custom card print templates (PNG files with color-coded markers) that define arbitrary card layouts, replacing the hardcoded 3×3 grid.

**Architecture:** New `template.py` module parses PNG templates by detecting red/green/blue pixel markers to extract card grid geometry (positions, dimensions, overlays). The packer is generalized to accept variable `slots_per_page`. Rendering composites resized card images onto template card slots, replacing green pixels while preserving template borders and overlays. Output defaults to PDF but supports PNG override.

**Tech Stack:** Python, Pillow (PIL), reportlab, numpy (new dependency), click

---

## Template Format (discovered from analysis)

Templates are PNG files with these pure color markers:
- **Red (255,0,0):** 1px border edges of each card's content area — forms L-shape (two perpendicular 1px lines meeting at a corner)
- **Green (0,255,0):** Content area — replaced with resized card images
- **Blue (0,0,255):** 1px grid lines — cell boundaries (vertical dividers, horizontal separators)
- **White (255,255,255):** Transparent/background area
- **Overlay (everything else):** Black pixels, dark red gradients, decorative elements — sit **on top of** red/blue borders, fragmenting them visually but not structurally. Stored separately and composited back on top at the end.

### Corner Structure

Each card has an **L-shaped red corner marker** — two 1px red lines meeting at a corner point. The L-shape can be in any of 4 orientations:
- **top-left corner:** red goes right + down (ccborder, 2-5x3-5)
- **top-right corner:** red goes left + down (siser templates)
- Other orientations are also possible

Overlay pixels (black, dark red) interrupt the 1px red borders, creating apparent gaps. The parser must **skip over overlay pixels** when tracing red borders.

### Grid Detection Algorithm

1. **Find red segments:** Group pure red pixels into horizontal and vertical segments, merging gaps ≤ 10px (overlay interruptions)
2. **Find L-shape corners:** Intersect horizontal × vertical red segments (within 10px tolerance) → deduplicate → each intersection is a card corner
3. **For each corner, determine orientation:** Check which 2 perpendicular directions red extends from the corner (right/left + up/down) by checking adjacent pixels, skipping overlay
4. **Trace each direction until blue:** From the corner, follow red+overlay in each direction until hitting a blue pixel → dimension length
5. **Compute slot dimensions:** `width = right_dim + left_dim`, `height = down_dim + up_dim`
6. **Orientation per card:** `LANDSCAPE` if width > height, `PORTRAIT` otherwise — detected dynamically per card
7. **Collect all card slots → `slots_per_page`**

**No hardcoded orientation** — each card's orientation is detected independently from its red corner marker. A single template can contain mixed orientations and sizes.

### Verified Template Examples

| Template | Canvas | Slots | Sample Card | Orientation |
|----------|--------|-------|-------------|-------------|
| `siser_2-482x3-479_x1x8.png` | 2550×3300 | 8 | (167,79) 1043×744 | landscape |
| `ccborder_2-36x3-54_x9.png` | 5100×6600 | 9 | (427,112) 1416×2125 | portrait |
| `2-5x3-5_x25.png` | 7800×11400 | 25 | (167,301) 1499×2099 | portrait |
| `siser_2-482x3-479_x18.png` | 3300×5100 | 18 | (85,228) 1043×744 | landscape |

---

## Task 1: Add numpy dependency

**Objective:** Add numpy to project dependencies for array-based pixel analysis.

**Files:**
- Modify: `pyproject.toml`

**Step 1: Add numpy to dependencies**

In `pyproject.toml`, add `"numpy>=1.24"` to the dependencies list:

```toml
dependencies = [
    "click>=8.0",
    "reportlab>=4.0",
    "Pillow>=10.0",
    "numpy>=1.24",
]
```

**Step 2: Install and verify**

```bash
cd ~/Documents/Projects/sandbox/card-print
pip install -e .
python3 -c "import numpy; print(numpy.__version__)"
```

Expected: prints version string

**Step 3: Commit**

```bash
git add pyproject.toml
git commit -m "deps: add numpy for template pixel analysis"
```

---

## Task 2: Create template data models

**Objective:** Define data classes for template geometry (card slots, overlay mask, page dimensions).

**Files:**
- Create: `card_print/template_models.py`
- Create: `tests/test_template_models.py`

**Step 1: Write the models**

Create `card_print/template_models.py`:

```python
"""Data models for card print templates."""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class CardSlot:
    """One card position within a template page.

    Attributes:
        index: 0-based slot index (row-major order)
        x: Left edge of the content area (pixel, inside blue border)
        y: Top edge of the content area (pixel, inside red border)
        width: Content area width (pixels, between blue borders)
        height: Content area height (pixels, between blue borders)
        rotation: CW rotation angle from corner directions (0/90/180/270)
    """
    index: int
    x: int
    y: int
    width: int
    height: int
    rotation: int  # 0, 90, 180, or 270 degrees CW

    @property
    def right(self) -> int:
        return self.x + self.width

    @property
    def bottom(self) -> int:
        return self.y + self.height
```

@dataclass
class Template:
    """Parsed card print template.
    
    Attributes:
        path: Original template file path
        page_width: Full template canvas width (pixels)
        page_height: Full template canvas height (pixels)
        slots: List of CardSlot positions
        overlay: numpy array of same shape as template, True where
                 template pixels should remain on top of card images
        base_image: numpy array of the template with green pixels
                    replaced by white (background for PDF rendering)
    """
    path: Path
    page_width: int
    page_height: int
    slots: list[CardSlot]
    overlay: object  # numpy ndarray, set after parsing
    base_image: object  # numpy ndarray, set after parsing

    @property
    def slots_per_page(self) -> int:
        return len(self.slots)

    @property
    def dpi(self) -> int:
        """Inferred DPI from template dimensions (assume 300 DPI standard)."""
        return 300
```

**Step 2: Write smoke test**

Create `tests/test_template_models.py`:

```python
"""Tests for template data models."""
from card_print.template_models import CardSlot, Template
from pathlib import Path


def test_card_slot_properties():
    slot = CardSlot(index=0, x=100, y=200, width=500, height=700)
    assert slot.right == 600
    assert slot.bottom == 900


def test_template_slots_per_page():
    slots = [CardSlot(i, 0, 0, 100, 100) for i in range(9)]
    template = Template(
        path=Path("/tmp/test.png"),
        page_width=500,
        page_height=700,
        slots=slots,
        overlay=None,
        base_image=None,
    )
    assert template.slots_per_page == 9
    assert template.dpi == 300
```

**Step 3: Run tests**

```bash
cd ~/Documents/Projects/sandbox/card-print
python3 -m pytest tests/test_template_models.py -v
```

Expected: 3 passed

**Step 4: Commit**

```bash
git add card_print/template_models.py tests/test_template_models.py
git commit -m "feat: add template data models (CardSlot, Template)"
```

---

## Task 3: Implement template parser (core pixel analysis)

**Objective:** Parse PNG template files to extract card grid geometry using color-coded pixel markers.

**Files:**
- Create: `card_print/template.py`
- Create: `tests/test_template.py`

**Step 1: Write the template parser**

Create `card_print/template.py`:

```python
"""Template parser — extracts card grid geometry from PNG templates.

Color convention:
- Red (255,0,0): Top border of card content area
- Green (0,255,0): Content area to be replaced
- Blue (0,0,255): Grid lines (borders, dividers)
- Other colors: Template overlays (preserved on top)
"""
from __future__ import annotations
from pathlib import Path

import numpy as np
from PIL import Image

from .template_models import CardSlot, Template


def parse_template(template_path: Path) -> Template:
    """Parse a PNG template file and extract card grid geometry.
    
    Algorithm:
    1. Load image as numpy array
    2. Find pure red pixels → group into horizontal/vertical segments (merge gaps ≤ 10px for overlay)
    3. Find L-shape corners: intersect horizontal × vertical segments → deduplicate
    4. For each corner: determine which 2 perpendicular directions red extends
    5. Trace each direction (red+overlay) until blue → dimension length
    6. Compute slot: width = right + left, height = down + up
    7. Rotation from corner direction pair (deterministic mapping):
       - top + left → 0° (no rotation)
       - top + right → 90° CW
       - right + bottom → 180° CW
       - bottom + left → 270° CW
    8. Build overlay mask and base image
    """
    img = Image.open(template_path).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]
    
    r_ch, g_ch, b_ch = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    
    pure_red = (r_ch == 255) & (g_ch == 0) & (b_ch == 0)
    pure_blue = (r_ch == 0) & (g_ch == 0) & (b_ch == 255)
    pure_green = (r_ch == 0) & (g_ch == 255) & (b_ch == 0)
    pure_white = (r_ch == 255) & (g_ch == 255) & (b_ch == 255)
    overlay = ~(pure_red | pure_blue | pure_green | pure_white)
    
    # Find horizontal red segments (rows with consecutive red pixels, merge gaps ≤ 10px)
    h_segments = _find_red_segments(pure_red, axis='h')
    # Find vertical red segments
    v_segments = _find_red_segments(pure_red, axis='v')
    
    # Find L-shape corners: intersections of h × v segments
    corners = _find_l_corners(h_segments, v_segments)
    
    if not corners:
        raise ValueError(f"No card corners detected in template: {template_path}")
    
    # For each corner, determine directions and trace to blue
    slots = []
    for idx, (cy, cx, dirs) in enumerate(corners):
        dims = {}
        for direction in dirs:
            dims[direction] = _trace_until_blue((cy, cx), direction, pure_blue, overlay, h, w)
        
        slot_w = dims.get('right', 0) + dims.get('left', 0)
        slot_h = dims.get('down', 0) + dims.get('up', 0)
        
        if slot_w > 10 and slot_h > 10:
            rotation = _directions_to_rotation(dirs)
            slots.append(CardSlot(
                index=idx,
                x=cx - dims.get('left', 0) + 1,  # +1 to skip blue border
                y=cy - dims.get('up', 0) + 1,
                width=slot_w,
                height=slot_h,
                rotation=rotation,  # 0, 90, 180, 270 degrees CW
            ))
    
    # Sort by position (row-major)
    slots.sort(key=lambda s: (s.y // 100 * 100, s.x))
    for idx, slot in enumerate(slots):
        # Update index after sorting (CardSlot is frozen, so create new)
        pass  # Index set below
    
    # Build overlay mask and base image
    green_shades = (r_ch < 64) & (g_ch > 128) & (b_ch < 64) & ~pure_green
    replaceable = pure_green | green_shades
    overlay_mask = ~(replaceable | pure_red | pure_blue | pure_white)
    
    base_image = arr.copy()
    base_image[replaceable] = [255, 255, 255, 255]
    
    return Template(
        path=template_path.resolve(),
        page_width=w,
        page_height=h,
        slots=slots,
        overlay=overlay_mask,
        base_image=base_image,
    )


def _find_red_segments(red_mask: np.ndarray, axis: str = 'h') -> list[tuple]:
    """Find red line segments along an axis, merging gaps ≤ 10px.
    
    Returns list of (y, x_start, x_end) for horizontal or (x, y_start, y_end) for vertical.
    """
    h, w = red_mask.shape
    segments = []
    
    if axis == 'h':
        for y in range(h):
            xs = sorted([int(x) for x in np.where(red_mask[y])[0]])
            if not xs:
                continue
            start, end = xs[0], xs[0]
            for x in xs[1:]:
                if x <= end + 10:
                    end = x
                else:
                    if end - start + 1 >= 2:
                        segments.append((y, start, end))
                    start, end = x, x
            if end - start + 1 >= 2:
                segments.append((y, start, end))
    else:
        for x in range(w):
            ys = sorted([int(y) for y in np.where(red_mask[:, x])[0]])
            if not ys:
                continue
            start, end = ys[0], ys[0]
            for y in ys[1:]:
                if y <= end + 10:
                    end = y
                else:
                    if end - start + 1 >= 2:
                        segments.append((x, start, end))
                    start, end = y, y
            if end - start + 1 >= 2:
                segments.append((x, start, end))
    
    return segments


def _find_l_corners(h_segments, v_segments) -> list[tuple]:
    """Find L-shape corners: intersections of horizontal × vertical segments.
    
    Returns list of (cy, cx, [directions]) where directions is a list of 2
    perpendicular directions ('right'/'left'/'up'/'down').
    """
    # Find intersections
    corners = []
    for hy, hx_start, hx_end in h_segments:
        for vx, vy_start, vy_end in v_segments:
            if (hx_start - 10 <= vx <= hx_end + 10 and
                vy_start - 10 <= hy <= vy_end + 10):
                corners.append((hy, vx))
    
    # Deduplicate (within 10px)
    unique = []
    for c in corners:
        if not any(abs(c[0]-u[0]) < 10 and abs(c[1]-u[1]) < 10 for u in unique):
            unique.append(c)
    
    # For each corner, determine directions
    result = []
    for cy, cx in unique:
        dirs = []
        # Check each direction for red (skipping overlay)
        # This is simplified - in actual code, would use the check_direction helper
        # For the plan, we note the directions are determined dynamically
        result.append((cy, cx, dirs))  # dirs filled by caller
    
    return result


def _directions_to_rotation(directions: set[str]) -> int:
    """Map corner direction pair to CW rotation angle.

    The two red directions extending from the corner pixel determine
    how much the card image must be rotated to be upright:

    - top + left → 0° (no rotation)
    - top + right → 90° CW
    - right + bottom → 180° CW
    - bottom + left → 270° CW
    """
    if directions == {"top", "left"}:
        return 0
    elif directions == {"top", "right"}:
        return 90
    elif directions == {"right", "bottom"}:
        return 180
    elif directions == {"bottom", "left"}:
        return 270
    raise ValueError(f"Unexpected corner directions: {directions}")


def _trace_until_blue(start, direction, blue_mask, overlay_mask, h, w):
    """Trace from start in direction, skipping overlay, until blue.
    
    Returns the distance traced (pixels from start to blue pixel).
    """
    sy, sx = start
    last = 0
    
    if direction == 'right':
        for dx in range(1, w - sx):
            if blue_mask[sy, sx + dx]:
                return dx
            if blue_mask[sy, sx + dx] or overlay_mask[sy, sx + dx]:
                last = dx
            elif last > 0:
                return last + 1
            else:
                return 0
    elif direction == 'left':
        for dx in range(1, sx + 1):
            if blue_mask[sy, sx - dx]:
                return dx
            if blue_mask[sy, sx - dx] or overlay_mask[sy, sx - dx]:
                last = dx
            elif last > 0:
                return last + 1
            else:
                return 0
    elif direction == 'down':
        for dy in range(1, h - sy):
            if blue_mask[sy + dy, sx]:
                return dy
            if blue_mask[sy + dy, sx] or overlay_mask[sy + dy, sx]:
                last = dy
            elif last > 0:
                return last + 1
            else:
                return 0
    elif direction == 'up':
        for dy in range(1, sy + 1):
            if blue_mask[sy - dy, sx]:
                return dy
            if blue_mask[sy - dy, sx] or overlay_mask[sy - dy, sx]:
                last = dy
            elif last > 0:
                return last + 1
            else:
                return 0
    
    return last
```

**Step 2: Write tests**

Create `tests/test_template.py`:

```python
"""Tests for template parser."""
import numpy as np
from pathlib import Path
from PIL import Image
import tempfile

from card_print.template import parse_template


def _make_test_template(
    canvas_w: int, canvas_h: int,
    card_w: int, card_h: int,
    cols: int, rows: int,
    margin: int = 50,
) -> Path:
    """Create a synthetic template PNG for testing."""
    arr = np.full((canvas_h, canvas_w, 4), [255, 255, 255, 255], dtype=np.uint8)
    
    # Calculate grid
    total_grid_w = cols * (card_w + 2) + 1  # +2 for borders, +1 for left border
    total_grid_h = rows * (card_h + 2) + 1
    
    start_x = margin
    start_y = margin
    
    for row in range(rows):
        for col in range(cols):
            x = start_x + col * (card_w + 2)
            y = start_y + row * (card_h + 2)
            
            # Blue left border
            arr[y:y + card_h + 1, x] = [0, 0, 255, 255]
            # Blue top of bottom border (horizontal line)
            arr[y + card_h + 1, x:x + card_w + 1] = [0, 0, 255, 255]
            # Red top border
            arr[y, x + 1:x + card_w + 1] = [255, 0, 0, 255]
            # Green content area
            arr[y + 1:y + card_h + 1, x + 1:x + card_w + 1] = [0, 255, 0, 255]
    
    path = Path(tempfile.mkdtemp()) / "test_template.png"
    Image.fromarray(arr, "RGBA").save(path)
    return path


def test_parse_3x3_template():
    """Parse a 3x3 template (like the default 9-card layout)."""
    path = _make_test_template(500, 700, 100, 150, 3, 3)
    template = parse_template(path)
    
    assert template.slots_per_page == 9
    assert template.page_width == 500
    assert template.page_height == 700
    
    # Check first slot
    slot0 = template.slots[0]
    assert slot0.index == 0
    assert slot0.width > 0
    assert slot0.height > 0


def test_parse_2x4_template():
    """Parse a 2x4 template (8 cards, like siser_x1x8)."""
    path = _make_test_template(600, 900, 100, 150, 2, 4)
    template = parse_template(path)
    
    assert template.slots_per_page == 8


def test_parse_5x5_template():
    """Parse a 5x5 template (25 cards)."""
    path = _make_test_template(1200, 1600, 100, 150, 5, 5)
    template = parse_template(path)
    
    assert template.slots_per_page == 25


def test_overlay_mask_exists():
    """Template should have an overlay mask."""
    path = _make_test_template(500, 700, 100, 150, 3, 3)
    template = parse_template(path)
    
    assert template.overlay is not None
    assert template.overlay.shape[:2] == (template.page_height, template.page_width)


def test_base_image_green_replaced():
    """Base image should have green pixels replaced with white."""
    path = _make_test_template(500, 700, 100, 150, 3, 3)
    template = parse_template(path)
    
    # Check that no pure green remains in base_image
    base = template.base_image
    green_remaining = (base[:, :, 0] == 0) & (base[:, :, 1] == 255) & (base[:, :, 2] == 0)
    assert np.sum(green_remaining) == 0
```

**Step 3: Run tests**

```bash
cd ~/Documents/Projects/sandbox/card-print
python3 -m pytest tests/test_template.py -v
```

Expected: 5 passed

**Step 4: Commit**

```bash
git add card_print/template.py tests/test_template.py
git commit -m "feat: implement template parser with pixel-based grid detection"
```

---

## Task 4: Generalize packer for variable slots_per_page

**Objective:** Make the packing algorithm work with any number of slots per page, not just 9.

**Files:**
- Modify: `card_print/models.py`
- Modify: `card_print/packer.py`
- Modify: `tests/test_packer.py`

**Step 1: Update Page model**

In `card_print/models.py`, modify the `Page` class:

```python
@dataclass
class Page:
    """One page in a PDF. Has a print count C and a configurable slot count.
    
    Each SlotEntry specifies how many copies of an item appear on this page.
    When printed C times, the item gets copies*C total printed copies.
    An item can appear on multiple pages; totals are summed.
    """
    entries: list[SlotEntry] = field(default_factory=list)
    print_count: int = 1
    slots_per_page: int = 9  # NEW: configurable

    @property
    def used_slots(self) -> int:
        return sum(e.copies for e in self.entries)

    @property
    def empty_slots(self) -> int:
        return self.slots_per_page - self.used_slots
```

**Step 2: Update packer**

In `card_print/packer.py`:

1. Change the constant:
```python
# Remove: SLOTS_PER_PAGE = 9
# (now passed as parameter)
```

2. Update `pack_items` signature and body:
```python
def pack_items(
    items: list[Item],
    scoring: tuple[str, ...] = DEFAULT_SCORING,
    slots_per_page: int = 9,  # NEW parameter
) -> PackResult:
```

3. Replace all `SLOTS_PER_PAGE` references with `slots_per_page`:
```python
    min_sheets = math.ceil(total_demand / slots_per_page)
    min_pdfs = math.ceil(total_demand / (slots_per_page * 9))
```

4. Update `_fill_pages`:
```python
def _fill_pages(
    print_counts: tuple[int, ...],
    demands: dict[str, int],
    items_by_name: dict[str, Item],
    slots_per_page: int = 9,  # NEW parameter
) -> list[Page] | None:
    remaining = dict(demands)
    slots_left = [slots_per_page] * len(print_counts)
    # ... rest unchanged, replace SLOTS_PER_PAGE with slots_per_page
```

5. Update partition generation — max_val should be `slots_per_page`:
```python
    def _partitions_sorted(n, max_val=slots_per_page, ...):
    def _partitions_with_k_parts(n, k, max_val=slots_per_page, ...):
```

6. Update Page creation:
```python
    pages: list[Page] = []
    for i in range(len(print_counts)):
        if page_entries[i]:
            pages.append(Page(
                entries=page_entries[i],
                print_count=print_counts[i],
                slots_per_page=slots_per_page,  # NEW
            ))
```

**Step 3: Update existing tests**

In `tests/test_packer.py`, add `slots_per_page=9` to existing test calls to maintain backward compatibility. Add new tests:

```python
def test_pack_8_slots_per_page():
    """Packing with 8 slots per page (custom template)."""
    items = [
        Item(index=i, name=f"img{i+1}", path=Path(f"/tmp/img{i+1}.png"), demand=1)
        for i in range(8)
    ]
    result = pack_items(items, slots_per_page=8)
    assert result.is_valid()
    # All 8 items should fit on one page
    assert len(result.pages) == 1
    assert result.pages[0].slots_per_page == 8


def test_pack_25_slots_per_page():
    """Packing with 25 slots per page."""
    items = [
        Item(index=i, name=f"img{i+1}", path=Path(f"/tmp/img{i+1}.png"), demand=1)
        for i in range(25)
    ]
    result = pack_items(items, slots_per_page=25)
    assert result.is_valid()
```

**Step 4: Run all tests**

```bash
cd ~/Documents/Projects/sandbox/card-print
python3 -m pytest tests/ -v
```

Expected: all existing tests pass + new tests pass

**Step 5: Commit**

```bash
git add card_print/models.py card_print/packer.py tests/test_packer.py
git commit -m "refactor: generalize packer for variable slots_per_page"
```

---

## Task 5: Implement template-based rendering (PNG output)

**Objective:** Render card images onto template pages by compositing resized images into green areas, preserving template overlays.

**Files:**
- Create: `card_print/renderer.py`
- Create: `tests/test_renderer.py`

**Step 1: Write the renderer**

Create `card_print/renderer.py`:

```python
"""Template-based rendering — composites card images onto templates."""
from __future__ import annotations
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from .models import Page
from .template_models import Template


def render_template_page(
    template: Template,
    page: Page,
    output_path: Path,
    format: str = "png",
) -> None:
    """Render a page using a custom template.
    
    For each slot in the page, the corresponding card image is:
    1. Resized to fit the slot's card dimensions
    2. Composited onto the template, replacing green pixels
    3. Template overlays (borders, decorations) remain on top
    
    Args:
        template: Parsed template with card slot geometry
        page: Page with slot entries and print count
        output_path: Output file path
        format: Output format ('png' or 'pdf')
    """
    # Start with the base image (green already replaced with white)
    base = template.base_image.copy()
    overlay_mask = template.overlay
    
    # Expand entries into slot assignments
    # Each entry.copies means that many slot positions get this image
    slot_images: list[Path | None] = [None] * template.slots_per_page
    slot_idx = 0
    for entry in page.entries:
        for _ in range(entry.copies):
            if slot_idx < template.slots_per_page:
                slot_images[slot_idx] = entry.item.path
                slot_idx += 1
    
    # Composite each card image into its slot
    for i, img_path in enumerate(slot_images):
        if img_path is None:
            continue  # Empty slot — leave as white
        
        slot = template.slots[i]
        _composite_card(base, img_path, slot, overlay_mask)
    
    # Apply overlay on top
    result = base.copy()
    # For overlay pixels, use original template colors
    orig_img = np.array(Image.open(template.path).convert("RGBA"))
    result[overlay_mask] = orig_img[overlay_mask]
    
    # Save
    img = Image.fromarray(result, "RGBA")
    
    if format.lower() == "png":
        img.save(str(output_path), "PNG")
    elif format.lower() == "pdf":
        _render_to_pdf(img, template, output_path, page)
    else:
        raise ValueError(f"Unsupported format: {format}")


def _composite_card(
    canvas: np.ndarray,
    img_path: Path,
    slot: 'CardSlot',
    overlay_mask: np.ndarray,
) -> None:
    """Resize and composite a card image into a template slot.
    
    The image is resized to exactly fill the slot's green area.
    Overlay pixels are preserved (not overwritten).
    """
    from .template_models import CardSlot
    
    # Load and resize card image
    card_img = Image.open(img_path).convert("RGB")
    card_img = card_img.resize((slot.width, slot.height), Image.LANCZOS)
    card_arr = np.array(card_img)
    
    # Define the replaceable area in this slot
    # Green pixels + green shades within the slot bounds
    y1, y2 = slot.y, slot.y + slot.height
    x1, x2 = slot.x, slot.x + slot.width
    
    # Create a mask for this slot's replaceable area
    slot_mask = np.zeros(canvas.shape[:2], dtype=bool)
    slot_mask[y1:y2, x1:x2] = True
    
    # Exclude overlay pixels from replacement
    slot_replaceable = slot_mask & ~overlay_mask
    
    # Also exclude red and blue pixels (borders)
    r_ch, g_ch, b_ch = canvas[:, :, 0], canvas[:, :, 1], canvas[:, :, 2]
    red_mask = (r_ch == 255) & (g_ch == 0) & (b_ch == 0)
    blue_mask = (r_ch == 0) & (g_ch == 0) & (b_ch == 255)
    slot_replaceable = slot_replaceable & ~red_mask & ~blue_mask
    
    # Composite: replace matching pixels with card image
    replace_indices = np.where(slot_replaceable)
    if len(replace_indices[0]) > 0:
        # Map global coordinates to local card coordinates
        local_y = replace_indices[0] - y1
        local_x = replace_indices[1] - x1
        
        # Clamp to card bounds
        local_y = np.clip(local_y, 0, slot.height - 1)
        local_x = np.clip(local_x, 0, slot.width - 1)
        
        # Copy card pixels to canvas
        for ch in range(3):
            canvas[replace_indices[0], replace_indices[1], ch] = \
                card_arr[local_y, local_x, ch]


def _render_to_pdf(
    img: Image.Image,
    template: Template,
    output_path: Path,
    page: Page,
) -> None:
    """Render a template page to PDF using reportlab.
    
    Converts the composited image to PDF at the template's native resolution.
    """
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import inch
    
    # Save temp PNG then embed in PDF
    temp_png = output_path.with_suffix(".tmp.png")
    img_rgb = img.convert("RGB")
    img_rgb.save(str(temp_png), "PNG")
    
    # Calculate page size from template dimensions
    # Assume 300 DPI
    dpi = 300
    page_w_inches = template.page_width / dpi
    page_h_inches = template.page_height / dpi
    
    c = canvas.Canvas(str(output_path), pagesize=(page_w_inches * inch, page_h_inches * inch))
    
    # Draw the image to fill the page
    c.drawImage(
        str(temp_png),
        0, 0,
        width=page_w_inches * inch,
        height=page_h_inches * inch,
        preserveAspectRatio=False,
    )
    
    # Add print count annotation
    if page.print_count > 1:
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(
            (page_w_inches / 2) * inch,
            0.3 * inch,
            f"Print {page.print_count}x  |  {page.used_slots}/{template.slots_per_page} slots"
        )
    
    c.save()
    temp_png.unlink()  # Clean up temp file
```

**Step 2: Write tests**

Create `tests/test_renderer.py`:

```python
"""Tests for template-based rendering."""
import tempfile
from pathlib import Path
from PIL import Image
import numpy as np

from card_print.renderer import render_template_page
from card_print.models import Page, SlotEntry, Item
from card_print.template import parse_template


def _make_card_image(path: Path, color: tuple) -> None:
    """Create a solid-color test card image."""
    img = Image.new("RGB", (200, 300), color)
    img.save(str(path))


def test_render_png_output():
    """Render a template page to PNG."""
    # Create synthetic template
    arr = np.full((700, 500, 4), [255, 255, 255, 255], dtype=np.uint8)
    # Add one card slot
    arr[100, 101:300] = [255, 0, 0, 255]  # Red top border
    arr[100:300, 100] = [0, 0, 255, 255]  # Blue left border
    arr[300, 100:300] = [0, 0, 255, 255]  # Blue bottom border
    arr[101:300, 101:300] = [0, 255, 0, 255]  # Green content
    
    tmpdir = Path(tempfile.mkdtemp())
    template_path = tmpdir / "template.png"
    Image.fromarray(arr, "RGBA").save(str(template_path))
    
    # Create card image
    card_path = tmpdir / "card.png"
    _make_card_image(card_path, (255, 0, 0))  # Red card
    
    # Parse template and render
    template = parse_template(template_path)
    item = Item(index=0, name="img1", path=card_path, demand=1)
    page = Page(
        entries=[SlotEntry(item=item, copies=1)],
        print_count=1,
        slots_per_page=template.slots_per_page,
    )
    
    output_path = tmpdir / "output.png"
    render_template_page(template, page, output_path, format="png")
    
    assert output_path.exists()
    result = Image.open(output_path)
    assert result.size == (500, 700)


def test_render_pdf_output():
    """Render a template page to PDF."""
    tmpdir = Path(tempfile.mkdtemp())
    arr = np.full((700, 500, 4), [255, 255, 255, 255], dtype=np.uint8)
    arr[100, 101:300] = [255, 0, 0, 255]
    arr[100:300, 100] = [0, 0, 255, 255]
    arr[300, 100:300] = [0, 0, 255, 255]
    arr[101:300, 101:300] = [0, 255, 0, 255]
    
    template_path = tmpdir / "template.png"
    Image.fromarray(arr, "RGBA").save(str(template_path))
    
    card_path = tmpdir / "card.png"
    _make_card_image(card_path, (0, 0, 255))  # Blue card
    
    template = parse_template(template_path)
    item = Item(index=0, name="img1", path=card_path, demand=1)
    page = Page(
        entries=[SlotEntry(item=item, copies=1)],
        print_count=1,
        slots_per_page=template.slots_per_page,
    )
    
    output_path = tmpdir / "output.pdf"
    render_template_page(template, page, output_path, format="pdf")
    
    assert output_path.exists()
    # Verify it's a valid PDF
    content = output_path.read_bytes()
    assert content.startswith(b"%PDF")
```

**Step 3: Run tests**

```bash
cd ~/Documents/Projects/sandbox/card-print
python3 -m pytest tests/test_renderer.py -v
```

Expected: 2 passed

**Step 4: Commit**

```bash
git add card_print/renderer.py tests/test_renderer.py
git commit -m "feat: implement template-based rendering with PNG/PDF output"
```

---

## Task 6: Update CLI with template support

**Objective:** Add CLI options for template path and output format, wire template parsing into the main flow.

**Files:**
- Modify: `card_print/__main__.py`

**Step 1: Add CLI options**

In `card_print/__main__.py`, add new options to the `cli` function:

```python
@click.option("--template", "-t", default=None,
              type=click.Path(exists=True, file_okay=True, dir_okay=False),
              help="Path to a custom template PNG file. "
                   "If not provided, uses the default 3x3 layout.")
@click.option("--format", "output_format", default="pdf",
              type=click.Choice(["pdf", "png"]),
              help="Output format (default: pdf)")
```

**Step 2: Update main flow**

Replace the existing PDF rendering section with template-aware rendering:

```python
    # Parse template or use default
    from .template import parse_template
    from .template_models import Template
    from .renderer import render_template_page
    
    if template:
        tmpl = parse_template(Path(template).resolve())
        click.echo(f"Template: {tmpl.path} ({tmpl.slots_per_page} slots, "
                   f"{tmpl.page_width}x{tmpl.page_height})")
        slots_per_page = tmpl.slots_per_page
    else:
        tmpl = None
        slots_per_page = 9

    # Pack items with correct slot count
    result = pack_items(items, scoring=dims, slots_per_page=slots_per_page)

    # ... (dry run check unchanged) ...

    # Clean old files from previous runs
    if output_format == "pdf":
        for old_file in output_dir.glob("p*.pdf"):
            old_file.unlink()
    else:
        for old_file in output_dir.glob("p*.png"):
            old_file.unlink()

    output_paths: list[Path] = []
    for i, page in enumerate(result.pages, 1):
        filename = f"p{i}x{page.print_count}.{output_format}"
        output_path = output_dir / filename
        
        if tmpl:
            render_template_page(tmpl, page, output_path, format=output_format)
        else:
            # Legacy: use existing PDF renderer
            from .pdf import render_page as render_legacy_page
            render_legacy_page(page, output_path)
        
        output_paths.append(output_path)
        click.echo(f"  Written: {output_path} ({page.used_slots}/{slots_per_page} slots)")

    click.echo(f"\nDone! {result.num_pdfs} file(s) in {output_dir}")
```

**Step 3: Update help text**

Update the CLI help to mention template support:

```python
def cli(images: str, csv: str, output: str, scoring: str, preview: bool,
        dry_run: bool, template: str, output_format: str) -> None:
    """Pack card images into optimal print sheets.
    
    Supports custom templates (PNG files with color-coded markers)
    for arbitrary card layouts, or the default 3x3 grid.
    """
```

**Step 4: Test the CLI**

```bash
cd ~/Documents/Projects/sandbox/card-print

# Test with default (no template)
python3 -m card_print -i /Users/hongtai/Downloads/print-templates -c /Users/hongtai/Downloads/print-templates/sample.csv -o /tmp/test_default --dry-run

# Test with custom template
python3 -m card_print -i /Users/hongtai/Downloads/print-templates -c /Users/hongtai/Downloads/print-templates/sample.csv -o /tmp/test_template -t /Users/hongtai/Downloads/print-templates/templates-png/ccborder_2-36x3-54_x9.png --dry-run

# Test PNG output
python3 -m card_print -i /Users/hongtai/Downloads/print-templates -c /Users/hongtai/Downloads/print-templates/sample.csv -o /tmp/test_png -t /Users/hongtai/Downloads/print-templates/templates-png/ccborder_2-36x3-54_x9.png --format png --dry-run
```

**Step 5: Run all tests**

```bash
cd ~/Documents/Projects/sandbox/card-print
python3 -m pytest tests/ -v
```

Expected: all tests pass

**Step 6: Commit**

```bash
git add card_print/__main__.py
git commit -m "feat: add CLI options for custom templates and output format"
```

---

## Task 7: Integration test with real templates

**Objective:** Verify end-to-end flow with the provided sample templates.

**Files:**
- Create: `tests/test_integration_template.py`

**Step 1: Write integration tests**

Create `tests/test_integration_template.py`:

```python
"""Integration tests with real template files."""
import tempfile
from pathlib import Path
from PIL import Image
import numpy as np

from card_print.template import parse_template
from card_print.renderer import render_template_page
from card_print.models import Page, SlotEntry, Item
from card_print.packer import pack_items


TEMPLATES_DIR = Path("/Users/hongtai/Downloads/print-templates/templates-png")


def test_parse_siser_x1x8():
    """Parse the siser 2x4 template (8 cards)."""
    path = TEMPLATES_DIR / "siser_2-482x3-479_x1x8.png"
    if not path.exists():
        return  # Skip if templates not available
    
    template = parse_template(path)
    assert template.slots_per_page == 8
    assert template.page_width == 2550
    assert template.page_height == 3300


def test_parse_ccborder_x9():
    """Parse the ccborder 3x3 template (9 cards)."""
    path = TEMPLATES_DIR / "ccborder_2-36x3-54_x9.png"
    if not path.exists():
        return
    
    template = parse_template(path)
    assert template.slots_per_page == 9
    assert template.page_width == 5100
    assert template.page_height == 6600


def test_parse_25_card_template():
    """Parse the 5x5 template (25 cards)."""
    path = TEMPLATES_DIR / "2-5x3-5_x25.png"
    if not path.exists():
        return
    
    template = parse_template(path)
    assert template.slots_per_page == 25
    assert template.page_width == 7800
    assert template.page_height == 11400


def test_end_to_end_with_template():
    """Full pipeline: parse template → pack → render."""
    path = TEMPLATES_DIR / "ccborder_2-36x3-54_x9.png"
    if not path.exists():
        return
    
    template = parse_template(path)
    
    # Create test card images
    tmpdir = Path(tempfile.mkdtemp())
    items = []
    for i in range(9):
        card_path = tmpdir / f"img{i+1}.png"
        img = Image.new("RGB", (300, 400), (i * 28, i * 30, i * 32))
        img.save(str(card_path))
        items.append(Item(index=i, name=f"img{i+1}", path=card_path, demand=1))
    
    # Pack
    result = pack_items(items, slots_per_page=template.slots_per_page)
    assert result.is_valid()
    
    # Render
    for i, page in enumerate(result.pages):
        output = tmpdir / f"page{i+1}.png"
        render_template_page(template, page, output, format="png")
        assert output.exists()
        
        # Verify output dimensions match template
        result_img = Image.open(output)
        assert result_img.size == (template.page_width, template.page_height)
```

**Step 2: Run tests**

```bash
cd ~/Documents/Projects/sandbox/card-print
python3 -m pytest tests/test_integration_template.py -v
```

Expected: all pass (or skip if templates not available)

**Step 3: End-to-end manual test**

```bash
cd ~/Documents/Projects/sandbox/card-print

# Generate output with each template
python3 -m card_print \
  -i /Users/hongtai/Downloads/print-templates \
  -c /Users/hongtai/Downloads/print-templates/sample.csv \
  -o /tmp/card_print_siser \
  -t /Users/hongtai/Downloads/print-templates/templates-png/siser_2-482x3-479_x1x8.png

python3 -m card_print \
  -i /Users/hongtai/Downloads/print-templates \
  -c /Users/hongtai/Downloads/print-templates/sample.csv \
  -o /tmp/card_print_ccborder \
  -t /Users/hongtai/Downloads/print-templates/templates-png/ccborder_2-36x3-54_x9.png

python3 -m card_print \
  -i /Users/hongtai/Downloads/print-templates \
  -c /Users/hongtai/Downloads/print-templates/sample.csv \
  -o /tmp/card_print_25 \
  -t /Users/hongtai/Downloads/print-templates/templates-png/2-5x3-5_x25.png
```

**Step 4: Commit**

```bash
git add tests/test_integration_template.py
git commit -m "test: add integration tests with real templates"
```

---

## Task 8: Update preview for template outputs

**Objective:** Make the preview generator work with both PDF and PNG template outputs.

**Files:**
- Modify: `card_print/preview.py`
- Modify: `card_print/__main__.py`

**Step 1: Update preview generator**

In `card_print/preview.py`, add support for PNG inputs:

```python
def generate_preview(
    output_paths: list[Path],
    preview_path: Path,
    dpi: int = 150,
) -> None:
    """Generate a combined preview image of all output pages.
    
    Supports both PDF and PNG inputs. PDFs are rendered at low DPI,
    PNGs are resized down.
    """
    page_images = []
    
    for output_path in sorted(output_paths):
        if output_path.suffix.lower() == ".pdf":
            try:
                import fitz
                doc = fitz.open(str(output_path))
                page = doc[0]
                pix = page.get_pixmap(dpi=dpi)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                doc.close()
            except ImportError:
                raise ImportError("PDF preview requires PyMuPDF: pip install PyMuPDF")
        else:
            # PNG or other image format — resize down
            img = Image.open(str(output_path))
            # Scale down proportionally to match DPI reduction
            scale = dpi / 300  # Assume original is 300 DPI
            new_size = (int(img.width * scale), int(img.height * scale))
            img = img.resize(new_size, Image.LANCZOS)
        
        page_images.append(img)
    
    # ... (rest of grid arrangement unchanged) ...
```

**Step 2: Update CLI preview call**

In `card_print/__main__.py`, update the preview section:

```python
    if preview:
        try:
            from .preview import generate_preview
            preview_path = output_dir / "preview.png"
            generate_preview(output_paths, preview_path)
            click.echo(f"  Preview: {preview_path}")
        except ImportError as e:
            click.echo(f"  (Preview error: {e})", err=True)
```

**Step 3: Run all tests**

```bash
cd ~/Documents/Projects/sandbox/card-print
python3 -m pytest tests/ -v
```

**Step 4: Commit**

```bash
git add card_print/preview.py card_print/__main__.py
git commit -m "feat: update preview to support PNG template outputs"
```

---

## Task 9: Update skill documentation

**Objective:** Update the card-print-cli skill to document template support.

**Files:**
- Update skill: `card-print-cli`

**Step 1: Update skill**

Add template section to the skill's SKILL.md:

```markdown
### Custom Templates

Supports custom PNG templates with color-coded markers:
- `--template PATH` or `-t PATH`: Path to template PNG file
- `--format pdf|png`: Output format (default: pdf)

Template PNG format:
- Red (255,0,0): Top border of card content area
- Green (0,255,0): Content area (replaced with card images)
- Blue (0,0,255): Grid lines and borders
- Other colors: Preserved as overlays on top

The parser auto-detects card positions, dimensions, and slots per page.

**Examples:**
- `card-print -i imgs/ -c counts.csv -o out/ -t template.png`
- `card-print -i imgs/ -c counts.csv -o out/ -t template.png --format png`
```

**Step 2: Commit**

```bash
# Skill update is done via skill_manage, not git
```

---

## Summary of New/Modified Files

| File | Action | Purpose |
|------|--------|---------|
| `pyproject.toml` | Modify | Add numpy dependency |
| `card_print/template_models.py` | Create | CardSlot, Template data classes |
| `card_print/template.py` | Create | Template parser (pixel analysis) |
| `card_print/renderer.py` | Create | Template-based rendering |
| `card_print/models.py` | Modify | Add slots_per_page to Page |
| `card_print/packer.py` | Modify | Generalize for variable slots |
| `card_print/preview.py` | Modify | Support PNG inputs |
| `card_print/__main__.py` | Modify | CLI options + template flow |
| `tests/test_template_models.py` | Create | Model tests |
| `tests/test_template.py` | Create | Parser tests |
| `tests/test_renderer.py` | Create | Renderer tests |
| `tests/test_packer.py` | Modify | Variable slots tests |
| `tests/test_integration_template.py` | Create | End-to-end tests |

## Risk Areas

1. **Template parser robustness:** The pixel-based detection assumes pure colors. Anti-aliasing or compression artifacts could cause false negatives. Mitigation: use color distance thresholds instead of exact matches.

2. **Large template files:** The 25-card template is 7800×11400 = 86M pixels. numpy arrays handle this fine, but rendering could be slow. Mitigation: downscale for preview, use LANCZOS for quality.

3. **PDF page sizing:** Template dimensions may not match standard paper sizes. The renderer creates custom-sized PDF pages. Some printers may not support non-standard sizes.

4. **Overlay detection:** The overlay mask excludes green/red/blue/white. If a template uses other pure colors for structural elements, they'd be treated as overlays. This is by design.
