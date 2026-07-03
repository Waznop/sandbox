"""CLI entry point for card-print."""
from __future__ import annotations
import sys
from pathlib import Path

import click

from .parser import parse_input
from .packer import pack_items
from .pdf import render_page
from .models import DEFAULT_SCORING, ALL_DIMENSIONS


@click.command()
@click.option("--images", "-i", required=True, type=click.Path(exists=True, file_okay=False, dir_okay=True),
              help="Directory containing card images")
@click.option("--csv", "-c", required=True, type=click.Path(exists=True, file_okay=True, dir_okay=False),
              help="CSV file with headers including 'count' column")
@click.option("--output", "-o", default=".", type=click.Path(file_okay=False, dir_okay=True),
              help="Output directory for PDFs (default: current directory)")
@click.option("--scoring", "-s", default=None,
              help="Scoring priority (comma-separated). Available: sheets, extras, empty, pdfs. "
                   "Default: sheets,extras,empty,pdfs")
@click.option("--preview", is_flag=True, default=False,
              help="Generate a preview image of all pages (low-res)")
@click.option("--dry-run", is_flag=True, default=False,
              help="Show packing plan without generating PDFs")
def cli(images: str, csv: str, output: str, scoring: str, preview: bool, dry_run: bool) -> None:
    """Pack card images into optimal print sheets."""
    image_dir = Path(images).resolve()
    csv_path = Path(csv).resolve()
    output_dir = Path(output).resolve()

    # Parse scoring config
    if scoring:
        dims = tuple(d.strip() for d in scoring.split(","))
        for d in dims:
            if d not in ALL_DIMENSIONS:
                click.echo(f"Error: unknown scoring dimension '{d}'. Available: {', '.join(sorted(ALL_DIMENSIONS))}", err=True)
                sys.exit(1)
        if len(dims) != len(set(dims)):
            click.echo("Error: scoring dimensions must be unique", err=True)
            sys.exit(1)
    else:
        dims = DEFAULT_SCORING

    click.echo(f"Reading images from: {image_dir}")
    click.echo(f"Reading CSV from: {csv_path}")
    click.echo(f"Scoring: {','.join(dims)}")
    items = parse_input(csv_path, image_dir)

    if not items:
        click.echo("Error: no valid items found", err=True)
        sys.exit(1)

    active = [it for it in items if it.demand > 0]
    skipped = [it for it in items if it.demand == 0]
    click.echo(f"Found {len(active)} item(s) to print"
               f"{f', {len(skipped)} skipped (count=0)' if skipped else ''}")

    result = pack_items(items, scoring=dims)

    if not result.pages:
        click.echo("No pages to generate (all counts are 0)")
        return

    click.echo(f"\n{result.summary()}")

    if dry_run:
        click.echo("\n(Dry run — no PDFs generated)")
        return

    output_dir.mkdir(parents=True, exist_ok=True)

    # Clean old PDFs from previous runs
    for old_pdf in output_dir.glob("p*.pdf"):
        old_pdf.unlink()

    pdf_paths: list[Path] = []
    for i, page in enumerate(result.pages, 1):
        filename = f"p{i}x{page.print_count}.pdf"
        output_path = output_dir / filename
        render_page(page, output_path)
        pdf_paths.append(output_path)
        click.echo(f"  Written: {output_path} ({page.used_slots}/9 slots)")

    click.echo(f"\nDone! {result.num_pdfs} PDF(s) in {output_dir}")
    if result.total_sheets > result.num_pdfs:
        click.echo(f"Total print jobs: {result.total_sheets} sheet(s)")

    # Generate preview if requested
    if preview:
        try:
            from .preview import generate_preview
            preview_path = output_dir / "preview.png"
            generate_preview(pdf_paths, preview_path)
            click.echo(f"  Preview: {preview_path}")
        except ImportError:
            click.echo("  (Preview requires PyMuPDF: pip install PyMuPDF)", err=True)


if __name__ == "__main__":
    cli()
