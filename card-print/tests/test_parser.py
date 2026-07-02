"""Tests for CSV and image parsing."""
from pathlib import Path
from card_print.parser import parse_input

FIXTURES = Path(__file__).parent.parent / "fixtures"


def test_parse_csv_and_images():
    items = parse_input(FIXTURES / "test.csv", FIXTURES / "images")
    names = [it.name for it in items]
    demands = [it.demand for it in items]
    assert names == ["img1", "img2", "img3", "img4", "img5", "img6"]
    assert demands == [3, 0, 1, 1, 2, 6]
    assert all(isinstance(it.path, Path) for it in items)


def test_parse_empty_count_defaults_to_one():
    items = parse_input(FIXTURES / "test.csv", FIXTURES / "images")
    img4 = next(it for it in items if it.name == "img4")
    assert img4.demand == 1


def test_parse_zero_count_kept():
    items = parse_input(FIXTURES / "test.csv", FIXTURES / "images")
    img2 = next(it for it in items if it.name == "img2")
    assert img2.demand == 0
