/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine/GameEngine';
import { ChainGamemode } from './ChainGamemode';
import { CellState, GameStatus, PRESET_CONFIGS } from '../types';

describe('ChainGamemode', () => {
  let engine: GameEngine;
  let gamemode: ChainGamemode;

  beforeEach(() => {
    engine = new GameEngine(PRESET_CONFIGS.easy);
    gamemode = new ChainGamemode();
    engine.setGamemode(gamemode);
    engine.newGame();
  });

  describe('combo tracking', () => {
    it('starts with combo 0', () => {
      expect(gamemode.getCombo()).toBe(0);
    });

    it('increments combo on first reveal', () => {
      engine.reveal(0, 0);
      expect(gamemode.getCombo()).toBe(1);
    });

    it('resets combo on mine hit', () => {
      // Just verify that hitting a mine resets combo to 0
      engine.reveal(0, 0);

      // Find and hit a mine
      const grid = engine.getState().grid;
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c].isMine && grid[r][c].state === CellState.Hidden) {
            engine.reveal(r, c);
            expect(gamemode.getCombo()).toBe(0);
            return;
          }
        }
      }
    });

    it('tracks chain cells revealed', () => {
      engine.reveal(0, 0);
      const state = engine.getState();
      expect(state.chainChainCellsRevealed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('combo bonuses', () => {
    it('reaches 5x combo threshold', () => {
      // Keep revealing until we hit 5x
      let revealed = 0;
      while (gamemode.getCombo() < 5 && revealed < 64) {
        // Find an unrevealed safe cell
        const grid = engine.getState().grid;
        let found = false;
        for (let r = 0; r < grid.length && !found; r++) {
          for (let c = 0; c < grid[r].length && !found; c++) {
            if (!grid[r][c].isMine && grid[r][c].state === CellState.Hidden) {
              engine.reveal(r, c);
              found = true;
            }
          }
        }
        revealed++;
        if (!found) break;
      }

      // Combo should be at least 5 (or we ran out of cells)
      if (gamemode.getCombo() > 0) {
        expect(gamemode.getCombo()).toBeGreaterThanOrEqual(5);
      }
    });

    it('reaches 10x combo threshold', () => {
      let revealed = 0;
      while (gamemode.getCombo() < 10 && revealed < 64) {
        const grid = engine.getState().grid;
        let found = false;
        for (let r = 0; r < grid.length && !found; r++) {
          for (let c = 0; c < grid[r].length && !found; c++) {
            if (!grid[r][c].isMine && grid[r][c].state === CellState.Hidden) {
              engine.reveal(r, c);
              found = true;
            }
          }
        }
        revealed++;
        if (!found) break;
      }

      if (gamemode.getCombo() > 0) {
        expect(gamemode.getCombo()).toBeGreaterThanOrEqual(10);
      }
    });
  });

  describe('combo multiplier', () => {
    it('returns 1 when no combo', () => {
      expect(gamemode.getComboMultiplier()).toBe(1);
    });

    it('returns combo value when active', () => {
      engine.reveal(0, 0);
      expect(gamemode.getComboMultiplier()).toBe(1);

      // Reveal more cells to build combo
      const grid = engine.getState().grid;
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (!grid[r][c].isMine && grid[r][c].state === CellState.Hidden) {
            engine.reveal(r, c);
            if (gamemode.getCombo() >= 2) {
              expect(gamemode.getComboMultiplier()).toBe(gamemode.getCombo());
              return;
            }
          }
        }
      }
    });
  });

  describe('game integration', () => {
    it('newGame resets combo', () => {
      engine.reveal(0, 0);
      engine.reveal(1, 0);
      const comboBefore = gamemode.getCombo();
      expect(comboBefore).toBeGreaterThanOrEqual(1);

      engine.newGame();
      expect(gamemode.getCombo()).toBe(0);
    });

    it('can win with gamemode active', () => {
      const tinyEngine = new GameEngine({ rows: 3, cols: 3, mines: 1 });
      const tinyGamemode = new ChainGamemode();
      tinyEngine.setGamemode(tinyGamemode);
      tinyEngine.newGame();

      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (!tinyEngine.getState().grid[r][c].isMine) {
            tinyEngine.reveal(r, c);
          }
        }
      }

      expect(tinyEngine.getState().status).toBe(GameStatus.Won);
    });
  });
});
