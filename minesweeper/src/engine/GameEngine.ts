import {
  Cell,
  CellState,
  Direction,
  DIRECTION_DELTAS,
  GameConfig,
  GameState,
  GameStatus,
} from '../types';

export class GameEngine {
  private config: GameConfig;
  private grid: Cell[][];
  private status: GameStatus;
  private startTime: number | null;
  private endTime: number | null;
  private flagsPlaced: number;
  private cellsRevealed: number;
  private totalSafeCells: number;
  private playerPos: { row: number; col: number };

  constructor(config: GameConfig) {
    this.config = config;
    this.startTime = null;
    this.endTime = null;
    this.flagsPlaced = 0;
    this.cellsRevealed = 0;
    this.totalSafeCells = config.rows * config.cols - config.mines;
    this.playerPos = { row: 0, col: 0 };
    this.status = GameStatus.Idle;
    this.grid = this.initGrid();
  }

  private initGrid(): Cell[][] {
    const grid: Cell[][] = [];
    for (let r = 0; r < this.config.rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < this.config.cols; c++) {
        row.push({
          row: r,
          col: c,
          isMine: false,
          adjacentMines: 0,
          state: CellState.Hidden,
        });
      }
      grid.push(row);
    }
    return grid;
  }

  placeMines(safeRow: number, safeCol: number): void {
    if (this.status !== GameStatus.Idle) return;

    // Build set of safe zone positions (first-click cell + its 8 neighbors)
    const safeSet = new Set<string>();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = safeRow + dr;
        const nc = safeCol + dc;
        if (nr >= 0 && nr < this.config.rows && nc >= 0 && nc < this.config.cols) {
          safeSet.add(`${nr},${nc}`);
        }
      }
    }

    // Collect all positions not in the safe zone
    let candidates: { r: number; c: number }[] = [];
    for (let r = 0; r < this.config.rows; r++) {
      for (let c = 0; c < this.config.cols; c++) {
        if (!safeSet.has(`${r},${c}`)) {
          candidates.push({ r, c });
        }
      }
    }

    // If safe zone covers too much of the grid, shrink it to just the clicked cell
    if (candidates.length < this.config.mines) {
      candidates = [];
      for (let r = 0; r < this.config.rows; r++) {
        for (let c = 0; c < this.config.cols; c++) {
          if (!(r === safeRow && c === safeCol)) {
            candidates.push({ r, c });
          }
        }
      }
    }

    // Shuffle and pick first N as mines
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const mineCount = Math.min(this.config.mines, candidates.length);
    for (let i = 0; i < mineCount; i++) {
      this.grid[candidates[i].r][candidates[i].c].isMine = true;
    }

    this.calculateAdjacent();
    this.status = GameStatus.Playing;
    this.startTime = Date.now();
  }

  private calculateAdjacent(): void {
    for (let r = 0; r < this.config.rows; r++) {
      for (let c = 0; c < this.config.cols; c++) {
        if (this.grid[r][c].isMine) {
          this.grid[r][c].adjacentMines = -1;
          continue;
        }
        let count = 0;
        this.forEachNeighbor(r, c, (nr, nc) => {
          if (this.grid[nr][nc].isMine) count++;
        });
        this.grid[r][c].adjacentMines = count;
      }
    }
  }

  private forEachNeighbor(
    row: number,
    col: number,
    fn: (r: number, c: number) => void
  ): void {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < this.config.rows && nc >= 0 && nc < this.config.cols) {
          fn(nr, nc);
        }
      }
    }
  }

  reveal(row: number, col: number): void {
    // On first click (Idle), place mines with safe zone
    if (this.status === GameStatus.Idle) {
      this.placeMines(row, col);
    }

    if (this.status !== GameStatus.Playing) return;

    const cell = this.grid[row][col];
    if (cell.state !== CellState.Hidden && cell.state !== CellState.Flagged) return;
    // Remove flag if flagged
    if (cell.state === CellState.Flagged) {
      cell.state = CellState.Hidden;
      this.flagsPlaced--;
    }

    if (cell.isMine) {
      cell.state = CellState.Revealed;
      this.status = GameStatus.Lost;
      this.endTime = Date.now();
      // Reveal all mines
      for (let r = 0; r < this.config.rows; r++) {
        for (let c = 0; c < this.config.cols; c++) {
          if (this.grid[r][c].isMine && this.grid[r][c].state === CellState.Hidden) {
            this.grid[r][c].state = CellState.Revealed;
          }
        }
      }
      return;
    }

    // Non-mine cell
    if (cell.adjacentMines > 0) {
      cell.state = CellState.Revealed;
      this.cellsRevealed++;
    } else {
      // Flood-fill for zero cells
      const queue: { r: number; c: number }[] = [{ r: row, c: col }];
      const visited = new Set<string>();
      visited.add(`${row},${col}`);

      while (queue.length > 0) {
        const cur = queue.shift()!;
        const currentCell = this.grid[cur.r][cur.c];
        if (currentCell.state === CellState.Revealed) continue;

        // Remove flag if flagged
        if (currentCell.state === CellState.Flagged) {
          currentCell.state = CellState.Hidden;
          this.flagsPlaced--;
        }
        currentCell.state = CellState.Revealed;
        this.cellsRevealed++;

        // Only expand to neighbors for zero cells
        if (currentCell.adjacentMines === 0) {
          this.forEachNeighbor(cur.r, cur.c, (nr, nc) => {
            const key = `${nr},${nc}`;
            if (!visited.has(key)) {
              visited.add(key);
              const neighbor = this.grid[nr][nc];
              if (neighbor.state !== CellState.Revealed && !neighbor.isMine) {
                queue.push({ r: nr, c: nc });
              }
            }
          });
        }
      }
    }

    // Check win
    if (this.cellsRevealed === this.totalSafeCells) {
      this.status = GameStatus.Won;
      this.endTime = Date.now();
    }
  }

  toggleFlag(row: number, col: number): void {
    if (this.status !== GameStatus.Playing && this.status !== GameStatus.Idle) return;

    const cell = this.grid[row][col];
    if (cell.state === CellState.Revealed) return;

    if (cell.state === CellState.Hidden) {
      cell.state = CellState.Flagged;
      this.flagsPlaced++;
    } else if (cell.state === CellState.Flagged) {
      cell.state = CellState.Hidden;
      this.flagsPlaced--;
    }
  }

  moveCursor(direction: Direction): void {
    const delta = DIRECTION_DELTAS[direction];
    const newRow = Math.max(0, Math.min(this.config.rows - 1, this.playerPos.row + delta.dr));
    const newCol = Math.max(0, Math.min(this.config.cols - 1, this.playerPos.col + delta.dc));
    this.playerPos = { row: newRow, col: newCol };
  }

  newGame(config?: GameConfig): void {
    this.config = config ?? this.config;
    this.grid = this.initGrid();
    this.status = GameStatus.Idle;
    this.startTime = null;
    this.endTime = null;
    this.flagsPlaced = 0;
    this.cellsRevealed = 0;
    this.totalSafeCells = this.config.rows * this.config.cols - this.config.mines;
    this.playerPos = { row: 0, col: 0 };
  }

  getState(): GameState {
    const now = Date.now();
    let elapsedSeconds = 0;
    if (this.startTime !== null) {
      const end = this.endTime ?? now;
      elapsedSeconds = Math.floor((end - this.startTime) / 1000);
    }
    return {
      grid: this.grid,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      elapsedSeconds,
      flagsPlaced: this.flagsPlaced,
      cellsRevealed: this.cellsRevealed,
      totalSafeCells: this.totalSafeCells,
      playerPos: { ...this.playerPos },
    };
  }

  getConfig(): GameConfig {
    return { ...this.config };
  }
}