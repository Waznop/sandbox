"""Bounded knapsack packing algorithm for card print sheets.

Allows multiple copies per item per page. Items can span pages with
different print counts. Minimizes according to configurable scoring priority.
"""
from __future__ import annotations
import math

from .models import Item, SlotEntry, Page, PackResult, DEFAULT_SCORING

SLOTS_PER_PAGE = 9


def _partitions_sorted(n: int, max_val: int = 9, min_val: int = 1, limit: int = 1000) -> list[tuple[int, ...]]:
    """Generate partitions of n into parts in [min_val, max_val].

    Returns tuples sorted by fewest parts first (fewer PDFs = better).
    Limits to 'limit' partitions to keep search feasible.
    """
    results: list[tuple[int, ...]] = []

    def _recurse(remaining: int, max_allowed: int, current: list[int]) -> None:
        if len(results) >= limit:
            return
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
            if len(results) >= limit:
                return

    _recurse(n, max_val, [])
    results.sort(key=lambda p: (len(p), p))
    return results


def _partitions_with_k_parts(n: int, k: int, max_val: int = 9, min_val: int = 1, limit: int = 100) -> list[tuple[int, ...]]:
    """Generate partitions of n into exactly k parts, each in [min_val, max_val]."""
    results: list[tuple[int, ...]] = []

    def _recurse(remaining: int, parts_left: int, max_allowed: int, current: list[int]) -> None:
        if len(results) >= limit:
            return
        if parts_left == 0:
            if remaining == 0:
                results.append(tuple(sorted(current, reverse=True)))
            return
        min_possible = parts_left * min_val
        max_possible = parts_left * max_val
        if remaining < min_possible or remaining > max_possible:
            return

        start = min(max_allowed, remaining - (parts_left - 1) * min_val)
        end = max(min_val, remaining - (parts_left - 1) * max_val)
        for v in range(start, end - 1, -1):
            if v < min_val or v > max_val:
                continue
            current.append(v)
            _recurse(remaining - v, parts_left - 1, v, current)
            current.pop()
            if len(results) >= limit:
                return

    _recurse(n, k, max_val, [])
    results.sort(key=lambda p: p)
    return results


def _fill_pages(
    print_counts: tuple[int, ...],
    demands: dict[str, int],
    items_by_name: dict[str, Item],
) -> list[Page] | None:
    """Fill pages page-by-page, preferring items that fit exactly on each page type."""
    remaining = dict(demands)
    slots_left = [SLOTS_PER_PAGE] * len(print_counts)
    page_entries: list[list[SlotEntry]] = [[] for _ in range(len(print_counts))]

    pc_indices = sorted(range(len(print_counts)), key=lambda i: -print_counts[i])

    for pi in pc_indices:
        pc = print_counts[pi]
        slots = SLOTS_PER_PAGE

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

    if any(v > 0 for v in remaining.values()):
        return None

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
    min_pdfs = math.ceil(total_demand / (SLOTS_PER_PAGE * 9))
    items_by_name = {it.name: it for it in active}

    best: PackResult | None = None
    best_score = None

    primary = scoring[0]
    max_sheets = min(total_demand, min_sheets + 50)

    if primary == "pdfs":
        # Search by PDF count first
        max_pdfs = min_sheets
        for target_pdfs in range(min_pdfs, max_pdfs + 1):
            min_sheets_for_pdfs = math.ceil(total_demand / (target_pdfs * SLOTS_PER_PAGE))
            max_sheets_for_pdfs = min(max_sheets, target_pdfs * 9)

            for target_sheets in range(min_sheets_for_pdfs, max_sheets_for_pdfs + 1):
                partitions = _partitions_with_k_parts(target_sheets, target_pdfs, limit=50)
                for print_counts in partitions:
                    pages = _fill_pages(print_counts, demands, items_by_name)
                    if pages is None:
                        continue
                    result = PackResult(pages=pages, demands=demands)
                    score = result.score(scoring)
                    if best_score is None or score < best_score:
                        best_score = score
                        best = result

            if best and best.total_extras == 0 and best.total_empty == 0:
                break
    else:
        # Search by sheet count first
        for target_sheets in range(min_sheets, max_sheets + 1):
            partitions = _partitions_sorted(target_sheets, limit=500)
            for print_counts in partitions:
                pages = _fill_pages(print_counts, demands, items_by_name)
                if pages is None:
                    continue
                result = PackResult(pages=pages, demands=demands)
                score = result.score(scoring)
                if best_score is None or score < best_score:
                    best_score = score
                    best = result

            if best and best.total_extras == 0 and best.total_empty == 0:
                break
            if primary == "sheets" and best.total_sheets == target_sheets:
                break

    return best if best else PackResult(pages=[], demands=demands)
