"""The page label must sit below the cards, never printed across them.

It used to be drawn at a fixed 0.3" from the page bottom, but most
templates leave less margin than that under the lowest card, so the
"Print 2x | 9/9 slots" line landed inside the printed cards.
"""
from dataclasses import dataclass

import pytest

from card_print.renderer import (
    _CAP_HEIGHT_RATIO, _LABEL_MAX_PT, _LABEL_MIN_PT, _label_placement,
)
from card_print.template_models import CardSlot


@dataclass
class _FakeTemplate:
    """Just the geometry _label_placement reads."""
    page_width: int
    page_height: int
    slots: list
    dpi: float = 600.0


def _template(page_height: int, lowest_bottom: int, n: int = 2):
    slots = [
        CardSlot(index=i, x=0, y=lowest_bottom - 100, width=100,
                 height=100, rotation=0)
        for i in range(n)
    ]
    return _FakeTemplate(page_width=5100, page_height=page_height, slots=slots)


def _band_pt(template, page_h_inches):
    lowest = max(s.bottom for s in template.slots)
    return page_h_inches * 72.0 * (1.0 - lowest / template.page_height)


def test_label_sits_entirely_below_the_cards():
    """The regression: a 0.25" band is narrower than the old 0.3" offset."""
    tmpl = _template(page_height=6600, lowest_bottom=6450)  # 0.25" band
    page_h_inches = 11.0

    baseline, font_size = _label_placement(tmpl, page_h_inches)
    band = _band_pt(tmpl, page_h_inches)

    assert band == pytest.approx(18.0)
    assert baseline > 0, "label must not hang off the bottom of the page"
    text_top = baseline + _CAP_HEIGHT_RATIO * font_size
    assert text_top < band, (
        f"label top {text_top:.2f}pt reaches into the cards (band {band:.2f}pt)"
    )
    # The old hardcoded placement would have failed exactly here.
    assert 0.3 * 72 > band, "fixture should reproduce the original overprint"


def test_label_centred_in_the_band():
    tmpl = _template(page_height=6600, lowest_bottom=6450)
    baseline, font_size = _label_placement(tmpl, 11.0)
    band = _band_pt(tmpl, 11.0)
    visual_centre = baseline + (_CAP_HEIGHT_RATIO * font_size) / 2
    assert visual_centre == pytest.approx(band / 2, abs=0.01)


def test_label_shrinks_to_fit_a_tight_band():
    """A short band gets smaller text rather than an overlapping label."""
    tight = _template(page_height=6600, lowest_bottom=6489)   # 0.185"
    roomy = _template(page_height=11400, lowest_bottom=11100)  # 0.5"

    tight_size = _label_placement(tight, 11.0)[1]
    roomy_size = _label_placement(roomy, 19.0)[1]

    assert tight_size < roomy_size
    assert roomy_size == _LABEL_MAX_PT, "a roomy band should use full size"
    assert tight_size >= _LABEL_MIN_PT


def test_label_never_exceeds_max_size():
    huge = _template(page_height=6600, lowest_bottom=3000)
    assert _label_placement(huge, 11.0)[1] == _LABEL_MAX_PT


def test_label_suppressed_when_band_too_short():
    """No room for legible text — drop the label instead of overprinting."""
    cramped = _template(page_height=6600, lowest_bottom=6590)
    assert _label_placement(cramped, 11.0) is None


def test_label_suppressed_when_cards_reach_the_page_edge():
    flush = _template(page_height=6600, lowest_bottom=6600)
    assert _label_placement(flush, 11.0) is None


def test_no_slots_gives_no_label():
    empty = _FakeTemplate(page_width=5100, page_height=6600, slots=[])
    assert _label_placement(empty, 11.0) is None


def test_lowest_slot_determines_the_band():
    """A stray low card, not the first one, defines the usable band."""
    slots = [
        CardSlot(index=0, x=0, y=100, width=100, height=100, rotation=0),
        CardSlot(index=1, x=0, y=6350, width=100, height=100, rotation=0),
    ]
    tmpl = _FakeTemplate(page_width=5100, page_height=6600, slots=slots)
    baseline, font_size = _label_placement(tmpl, 11.0)
    band = 11.0 * 72.0 * (1.0 - 6450 / 6600)
    assert baseline + _CAP_HEIGHT_RATIO * font_size < band
