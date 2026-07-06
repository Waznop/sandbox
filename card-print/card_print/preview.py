"""Preview image generation for card print sheets."""
from __future__ import annotations
from pathlib import Path

from PIL import Image


def generate_preview(output_paths: list[Path], output_path: Path, dpi: int = 150) -> None:
    """Generate a combined preview image of all output pages.

    Supports both PDF and PNG inputs. PDFs are rendered at low DPI,
    PNGs are resized down.
    """
    if not output_paths:
        return

    page_images = []

    for output_path_item in sorted(output_paths):
        if output_path_item.suffix.lower() == ".pdf":
            try:
                import fitz  # PyMuPDF
            except ImportError:
                raise ImportError("PDF preview requires PyMuPDF: pip install PyMuPDF")

            doc = fitz.open(str(output_path_item))
            page = doc[0]
            pix = page.get_pixmap(dpi=dpi)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            doc.close()
        else:
            # PNG or other image format — resize down
            img = Image.open(str(output_path_item))
            # Scale down proportionally to match DPI reduction
            scale = dpi / 300  # Assume original is 300 DPI
            new_size = (int(img.width * scale), int(img.height * scale))
            img = img.resize(new_size, Image.LANCZOS)

        page_images.append(img)

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
