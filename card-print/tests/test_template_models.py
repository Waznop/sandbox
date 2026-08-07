"""Tests for template data models."""
from pathlib import Path

from PIL import Image

from card_print.template import _read_dpi
from card_print.template_models import DEFAULT_DPI, CardSlot, Template


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
    assert template.dpi == DEFAULT_DPI


def _template(page_width: int, page_height: int, dpi: int) -> Template:
    return Template(
        path=Path("/tmp/test.png"),
        page_width=page_width,
        page_height=page_height,
        slots=[],
        overlay=None,
        base_image=None,
        dpi=dpi,
    )


def test_page_size_in_inches_uses_template_dpi():
    """A 600 DPI letter template must not be read as a 17x22" page."""
    t = _template(5100, 6600, 600)
    assert (t.page_width / t.dpi, t.page_height / t.dpi) == (8.5, 11.0)

    t300 = _template(2550, 3300, 300)
    assert (t300.page_width / t300.dpi, t300.page_height / t300.dpi) == (8.5, 11.0)


def test_read_dpi_rounds_png_metadata(tmp_path):
    """PNG stores pixels-per-metre, so 600 DPI round-trips as 599.9988."""
    path = tmp_path / "t.png"
    Image.new("RGB", (10, 10)).save(path, dpi=(600, 600))
    assert _read_dpi(Image.open(path)) == 600


def test_read_dpi_falls_back_without_metadata(tmp_path):
    path = tmp_path / "t.png"
    Image.new("RGB", (10, 10)).save(path)
    assert _read_dpi(Image.open(path)) == DEFAULT_DPI
