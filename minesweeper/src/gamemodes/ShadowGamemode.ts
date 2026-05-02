import type { Cell, GameConfig } from '../types';
import type { IGamemode } from './IGamemode';

/**
 * Shadow Minesweeper — Fog of War + Stealth
 *
 * Inspired by board games like XCOM and Descent.
 * - Only cells within `fogRadius` of any revealed cell are visible
 * - Hidden cells in fog show as "?" with reduced opacity
 * - Shadow mines don't contribute to adjacent mine counts
 * - You get `stealthCharges` to reveal cells without triggering adjacent counts
 */
export class ShadowGamemode implements IGamemode {
  readonly modeName = 'Shadow Minesweeper';
  readonly icon = '🌑';

  private fogRadius = 2;
  private stealthCharges = 3;
  private fogMask!: boolean[][];

  init(grid: Cell[][]): void {
    const rows = grid.length;
    const cols = grid[0].length;
    this.fogMask = Array.from({ length: rows }, () => Array(cols).fill(false));
    // Initially reveal cells around (0, 0)
    this.updateFogForCell(0, 0, grid);
  }

  onReveal(row: number, col: number, _cell: Cell, grid: Cell[][]): void {
    // After revealing a cell, expand fog visibility
    this.updateFogForCell(row, col, grid);
  }

  onFlag(_row: number, _col: number, _cell: Cell): void {
    // Flagging doesn't expand fog
  }

  onNewGame(_config: GameConfig): void {
    this.stealthCharges = 3;
  }

  getState(): Record<string, unknown> {
    return {
      shadowFogMask: this.fogMask,
      shadowStealthCharges: this.stealthCharges,
    };
  }

  /** Returns whether a cell is currently visible (not in fog) */
  isVisible(row: number, col: number): boolean {
    return this.fogMask[row]?.[col] ?? false;
  }

  /** Returns the number of remaining stealth charges */
  getStealthCharges(): number {
    return this.stealthCharges;
  }

  /** Spend a stealth charge — returns true if successful */
  useStealthCharge(): boolean {
    if (this.stealthCharges > 0) {
      this.stealthCharges--;
      return true;
    }
    return false;
  }

  // ─── Fog Logic ───────────────────────────────────────────────────────

  private updateFogForCell(row: number, col: number, grid: Cell[][]): void {
    const rows = grid.length;
    const cols = grid[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dist = Math.max(Math.abs(r - row), Math.abs(c - col)); // Chebyshev distance
        if (dist <= this.fogRadius) {
          this.fogMask[r][c] = true;
        }
      }
    }
  }
}
