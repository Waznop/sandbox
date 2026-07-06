"""Template parser — extracts card grid geometry from PNG templates.

Color convention:
- Red (255,0,0): Border edges of each card's content area
- Green (0,255,0): Content area to be replaced
- Blue (0,0,255): Grid lines (borders, dividers)
- Other colors: Template overlays (preserved on top)
"""
from __future__ import annotations
from pathlib import Path

import numpy as np
from PIL import Image

from .template_models import CardSlot, Template

# Merge gaps up to this many pixels when finding red segments.
# Overlay pixels (black, dark red gradients) can fragment 1px red borders
# into segments separated by ~37px gaps.
SEGMENT_MERGE_GAP = 50


def parse_template(template_path: Path) -> Template:
    """Parse a PNG template file and extract card grid geometry."""
    img = Image.open(template_path).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]

    r_ch, g_ch, b_ch = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    pure_red = (r_ch == 255) & (g_ch == 0) & (b_ch == 0)
    pure_blue = (r_ch == 0) & (g_ch == 0) & (b_ch == 255)
    pure_green = (r_ch == 0) & (g_ch == 255) & (b_ch == 0)
    pure_white = (r_ch == 255) & (g_ch == 255) & (b_ch == 255)

    # "Red-ish" includes pure red + dark red gradients (r > 128, g < 64, b < 64)
    red_ish = (r_ch > 128) & (g_ch < 64) & (b_ch < 64)

    # Overlay = everything that's not a structural color
    overlay = ~(pure_red | pure_blue | pure_green | pure_white)

    # Find red segments, merging gaps caused by overlay pixels
    h_segments = _find_red_segments(pure_red, axis='h')
    v_segments = _find_red_segments(pure_red, axis='v')

    # Find L-shape corners: intersections of h × v segments
    corners = _find_l_corners(h_segments, v_segments, arr)

    if not corners:
        raise ValueError(f"No card corners detected in template: {template_path}")

    # For each corner, trace red-ish+overlay in each direction until blue
    slots = []
    for idx, (cy, cx, dirs) in enumerate(corners):
        dims = {}
        for direction in dirs:
            dims[direction] = _trace_until_blue(
                (cy, cx), direction, red_ish, overlay, pure_blue, h, w
            )

        slot_w = dims.get('right', 0) + dims.get('left', 0)
        slot_h = dims.get('down', 0) + dims.get('up', 0)

        if slot_w > 10 and slot_h > 10:
            rotation = _directions_to_rotation(dirs)
            # Slot bounds include the red/blue border pixels
            slot_x = cx - dims.get('left', 0)
            slot_y = cy - dims.get('up', 0)
            slots.append(CardSlot(
                index=idx,
                x=slot_x,
                y=slot_y,
                width=slot_w + 1,   # +1 to include border pixels
                height=slot_h + 1,  # +1 to include border pixels
                rotation=rotation,
            ))

    # Sort by position (row-major)
    slots.sort(key=lambda s: (s.y // 100 * 100, s.x))
    # Re-index after sorting
    slots = [CardSlot(index=i, x=s.x, y=s.y, width=s.width,
                       height=s.height, rotation=s.rotation)
             for i, s in enumerate(slots)]

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
    """Find red line segments along an axis, merging gaps ≤ SEGMENT_MERGE_GAP px.

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
                if x <= end + SEGMENT_MERGE_GAP:
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
                if y <= end + SEGMENT_MERGE_GAP:
                    end = y
                else:
                    if end - start + 1 >= 2:
                        segments.append((x, start, end))
                    start, end = y, y
            if end - start + 1 >= 2:
                segments.append((x, start, end))

    return segments


def _is_red_ish(pixel: np.ndarray) -> bool:
    """Check if a pixel is red or a dark red gradient."""
    return int(pixel[0]) > 32 and int(pixel[1]) < 64 and int(pixel[2]) < 64


def _find_l_corners(
    h_segments: list[tuple],
    v_segments: list[tuple],
    arr: np.ndarray,
) -> list[tuple]:
    """Find L-shape corners: intersections of horizontal × vertical segments.

    Returns list of (cy, cx, {directions}) where directions is a set of
    2 perpendicular direction names from {'top', 'right', 'bottom', 'left'}.
    """
    # Find intersections
    corners = []
    for hy, hx_start, hx_end in h_segments:
        for vx, vy_start, vy_end in v_segments:
            if (hx_start - SEGMENT_MERGE_GAP <= vx <= hx_end + SEGMENT_MERGE_GAP and
                    vy_start - SEGMENT_MERGE_GAP <= hy <= vy_end + SEGMENT_MERGE_GAP):
                corners.append((hy, vx))

    # Deduplicate (within SEGMENT_MERGE_GAP px)
    unique = []
    for c in corners:
        if not any(abs(c[0] - u[0]) < SEGMENT_MERGE_GAP and
                   abs(c[1] - u[1]) < SEGMENT_MERGE_GAP for u in unique):
            unique.append(c)

    # For each corner, determine which 2 perpendicular directions red-ish extends
    result = []
    for cy, cx in unique:
        dirs = set()
        for direction, dy, dx in [('right', 0, 1), ('left', 0, -1),
                                   ('down', 1, 0), ('up', -1, 0)]:
            if _check_direction(cy, cx, dy, dx, arr):
                dirs.add(direction)

        if len(dirs) == 2:
            result.append((cy, cx, dirs))

    return result


def _check_direction(cy: int, cx: int, dy: int, dx: int, arr: np.ndarray) -> bool:
    """Check if red-ish pixels extend in a direction from (cy, cx).

    Walks up to 20px in the direction. Counts red-ish pixels
    (pure red + dark red gradients). Returns True if at least 2 found.
    """
    h, w = arr.shape[:2]
    redish_count = 0
    for step in range(1, 21):
        ny, nx = cy + dy * step, cx + dx * step
        if ny < 0 or ny >= h or nx < 0 or nx >= w:
            break
        if _is_red_ish(arr[ny, nx]):
            redish_count += 1
        else:
            break  # Hit a non-red-ish pixel
    return redish_count >= 2


def _directions_to_rotation(directions: set[str]) -> int:
    """Map corner direction pair to CW rotation angle.

    The two red directions extending FROM the corner pixel tell us which
    corner of the card this is. The rotation maps the card to upright:

    Corner at top-left of card:  red goes right + down → 0°
    Corner at top-right of card: red goes left + down  → 90°
    Corner at bottom-right:      red goes left + up    → 180°
    Corner at bottom-left:       red goes right + up   → 270°
    """
    if directions == {'right', 'down'}:
        return 0
    elif directions == {'left', 'down'}:
        return 90
    elif directions == {'left', 'up'}:
        return 180
    elif directions == {'right', 'up'}:
        return 270
    raise ValueError(f"Unexpected corner directions: {directions}")


def _trace_until_blue(
    start: tuple, direction: str,
    red_ish: np.ndarray, overlay: np.ndarray,
    pure_blue: np.ndarray, h: int, w: int,
) -> int:
    """Trace from start in direction, following red-ish+overlay until blue.

    Returns the distance traced (pixels from start to blue pixel).
    """
    sy, sx = start

    if direction == 'right':
        for dx in range(1, w - sx):
            if pure_blue[sy, sx + dx]:
                return dx
            if red_ish[sy, sx + dx] or overlay[sy, sx + dx]:
                continue
            else:
                return dx - 1
    elif direction == 'left':
        for dx in range(1, sx + 1):
            if pure_blue[sy, sx - dx]:
                return dx
            if red_ish[sy, sx - dx] or overlay[sy, sx - dx]:
                continue
            else:
                return dx - 1
    elif direction == 'down':
        for dy in range(1, h - sy):
            if pure_blue[sy + dy, sx]:
                return dy
            if red_ish[sy + dy, sx] or overlay[sy + dy, sx]:
                continue
            else:
                return dy - 1
    elif direction == 'up':
        for dy in range(1, sy + 1):
            if pure_blue[sy - dy, sx]:
                return dy
            if red_ish[sy - dy, sx] or overlay[sy - dy, sx]:
                continue
            else:
                return dy - 1

    return 0
