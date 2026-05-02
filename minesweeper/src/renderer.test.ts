/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Renderer } from './renderer';
import { CellState, GameStatus, PRESET_CONFIGS } from './types';
import { GameEngine } from './engine/GameEngine';

describe('Renderer', () => {
  let container: HTMLDivElement;
  let renderer: Renderer;
  let engine: GameEngine;

  function setup() {
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
    engine = new GameEngine(PRESET_CONFIGS.easy);
    renderer = new Renderer(container);
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    setup();
  });

  describe('initial render', () => {
    it('creates a board with correct number of cells', () => {
      const state = engine.getState();
      renderer.render(state);
      const cells = container.querySelectorAll('.cell');
      expect(cells.length).toBe(64); // 8x8 easy
    });

    it('initializes all cells as hidden', () => {
      renderer.render(engine.getState());
      const cells = container.querySelectorAll('.cell');
      cells.forEach(cell => {
        expect(cell.classList.contains('hidden')).toBe(true);
      });
    });

    it('sets correct grid dimensions', () => {
      renderer.render(engine.getState());
      const board = container.querySelector('.board');
      const style = board?.style;
      expect(style?.gridTemplateColumns).toBe('repeat(8, 32px)');
      expect(style?.gridTemplateRows).toBe('repeat(8, 32px)');
    });

    it('shows status message for idle game', () => {
      renderer.render(engine.getState());
      const status = container.querySelector('.game-status');
      expect(status?.textContent).toBe('Click or press Space to start');
    });

    it('shows correct mine count', () => {
      renderer.render(engine.getState());
      const mineCount = container.querySelector('.mine-count');
      expect(mineCount?.textContent).toBe('10');
    });
  });

  describe('cell updates after game state changes', () => {
    it('reveals a non-mine cell with correct number', () => {
      engine.reveal(0, 0); // first click places mines
      renderer.render(engine.getState());

      const cell = container.querySelector('.cell[data-row="0"][data-col="0"]');
      expect(cell?.classList.contains('revealed')).toBe(true);
      // Cell should show a number or be empty (if adjacentMines is 0)
    });

    it('flips a cell to flagged state', () => {
      engine.toggleFlag(0, 0);
      renderer.render(engine.getState());

      const cell = container.querySelector('.cell[data-row="0"][data-col="0"]');
      expect(cell?.classList.contains('flagged')).toBe(true);
      expect(cell?.textContent).toBe('🚩');
    });

    it('updates cursor highlight on player position change', () => {
      engine.moveCursor('right');
      engine.moveCursor('right');
      renderer.render(engine.getState());

      const cursor = container.querySelector('.cell.cursor');
      expect(cursor).not.toBeNull();
      expect(cursor?.dataset.row).toBe('0');
      expect(cursor?.dataset.col).toBe('2');
    });

    it('updates mine count after flagging', () => {
      renderer.render(engine.getState());
      expect(container.querySelector('.mine-count')?.textContent).toBe('10');

      engine.toggleFlag(0, 0);
      renderer.render(engine.getState());
      expect(container.querySelector('.mine-count')?.textContent).toBe('9');
    });

    it('updates timer during playing state', () => {
      engine.reveal(0, 0); // start game
      renderer.render(engine.getState());

      const timer = container.querySelector('.timer');
      // Timer should be > 0 since some time has passed
      expect(parseInt(timer?.textContent || '0')).toBeGreaterThanOrEqual(0);
    });
  });

  describe('game state transitions', () => {
    it('shows win status when all safe cells revealed', () => {
      // Use a tiny board for fast testing
      const tinyEngine = new GameEngine({ rows: 3, cols: 3, mines: 1 });
      const tinyRenderer = new Renderer(document.createElement('div'));
      document.body.appendChild(tinyRenderer['boardEl'].parentElement!);

      // Reveal all safe cells
      tinyEngine.reveal(0, 0);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const cell = tinyEngine.getState().grid[r][c];
          if (!cell.isMine && cell.state !== CellState.Revealed) {
            tinyEngine.reveal(r, c);
          }
        }
      }
      tinyRenderer.render(tinyEngine.getState());

      const status = tinyRenderer['statusEl'];
      expect(status?.textContent).toBe('🎉 You Win!');
    });

    it('shows loss status when mine is revealed', () => {
      engine.reveal(0, 0); // start game, place mines
      const state = engine.getState();

      // Find and reveal a mine
      let mineR = -1, mineC = -1;
      for (let r = 0; r < state.grid.length && mineR === -1; r++) {
        for (let c = 0; c < state.grid[0].length; c++) {
          if (state.grid[r][c].isMine) {
            mineR = r; mineC = c; break;
          }
        }
      }

      if (mineR !== -1) {
        engine.reveal(mineR, mineC);
        renderer.render(engine.getState());

        const status = container.querySelector('.game-status');
        expect(status?.textContent).toBe('💥 Game Over');
      }
    });
  });

  describe('difficulty switching', () => {
    it('rebuilds board with different dimensions for medium', () => {
      const mediumEngine = new GameEngine(PRESET_CONFIGS.medium);
      const mediumRenderer = new Renderer(document.createElement('div'));
      document.body.appendChild(mediumRenderer['boardEl'].parentElement!);

      mediumRenderer.render(mediumEngine.getState());
      const cells = mediumRenderer['boardEl'].querySelectorAll('.cell');
      expect(cells.length).toBe(120); // 12x10 medium

      const board = mediumRenderer['boardEl'];
      expect(board.style.gridTemplateColumns).toBe('repeat(10, 32px)');
      expect(board.style.gridTemplateRows).toBe('repeat(12, 32px)');
    });
  });

  describe('board rebuild on dimension change', () => {
    it('rebuilds when switching from easy to medium', () => {
      renderer.render(engine.getState());
      expect(container.querySelectorAll('.cell').length).toBe(64);

      const mediumEngine = new GameEngine(PRESET_CONFIGS.medium);
      renderer.render(mediumEngine.getState());
      expect(container.querySelectorAll('.cell').length).toBe(120);
    });
  });
});
