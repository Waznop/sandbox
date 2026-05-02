/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine/GameEngine';
import { ShadowGamemode } from './ShadowGamemode';
import { PRESET_CONFIGS } from '../types';

describe('ShadowGamemode', () => {
  let engine: GameEngine;
  let gamemode: ShadowGamemode;

  beforeEach(() => {
    engine = new GameEngine(PRESET_CONFIGS.easy);
    gamemode = new ShadowGamemode();
    engine.setGamemode(gamemode);
    engine.newGame();
  });

  describe('fog of war', () => {
    it('initializes fog mask', () => {
      const state = engine.getState();
      const fogMask = state.shadowFogMask as boolean[][] | undefined;
      expect(fogMask).toBeDefined();
      expect(fogMask?.length).toBe(8);
      expect(fogMask?.[0]?.length).toBe(8);
    });

    it('reveals cells around (0,0) initially', () => {
      const state = engine.getState();
      const fogMask = state.shadowFogMask as boolean[][] | undefined;

      // Cells within radius 2 of (0,0) should be visible
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          expect(fogMask?.[r]?.[c]).toBe(true);
        }
      }
    });

    it('expands fog when revealing a cell', () => {
      const stateBefore = engine.getState();
      const fogMaskBefore = stateBefore.shadowFogMask as boolean[][] | undefined;
      const visibleBefore = fogMaskBefore?.flat().filter(Boolean).length ?? 0;

      // Reveal a cell far from initial fog
      engine.reveal(6, 6);
      const stateAfter = engine.getState();
      const fogMaskAfter = stateAfter.shadowFogMask as boolean[][] | undefined;
      const visibleAfter = fogMaskAfter?.flat().filter(Boolean).length ?? 0;

      // More cells should be visible after revealing a new cell
      expect(visibleAfter).toBeGreaterThan(visibleBefore);
    });

    it('cells far from revealed cells are hidden', () => {
      const state = engine.getState();
      const fogMask = state.shadowFogMask as boolean[][] | undefined;

      // Cell at (7,7) should not be visible initially (far from (0,0))
      expect(fogMask?.[7]?.[7]).toBe(false);
    });
  });

  describe('stealth charges', () => {
    it('starts with 3 stealth charges', () => {
      expect(gamemode.getStealthCharges()).toBe(3);
    });

    it('can spend stealth charges', () => {
      expect(gamemode.useStealthCharge()).toBe(true);
      expect(gamemode.getStealthCharges()).toBe(2);
    });

    it('cannot spend beyond limit', () => {
      gamemode.useStealthCharge();
      gamemode.useStealthCharge();
      gamemode.useStealthCharge();
      expect(gamemode.useStealthCharge()).toBe(false);
      expect(gamemode.getStealthCharges()).toBe(0);
    });

    it('resets on new game', () => {
      gamemode.useStealthCharge();
      gamemode.useStealthCharge();
      expect(gamemode.getStealthCharges()).toBe(1);

      engine.newGame();
      expect(gamemode.getStealthCharges()).toBe(3);
    });
  });

  describe('game integration', () => {
    it('can win with gamemode active', () => {
      const tinyEngine = new GameEngine({ rows: 3, cols: 3, mines: 1 });
      const tinyGamemode = new ShadowGamemode();
      tinyEngine.setGamemode(tinyGamemode);
      tinyEngine.newGame();

      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (!tinyEngine.getState().grid[r][c].isMine) {
            tinyEngine.reveal(r, c);
          }
        }
      }

      expect(tinyEngine.getState().status).toBe('won');
    });
  });
});
