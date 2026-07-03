"""Bounded knapsack packing algorithm for card print sheets.

Allows multiple copies per item per page. Items can span pages with
different print counts. Minimizes according to configurable scoring priority.
"""
from __future__ import annotations
import math
from itertools import combinations

from .models import Item, SlotEntry, Page, PackResult, DEFAULT_SCORING

SLOTS_PER_PAGE = 9


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
    """Fill page by distributing slots proportionally to remaining demand."""
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


def _smart_partitions(n: int, max_part: int = 9, limit: int = 50) -> list[list[int]]:
    """Generate a limited set of smart integer partitions of n.

    For small n, generates all partitions.
    For large n, generates a curated set of promising partitions:
    - All 9s (max print count per page)
    - Mix of 9s and smaller counts
    - Just a few varied partitions
    """
    if n <= 15:
        # Small enough to enumerate all
        return _partitions_all(n, max_part)

    # For large n, generate smart partitions
    result = []

    # Strategy 1: All 9s, with remainder
    if n > 0:
        nines = n // 9
        rem = n % 9
        if nines > 0:
            if rem > 0:
                result.append([9] * nines + [rem])
            else:
                result.append([9] * nines)

    # Strategy 2: Mix of high and low print counts
    for pc in range(min(n, max_part), 0, -1):
        if n - pc >= 0:
            rest = n - pc
            if rest == 0:
                result.append([pc])
            elif rest <= 9:
                result.append([pc, rest])
            else:
                # Fill rest with 9s
                nines = rest // 9
                rem = rest % 9
                p = [pc] + [9] * nines + ([rem] if rem > 0 else [])
                if p not in result:
                    result.append(p)

    # Strategy 3: All 1s (many pages, no over-printing)
    if n <= 50:  # Don't generate too many pages
        result.append([1] * n)

    # Strategy 4: Balanced partitions
    if n >= 2:
        half = n // 2
        rem = n % 2
        result.append([half, half] + ([rem] if rem > 0 else []))

    # Deduplicate and limit
    seen = set()
    unique = []
    for p in result:
        key = tuple(sorted(p, reverse=True))
        if key not in seen:
            seen.add(key)
            unique.append(p)
        if len(unique) >= limit:
            break

    return unique


def _partitions_all(n: int, max_part: int = 9) -> list[list[int]]:
    """Generate all integer partitions of n into parts <= max_part."""
    if n == 0:
        return [[]]
    result = []
    for first in range(min(n, max_part), 0, -1):
        for rest in _partitions_all(n - first, first):
            result.append([first] + rest)
    return result


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
       a. Generate smart partitions of target_sheets into print counts
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

    # Limit search depth based on input size
    max_sheets = min(total_demand, min_sheets * 3) if total_demand <= 100 else min_sheets * 2

    for target_sheets in range(min_sheets, max_sheets + 1):
        partitions = _smart_partitions(target_sheets)

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

    return best if best else PackResult(pages=[], demands=demands)
