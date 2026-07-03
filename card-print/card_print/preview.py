"""Preview image generation for card print sheets."""
from __future__ import annotations
from pathlib import Path

from PIL import Image


def generate_preview(pdf_paths: list[Path], output_path: Path, dpi: int = 75) -> None:
    """Generate a combined preview image of all PDF pages.

    Each page is rendered at low resolution and arranged in a grid.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise ImportError("Preview requires PyMuPDF: pip install PyMuPDF")

    if not pdf_paths:
        return

    # Render each PDF page as a low-res image
    page_images = []
    for pdf_path in sorted(pdf_paths):
        doc = fitz.open(str(pdf_path))
        page = doc[0]
        pix = page.get_pixmap(dpi=dpi)
        # Convert to PIL Image
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        page_images.append(img)
        doc.close()

    if not page_images:
        return

    # Arrange in a grid (3 columns)
    cols = 3
    rows = (len(page_images) + cols - 1) // cols
    gap = 10  # pixels between pages

    # Calculate grid dimensions
    page_w = page_images[0].width
    page_h = page_images[0].height
    total_w = cols * page_w + (cols - 1) * gap
    total_h = rows * page_h + (rows - 1) * gap

    # Create combined image
    combined = Image.new("RGB", (total_w, total_h), (240, 240, 240))

    for i, img in enumerate(page_images):
        row = i // cols
        col = i % cols
        x = col * (page_w + gap)
        y = row * (page_h + gap)
        combined.paste(img, (x, y))

    combined.save(str(output_path))
