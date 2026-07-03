"""Tests for the packing algorithm — 14 cases + scoring variants."""
from card_print.models import Item, DEFAULT_SCORING
from card_print.packer import pack_items


def _items(counts):
    return [Item(i, f"img{i+1}", f"/img{i+1}.png", c) for i, c in enumerate(counts)]


# === Default scoring: (sheets, extras, empty, pdfs) ===

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
    """5,7 -> 2 sheets, 0 extras, 6 empty (split demand across 2 pages)."""
    r = pack_items(_items([5,7]))
    assert r.total_sheets == 2
    assert r.total_extras == 0
    assert r.total_empty == 6


def test_tc6_all_zero():
    """All zeros -> 0 sheets."""
    r = pack_items(_items([0,0,0]))
    assert r.total_sheets == 0
    assert r.num_pdfs == 0


def test_tc7_large_plus_small():
    """18,3,3,3 -> 3 sheets, 0 extras, 0 empty."""
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
    """8x9 -> 8 sheets, 0 extras, 0 empty."""
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


# === Scoring variant tests ===

def test_scoring_pdfs_over_extras():
    """(sheets, pdfs, extras, empty): prefer fewer PDFs even with extras.

    [5, 7]: default splits across 2 pages (0 extras, 2 PDFs).
    With pdfs-first: single page at print_count=2 (2 extras, 1 PDF).
    """
    r = pack_items(_items([5, 7]), scoring=("sheets", "pdfs", "extras", "empty"))
    assert r.total_sheets == 2
    assert r.num_pdfs == 1  # fewer PDFs than default (2)
    assert r.total_extras >= 0  # may have extras


def test_scoring_extras_over_pdfs():
    """(sheets, extras, empty, pdfs): prefer 0 extras even with more PDFs.

    [5, 7]: default scoring splits across 2 pages for 0 extras.
    """
    r = pack_items(_items([5, 7]), scoring=DEFAULT_SCORING)
    assert r.total_sheets == 2
    assert r.total_extras == 0  # 0 extras preferred
    assert r.num_pdfs == 2


def test_scoring_pdfs_over_extras_larger():
    """Larger case where pdfs-first changes the solution.

    [3, 3, 3, 6, 6, 6, 1, 1, 1, 1, 1, 1, 0, 1, 1]:
    Default: 2 PDFs, 4 sheets, 0 extras, 1 empty
    With pdfs-first: might consolidate to fewer PDFs with some extras.
    """
    counts = [3,3,3,6,6,6,1,1,1,1,1,1,0,1,1]
    r_default = pack_items(_items(counts), scoring=DEFAULT_SCORING)
    r_pdfs = pack_items(_items(counts), scoring=("sheets", "pdfs", "extras", "empty"))

    # Both should have same sheets (primary priority)
    assert r_default.total_sheets == r_pdfs.total_sheets == 4

    # pdfs-first should have <= PDFs than default
    assert r_pdfs.num_pdfs <= r_default.num_pdfs


def test_scoring_empty_over_extras():
    """(sheets, empty, extras, pdfs): prefer fewer empty slots over fewer extras.

    [5, 7]: demand=12, min_sheets=2.
    Best solution: p1x2 -> img2x4, img1x3 (7/9 slots).
    2 empty, 2 extras. (Can't do 0 empty without 6 extras.)
    """
    r = pack_items(_items([5, 7]), scoring=("sheets", "empty", "extras", "pdfs"))
    assert r.total_sheets == 2
    assert r.total_extras == 2
    assert r.num_pdfs == 1


def test_scoring_sheets_always_first():
    """Regardless of scoring, sheets is always the primary concern.

    [1, 1]: demand=2, min_sheets=1.
    Any scoring should produce 1 sheet.
    """
    for scoring in [
        ("sheets", "extras", "empty", "pdfs"),
        ("sheets", "pdfs", "extras", "empty"),
        ("sheets", "empty", "pdfs", "extras"),
        ("sheets", "extras", "pdfs", "empty"),
    ]:
        r = pack_items(_items([1, 1]), scoring=scoring)
        assert r.total_sheets == 1, f"Failed for scoring {scoring}"


# === Large real-world scenario: 74 items, 68 with demand > 0 ===
# Demand distribution: 2x9, 1x6, 23x3, 10x2, 32x1 = 151 total demand

def _large_items():
    """74-item dataset matching real card print scenario."""
    demands = {i: 1 for i in range(74)}
    demands[24] = 9   # img25
    demands[25] = 9   # img26
    demands[26] = 6   # img27
    for i in range(27, 50):  # img28-img50
        demands[i] = 3
    for i in range(50, 60):  # img51-img60
        demands[i] = 2
    # img1-img24, img61-img74 stay at 1
    return [Item(i, f"img{i+1}", f"/img{i+1}.png", demands[i]) for i in range(74)]


def test_large_default_scoring():
    """74 items, default scoring (sheets, extras, empty, pdfs) -> 17 sheets, 10 pdfs, 0 extras, 2 empty."""
    r = pack_items(_large_items())
    assert r.total_sheets == 17
    assert r.num_pdfs == 10
    assert r.total_extras == 0
    assert r.total_empty == 2


def test_large_pdfs_first():
    """74 items, pdfs-first scoring -> 18 sheets, 9 pdfs, 10 extras, 1 empty.

    When pdfs is prioritized over sheets, the solver accepts 1 extra sheet
    and 10 extras to reduce from 10 to 9 PDFs.
    """
    r = pack_items(_large_items(), scoring=("pdfs", "sheets", "extras", "empty"))
    assert r.num_pdfs == 9
    assert r.total_sheets == 18
    assert r.total_extras == 10
    assert r.total_empty == 1


def test_large_sheets_then_empty():
    """74 items, sheets then empty -> 17 sheets, 15 pdfs, 1 extra, 1 empty.

    When empty is prioritized over extras, the solver accepts 1 extra to save 1 empty slot.
    """
    r = pack_items(_large_items(), scoring=("sheets", "empty", "extras", "pdfs"))
    assert r.total_sheets == 17
    assert r.total_empty == 1
    assert r.total_extras == 1
    assert r.num_pdfs == 15


def test_large_empty_first():
    """74 items, empty-first scoring -> 19 sheets, 12 pdfs, 20 extras, 0 empty.

    When empty is prioritized, the solver accepts more sheets and extras
    to eliminate empty slots entirely.
    """
    r = pack_items(_large_items(), scoring=("empty", "sheets", "pdfs", "extras"))
    assert r.total_empty == 0
    assert r.total_sheets == 19
    assert r.total_extras == 20
    assert r.num_pdfs == 12


def test_large_extras_then_pdfs():
    """74 items, sheets then extras then pdfs -> 17 sheets, 10 pdfs, 0 extras, 2 empty."""
    r = pack_items(_large_items(), scoring=("sheets", "extras", "pdfs", "empty"))
    assert r.total_sheets == 17
    assert r.num_pdfs == 10
    assert r.total_extras == 0
    assert r.total_empty == 2
