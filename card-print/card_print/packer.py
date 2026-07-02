"""Bounded knapsack packing algorithm for card print sheets.

Allows multiple copies per item per page. Items can span pages with
different print counts. Minimizes (sheets, extras, empty, num_pdfs).
"""
from __future__ import annotations

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
