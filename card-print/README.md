# card-print

CLI tool for packing card images into optimal print sheets.

## Install

The dependencies (click, reportlab, Pillow, numpy) aren't available system-wide,
so install into a virtualenv in the repo:

```bash
cd card-print
python3 -m venv .venv
.venv/bin/pip install -e .
```

That creates the `card-print` command inside the venv. Either activate the venv
(`source .venv/bin/activate`) and run `card-print`, or call it by path without
activating:

```bash
.venv/bin/card-print --help
```

`.venv/bin/python -m card_print` works too and is equivalent.

This only needs doing once — `-e` is an editable install, so code changes take
effect without reinstalling.

## Usage

```bash
card-print --images ./cards --csv ./counts.csv --output ./pdfs
```

With a custom template:

```bash
card-print -i ./cards -c ./counts.csv -o ./pdfs -t ./templates/2-5x3-5_x9.png
```

### Options

| Flag | Required | Description |
|------|----------|-------------|
| `--images`, `-i` | yes | Directory with card images |
| `--csv`, `-c` | yes | CSV file with `count` column |
| `--output`, `-o` | no | Output directory (default: `.`) |
| `--template`, `-t` | no | Template **PNG** for a custom layout (default: `2-5x3-5_x9.png`, see below) |
| `--format` | no | `pdf` (default) or `png` — `png` requires `--template` |
| `--scoring`, `-s` | no | Comma-separated solver priority (default: `sheets,extras,empty,pdfs`) |
| `--preview` | no | Also write a low-res `preview.png` of all pages |
| `--dry-run` | no | Show plan without generating files |

### Templates

Templates live in `templates/`. They are **not tracked in git** (they're
binary assets), so a fresh clone starts without them — copy them in, or point
`CARD_PRINT_TEMPLATES_DIR` elsewhere, which is what the integration tests read.
Those tests skip (visibly) when no templates are present.

Without `--template`, the tool uses **`2-5x3-5_x9.png`** (9-up 2.5×3.5" cards,
letter, 600 DPI) from that directory. Because templates are untracked, that
default can be absent on a fresh clone — then it falls back to the built-in 3×3
grid and says so in its output. Either way `--template` overrides it.

`--template` takes a **PNG**, not a PDF — the parser detects card slots by
scanning pixel colors, so a vector PDF can't be read. If your template set ships
both, point at the PNG copy.

Color convention in the template image:

| Color | Meaning |
|-------|---------|
| Red `(255,0,0)` | Corner/border marks of a card's content area |
| Green `(0,255,0)` | Content area to be replaced by the card image |
| Blue `(0,0,255)` | Grid lines (borders, dividers) |
| Anything else | Overlay art, preserved on top of the card |

Slot count and page size come from the template, so the packer adapts to layouts
other than 9-up automatically.

### CSV Format

First row must be headers including `count`. Each row maps to an image:

```csv
name,count,notes
img1,3,print 3 copies
img2,0,skip
img3,,defaults to 1
```

- Empty count → defaults to 1
- `0` → item is skipped
- Image names must match files in the images directory

### Output

Files named `p{N}x{C}.pdf` where N = page number, C = how many copies of that
sheet to print — so `p1x3.pdf` gets printed 3 times.

Layout and page size come from the template — by default `2-5x3-5_x9.png`
(9-up on letter). When no template is installed, the built-in fallback is a 3×3
grid on letter paper (8.5 × 11"), 0.5" margins.

**Note:** on each run the output directory is cleaned of `p*.pdf` (or `p*.png`
with `--format png`) from previous runs, so point `--output` at a dedicated
folder rather than one holding files you want to keep.

### Algorithm

Items can appear multiple times per page and span pages with different print counts.
The solver minimizes: total sheets → over-printed extras → empty slots → number of PDFs.

Uses iterative deepening from `ceil(total_demand/9)` sheets upward, trying integer
partitions as page print counts with greedy first-fit fill per page.

### Future

- Configurable paper size (A4, legal, custom)
- Configurable grid (2×2, 4×3, etc.)
- Adjustable margins
- Image borders and labels
