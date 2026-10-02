"""Integration test: full pipeline from CSV to PDF."""
import tempfile
from pathlib import Path
import zlib, struct

from card_print.parser import parse_input
from card_print.packer import pack_items
from card_print.pdf import render_page
from card_print.models import DEFAULT_SCORING


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
    """End-to-end: the spec example produces optimal results with default scoring."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        img_dir = tmp / "images"
        img_dir.mkdir()
        for i in range(1, 16):
            _create_png(img_dir / f"img{i}.png")

        csv_path = tmp / "test.csv"
        csv_path.write_text(
            "count\n"
            "3\n3\n3\n6\n6\n6\n"
            "1\n1\n1\n\n1\n1\n"
            "0\n1\n1\n"
        )

        items = parse_input(csv_path, img_dir)
        result = pack_items(items, scoring=DEFAULT_SCORING)

        assert result.total_sheets == 4
        assert result.total_extras == 0
        assert result.total_empty == 2
        assert result.num_pdfs == 2

        out_dir = tmp / "output"
        out_dir.mkdir()
        for i, page in enumerate(result.pages, 1):
            pdf_path = out_dir / f"p{i}x{page.print_count}.pdf"
            render_page(page, pdf_path)
            assert pdf_path.read_bytes()[:4] == b"%PDF"


def test_full_pipeline_custom_scoring():
    """End-to-end: custom scoring produces different results."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        img_dir = tmp / "images"
        img_dir.mkdir()
        for i in range(1, 8):
            _create_png(img_dir / f"img{i}.png")

        csv_path = tmp / "test.csv"
        csv_path.write_text("count\n5\n7\n")

        items = parse_input(csv_path, img_dir)

        # Default scoring: prefer 0 extras over fewer PDFs
        r_default = pack_items(items, scoring=DEFAULT_SCORING)
        assert r_default.total_extras == 0
        assert r_default.num_pdfs == 2

        # PDFs-first scoring: prefer fewer PDFs even with extras
        r_pdfs = pack_items(items, scoring=("sheets", "pdfs", "extras", "empty"))
        assert r_pdfs.num_pdfs <= r_default.num_pdfs

        # Both should have same sheets
        assert r_default.total_sheets == r_pdfs.total_sheets == 2

        # Generate PDFs for both
        for scoring_name, result in [("default", r_default), ("pdfs", r_pdfs)]:
            out_dir = tmp / f"output_{scoring_name}"
            out_dir.mkdir()
            for i, page in enumerate(result.pages, 1):
                pdf_path = out_dir / f"p{i}x{page.print_count}.pdf"
                render_page(page, pdf_path)
                assert pdf_path.read_bytes()[:4] == b"%PDF"


def test_png_format_requires_template(monkeypatch):
    """With no template resolvable, the built-in 3x3 renderer only emits PDF;
    asking for PNG used to write PDF bytes into files named .png.

    Points CARD_PRINT_TEMPLATES_DIR at an empty directory so the default
    template is unavailable — the state a fresh clone starts in.
    """
    from click.testing import CliRunner

    from card_print.__main__ import cli

    fixtures = Path(__file__).parent.parent / "fixtures"
    with tempfile.TemporaryDirectory() as empty_templates, \
            tempfile.TemporaryDirectory() as out:
        monkeypatch.setenv("CARD_PRINT_TEMPLATES_DIR", empty_templates)
        result = CliRunner().invoke(cli, [
            "-i", str(fixtures / "images"),
            "-c", str(fixtures / "test.csv"),
            "-o", out,
            "--format", "png",
        ])
        assert result.exit_code == 1
        assert "--format png requires a template" in result.output
        assert not list(Path(out).glob("*.png"))


def test_default_template_used_when_available(monkeypatch, tmp_path):
    """With a template directory present, --template may be omitted: the
    default is picked up and reported as such."""
    from click.testing import CliRunner

    from card_print.__main__ import cli
    from card_print.template import (
        DEFAULT_TEMPLATE_NAME, default_template_path, templates_dir,
    )

    # Resolve through the same discovery the CLI uses, so this skips (rather
    # than fails) when CARD_PRINT_TEMPLATES_DIR points somewhere without it.
    if default_template_path() is None:
        import pytest
        pytest.skip(f"default template not available in {templates_dir()}")

    fixtures = Path(__file__).parent.parent / "fixtures"
    out = tmp_path / "out"
    result = CliRunner().invoke(cli, [
        "-i", str(fixtures / "images"),
        "-c", str(fixtures / "test.csv"),
        "-o", str(out),
    ])
    assert result.exit_code == 0, result.output
    assert f"{DEFAULT_TEMPLATE_NAME} (default)" in result.output
    pdfs = list(out.glob("p*.pdf"))
    assert pdfs
    assert all(f.read_bytes()[:4] == b"%PDF" for f in pdfs)


def test_explicit_template_overrides_default(monkeypatch, tmp_path):
    """An explicit --template wins over the default, and isn't labelled
    as the default."""
    from click.testing import CliRunner

    from card_print.__main__ import cli

    from card_print.template import templates_dir

    other = templates_dir() / "siser_2-482x3-479_x1x8.png"
    if not other.exists():
        import pytest
        pytest.skip(f"template not available: {other}")

    fixtures = Path(__file__).parent.parent / "fixtures"
    out = tmp_path / "out"
    result = CliRunner().invoke(cli, [
        "-i", str(fixtures / "images"),
        "-c", str(fixtures / "test.csv"),
        "-o", str(out),
        "-t", str(other),
    ])
    assert result.exit_code == 0, result.output
    assert "siser_2-482x3-479_x1x8.png" in result.output
    assert "(default)" not in result.output
    assert "8 slots" in result.output
