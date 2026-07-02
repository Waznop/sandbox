"""Tests for data models."""
from pathlib import Path
from card_print.models import Item, SlotEntry, Page, PackResult


def test_item_creation():
    item = Item(index=0, name="img1", path=Path("/fake/img1.png"), demand=3)
    assert item.index == 0
    assert item.demand == 3


def test_slot_entry():
    entry = SlotEntry(item=Item(0, "img1", Path("/a.png"), 3), copies=2)
    assert entry.copies == 2


def test_page_calculations():
    item = Item(0, "img1", Path("/a.png"), 6)
    entry = SlotEntry(item=item, copies=3)
    page = Page(entries=[entry], print_count=2)
    assert page.used_slots == 3
    assert page.empty_slots == 6
    assert page.printed_copies == {item.name: 6}  # 3 copies * print_count 2


def test_page_printed_copies():
    """Printed copies = copies * print_count."""
    item = Item(0, "img1", Path("/a.png"), 4)
    entry = SlotEntry(item=item, copies=3)
    page = Page(entries=[entry], print_count=2)
    assert page.printed_copies == {item.name: 6}


def test_pack_result_sheets():
    result = PackResult(pages=[
        Page(entries=[], print_count=3),
        Page(entries=[], print_count=1),
    ])
    assert result.total_sheets == 4
    assert result.num_pdfs == 2


def test_pack_result_summary():
    item = Item(0, "img1", Path("/a.png"), 3)
    page = Page(entries=[SlotEntry(item=item, copies=1)], print_count=3)
    result = PackResult(pages=[page])
    summary = result.summary()
    assert "1 PDF" in summary
    assert "3 sheet" in summary
