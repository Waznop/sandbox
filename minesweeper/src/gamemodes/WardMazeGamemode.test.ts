/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine/GameEngine';
import { WardMazeGamemode } from './WardMazeGamemode';
import { PRESET_CONFIGS } from '../types';

describe('WardMazeGamemode', () => {
  let engine: GameEngine;
  let gamemode: WardMazeGamemode;

  beforeEach(() => {
    engine = new GameEngine(PRESET_CONFIGS.easy);
    gamemode = new WardMazeGamemode();
    engine.setGamemode(gamemode);
    engine.newGame();
  });

  describe('initialization', () => {
    it('places player at bottom-left', () => {
      const state = engine.getState();
      const playerPos = state.wardMazePlayerPos as { row: number; col: number } | undefined;
      expect(playerPos).toBeDefined();
      expect(playerPos?.row).toBe(7); // rows - 1 = 8 - 1 = 7
      expect(playerPos?.col).toBe(0);
    });

    it('places goal at top-right', () => {
      const state = engine.getState();
      const goalPos = state.wardMazeGoalPos as { row: number; col: number } | undefined;
      expect(goalPos).toBeDefined();
      expect(goalPos?.row).toBe(0);
      expect(goalPos?.col).toBe(7); // cols - 1 = 8 - 1 = 7
    });

    it('initializes 3 wards adjacent to player start', () => {
      const state = engine.getState();
      const wards = state.wardMazeWards as { row: number; col: number }[] | undefined;
      expect(wards).toBeDefined();
      expect(wards?.length).toBe(3);

      // All wards should be adjacent to player start (7, 0)
      for (const ward of wards!) {
        const dr = Math.abs(ward.row - 7);
        const dc = Math.abs(ward.col - 0);
        expect(dr <= 1 && dc <= 1 && (dr + dc > 0)).toBe(true);
      }
    });

    it('starts with 0 moves', () => {
      const state = engine.getState();
      expect(state.wardMazeMoves).toBe(0);
    });

    it('has no selection initially', () => {
      const state = engine.getState();
      expect(state.wardMazeSelectedWardIndex).toBeNull();
      expect(state.wardMazePlayerSelected).toBe(false);
    });
  });

  describe('ward movement', () => {
    it('selects a ward on first tap, moves it on second tap', () => {
      const stateBefore = engine.getState();
      const wardsBefore = stateBefore.wardMazeWards as { row: number; col: number }[];
      const ward0 = wardsBefore[0];

      // First tap: select the ward (also starts the game)
      engine.reveal(ward0.row, ward0.col);
      const stateAfterSelect = engine.getState();
      expect(stateAfterSelect.wardMazeSelectedWardIndex).toBe(0);
      expect(stateAfterSelect.wardMazeMoves).toBe(0); // No move yet
      expect(stateAfterSelect.status).toBe('playing');

      // Second tap: move the ward to the goal cell (guaranteed safe)
      const goalPos = stateAfterSelect.wardMazeGoalPos as { row: number; col: number };
      engine.reveal(goalPos.row, goalPos.col);
      const stateAfterMove = engine.getState();
      const wardsAfter = stateAfterMove.wardMazeWards as { row: number; col: number }[];
      expect(wardsAfter[0].row).toBe(goalPos.row);
      expect(wardsAfter[0].col).toBe(goalPos.col);
      expect(stateAfterMove.wardMazeMoves).toBe(1);
      expect(stateAfterMove.wardMazeSelectedWardIndex).toBeNull(); // Deselected after move
    });

    it('increments move count when moving a ward', () => {
      const stateBefore = engine.getState();
      const wards = stateBefore.wardMazeWards as { row: number; col: number }[];
      const goalPos = stateBefore.wardMazeGoalPos as { row: number; col: number };

      // Move ward 0 to goal (safe)
      engine.reveal(wards[0].row, wards[0].col);
      engine.reveal(goalPos.row, goalPos.col);
      expect(engine.getState().wardMazeMoves).toBe(1);

      // Move ward 1 to (5, 0) - within first-click safe zone
      engine.reveal(wards[1].row, wards[1].col);
      engine.reveal(5, 0);
      expect(engine.getState().wardMazeMoves).toBe(2);
    });

    it('destroys ward when moved onto a mine', () => {
      // Start the game by clicking on a ward (not player)
      const state = engine.getState();
      const wards = state.wardMazeWards as { row: number; col: number }[];

      // Click ward 0 to start game + select it
      engine.reveal(wards[0].row, wards[0].col);
      expect(engine.getState().status).toBe('playing');

      // Find a mine location
      const stateAfterStart = engine.getState();
      let mineRow = -1, mineCol = -1;
      outer:
      for (let r = 0; r < stateAfterStart.grid.length; r++) {
        for (let c = 0; c < stateAfterStart.grid[0].length; c++) {
          if (stateAfterStart.grid[r][c].isMine) {
            mineRow = r;
            mineCol = c;
            break outer;
          }
        }
      }
      expect(mineRow).toBeGreaterThanOrEqual(0);

      // Ward 0 is already selected, move it onto the mine
      engine.reveal(mineRow, mineCol);

      const stateAfter = engine.getState();
      const wardsAfter = stateAfter.wardMazeWards as { row: number; col: number }[];
      // Ward should be destroyed (1 less)
      expect(wardsAfter.length).toBe(wards.length - 1);
    });

    it('cannot move ward to player position', () => {
      const state = engine.getState();
      const wards = state.wardMazeWards as { row: number; col: number }[];
      const playerPos = state.wardMazePlayerPos as { row: number; col: number };

      // Select ward, try to move to player position
      engine.reveal(wards[0].row, wards[0].col);
      engine.reveal(playerPos.row, playerPos.col);

      const stateAfter = engine.getState();
      const wardsAfter = stateAfter.wardMazeWards as { row: number; col: number }[];
      // Ward should not have moved
      expect(wardsAfter[0].row).toBe(wards[0].row);
      expect(wardsAfter[0].col).toBe(wards[0].col);
    });

    it('cannot move ward to another ward position', () => {
      const state = engine.getState();
      const wards = state.wardMazeWards as { row: number; col: number }[];

      // Select ward 0, try to move to ward 1's position
      engine.reveal(wards[0].row, wards[0].col);
      engine.reveal(wards[1].row, wards[1].col);

      const stateAfter = engine.getState();
      const wardsAfter = stateAfter.wardMazeWards as { row: number; col: number }[];
      // Ward 0 should not have moved
      expect(wardsAfter[0].row).toBe(wards[0].row);
      expect(wardsAfter[0].col).toBe(wards[0].col);
    });
  });

  describe('player movement', () => {
    it('selects player on first tap, moves on second tap to adjacent cell', () => {
      // Use a larger board so player has room to move
      const bigEngine = new GameEngine({ rows: 10, cols: 10, mines: 15 });
      const bigGamemode = new WardMazeGamemode();
      bigEngine.setGamemode(bigGamemode);
      bigEngine.newGame();

      const state = bigEngine.getState();
      const playerPos = state.wardMazePlayerPos as { row: number; col: number };
      const wards = state.wardMazeWards as { row: number; col: number }[];
      expect(playerPos.row).toBe(9); // bottom-left
      expect(playerPos.col).toBe(0);

      // First, move ward 0 out of the way so player can move up
      // Ward 0 is at (8, 0) - the cell directly above player
      bigEngine.reveal(wards[0].row, wards[0].col); // select ward 0 (also starts game)
      bigEngine.reveal(5, 5); // move ward 0 away

      // Now select player
      bigEngine.reveal(playerPos.row, playerPos.col);
      const stateAfterSelect = bigEngine.getState();
      expect(stateAfterSelect.wardMazePlayerSelected).toBe(true);

      // Move player up (should now be free)
      bigEngine.reveal(playerPos.row - 1, playerPos.col);
      const stateAfterMove = bigEngine.getState();
      const newPlayerPos = stateAfterMove.wardMazePlayerPos as { row: number; col: number };
      expect(newPlayerPos.row).toBe(playerPos.row - 1);
      expect(newPlayerPos.col).toBe(playerPos.col);
      expect(stateAfterMove.wardMazeMoves).toBe(2); // 1 for ward move + 1 for player move
      expect(stateAfterMove.wardMazePlayerSelected).toBe(false);
    });

    it('cannot move player to non-adjacent cell', () => {
      const state = engine.getState();
      const playerPos = state.wardMazePlayerPos as { row: number; col: number };

      // Select player, try to move far away
      engine.reveal(playerPos.row, playerPos.col);
      engine.reveal(0, 0);

      const stateAfter = engine.getState();
      const newPlayerPos = stateAfter.wardMazePlayerPos as { row: number; col: number };
      // Player should not have moved
      expect(newPlayerPos.row).toBe(playerPos.row);
      expect(newPlayerPos.col).toBe(playerPos.col);
    });

    it('cannot move player onto a ward', () => {
      const state = engine.getState();
      const playerPos = state.wardMazePlayerPos as { row: number; col: number };
      const wards = state.wardMazeWards as { row: number; col: number }[];

      // Select player, try to move onto a ward
      engine.reveal(playerPos.row, playerPos.col);
      engine.reveal(wards[0].row, wards[0].col);

      const stateAfter = engine.getState();
      const newPlayerPos = stateAfter.wardMazePlayerPos as { row: number; col: number };
      expect(newPlayerPos.row).toBe(playerPos.row);
      expect(newPlayerPos.col).toBe(playerPos.col);
    });
  });

  describe('win/lose conditions', () => {
    it('wins when player reaches goal', () => {
      // Use a 4x4 board - player at (3,0), goal at (0,3)
      const tinyEngine = new GameEngine({ rows: 4, cols: 4, mines: 2 });
      const tinyGamemode = new WardMazeGamemode();
      tinyEngine.setGamemode(tinyGamemode);
      tinyEngine.newGame();

      const state = tinyEngine.getState();
      const wards = state.wardMazeWards as { row: number; col: number }[];

      // Move all wards far away from player path
      // Wards start at (2,0), (3,1), (2,1) - adjacent to player (3,0)
      // Move them to row 0, cols 0,1,2 (goal is at 0,3)
      for (let i = 0; i < wards.length; i++) {
        tinyEngine.reveal(wards[i].row, wards[i].col); // select ward i
        tinyEngine.reveal(0, i); // move to (0,0), (0,1), (0,2)
      }

      // Verify wards are out of the way
      const wardsAfterMove = tinyEngine.getState().wardMazeWards as { row: number; col: number }[];
      const wardKeys = new Set(wardsAfterMove.map(w => `${w.row},${w.col}`));
      // Player path: (3,0) -> (2,1) -> (1,2) -> (0,3)
      expect(wardKeys.has('2,1')).toBe(false);
      expect(wardKeys.has('1,2')).toBe(false);
      expect(wardKeys.has('0,3')).toBe(false);

      // Navigate: (3,0) -> (2,1)
      tinyEngine.reveal(3, 0); // select player (also starts game)
      expect(tinyEngine.getState().status).toBe('playing');
      tinyEngine.reveal(2, 1); // move to (2,1)
      let pos = tinyEngine.getState().wardMazePlayerPos as { row: number; col: number };
      expect(pos).toEqual({ row: 2, col: 1 });

      // Navigate: (2,1) -> (1,2)
      tinyEngine.reveal(2, 1); // select player
      tinyEngine.reveal(1, 2); // move to (1,2)
      pos = tinyEngine.getState().wardMazePlayerPos as { row: number; col: number };
      expect(pos).toEqual({ row: 1, col: 2 });

      // Navigate: (1,2) -> (0,3) GOAL!
      tinyEngine.reveal(1, 2); // select player
      tinyEngine.reveal(0, 3); // move to goal
      pos = tinyEngine.getState().wardMazePlayerPos as { row: number; col: number };
      expect(pos).toEqual({ row: 0, col: 3 });
      expect(tinyEngine.getState().status).toBe('won');
    });

    it('loses when player steps on an undetected mine', () => {
      const tinyEngine = new GameEngine({ rows: 4, cols: 4, mines: 3 });
      const tinyGamemode = new WardMazeGamemode();
      tinyEngine.setGamemode(tinyGamemode);
      tinyEngine.newGame();

      // Start the game by clicking player start
      tinyEngine.reveal(3, 0);

      // Find a mine that's adjacent to player start but not covered by a ward
      const state = tinyEngine.getState();
      const wards = state.wardMazeWards as { row: number; col: number }[];
      const wardKeys = new Set(wards.map(w => `${w.row},${w.col}`));

      let mineRow = -1, mineCol = -1;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = 3 + dr;
          const nc = 0 + dc;
          if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4) {
            if (state.grid[nr][nc].isMine && !wardKeys.has(`${nr},${nc}`)) {
              mineRow = nr;
              mineCol = nc;
            }
          }
        }
        if (mineRow >= 0) break;
      }

      if (mineRow >= 0) {
        // Deselect player first (right-click), then re-select and move to mine
        tinyEngine.toggleFlag(0, 0); // deselect
        tinyEngine.reveal(3, 0); // select player
        tinyEngine.reveal(mineRow, mineCol); // move to mine
        expect(tinyEngine.getState().status).toBe('lost');
      }
    });
  });

  describe('game integration', () => {
    it('game starts on first click', () => {
      expect(engine.getState().status).toBe('idle');

      // Click anywhere to start
      engine.reveal(7, 0);

      expect(engine.getState().status).toBe('playing');
    });

    it('right-click deselects', () => {
      const state = engine.getState();
      const wards = state.wardMazeWards as { row: number; col: number }[];
      const playerPos = state.wardMazePlayerPos as { row: number; col: number };

      // Select a ward
      engine.reveal(wards[0].row, wards[0].col);
      expect(engine.getState().wardMazeSelectedWardIndex).toBe(0);

      // Right-click to deselect
      engine.toggleFlag(0, 0);
      expect(engine.getState().wardMazeSelectedWardIndex).toBeNull();

      // Select player
      engine.reveal(playerPos.row, playerPos.col);
      expect(engine.getState().wardMazePlayerSelected).toBe(true);

      // Right-click to deselect
      engine.toggleFlag(0, 0);
      expect(engine.getState().wardMazePlayerSelected).toBe(false);
    });
  });
});
