"""Tests for template data models."""
from pathlib import Path

from card_print.template_models import CardSlot, Template


def test_card_slot_properties():
    slot = CardSlot(index=0, x=100, y=200, width=500, height=700, rotation=0)
    assert slot.right == 600
    assert slot.bottom == 900


def test_card_slot_rotation():
    slot = CardSlot(index=0, x=0, y=0, width=100, height=200, rotation=90)
    assert slot.rotation == 90


def test_template_slots_per_page():
    slots = [CardSlot(i, 0, 0, 100, 100, rotation=0) for i in range(9)]
    template = Template(
        path=Path("/tmp/test.png"),
        page_width=500,
        page_height=700,
        slots=slots,
        overlay=None,
        base_image=None,
    )
    assert template.slots_per_page == 9
    assert template.dpi == 300
