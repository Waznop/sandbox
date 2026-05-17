// Core type definitions for Minesweeper

export const CellState = {
  Hidden: 'hidden',
  Revealed: 'revealed',
  Flagged: 'flagged',
} as const;
export type CellState = (typeof CellState)[keyof typeof CellState];

export const GameStatus = {
  Idle: 'idle',
  Playing: 'playing',
  Won: 'won',
  Lost: 'lost',
} as const;
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

export interface Cell {
  row: number;
  col: number;
  isMine: boolean;
  adjacentMines: number;   // -1 if mine, 0-8 otherwise
  state: CellState;
}

export interface GameConfig {
  rows: number;
  cols: number;
  mines: number;
}

export interface HighScoreEntry {
  time: number;       // seconds
  date: string;       // ISO date string
  config: GameConfig;
}

export interface GameState {
  grid: Cell[][];
  status: GameStatus;
  startTime: number | null;    // timestamp ms
  endTime: number | null;      // timestamp ms
  elapsedSeconds: number;
  flagsPlaced: number;
  cellsRevealed: number;
  totalSafeCells: number;
  playerPos: { row: number; col: number };  // current cursor position on grid
}

export type Direction =
  | 'up'         | 'down'
  | 'left'       | 'right'
  | 'up-left'    | 'up-right'
  | 'down-left'  | 'down-right';

export const DIRECTION_DELTAS: Record<Direction, { dr: number; dc: number }> = {
  'up':         { dr: -1, dc: 0 },
  'down':       { dr: 1,  dc: 0 },
  'left':       { dr: 0,  dc: -1 },
  'right':      { dr: 0,  dc: 1 },
  'up-left':    { dr: -1, dc: -1 },
  'up-right':   { dr: -1, dc: 1 },
  'down-left':  { dr: 1,  dc: -1 },
  'down-right': { dr: 1,  dc: 1 },
};

export const PRESET_CONFIGS: Record<string, GameConfig> = {
  easy:   { rows: 8,  cols: 8,  mines: 10 },
  medium: { rows: 12, cols: 10, mines: 30 },
  hard:   { rows: 14, cols: 12, mines: 50 },
};

// ─── Gamemode System ───────────────────────────────────────────────────────

export const Gamemode = {
  Classic: 'classic',
  Arcane: 'arcane',
  Shadow: 'shadow',
  Resource: 'resource',
  Chain: 'chain',
  WardMaze: 'ward-maze',
} as const;
export type Gamemode = (typeof Gamemode)[keyof typeof Gamemode];

export interface GamemodeConfig {
  mode: Gamemode;
  // Arcane
  arcaneDeckSize?: number;
  arcaneHandLimit?: number;
  // Shadow
  shadowFogRadius?: number;
  // Resource
  resourceStartEnergy?: number;
  resourceRevealCost?: number;
  resourceFlagCost?: number;
  resourceEnergyCellValue?: number;
  // Chain
  chainComboTimeout?: number;
  chainAutoFlagThreshold?: number;
  chainChainRevealThreshold?: number;
  // WardMaze
  wardMazeWardCount?: number;
}

// ─── Arcane Card System ────────────────────────────────────────────────────

export const CardRarity = {
  Common: 'common',
  Rare: 'rare',
  Legendary: 'legendary',
} as const;
export type CardRarity = (typeof CardRarity)[keyof typeof CardRarity];

export const CardEffect = {
  Shield: 'shield',
  Detonate: 'detonate',
  Scanner: 'scanner',
  Chain: 'chain',
} as const;
export type CardEffect = (typeof CardEffect)[keyof typeof CardEffect];

export interface Card {
  id: string;
  name: string;
  description: string;
  effect: CardEffect;
  rarity: CardRarity;
}

// ─── Extended Types ────────────────────────────────────────────────────────

export interface Cell {
  row: number;
  col: number;
  isMine: boolean;
  adjacentMines: number;
  state: CellState;
  // Gamemode-specific extensions
  isEnergyCell?: boolean;
  isShadowMine?: boolean;
  shielded?: boolean;
  // WardMaze: cell was revealed safe by a ward
  wardRevealed?: boolean;
}

export interface GameState {
  grid: Cell[][];
  status: GameStatus;
  startTime: number | null;
  endTime: number | null;
  elapsedSeconds: number;
  flagsPlaced: number;
  cellsRevealed: number;
  totalSafeCells: number;
  playerPos: { row: number; col: number };
  // Gamemode extensions
  gamemode: Gamemode;
  // Arcane
  arcaneDeck?: Card[];
  arcaneHand?: Card[];
  arcanePlayedCards?: Card[];
  arcanePendingCard?: Card | null;
  // Shadow
  shadowFogMask?: boolean[][];
  // Resource
  resourceEnergy?: number;
  resourceEnergyCellsRevealed?: number;
  // Chain
  chainCombo?: number;
  chainLastRevealTime?: number;
  chainChainCellsRevealed?: number;
  // WardMaze
  wardMazePlayerPos?: { row: number; col: number };
  wardMazeGoalPos?: { row: number; col: number };
  wardMazeWards?: { row: number; col: number }[];
  wardMazeMoves?: number;
  wardMazeSelectedWardIndex?: number | null;
  wardMazePlayerSelected?: boolean;
}