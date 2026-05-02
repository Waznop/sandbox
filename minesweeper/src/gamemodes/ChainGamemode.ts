import type { Cell, GameConfig } from '../types';
import type { IGamemode } from './IGamemode';

/**
 * Chain Minesweeper — Combo System
 *
 * Inspired by rhythm games and TCG combo chains.
 * - Revealing cells in quick succession builds a combo counter
 * - Combo resets after 3 seconds of inactivity or hitting a mine
 * - Combo bonuses:
 *   - 5x: Auto-flag adjacent mines on next reveal
 *   - 10x: Chain reveal (reveal all connected zeros)
 *   - 15x: Reveal all cells in a 3x3 area
 * - Higher combo = more cells revealed per click
 */
export class ChainGamemode implements IGamemode {
  readonly modeName = 'Chain Minesweeper';
  readonly icon = '🔥';

  private combo = 0;
  private lastRevealTime = 0;
  private chainCellsRevealed = 0;
  private comboTimeout = 3000; // 3 seconds
  private autoFlagThreshold = 5;
  private chainRevealThreshold = 10;
  private blastThreshold = 15;

  init(_grid: Cell[][]): void {
    this.combo = 0;
    this.lastRevealTime = 0;
    this.chainCellsRevealed = 0;
  }

  onReveal(row: number, col: number, cell: Cell, grid: Cell[][]): void {
    const now = Date.now();

    // Check if combo should reset (timeout or mine hit)
    if (cell.isMine) {
      this.combo = 0;
      this.chainCellsRevealed = 0;
      return;
    }

    if (now - this.lastRevealTime > this.comboTimeout) {
      this.combo = 0; // Reset combo on timeout
    }

    // Increment combo
    this.combo++;
    this.lastRevealTime = now;

    // Apply combo bonuses
    if (this.combo >= this.blastThreshold) {
      // 15x: Blast — reveal 3x3 area
      this.blast(row, col, grid);
      this.combo = 0; // Reset after blast
      this.chainCellsRevealed = 0;
    } else if (this.combo >= this.chainRevealThreshold) {
      // 10x: Chain reveal
      this.chainReveal(row, col, grid);
    } else if (this.combo >= this.autoFlagThreshold) {
      // 5x: Auto-flag adjacent mines
      this.autoFlagAdjacentMines(row, col, grid);
    }

    this.chainCellsRevealed++;
  }

  onFlag(_row: number, _col: number, _cell: Cell): void {
    // Flagging doesn't affect combo
  }

  onNewGame(_config: GameConfig): void {
    this.combo = 0;
    this.lastRevealTime = 0;
    this.chainCellsRevealed = 0;
  }

  getState(): Record<string, unknown> {
    return {
      chainCombo: this.combo,
      chainLastRevealTime: this.lastRevealTime,
      chainChainCellsRevealed: this.chainCellsRevealed,
    };
  }

  /** Current combo level */
  getCombo(): number {
    return this.combo;
  }

  /** Combo multiplier for scoring */
  getComboMultiplier(): number {
    return Math.max(1, this.combo);
  }

  /** Whether combo is active (non-zero) */
  isComboActive(): boolean {
    return this.combo > 0;
  }

  // ─── Combo Effects ───────────────────────────────────────────────────

  private blast(row: number, col: number, grid: Cell[][]): void {
    const rows = grid.length;
    const cols = grid[0].length;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const n = grid[nr][nc];
          if (n.state === 'hidden' && !n.isMine) {
            n.state = 'revealed';
          }
        }
      }
    }
  }

  private chainReveal(row: number, col: number, grid: Cell[][]): void {
    const cell = grid[row][col];
    if (cell.adjacentMines !== 0) return;

    const queue: { r: number; c: number }[] = [{ r: row, c: col }];
    const visited = new Set<string>();
    visited.add(`${row},${col}`);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      const currentCell = grid[cur.r][cur.c];
      if (currentCell.state === 'revealed') continue;
      currentCell.state = 'revealed';

      if (currentCell.adjacentMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = cur.r + dr;
            const nc = cur.c + dc;
            if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length) {
              const key = `${nr},${nc}`;
              if (!visited.has(key) && !grid[nr][nc].isMine) {
                visited.add(key);
                queue.push({ r: nr, c: nc });
              }
            }
          }
        }
      }
    }
  }

  private autoFlagAdjacentMines(row: number, col: number, grid: Cell[][]): void {
    const rows = grid.length;
    const cols = grid[0].length;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const n = grid[nr][nc];
          if (n.isMine && n.state === 'hidden') {
            n.state = 'flagged';
          }
        }
      }
    }
  }
}
