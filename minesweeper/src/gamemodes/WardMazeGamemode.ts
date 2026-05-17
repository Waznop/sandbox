import { Gamemode } from '../types';
import type { Cell, GameConfig } from '../types';
import type { IGamemode } from './IGamemode';

/**
 * Ward Maze — Navigate a minefield using mobile sensor tiles.
 *
 * Core loop: Pathfinding through hidden danger with limited intel.
 * - Player starts at bottom-left, goal is top-right
 * - 3 "ward" tiles act as mobile minesweeper sensors
 * - Tap a ward, then tap anywhere to move it there (counts as 1 move)
 * - Tap yourself, then tap an adjacent empty cell to move (1 move)
 * - Wards show the number of adjacent mines (like classic minesweeper)
 * - If a ward lands on a mine, the ward is destroyed and the mine revealed
 * - If the player steps on an undetected mine → game over
 * - Stepping on a ward-revealed safe cell is always safe
 * - Win by reaching the goal cell in the fewest moves
 */
export class WardMazeGamemode implements IGamemode {
  readonly modeName = 'Ward Maze';
  readonly icon = '🗺️';

  getMode(): Gamemode { return Gamemode.WardMaze; }

  private wardCount = 3;
  private playerPos: { row: number; col: number } = { row: 0, col: 0 };
  private goalPos: { row: number; col: number } = { row: 0, col: 0 };
  private wards: { row: number; col: number }[] = [];
  private moves = 0;
  private selectedWardIndex: number | null = null;
  private playerSelected = false;

  // Track which cells have been revealed safe by a ward
  private safeCells = new Set<string>();

  private rows = 0;
  private cols = 0;

  init(grid: Cell[][]): void {
    this.rows = grid.length;
    this.cols = grid[0].length;

    // Player starts at bottom-left
    this.playerPos = { row: this.rows - 1, col: 0 };
    // Goal is at top-right
    this.goalPos = { row: 0, col: this.cols - 1 };

    // Place 3 initial wards in adjacent cells to player start
    this.wards = this.computeInitialWards();

    // Mark player start, initial ward positions, and goal as safe
    this.safeCells.clear();
    this.safeCells.add(`${this.playerPos.row},${this.playerPos.col}`);
    for (const w of this.wards) {
      this.safeCells.add(`${w.row},${w.col}`);
    }
    this.safeCells.add(`${this.goalPos.row},${this.goalPos.col}`);

    // Mark safe cells on the grid
    for (const key of this.safeCells) {
      const [r, c] = key.split(',').map(Number);
      grid[r][c].wardRevealed = true;
    }

    this.moves = 0;
    this.selectedWardIndex = null;
    this.playerSelected = false;
  }

  onReveal(_row: number, _col: number, _cell: Cell, _grid: Cell[][]): void {
    // Ward Maze doesn't use standard reveal
  }

  onFlag(_row: number, _col: number, _cell: Cell): void {
    // Ward Maze doesn't use standard flagging
  }

  onNewGame(_config: GameConfig): void {
    // Reset handled in init()
  }

  getState(): Record<string, unknown> {
    return {
      wardMazePlayerPos: { ...this.playerPos },
      wardMazeGoalPos: { ...this.goalPos },
      wardMazeWards: this.wards.map(w => ({ ...w })),
      wardMazeMoves: this.moves,
      wardMazeSelectedWardIndex: this.selectedWardIndex,
      wardMazePlayerSelected: this.playerSelected,
    };
  }

  // ─── Optional: Custom mine placement ─────────────────────────────────

