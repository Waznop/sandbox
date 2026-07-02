"""Tests for the packing algorithm — 14 cases."""
from card_print.models import Item
from card_print.packer import pack_items


def _items(counts):
    return [Item(i, f"img{i+1}", f"/img{i+1}.png", c) for i, c in enumerate(counts)]


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
    """5,7 -> 2 sheets, 0 extras, 6 empty (split demand: img2x7+img1x2 on p1, img1x3 on p2)."""
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
    """18,3,3,3 -> 3 sheets, 0 extras, 0 empty (p1x3: img1x6, rest x1)."""
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
    """8x9 -> 8 sheets, 0 extras, 0 empty (p1x8: all x1)."""
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
