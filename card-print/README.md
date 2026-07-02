# card-print

CLI tool for packing card images into optimal print sheets.

## Install

```bash
cd card-print
pip install -e .
```

## Usage

```bash
card-print --images ./cards --csv ./counts.csv --output ./pdfs
```

### Options

| Flag | Required | Description |
|------|----------|-------------|
| `--images`, `-i` | yes | Directory with card images |
| `--csv`, `-c` | yes | CSV file with `count` column |
| `--output`, `-o` | no | Output directory (default: `.`) |
| `--dry-run` | no | Show plan without generating PDFs |

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

PDFs named `p{N}x{C}.pdf` where N = page number, C = print count.
Each PDF: 3×3 grid on letter paper (8.5 × 11"), 0.5" margins.

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