  placeMines(safeRow: number, safeCol: number, _grid: Cell[][], _config: GameConfig): Set<string> {
    // Build safe zone: first-click area + player start + wards + goal
    const safeSet = new Set<string>();

    // Include the standard first-click safe zone
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = safeRow + dr;
        const nc = safeCol + dc;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          safeSet.add(`${nr},${nc}`);
        }
      }
    }

    // Add WardMaze safe cells
    safeSet.add(`${this.playerPos.row},${this.playerPos.col}`);
    for (const w of this.wards) {
      safeSet.add(`${w.row},${w.col}`);
    }
    safeSet.add(`${this.goalPos.row},${this.goalPos.col}`);

    return safeSet;
  }

  // ─── Optional: Custom click handler ──────────────────────────────────

  handleCellClick(row: number, col: number, _grid: Cell[][]): boolean {
    // Always intercept clicks in WardMaze mode

    // First tap: select a ward or the player
    if (this.selectedWardIndex === null && !this.playerSelected) {
      // Check if tapping a ward
      const wardIdx = this.wards.findIndex(w => w.row === row && w.col === col);
      if (wardIdx !== -1) {
        this.selectedWardIndex = wardIdx;
        return true;
      }

      // Check if tapping the player
      if (row === this.playerPos.row && col === this.playerPos.col) {
        this.playerSelected = true;
        return true;
      }

      // Tapping anything else with nothing selected → do nothing
      return true;
    }

    // Second tap: execute move
    if (this.selectedWardIndex !== null) {
      this.moveWard(this.selectedWardIndex, row, col, _grid);
      this.selectedWardIndex = null;
      return true;
    }

    if (this.playerSelected) {
      this.movePlayer(row, col, _grid);
      this.playerSelected = false;
      return true;
    }

    return true;
  }

  handleRightClick(_row: number, _col: number, _grid: Cell[][]): boolean {
    // Deselect on right-click
    this.selectedWardIndex = null;
    this.playerSelected = false;
    return true;
  }

  // ─── Optional: Game-over check ───────────────────────────────────────

  checkGameOver(grid: Cell[][]): { won: boolean; lost: boolean } | null {
    // Check win: player on goal
    if (
      this.playerPos.row === this.goalPos.row &&
      this.playerPos.col === this.goalPos.col
    ) {
      return { won: true, lost: false };
    }

    // Check loss: player on a mine that wasn't revealed by a ward
    const cell = grid[this.playerPos.row][this.playerPos.col];
    if (cell.isMine && !cell.wardRevealed) {
      return { won: false, lost: true };
    }

    return null;
  }

  // ─── Ward Maze Logic ─────────────────────────────────────────────────

  private computeInitialWards(): { row: number; col: number }[] {
    const pr = this.playerPos.row;
    const pc = this.playerPos.col;
    const wards: { row: number; col: number }[] = [];

    // Adjacent cells: up, right, up-right (prioritized for bottom-left start)
    const candidates = [
      { row: pr - 1, col: pc },     // up
      { row: pr, col: pc + 1 },     // right
      { row: pr - 1, col: pc + 1 }, // up-right
      { row: pr + 1, col: pc },     // down
      { row: pr, col: pc - 1 },     // left
    ];

    for (const c of candidates) {
      if (wards.length >= this.wardCount) break;
      if (c.row >= 0 && c.row < this.rows && c.col >= 0 && c.col < this.cols) {
        // Don't place on player or goal
        if (c.row === this.playerPos.row && c.col === this.playerPos.col) continue;
        if (c.row === this.goalPos.row && c.col === this.goalPos.col) continue;
        // Don't duplicate
        if (!wards.some(w => w.row === c.row && w.col === c.col)) {
          wards.push(c);
        }
      }
    }

    return wards;
  }

  private moveWard(index: number, toRow: number, toCol: number, grid: Cell[][]): void {
    if (index < 0 || index >= this.wards.length) return;

    const ward = this.wards[index];
    const key = `${toRow},${toCol}`;

    // Can't move ward to the same position
    if (ward.row === toRow && ward.col === toCol) {
      this.selectedWardIndex = null;
      return;
    }

    // Can't move ward to player position
    if (toRow === this.playerPos.row && toCol === this.playerPos.col) {
      this.selectedWardIndex = null;
      return;
    }

    // Can't move ward to another ward's position
    if (this.wards.some((w, i) => i !== index && w.row === toRow && w.col === toCol)) {
      this.selectedWardIndex = null;
      return;
    }

    // Check if destination is a mine
    const destCell = grid[toRow][toCol];
    if (destCell.isMine) {
      // Ward is destroyed, mine is revealed
      this.wards.splice(index, 1);
      destCell.state = 'revealed';
      // Adjust selected index if needed
      if (this.selectedWardIndex !== null && this.selectedWardIndex >= this.wards.length) {
        this.selectedWardIndex = null;
      }
      this.moves++;
      return;
    }

    // Safe cell - move the ward
    this.safeCells.add(key);
    destCell.wardRevealed = true;
    ward.row = toRow;
    ward.col = toCol;
    this.moves++;
  }

  private movePlayer(toRow: number, toCol: number, _grid: Cell[][]): void {
    const pr = this.playerPos.row;
    const pc = this.playerPos.col;

    // Must be adjacent (including diagonals)
    const dr = Math.abs(toRow - pr);
    const dc = Math.abs(toCol - pc);
    if (dr > 1 || dc > 1 || (dr === 0 && dc === 0)) {
      this.playerSelected = false;
      return;
    }

    // Can't move to a ward's position
    if (this.wards.some(w => w.row === toRow && w.col === toCol)) {
      this.playerSelected = false;
      return;
    }

    // Move player
    this.playerPos = { row: toRow, col: toCol };
    this.moves++;
    // (Game-over check is handled by checkGameOver)
  }

  /** Public accessor for tests */
  getPlayerPos(): { row: number; col: number } {
    return { ...this.playerPos };
  }

  getGoalPos(): { row: number; col: number } {
    return { ...this.goalPos };
  }

  getWards(): { row: number; col: number }[] {
    return this.wards.map(w => ({ ...w }));
  }

  getMoves(): number {
    return this.moves;
  }
}
