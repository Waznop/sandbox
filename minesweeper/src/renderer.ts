import { CellState, GameStatus } from './types';
import type { Cell, GameState } from './types';

const CELL_SIZE = 32;

// Number colors matching classic Minesweeper
const NUMBER_COLORS: Record<number, string> = {
  1: '#0000ff',
  2: '#008000',
  3: '#ff0000',
  4: '#000080',
  5: '#800000',
  6: '#008080',
  7: '#000000',
  8: '#808080',
};

export class Renderer {
  private boardEl: HTMLElement;
  private statusEl: HTMLElement;
  private mineCountEl: HTMLElement;
  private timerEl: HTMLElement;
  private faceBtn: HTMLElement;

  constructor(container: HTMLElement) {
    // Build the game shell
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'game-header';

    this.mineCountEl = document.createElement('span');
    this.mineCountEl.className = 'mine-count';
    this.mineCountEl.textContent = '0';

    this.faceBtn = document.createElement('button');
    this.faceBtn.className = 'face-btn';
    this.faceBtn.textContent = '😊';
    this.faceBtn.title = 'New Game';

    this.timerEl = document.createElement('span');
    this.timerEl.className = 'timer';
    this.timerEl.textContent = '0';

    header.appendChild(this.mineCountEl);
    header.appendChild(this.faceBtn);
    header.appendChild(this.timerEl);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'game-status';

    this.boardEl = document.createElement('div');
    this.boardEl.className = 'board';

    container.appendChild(header);
    container.appendChild(this.statusEl);
    container.appendChild(this.boardEl);
  }

  getFaceBtn(): HTMLElement {
    return this.faceBtn;
  }

  render(state: GameState): void {
    // Update status
    if (state.status === GameStatus.Won) {
      this.statusEl.textContent = '🎉 You Win!';
      this.faceBtn.textContent = '😎';
    } else if (state.status === GameStatus.Lost) {
      this.statusEl.textContent = '💥 Game Over';
      this.faceBtn.textContent = '😵';
    } else if (state.status === GameStatus.Idle) {
      this.statusEl.textContent = 'Click or press Space to start';
      this.faceBtn.textContent = '😊';
    } else {
      this.statusEl.textContent = '';
      this.faceBtn.textContent = '😊';
    }

    // Update mine count and timer
    const rows = state.grid.length;
    const cols = rows > 0 ? state.grid[0].length : 0;
    const totalMines = rows * cols - state.totalSafeCells;
    this.mineCountEl.textContent = String(totalMines - state.flagsPlaced);
    this.timerEl.textContent = String(state.elapsedSeconds);

    // Rebuild board if dimensions changed
    const existingRows = this.boardEl.children.length;
    const existingCols = existingRows > 0 ? (this.boardEl.children[0] as HTMLElement).children.length : 0;

    if (existingRows !== rows || existingCols !== cols) {
      this.buildBoard(rows, cols);
    }

    // Update cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellEl = (this.boardEl.children[r] as HTMLElement).children[c] as HTMLElement;
        const cellData = state.grid[r][c];
        this.updateCell(cellEl, cellData);
      }
    }

    // Update cursor highlight
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellEl = (this.boardEl.children[r] as HTMLElement).children[c] as HTMLElement;
        if (r === state.playerPos.row && c === state.playerPos.col) {
          cellEl.classList.add('cursor');
        } else {
          cellEl.classList.remove('cursor');
        }
      }
    }
  }

  private buildBoard(rows: number, cols: number): void {
    this.boardEl.innerHTML = '';
    this.boardEl.style.gridTemplateColumns = `repeat(${cols}, ${CELL_SIZE}px)`;
    this.boardEl.style.gridTemplateRows = `repeat(${rows}, ${CELL_SIZE}px)`;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellEl = document.createElement('div');
        cellEl.className = 'cell hidden';
        cellEl.dataset.row = String(r);
        cellEl.dataset.col = String(c);
        this.boardEl.appendChild(cellEl);
      }
    }
  }

  private updateCell(el: HTMLElement, cell: Cell): void {
    // Remove all state classes
    el.classList.remove('hidden', 'revealed', 'flagged', 'mine', 'cursor');

    if (cell.state === CellState.Hidden) {
      el.className = 'cell hidden';
      el.textContent = '';
    } else if (cell.state === CellState.Flagged) {
      el.className = 'cell flagged';
      el.textContent = '🚩';
    } else if (cell.state === CellState.Revealed) {
      if (cell.isMine) {
        el.className = 'cell revealed mine';
        el.textContent = '💣';
      } else {
        el.className = 'cell revealed';
        const count = cell.adjacentMines;
        if (count > 0) {
          el.textContent = String(count);
          el.style.color = NUMBER_COLORS[count] || '#000';
        } else {
          el.textContent = '';
          el.style.color = '';
        }
      }
    }
  }

  onCellClick(handler: (row: number, col: number) => void): void {
    this.boardEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.dataset.row || !target.dataset.col) return;
      handler(Number(target.dataset.row), Number(target.dataset.col));
    });
  }

  onCellRightClick(handler: (row: number, col: number) => void): void {
    this.boardEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      if (!target.dataset.row || !target.dataset.col) return;
      handler(Number(target.dataset.row), Number(target.dataset.col));
    });
  }
}