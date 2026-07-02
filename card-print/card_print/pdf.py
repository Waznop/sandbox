"""PDF generation for card print sheets."""
from __future__ import annotations
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

from .models import Page


MARGIN = 0.5 * inch
GRID_COLS = 3
GRID_ROWS = 3


def _cell_geometry() -> tuple[float, float, float, float]:
    """Return (cell_w, cell_h, page_w, page_h)."""
    pw, ph = letter
    return ((pw - 2*MARGIN)/GRID_COLS, (ph - 2*MARGIN)/GRID_ROWS, pw, ph)


def render_page(page: Page, output_path: Path) -> None:
    """Render a 3x3 grid of card images to a PDF.

    Each SlotEntry's copies are placed in sequential cells (left->right, top->down).
    Images are scaled to fit within their cell, maintaining aspect ratio.
    """
    cell_w, cell_h, pw, ph = _cell_geometry()
    c = canvas.Canvas(str(output_path), pagesize=letter)

    # Footer: print count annotation
    if page.print_count > 1:
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(pw / 2, 0.3 * inch,
                           f"Print {page.print_count}x  |  {page.used_slots}/9 slots")

    # Expand entries into individual cell placements
    cell_idx = 0
    for entry in page.entries:
        for _ in range(entry.copies):
            col = cell_idx % GRID_COLS
            row = cell_idx // GRID_COLS
            x = MARGIN + col * cell_w
            y = ph - MARGIN - (row + 1) * cell_h

            # Cell border
            c.setStrokeColorRGB(0.85, 0.85, 0.85)
            c.setLineWidth(0.5)
            c.rect(x, y, cell_w, cell_h, fill=0)

            # Image fitted to cell
            try:
                with PILImage.open(str(entry.item.path)) as img:
                    iw, ih = img.size
                    ir = iw / ih
                    cr = cell_w / cell_h
                    if ir > cr:
                        dw = cell_w * 0.95
                        dh = dw / ir
                    else:
                        dh = cell_h * 0.95
                        dw = dh * ir
                    dx = x + (cell_w - dw) / 2
                    dy = y + (cell_h - dh) / 2
                    c.drawImage(str(entry.item.path), dx, dy,
                               width=dw, height=dh,
                               preserveAspectRatio=True, anchor='c')
            except Exception:
                c.setFont("Helvetica", 8)
                c.drawCentredString(x + cell_w/2, y + cell_h/2, entry.item.name)

            cell_idx += 1

    c.save()
