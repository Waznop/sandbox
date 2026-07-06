"""Template-based rendering — composites card images onto templates."""
from __future__ import annotations
from pathlib import Path

import numpy as np
from PIL import Image

from .models import Page
from .template_models import Template, CardSlot


def render_template_page(
    template: Template,
    page: Page,
    output_path: Path,
    fmt: str = "png",
) -> None:
    """Render a page using a custom template.

    For each slot in the page, the corresponding card image is:
    1. Resized to fill the full slot (borders inclusive)
    2. Pasted onto the canvas at the slot position
    3. Template overlay pixels (borders, decorations) are restored on top

    Args:
        template: Parsed template with card slot geometry
        page: Page with slot entries and print count
        output_path: Output file path
        fmt: Output format ('png' or 'pdf')
    """
    # Start with the base image (green already replaced with white)
    canvas = template.base_image.copy()
    overlay_mask = template.overlay

    # Expand entries into slot assignments
    slot_images: list[Path | None] = [None] * template.slots_per_page
    slot_idx = 0
    for entry in page.entries:
        for _ in range(entry.copies):
            if slot_idx < template.slots_per_page:
                slot_images[slot_idx] = entry.item.path
                slot_idx += 1

    # Composite each card image into its slot (borders inclusive)
    for i, img_path in enumerate(slot_images):
        if img_path is None:
            continue  # Empty slot — leave as white

        slot = template.slots[i]
        _composite_card(canvas, img_path, slot)

    # Restore overlay pixels (borders, decorations) on top
    orig_img = np.array(Image.open(template.path).convert("RGBA"))
    canvas[overlay_mask] = orig_img[overlay_mask]

    # Save
    img = Image.fromarray(canvas)

    if fmt.lower() == "png":
        img.save(str(output_path), "PNG")
    elif fmt.lower() == "pdf":
        _render_to_pdf(img, template, output_path, page)
    else:
        raise ValueError(f"Unsupported format: {fmt}")


def _composite_card(
    canvas: np.ndarray,
    img_path: Path,
    slot: CardSlot,
) -> None:
    """Resize and composite a card image into a template slot (borders inclusive).

    The image is resized to exactly fill the slot's full dimensions
    (including border pixels). Border pixels are restored later by
    the overlay mask compositing step.
    """
    # Load and rotate card image according to slot's rotation
    card_img = Image.open(img_path).convert("RGB")
    if slot.rotation == 90:
        card_img = card_img.transpose(Image.ROTATE_270)  # PIL uses CCW, so 270 = 90 CW
    elif slot.rotation == 180:
        card_img = card_img.transpose(Image.ROTATE_180)
    elif slot.rotation == 270:
        card_img = card_img.transpose(Image.ROTATE_90)  # PIL uses CCW, so 90 = 270 CW
    # Resize to fill the entire slot (borders inclusive)
    card_img = card_img.resize((slot.width, slot.height), Image.LANCZOS)
    card_arr = np.array(card_img)

    # Define slot bounds
    y1, y2 = slot.y, slot.y + slot.height
    x1, x2 = slot.x, slot.x + slot.width

    # Paste card image into slot area on canvas
    # Only write RGB channels, preserve alpha
    canvas[y1:y2, x1:x2, 0] = card_arr[:, :, 0]
    canvas[y1:y2, x1:x2, 1] = card_arr[:, :, 1]
    canvas[y1:y2, x1:x2, 2] = card_arr[:, :, 2]


def _render_to_pdf(
    img: Image.Image,
    template: Template,
    output_path: Path,
    page: Page,
) -> None:
    """Render a template page to PDF using reportlab.

    Converts the composited image to PDF at the template's native resolution.
    """
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas

    # Save temp PNG then embed in PDF
    temp_png = output_path.with_suffix(".tmp.png")
    img_rgb = img.convert("RGB")
    img_rgb.save(str(temp_png), "PNG")

    # Calculate page size from template dimensions
    dpi = template.dpi
    page_w_inches = template.page_width / dpi
    page_h_inches = template.page_height / dpi

    c = canvas.Canvas(str(output_path),
                       pagesize=(page_w_inches * inch, page_h_inches * inch))

    # Draw the image to fill the page
    c.drawImage(
        str(temp_png),
        0, 0,
        width=page_w_inches * inch,
        height=page_h_inches * inch,
        preserveAspectRatio=False,
    )

    # Add print count annotation
    if page.print_count > 1:
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(
            (page_w_inches / 2) * inch,
            0.3 * inch,
            f"Print {page.print_count}x  |  {page.used_slots}/{template.slots_per_page} slots"
        )

    c.save()
    temp_png.unlink()  # Clean up temp file
