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


def test_duplicate_stems_resolve_deterministically(tmp_path):
    """img1.jpg and img1.png both match 'img1' — pick must not depend on
    directory iteration order."""
    from PIL import Image
    for ext in (".png", ".jpg", ".webp"):
        Image.new("RGB", (10, 10)).save(tmp_path / f"img1{ext}")
    csv_path = tmp_path / "c.csv"
    csv_path.write_text("count\n1\n")

    picks = {parse_input(csv_path, tmp_path)[0].path.name for _ in range(5)}
    assert picks == {"img1.jpg"}  # first in sorted order
