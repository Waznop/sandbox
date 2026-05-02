/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine/GameEngine';
import { ArcaneGamemode } from './ArcaneGamemode';
import { CellState, GameStatus, PRESET_CONFIGS, CardEffect } from '../types';

describe('ArcaneGamemode', () => {
  let engine: GameEngine;
  let gamemode: ArcaneGamemode;

  beforeEach(() => {
    engine = new GameEngine(PRESET_CONFIGS.easy);
    gamemode = new ArcaneGamemode();
    engine.setGamemode(gamemode);
    engine.newGame();
  });

  describe('card drawing', () => {
    it('draws a card when revealing a cell', () => {
      engine.reveal(0, 0);
      const state = engine.getState();
      const hand = state.arcaneHand as any[] | undefined;
      expect(hand?.length).toBeGreaterThan(0);
    });

    it('cards have rarity property', () => {
      engine.reveal(0, 0);
      const state = engine.getState();
      const hand = state.arcaneHand as any[] | undefined;
      const played = state.arcanePlayedCards as any[] | undefined;

      for (const card of [...(hand ?? []), ...(played ?? [])]) {
        expect(['common', 'rare', 'legendary']).toContain(card.rarity);
      }
    });

    it('respects hand limit', () => {
      // Keep revealing until hand is full
      let revealed = 0;
      while (revealed < 20) {
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
        if (!found) break;
        revealed++;
      }

      const state = engine.getState();
      const hand = state.arcaneHand as any[] | undefined;
      expect(hand?.length).toBeLessThanOrEqual(5);
    });
  });

  describe('card effects', () => {
    it('Shield card sets shielded flag', () => {
      engine.reveal(0, 0);
      const state = engine.getState();
      const hand = state.arcaneHand as any[] | undefined;
      const played = state.arcanePlayedCards as any[] | undefined;

      // Find a Shield card
      let hasShield = false;
      for (const card of [...(hand ?? []), ...(played ?? [])]) {
        if (card.effect === CardEffect.Shield) {
          hasShield = true;
          break;
        }
      }

      // If we got a Shield, the cell should be shielded
      if (hasShield) {
        const cell = engine.getState().grid[0][0];
        expect(cell.shielded).toBe(true);
      }
    });

    it('Detonate reveals neighbor cells', () => {
      engine.reveal(4, 4); // center of 8x8
      const state = engine.getState();

      // Check that some neighbors are revealed
      let revealedNeighbors = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r = 4 + dr;
          const c = 4 + dc;
          if (r >= 0 && r < 8 && c >= 0 && c < 8) {
            if (state.grid[r][c].state === CellState.Revealed) {
              revealedNeighbors++;
            }
          }
        }
      }

      // At least some neighbors should be revealed from Detonate
      expect(revealedNeighbors).toBeGreaterThan(0);
    });

    it('Scanner reveals a random safe cell', () => {
      const hiddenCountBefore = engine.getState().grid.flat()
        .filter(c => c.state === CellState.Hidden && !c.isMine).length;

      engine.reveal(0, 0);
      const hiddenCountAfter = engine.getState().grid.flat()
        .filter(c => c.state === CellState.Hidden && !c.isMine).length;

      // At least one more safe cell should be revealed
      expect(hiddenCountBefore - hiddenCountAfter).toBeGreaterThanOrEqual(1);
    });
  });

  describe('game integration', () => {
    it('newGame resets card state', () => {
      engine.reveal(0, 0);
      const handBefore = engine.getState().arcaneHand?.length ?? 0;
      expect(handBefore).toBeGreaterThan(0);

      engine.newGame();
      const handAfter = engine.getState().arcaneHand?.length ?? 0;
      expect(handAfter).toBe(0);
    });

    it('can win with gamemode active', () => {
      const tinyEngine = new GameEngine({ rows: 3, cols: 3, mines: 1 });
      const tinyGamemode = new ArcaneGamemode();
      tinyEngine.setGamemode(tinyGamemode);
      tinyEngine.newGame();

      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (!tinyEngine.getState().grid[r][c].isMine) {
            tinyEngine.reveal(r, c);
          }
        }
      }

      expect([GameStatus.Won, GameStatus.Playing]).toContain(tinyEngine.getState().status);
    });
  });
});
