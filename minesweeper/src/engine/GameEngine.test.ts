import { describe, it, expect } from 'vitest';
import { GameEngine } from './GameEngine';
import { CellState, GameStatus, PRESET_CONFIGS } from '../types';

describe('GameEngine', () => {
  const config = { rows: 5, cols: 5, mines: 3 };

  describe('grid initialization', () => {
    it('creates grid with correct dimensions', () => {
      const engine = new GameEngine(config);
      const state = engine.getState();
      expect(state.grid.length).toBe(5);
      expect(state.grid[0].length).toBe(5);
    });

    it('initializes all cells as hidden, non-mine, zero adjacent', () => {
      const engine = new GameEngine(config);
      const state = engine.getState();
      for (const row of state.grid) {
        for (const cell of row) {
          expect(cell.state).toBe(CellState.Hidden);
          expect(cell.isMine).toBe(false);
          expect(cell.adjacentMines).toBe(0);
        }
      }
    });

    it('computes totalSafeCells correctly', () => {
      const engine = new GameEngine(config);
      expect(engine.getState().totalSafeCells).toBe(25 - 3);
    });

    it('initializes player position to (0,0)', () => {
      const engine = new GameEngine(config);
      expect(engine.getState().playerPos).toEqual({ row: 0, col: 0 });
    });

    it('starts in Idle status', () => {
      const engine = new GameEngine(config);
      expect(engine.getState().status).toBe(GameStatus.Idle);
    });
  });

  describe('mine placement', () => {
    it('places correct number of mines', () => {
      const engine = new GameEngine(config);
      engine.placeMines(2, 2); // center click
      let mineCount = 0;
      for (const row of engine.getState().grid) {
        for (const cell of row) {
          if (cell.isMine) mineCount++;
        }
      }
      expect(mineCount).toBe(3);
    });

    it('keeps safe zone free of mines', () => {
      const engine = new GameEngine(config);
      const safeRow = 2, safeCol = 2;
      engine.placeMines(safeRow, safeCol);

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = safeRow + dr;
          const c = safeCol + dc;
          if (r >= 0 && r < config.rows && c >= 0 && c < config.cols) {
            expect(engine.getState().grid[r][c].isMine).toBe(false);
          }
        }
      }
    });

    it('transitions to Playing status after mine placement', () => {
      const engine = new GameEngine(config);
      engine.placeMines(2, 2);
      expect(engine.getState().status).toBe(GameStatus.Playing);
    });

    it('does not place mines twice', () => {
      const engine = new GameEngine(config);
      engine.placeMines(2, 2);
      // Second call should be no-op (already Playing)
      engine.placeMines(0, 0);
      let mineCount = 0;
      for (const row of engine.getState().grid) {
        for (const cell of row) {
          if (cell.isMine) mineCount++;
        }
      }
      expect(mineCount).toBe(3);
    });
  });

  describe('adjacent mine counting', () => {
    it('calculates adjacent counts correctly after placement', () => {
      const engine = new GameEngine(config);
      engine.placeMines(2, 2);

      // Verify that non-mine cells have valid adjacent counts (0-8)
      for (const row of engine.getState().grid) {
        for (const cell of row) {
          if (cell.isMine) {
            expect(cell.adjacentMines).toBe(-1);
          } else {
            expect(cell.adjacentMines).toBeGreaterThanOrEqual(0);
            expect(cell.adjacentMines).toBeLessThanOrEqual(8);
          }
        }
      }
    });

    it('cells far from mines have count 0', () => {
      // Use a large board with few mines to guarantee some zero cells
      const bigConfig = { rows: 10, cols: 10, mines: 1 };
      const engine = new GameEngine(bigConfig);
      engine.placeMines(5, 5);

      let zeroCount = 0;
      for (const row of engine.getState().grid) {
        for (const cell of row) {
          if (!cell.isMine && cell.adjacentMines === 0) zeroCount++;
        }
      }
      // With only 1 mine on a 10x10 board, most cells should be 0
      expect(zeroCount).toBeGreaterThan(50);
    });
  });

  describe('cell reveal', () => {
    it('reveals a single non-mine cell with adjacent count > 0', () => {
      const engine = new GameEngine(config);
      // Force a known board setup for determinism
      engine.newGame();
      engine.placeMines(2, 2);

      // Find a non-zero, non-mine cell to reveal
      let targetR = -1, targetC = -1;
      for (let r = 0; r < config.rows && targetR === -1; r++) {
        for (let c = 0; c < config.cols; c++) {
          const cell = engine.getState().grid[r][c];
          if (!cell.isMine && cell.adjacentMines > 0) {
            targetR = r; targetC = c; break;
          }
        }
      }

      if (targetR !== -1) {
        const beforeRevealed = engine.getState().cellsRevealed;
        engine.reveal(targetR, targetC);
        expect(engine.getState().grid[targetR][targetC].state).toBe(CellState.Revealed);
        expect(engine.getState().cellsRevealed).toBe(beforeRevealed + 1);
      }
    });

    it('flood-fills from a zero cell', () => {
      const bigConfig = { rows: 10, cols: 10, mines: 5 };
      const engine = new GameEngine(bigConfig);

      // Click center to place mines with safe zone
      engine.reveal(5, 5);
      expect(engine.getState().status).toBe(GameStatus.Playing);

      // If the clicked cell has adjacentMines === 0, flood-fill should have happened
      if (engine.getState().grid[5][5].adjacentMines === 0) {
        expect(engine.getState().cellsRevealed).toBeGreaterThan(1);
      } else {
        // Only single reveal
        expect(engine.getState().cellsRevealed).toBe(1);
      }
    });

    it('sets status to Lost when revealing a mine', () => {
      const engine = new GameEngine(config);
      engine.placeMines(2, 2);

      // Find and click a mine
      let mineR = -1, mineC = -1;
      for (let r = 0; r < config.rows && mineR === -1; r++) {
        for (let c = 0; c < config.cols; c++) {
          if (engine.getState().grid[r][c].isMine) {
            mineR = r; mineC = c; break;
          }
        }
      }

      engine.reveal(mineR, mineC);
      expect(engine.getState().status).toBe(GameStatus.Lost);
    });

    it('reveals all mines on loss', () => {
      const engine = new GameEngine(config);
      engine.placeMines(2, 2);

      let mineR = -1, mineC = -1;
      for (let r = 0; r < config.rows && mineR === -1; r++) {
        for (let c = 0; c < config.cols; c++) {
          if (engine.getState().grid[r][c].isMine) { mineR = r; mineC = c; break; }
        }
      }

      engine.reveal(mineR, mineC);

      let revealedMines = 0;
      for (const row of engine.getState().grid) {
        for (const cell of row) {
          if (cell.isMine && cell.state === CellState.Revealed) revealedMines++;
        }
      }
      expect(revealedMines).toBe(config.mines);
    });

    it('detects win when all safe cells are revealed', () => {
      // Use a 5x5 board with 2 mines — enough room for the safe zone
      const medConfig = { rows: 5, cols: 5, mines: 2 };
      const engine = new GameEngine(medConfig);

      // Click center to place mines (safe zone around center)
      engine.reveal(2, 2);
      expect(engine.getState().status).toBe(GameStatus.Playing);

      // Reveal all remaining safe cells
      for (let r = 0; r < medConfig.rows; r++) {
        for (let c = 0; c < medConfig.cols; c++) {
          const cell = engine.getState().grid[r][c];
          if (!cell.isMine && cell.state !== CellState.Revealed) {
            engine.reveal(r, c);
          }
          // Re-check state after each reveal since it may have changed
        }
      }

      expect(engine.getState().cellsRevealed).toBe(medConfig.rows * medConfig.cols - medConfig.mines);
      expect(engine.getState().status).toBe(GameStatus.Won);
    });

    it('cannot reveal after game is over', () => {
      const medConfig = { rows: 5, cols: 5, mines: 3 };
      const engine = new GameEngine(medConfig);
      engine.reveal(2, 2);

      // Find and click a mine to lose
      let mineR = -1, mineC = -1;
      for (let r = 0; r < medConfig.rows && mineR === -1; r++) {
        for (let c = 0; c < medConfig.cols; c++) {
          if (engine.getState().grid[r][c].isMine) { mineR = r; mineC = c; break; }
        }
      }

      engine.reveal(mineR, mineC);
      expect(engine.getState().status).toBe(GameStatus.Lost);

      const revealedBefore = engine.getState().cellsRevealed;
      // Try to reveal another safe cell
      for (let r = 0; r < medConfig.rows && r !== mineR; r++) {
        for (let c = 0; c < medConfig.cols && c !== mineC; c++) {
          if (!engine.getState().grid[r][c].isMine &&
              engine.getState().grid[r][c].state !== CellState.Revealed) {
            engine.reveal(r, c);
            break;
          }
        }
      }
      // No additional reveals should happen after loss
      expect(engine.getState().cellsRevealed).toBe(revealedBefore);
    });
  });

  describe('flag toggling', () => {
    it('toggles hidden cell to flagged and back', () => {
      const engine = new GameEngine(config);
      engine.placeMines(2, 2);

      engine.toggleFlag(0, 0);
      expect(engine.getState().grid[0][0].state).toBe(CellState.Flagged);
      expect(engine.getState().flagsPlaced).toBe(1);

      engine.toggleFlag(0, 0);
      expect(engine.getState().grid[0][0].state).toBe(CellState.Hidden);
      expect(engine.getState().flagsPlaced).toBe(0);
    });

    it('cannot flag a revealed cell', () => {
      const engine = new GameEngine(config);
      engine.reveal(2, 2); // first click places mines and reveals

      // Find an unrevealed non-mine cell, reveal it
      for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
          const cell = engine.getState().grid[r][c];
          if (!cell.isMine && cell.state !== CellState.Revealed) {
            engine.reveal(r, c);
            // Try to flag this now-revealed cell
            engine.toggleFlag(r, c);
            expect(engine.getState().grid[r][c].state).toBe(CellState.Revealed);
            return;
          }
        }
      }
    });

    it('can flag during Idle (before first reveal)', () => {
      const engine = new GameEngine(config);
      // Pre-placement flags should work
      engine.toggleFlag(0, 0);
      expect(engine.getState().grid[0][0].state).toBe(CellState.Flagged);
      expect(engine.getState().flagsPlaced).toBe(1);
    });
  });

  describe('cursor movement', () => {
    it('moves cursor in all directions', () => {
      const engine = new GameEngine(config);

      engine.moveCursor('down');
      expect(engine.getState().playerPos).toEqual({ row: 1, col: 0 });

      engine.moveCursor('right');
      expect(engine.getState().playerPos).toEqual({ row: 1, col: 1 });

      engine.moveCursor('up');
      expect(engine.getState().playerPos).toEqual({ row: 0, col: 1 });

      engine.moveCursor('left');
      expect(engine.getState().playerPos).toEqual({ row: 0, col: 0 });
    });

    it('clamps cursor at grid boundaries', () => {
      const engine = new GameEngine(config);
      // At (0,0), moving up/left should clamp
      engine.moveCursor('up');
      expect(engine.getState().playerPos).toEqual({ row: 0, col: 0 });
      engine.moveCursor('left');
      expect(engine.getState().playerPos).toEqual({ row: 0, col: 0 });

      // Move to bottom-right corner
      for (let i = 0; i < 10; i++) {
        engine.moveCursor('down');
        engine.moveCursor('right');
      }
      const maxRow = config.rows - 1;
      const maxCol = config.cols - 1;
      expect(engine.getState().playerPos).toEqual({ row: maxRow, col: maxCol });

      // Try to go beyond
      engine.moveCursor('down-right');
      expect(engine.getState().playerPos).toEqual({ row: maxRow, col: maxCol });
    });

    it('supports diagonal movement', () => {
      const engine = new GameEngine(config);
      engine.moveCursor('down-right');
      expect(engine.getState().playerPos).toEqual({ row: 1, col: 1 });
      engine.moveCursor('up-left');
      expect(engine.getState().playerPos).toEqual({ row: 0, col: 0 });
    });
  });

  describe('new game / reset', () => {
    it('resets all state on newGame()', () => {
      const engine = new GameEngine(config);
      engine.reveal(2, 2); // start a game
      engine.toggleFlag(0, 4);

      engine.newGame();
      const state = engine.getState();

      expect(state.status).toBe(GameStatus.Idle);
      expect(state.flagsPlaced).toBe(0);
      expect(state.cellsRevealed).toBe(0);
      expect(state.startTime).toBeNull();
      expect(state.endTime).toBeNull();
      expect(state.elapsedSeconds).toBe(0);
      expect(state.playerPos).toEqual({ row: 0, col: 0 });

      for (const row of state.grid) {
        for (const cell of row) {
          expect(cell.state).toBe(CellState.Hidden);
          expect(cell.isMine).toBe(false);
        }
      }
    });

    it('accepts new config on reset', () => {
      const engine = new GameEngine(config);
      engine.newGame(PRESET_CONFIGS.medium);

      const state = engine.getState();
      expect(state.grid.length).toBe(PRESET_CONFIGS.medium.rows);
      expect(state.grid[0].length).toBe(PRESET_CONFIGS.medium.cols);
      expect(state.totalSafeCells).toBe(
        PRESET_CONFIGS.medium.rows * PRESET_CONFIGS.medium.cols - PRESET_CONFIGS.medium.mines
      );
    });
  });

  describe('timer', () => {
    it('elapsedSeconds is 0 when idle', () => {
      const engine = new GameEngine(config);
      expect(engine.getState().elapsedSeconds).toBe(0);
    });

    it('startTime is set on first reveal', () => {
      const engine = new GameEngine(config);
      expect(engine.getState().startTime).toBeNull();
      engine.reveal(2, 2);
      expect(engine.getState().startTime).not.toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles corner click for safe zone on small board', () => {
      const tiny = { rows: 3, cols: 3, mines: 1 };
      const engine = new GameEngine(tiny);
      // Click top-left corner — safe zone is just (0,0),(0,1),(1,0),(1,1)
      engine.reveal(0, 0);
      expect(engine.getState().status).toBe(GameStatus.Playing);

      // The mine should NOT be in the safe zone
      for (let dr = 0; dr <= 1; dr++) {
        for (let dc = 0; dc <= 1; dc++) {
          expect(engine.getState().grid[dr][dc].isMine).toBe(false);
        }
      }
    });

    it('handles board where mines equals almost all cells', () => {
      // 5x5 with 20 mines — only 5 safe cells, but plenty of room outside safe zone
      const dense = { rows: 5, cols: 5, mines: 20 };
      const engine = new GameEngine(dense);
      engine.reveal(2, 2);

      let mineCount = 0;
      for (const row of engine.getState().grid) {
        for (const cell of row) {
          if (cell.isMine) mineCount++;
        }
      }
      expect(mineCount).toBe(20);
      expect(engine.getState().totalSafeCells).toBe(5);
    });
  });
});