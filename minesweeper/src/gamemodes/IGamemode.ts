import type { Cell, GameConfig, Gamemode } from '../types';

/**
 * Interface for gamemode plugins. Each gamemode implements this to add
 * special mechanics on top of classic minesweeper.
 */
export interface IGamemode {
  /** Human-readable name */
  readonly modeName: string;
  /** Display icon */
  readonly icon: string;
  /** The Gamemode enum value */
  getMode(): Gamemode;
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

  // ─── Optional hooks (gamemodes can implement these) ───────────────────

  /**
   * Optional: Custom mine placement. If implemented, the engine calls this
   * instead of its default placeMines on first click.
   * @returns Set of safe zone keys ("row,col") that should be mine-free.
   */
  placeMines?(safeRow: number, safeCol: number, grid: Cell[][], config: GameConfig): Set<string>;

  /**
   * Optional: Custom cell click handler. If implemented and returns true,
   * the engine skips the default reveal/flag behavior.
   */
  handleCellClick?(row: number, col: number, grid: Cell[][]): boolean;

  /**
   * Optional: Custom right-click handler. If implemented and returns true,
   * the engine skips the default flag behavior.
   */
  handleRightClick?(row: number, col: number, grid: Cell[][]): boolean;

  /**
   * Optional: Gamemode-specific game-over check. Called after each action.
   * Return true to end the game with the given status.
   */
  checkGameOver?(grid: Cell[][]): { won: boolean; lost: boolean } | null;
}
