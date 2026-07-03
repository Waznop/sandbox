"""Bounded knapsack packing algorithm for card print sheets.

Allows multiple copies per item per page. Items can span pages with
different print counts. Minimizes according to configurable scoring priority.
"""
from __future__ import annotations
import math

from .models import Item, SlotEntry, Page, PackResult, DEFAULT_SCORING

SLOTS_PER_PAGE = 9


def _partitions_sorted(n: int, max_val: int = 9, min_val: int = 1) -> list[tuple[int, ...]]:
    """Generate partitions of n into parts in [min_val, max_val].

    Returns tuples sorted by fewest parts first (fewer PDFs = better).
    """
    results: list[tuple[int, ...]] = []

    def _recurse(remaining: int, max_allowed: int, current: list[int]) -> None:
        if remaining == 0:
            results.append(tuple(sorted(current, reverse=True)))
            return
        start = min(max_allowed, remaining)
        for v in range(start, min_val - 1, -1):
            if v > remaining:
                continue
            current.append(v)
            _recurse(remaining - v, v, current)
            current.pop()

    _recurse(n, max_val, [])
    results.sort(key=lambda p: (len(p), p))
    return results


def _fill_pages(
    print_counts: tuple[int, ...],
    demands: dict[str, int],
    items_by_name: dict[str, Item],
) -> list[Page] | None:
    """Fill pages page-by-page, preferring items that fit exactly on each page type.

    For each page (highest pc first), fill it with items whose remaining demand
    is divisible by pc (exact fit, no extras). Then fill remaining slots with
    other items, preferring those that produce the fewest extras.
    """
    remaining = dict(demands)
    slots_left = [SLOTS_PER_PAGE] * len(print_counts)
    page_entries: list[list[SlotEntry]] = [[] for _ in range(len(print_counts))]

    # Process pages from highest print count to lowest
    pc_indices = sorted(range(len(print_counts)), key=lambda i: -print_counts[i])

    for pi in pc_indices:
        pc = print_counts[pi]
        slots = SLOTS_PER_PAGE

        # Phase 1: Fill with items that divide evenly by pc (no extras)
        # Sort by demand descending
        exact_items = sorted(
            [(n, d) for n, d in remaining.items() if d > 0 and d % pc == 0],
            key=lambda x: (-x[1], items_by_name[x[0]].index),
        )

        for name, demand in exact_items:
            if slots <= 0:
                break
            copies = min(slots, demand // pc)
            if copies <= 0:
                continue
            page_entries[pi].append(SlotEntry(item=items_by_name[name], copies=copies))
            slots -= copies
            remaining[name] -= copies * pc

        # Phase 2: Fill remaining slots with other items
        # Prefer items where (demand % pc) == 0 or close, then by demand descending
        other_items = sorted(
            [(n, d) for n, d in remaining.items() if d > 0],
            key=lambda x: (x[1] % pc, -x[1], items_by_name[x[0]].index),
        )

        for name, demand in other_items:
            if slots <= 0:
                break
            copies = min(slots, math.ceil(demand / pc))
            if copies <= 0:
                continue
            page_entries[pi].append(SlotEntry(item=items_by_name[name], copies=copies))
            slots -= copies
            remaining[name] = max(0, demand - copies * pc)

    # Check all demands satisfied
    if any(v > 0 for v in remaining.values()):
        return None

    # Build pages
    pages: list[Page] = []
    for i in range(len(print_counts)):
        if page_entries[i]:
            pages.append(Page(entries=page_entries[i], print_count=print_counts[i]))

    return pages


def pack_items(
    items: list[Item],
    scoring: tuple[str, ...] = DEFAULT_SCORING,
) -> PackResult:
    """Pack items into optimal print sheets."""
    active = [it for it in items if it.demand > 0]
    if not active:
        return PackResult(pages=[], demands={})

    demands = {it.name: it.demand for it in active}
    total_demand = sum(demands.values())
    min_sheets = math.ceil(total_demand / SLOTS_PER_PAGE)
    items_by_name = {it.name: it for it in active}

    best: PackResult | None = None
    best_score = None

    max_sheets = min(total_demand, min_sheets + 20)

    for target_sheets in range(min_sheets, max_sheets + 1):
        partitions = _partitions_sorted(target_sheets)

        for print_counts in partitions:
            pages = _fill_pages(print_counts, demands, items_by_name)
            if pages is None:
                continue

            result = PackResult(pages=pages, demands=demands)
            score = result.score(scoring)

            if best_score is None or score < best_score:
                best_score = score
                best = result

            if result.total_extras == 0 and result.total_empty == 0:
                return result

        if best and best.total_sheets == target_sheets:
            break

    return best if best else PackResult(pages=[], demands=demands)
