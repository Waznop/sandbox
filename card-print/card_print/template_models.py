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
