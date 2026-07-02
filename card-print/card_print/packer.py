"""Bounded knapsack packing algorithm for card print sheets.

Allows multiple copies per item per page. Items can span pages with
different print counts. Minimizes according to configurable scoring priority.
"""
from __future__ import annotations

from .models import Item, SlotEntry, Page, PackResult, DEFAULT_SCORING

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


def _fill_page_conservative(
    print_count: int,
    remaining: dict[str, int],
    items_by_name: dict[str, Item],
) -> tuple[list[SlotEntry], dict[str, int]]:
    """Greedy fill: never over-print. Copies capped at what's needed."""
    entries: list[SlotEntry] = []
    slots_left = SLOTS_PER_PAGE

    sorted_items = sorted(
        remaining.items(),
        key=lambda kv: (-kv[1], items_by_name[kv[0]].index),
    )

    for name, demand_left in sorted_items:
        if slots_left <= 0 or demand_left <= 0:
            continue
        copies = min(slots_left, (demand_left + print_count - 1) // print_count)
        if copies <= 0:
            continue
        entries.append(SlotEntry(item=items_by_name[name], copies=copies))
        slots_left -= copies
        remaining[name] = max(0, demand_left - copies * print_count)

    return entries, remaining


def _fill_page_aggressive(
    print_count: int,
    remaining: dict[str, int],
    items_by_name: dict[str, Item],
) -> tuple[list[SlotEntry], dict[str, int]]:
    """Fill page by distributing slots proportionally to remaining demand.

    This allows over-printing but spreads it across items rather than
    dumping it all on the highest-demand item. Minimizes empty slots.
    """
    entries: list[SlotEntry] = []
    active = {n: d for n, d in remaining.items() if d > 0}
    total_demand = sum(active.values())
    if total_demand == 0:
        return entries, remaining

    # Proportional distribution of slots
    raw = {n: d / total_demand * SLOTS_PER_PAGE for n, d in active.items()}

    # Round down, then distribute remainder by largest fractional part
    copies = {n: int(v) for n, v in raw.items()}
    assigned = sum(copies.values())
    remainder = SLOTS_PER_PAGE - assigned

    frac_order = sorted(active.keys(), key=lambda n: raw[n] - copies[n], reverse=True)
    for i, name in enumerate(frac_order):
        if i >= remainder:
            break
        copies[name] += 1

    for name, c in copies.items():
        if c > 0:
            entries.append(SlotEntry(item=items_by_name[name], copies=c))
            remaining[name] = max(0, remaining[name] - c * print_count)

    return entries, remaining


def _try_partition(
    partition: list[int],
    demands: dict[str, int],
    items_by_name: dict[str, Item],
    aggressive: bool = False,
) -> PackResult:
    """Try a partition of print counts, return result."""
    remaining = dict(demands)
    pages: list[Page] = []
    fill_fn = _fill_page_aggressive if aggressive else _fill_page_conservative

    for pc in partition:
        entries, remaining = fill_fn(pc, remaining, items_by_name)
        if entries:
            pages.append(Page(entries=entries, print_count=pc))

    return PackResult(pages=pages, demands=demands)


def pack_items(
    items: list[Item],
    scoring: tuple[str, ...] = DEFAULT_SCORING,
) -> PackResult:
    """Pack items into optimal print sheets.

    Args:
        items: List of items with demands.
        scoring: Priority tuple of dimension names. Available:
            'sheets', 'extras', 'empty', 'pdfs'
            Default: ('sheets', 'extras', 'empty', 'pdfs')

    Strategy:
    1. Compute min_sheets = ceil(total_demand / 9)
    2. For target_sheets from min_sheets upward:
       a. Generate partitions of target_sheets into print counts
       b. For each partition, try both conservative and aggressive fill
       c. Check validity, track best by scoring priority
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
            # Try conservative (no over-printing)
            result = _try_partition(partition, demands, items_by_name, aggressive=False)
            if result.is_valid() and (best is None or result.score(scoring) < best.score(scoring)):
                best = result

            # Try aggressive (allow over-printing to fill slots)
            result = _try_partition(partition, demands, items_by_name, aggressive=True)
            if result.is_valid() and (best is None or result.score(scoring) < best.score(scoring)):
                best = result

        # Early exit: perfect packing found
        if best and best.total_extras == 0 and best.total_empty == 0:
            break

        if target_sheets > min_sheets * 3:
            break

    return best if best else PackResult(pages=[], demands=demands)
