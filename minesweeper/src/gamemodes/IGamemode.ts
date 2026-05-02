import type { Cell, GameConfig } from '../types';

/**
 * Interface for gamemode plugins. Each gamemode implements this to add
 * special mechanics on top of classic minesweeper.
 */
export interface IGamemode {
  /** Human-readable name */
  readonly modeName: string;
  /** Display icon */
  readonly icon: string;
  /** Initialize gamemode-specific state for a new board */
  init(grid: Cell[][]): void;
  /** Called after a cell is revealed (before mine-death check) */
  onReveal(row: number, col: number, cell: Cell, grid: Cell[][]): void;
  /** Called after a flag is toggled */
  onFlag(row: number, col: number, cell: Cell): void;
  /** Called when a new game starts */
  onNewGame(config: GameConfig): void;
  /** Returns gamemode-specific state to include in GameState */
  getState(): Record<string, unknown>;
}
