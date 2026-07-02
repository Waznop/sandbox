"""Integration test: full pipeline from CSV to PDF."""
import tempfile
from pathlib import Path
import zlib, struct

from card_print.parser import parse_input
from card_print.packer import pack_items
from card_print.pdf import render_page


def _create_png(path: Path) -> None:
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    path.write_bytes(
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack(">IIBBBBB", 100, 100, 8, 6, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(b'\x00' * 400))
        + chunk(b'IEND', b'')
    )


def test_full_pipeline_spec_example():
    """End-to-end: the spec example produces optimal results."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        img_dir = tmp / "images"
        img_dir.mkdir()
        for i in range(1, 16):
            _create_png(img_dir / f"img{i}.png")

        csv_path = tmp / "test.csv"
        csv_path.write_text(
            "name,count\n"
            "img1,3\nimg2,3\nimg3,3\nimg4,6\nimg5,6\nimg6,6\n"
            "img7,1\nimg8,1\nimg9,1\nimg10,\nimg11,1\nimg12,1\n"
            "img13,0\nimg14,1\nimg15,1\n"
        )

        items = parse_input(csv_path, img_dir)
        result = pack_items(items)

        assert result.total_sheets == 4
        assert result.total_extras == 0
        assert result.total_empty == 1
        assert result.num_pdfs == 2

        out_dir = tmp / "output"
        out_dir.mkdir()
        for i, page in enumerate(result.pages, 1):
            pdf_path = out_dir / f"p{i}x{page.print_count}.pdf"
            render_page(page, pdf_path)
            assert pdf_path.read_bytes()[:4] == b"%PDF"
