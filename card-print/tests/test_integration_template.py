"""Integration tests with real template files."""
import tempfile
from pathlib import Path
from PIL import Image
import numpy as np

from card_print.template import parse_template
from card_print.renderer import render_template_page
from card_print.models import Page, SlotEntry, Item
from card_print.packer import pack_items


TEMPLATES_DIR = Path("/Users/hongtai/Downloads/print-templates/templates-png")


def test_parse_siser_x1x8():
    """Parse the siser 2x4 template (8 cards)."""
    path = TEMPLATES_DIR / "siser_2-482x3-479_x1x8.png"
    if not path.exists():
        return
    template = parse_template(path)
    assert template.slots_per_page == 8
    assert template.page_width == 2550
    assert template.page_height == 3300


def test_parse_ccborder_x9():
    """Parse the ccborder 3x3 template (9 cards)."""
    path = TEMPLATES_DIR / "ccborder_2-36x3-54_x9.png"
    if not path.exists():
        return
    template = parse_template(path)
    assert template.slots_per_page == 9
    assert template.page_width == 5100
    assert template.page_height == 6600


def test_parse_25_card_template():
    """Parse the 5x5 template (25 cards)."""
    path = TEMPLATES_DIR / "2-5x3-5_x25.png"
    if not path.exists():
        return
    template = parse_template(path)
    assert template.slots_per_page == 25
    assert template.page_width == 7800
    assert template.page_height == 11400


def test_parse_siser_x18():
    """Parse the siser 3x6 template (18 cards)."""
    path = TEMPLATES_DIR / "siser_2-482x3-479_x18.png"
    if not path.exists():
        return
    template = parse_template(path)
    assert template.slots_per_page == 18
    assert template.page_width == 3300
    assert template.page_height == 5100


def test_parse_siser_x9():
    """Parse the siser 3x3 template (9 cards)."""
    path = TEMPLATES_DIR / "siser_2-482x3-479_x9.png"
    if not path.exists():
        return
    template = parse_template(path)
    assert template.slots_per_page == 9
    assert template.page_width == 2550
    assert template.page_height == 3300


def test_parse_2_5x3_5_x9():
    """Parse the 2-5x3-5 3x3 template (9 cards)."""
    path = TEMPLATES_DIR / "2-5x3-5_x9.png"
    if not path.exists():
        return
    template = parse_template(path)
    assert template.slots_per_page == 9
    assert template.page_width == 5100
    assert template.page_height == 6600


def test_end_to_end_with_ccborder():
    """Full pipeline: parse template → pack → render."""
    path = TEMPLATES_DIR / "ccborder_2-36x3-54_x9.png"
    if not path.exists():
        return

    template = parse_template(path)

    # Create test card images
    tmpdir = Path(tempfile.mkdtemp())
    items = []
    for i in range(9):
        card_path = tmpdir / f"img{i + 1}.png"
        img = Image.new("RGB", (300, 400), (i * 28, i * 30, i * 32))
        img.save(str(card_path))
        items.append(Item(index=i, name=f"img{i + 1}", path=card_path, demand=1))

    # Pack
    result = pack_items(items, slots_per_page=template.slots_per_page)
    assert result.is_valid()

    # Render
    for i, page in enumerate(result.pages):
        output = tmpdir / f"page{i + 1}.png"
        render_template_page(template, page, output, fmt="png")
        assert output.exists()

        # Verify output dimensions match template
        result_img = Image.open(output)
        assert result_img.size == (template.page_width, template.page_height)


def test_end_to_end_with_siser_x1x8():
    """Full pipeline with 8-card siser template."""
    path = TEMPLATES_DIR / "siser_2-482x3-479_x1x8.png"
    if not path.exists():
        return

    template = parse_template(path)

    tmpdir = Path(tempfile.mkdtemp())
    items = []
    for i in range(8):
        card_path = tmpdir / f"img{i + 1}.png"
        img = Image.new("RGB", (400, 300), (i * 30, i * 20, i * 25))
        img.save(str(card_path))
        items.append(Item(index=i, name=f"img{i + 1}", path=card_path, demand=1))

    result = pack_items(items, slots_per_page=template.slots_per_page)
    assert result.is_valid()

    for i, page in enumerate(result.pages):
        output = tmpdir / f"page{i + 1}.png"
        render_template_page(template, page, output, fmt="png")
        assert output.exists()
        result_img = Image.open(output)
        assert result_img.size == (template.page_width, template.page_height)
