import type { Cell, GameConfig } from '../types';
import type { IGamemode } from './IGamemode';

/**
 * Resource Minesweeper — Energy Management
 *
 * Inspired by Magic: The Gathering and Gloomhaven.
 * - You start with a limited energy pool
 * - Revealing cells costs energy
 * - Flagging costs extra energy
 * - Some safe cells are "energy cells" that restore energy when revealed
 * - If energy reaches 0, you lose
 */
export class ResourceGamemode implements IGamemode {
  readonly modeName = 'Resource Minesweeper';
  readonly icon = '⚡';

  private energy = 10;
  private revealCost = 1;
  private flagCost = 2;
  private energyCellValue = 2;
  private energyCellChance = 0.15; // 15% of safe cells are energy cells
  private energyCellsRevealed = 0;

  init(grid: Cell[][]): void {
    // Randomly assign energy cells to safe cells
    const safeCells: { r: number; c: number }[] = [];
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (!grid[r][c].isMine) {
          safeCells.push({ r, c });
        }
      }
    }

    // Shuffle and assign energy cells
    for (let i = safeCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [safeCells[i], safeCells[j]] = [safeCells[j], safeCells[i]];
    }

    const energyCellCount = Math.max(1, Math.floor(safeCells.length * this.energyCellChance));
    for (let i = 0; i < energyCellCount; i++) {
      grid[safeCells[i].r][safeCells[i].c].isEnergyCell = true;
    }
  }

  onReveal(_row: number, _col: number, cell: Cell, _grid: Cell[][]): void {
    // Deduct reveal cost
    this.energy -= this.revealCost;

    // Check if it's an energy cell
    if (cell.isEnergyCell) {
      this.energy += this.energyCellValue;
      this.energyCellsRevealed++;
    }
  }

  onFlag(_row: number, _col: number, _cell: Cell): void {
    // Deduct flag cost
    this.energy -= this.flagCost;
  }

  onNewGame(_config: GameConfig): void {
    this.energy = 10;
    this.energyCellsRevealed = 0;
  }

  getState(): Record<string, unknown> {
    return {
      resourceEnergy: this.energy,
      resourceEnergyCellsRevealed: this.energyCellsRevealed,
    };
  }

  /** Check if the player has run out of energy (lose condition) */
  isEnergyDepleted(): boolean {
    return this.energy <= 0;
  }

  /** Current energy level */
  getEnergy(): number {
    return this.energy;
  }

  /** Remaining energy cells to find */
  getEnergyCellsRemaining(grid: Cell[][]): number {
    let remaining = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell.isEnergyCell && cell.state !== 'revealed') {
          remaining++;
        }
      }
    }
    return remaining;
  }
}
