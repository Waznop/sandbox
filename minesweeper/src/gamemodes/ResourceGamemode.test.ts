/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine/GameEngine';
import { ResourceGamemode } from './ResourceGamemode';
import { CellState, GameStatus, PRESET_CONFIGS } from '../types';

describe('ResourceGamemode', () => {
  let engine: GameEngine;
  let gamemode: ResourceGamemode;

  beforeEach(() => {
    engine = new GameEngine(PRESET_CONFIGS.easy);
    gamemode = new ResourceGamemode();
    engine.setGamemode(gamemode);
    engine.newGame();
  });

  describe('energy management', () => {
    it('starts with 10 energy', () => {
      const state = engine.getState();
      expect(state.resourceEnergy).toBe(10);
    });

    it('deducts energy on reveal', () => {
      engine.reveal(0, 0);
      const state = engine.getState();
      // Energy should be 9 (10 - 1 reveal cost), or 11 if it was an energy cell
      expect([9, 11]).toContain(state.resourceEnergy);
    });

    it('deducts energy on flag', () => {
      engine.toggleFlag(0, 0);
      const state = engine.getState();
      expect(state.resourceEnergy).toBe(8); // 10 - 2 (flag cost)
    });

    it('energy cells restore energy', () => {
      // Find an energy cell and reveal it
      const grid = engine.getState().grid;
      let energyCell: { r: number; c: number } | null = null;

      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c].isEnergyCell && grid[r][c].state === CellState.Hidden) {
            energyCell = { r, c };
            break;
          }
        }
        if (energyCell) break;
      }

      if (energyCell) {
        const energyBefore = engine.getState().resourceEnergy;
        engine.reveal(energyCell.r, energyCell.c);
        const energyAfter = engine.getState().resourceEnergy;

        // Should gain energyCellValue (2) and lose revealCost (1), net +1
        expect(energyAfter).toBe(energyBefore + 1);
      }
    });

    it('tracks energy cells revealed', () => {
      const grid = engine.getState().grid;
      let energyCell: { r: number; c: number } | null = null;

      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c].isEnergyCell && grid[r][c].state === CellState.Hidden) {
            energyCell = { r, c };
            break;
          }
        }
        if (energyCell) break;
      }

      if (energyCell) {
        engine.reveal(energyCell.r, energyCell.c);
        const state = engine.getState();
        expect(state.resourceEnergyCellsRevealed).toBe(1);
      }
    });
  });

  describe('energy depletion', () => {
    it('detects energy depletion', () => {
      // Drain energy by flagging many cells
      for (let i = 0; i < 10; i++) {
        engine.toggleFlag(0, i % 8);
      }

      expect(gamemode.isEnergyDepleted()).toBe(true);
    });
  });

  describe('game integration', () => {
    it('newGame resets energy', () => {
      engine.reveal(0, 0);
      expect(engine.getState().resourceEnergy).toBe(9);

      engine.newGame();
      expect(engine.getState().resourceEnergy).toBe(10);
    });
  });
});
