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
@click.option("--template", "-t", default=None,
              type=click.Path(exists=True, file_okay=True, dir_okay=False),
              help="Path to a custom template PNG file. "
                   "If not provided, uses the default 3x3 layout.")
@click.option("--format", "output_format", default="pdf",
              type=click.Choice(["pdf", "png"]),
              help="Output format (default: pdf)")
def cli(images: str, csv: str, output: str, scoring: str, preview: bool,
        dry_run: bool, template: str, output_format: str) -> None:
    """Pack card images into optimal print sheets.

    Supports custom templates (PNG files with color-coded markers)
    for arbitrary card layouts, or the default 3x3 grid.
    """
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

    # Parse template or use default
    tmpl = None
    slots_per_page = 9
    if template:
        from .template import parse_template as parse_template_file
        tmpl = parse_template_file(Path(template).resolve())
        slots_per_page = tmpl.slots_per_page
        click.echo(f"Template: {tmpl.path} ({slots_per_page} slots, "
                   f"{tmpl.page_width}x{tmpl.page_height})")

    result = pack_items(items, scoring=dims, slots_per_page=slots_per_page)

    if not result.pages:
        click.echo("No pages to generate (all counts are 0)")
        return

    click.echo(f"\n{result.summary()}")

    if dry_run:
        click.echo(f"\n(Dry run — no files generated)")
        return

    output_dir.mkdir(parents=True, exist_ok=True)

    # Clean old files from previous runs
    ext = output_format
    for old_file in output_dir.glob(f"p*.{ext}"):
        old_file.unlink()

    output_paths: list[Path] = []
    for i, page in enumerate(result.pages, 1):
        filename = f"p{i}x{page.print_count}.{ext}"
        output_path = output_dir / filename

        if tmpl:
            from .renderer import render_template_page
            render_template_page(tmpl, page, output_path, fmt=output_format)
        else:
            render_page(page, output_path)

        output_paths.append(output_path)
        click.echo(f"  Written: {output_path} ({page.used_slots}/{page.slots_per_page} slots)")

    click.echo(f"\nDone! {result.num_pdfs} file(s) in {output_dir}")
    if result.total_sheets > result.num_pdfs:
        click.echo(f"Total print jobs: {result.total_sheets} sheet(s)")

    # Generate preview if requested
    if preview:
        try:
            from .preview import generate_preview
            preview_path = output_dir / "preview.png"
            generate_preview(output_paths, preview_path)
            click.echo(f"  Preview: {preview_path}")
        except ImportError as e:
            click.echo(f"  (Preview error: {e})", err=True)


if __name__ == "__main__":
    cli()
