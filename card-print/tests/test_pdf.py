"""Tests for PDF generation."""
import tempfile
from pathlib import Path
import zlib, struct

from card_print.models import Item, SlotEntry, Page
from card_print.pdf import render_page


def _minimal_png():
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack(">IIBBBBB", 100, 100, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b'\x00' * 400)) + chunk(b'IEND', b'')


def test_render_page_creates_valid_pdf():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        img_path = tmp / "img1.png"
        img_path.write_bytes(_minimal_png())

        item = Item(0, "img1", img_path, 3)
        page = Page(
            entries=[
                SlotEntry(item=item, copies=4),
                SlotEntry(item=Item(1, "img2", img_path, 1), copies=3),
                SlotEntry(item=Item(2, "img3", img_path, 1), copies=2),
            ],
            print_count=1,
        )

        output = tmp / "test.pdf"
        render_page(page, output)

        assert output.exists()
        assert output.read_bytes()[:4] == b"%PDF"


def test_render_page_multiple_copies():
    """Same item appearing multiple times fills different cells."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        img_path = tmp / "img1.png"
        img_path.write_bytes(_minimal_png())

        item = Item(0, "img1", img_path, 9)
        page = Page(
            entries=[SlotEntry(item=item, copies=9)],
            print_count=1,
        )

        output = tmp / "full.pdf"
        render_page(page, output)
        assert output.read_bytes()[:4] == b"%PDF"
