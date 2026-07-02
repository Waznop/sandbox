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
