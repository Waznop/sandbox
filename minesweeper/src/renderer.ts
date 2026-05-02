import { CellState, GameStatus, Gamemode } from './types';
import type { Cell, GameState, GameConfig, Card } from './types';

const CELL_SIZE = 32;

// Number colors matching classic Minesweeper
const NUMBER_COLORS: Record<number, string> = {
  1: '#3498db',   // blue
  2: '#27ae60',   // green
  3: '#e74c3c',   // red
  4: '#8e44ad',   // purple (classic dark blue)
  5: '#c0392b',   // maroon
  6: '#16a085',   // teal
  7: '#2c3e50',   // dark
  8: '#7f8c8d',   // gray
};

const STORAGE_KEY = 'minesweeper-high-scores';

export interface ScoreEntry {
  time: number;
  date: string;
  difficulty: string;
  config: GameConfig;
}

function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveScores(scores: ScoreEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch {
    // ignore storage errors
  }
}

export class Renderer {
  private boardEl: HTMLElement;
  private statusEl: HTMLElement;
  private mineCountEl: HTMLElement;
  private timerEl: HTMLElement;
  private faceBtn: HTMLElement;
  private difficultySelector!: HTMLSelectElement;
  private gamemodeSelector!: HTMLSelectElement;
  private scoresPanel!: HTMLElement;
  private gamemodeInfoEl!: HTMLElement;
  private arcaneHandEl!: HTMLElement;
  private resourceEnergyEl!: HTMLElement;
  private chainComboEl!: HTMLElement;
  private resourceEnergyBarEl!: HTMLElement;

  constructor(container: HTMLElement) {
    container.innerHTML = '';

    // Title
    const title = document.createElement('h1');
    title.className = 'game-title';
    title.textContent = '💣 Minesweeper';

    // Difficulty selector
    const diffWrap = document.createElement('div');
    diffWrap.className = 'difficulty-selector';
    const diffLabel = document.createElement('label');
    diffLabel.textContent = 'Difficulty:';
    diffLabel.htmlFor = 'difficulty';
    this.difficultySelector = document.createElement('select');
    this.difficultySelector.id = 'difficulty';
    for (const key of Object.keys({ easy: '', medium: '', hard: '' })) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key.charAt(0).toUpperCase() + key.slice(1);
      if (key === 'easy') opt.selected = true;
      this.difficultySelector.appendChild(opt);
    }
    diffWrap.appendChild(diffLabel);
    diffWrap.appendChild(this.difficultySelector);

    // Gamemode selector
    const gmWrap = document.createElement('div');
    gmWrap.className = 'difficulty-selector';
    const gmLabel = document.createElement('label');
    gmLabel.textContent = 'Mode:';
    gmLabel.htmlFor = 'gamemode';
    this.gamemodeSelector = document.createElement('select');
    this.gamemodeSelector.id = 'gamemode';
    const gamemodeOptions = [
      { value: Gamemode.Classic, label: 'Classic' },
      { value: Gamemode.Arcane, label: '🔮 Arcane' },
      { value: Gamemode.Shadow, label: '🌑 Shadow' },
      { value: Gamemode.Resource, label: '⚡ Resource' },
      { value: Gamemode.Chain, label: '🔥 Chain' },
    ];
    for (const opt of gamemodeOptions) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === Gamemode.Classic) option.selected = true;
      this.gamemodeSelector.appendChild(option);
    }
    gmWrap.appendChild(gmLabel);
    gmWrap.appendChild(this.gamemodeSelector);

    // Header bar: mine count, face, timer
    const header = document.createElement('div');
    header.className = 'game-header';

    this.mineCountEl = document.createElement('span');
    this.mineCountEl.className = 'mine-count';
    this.mineCountEl.textContent = '0';

    this.faceBtn = document.createElement('button');
    this.faceBtn.className = 'face-btn';
    this.faceBtn.textContent = '😊';
    this.faceBtn.title = 'New Game (R)';

    this.timerEl = document.createElement('span');
    this.timerEl.className = 'timer';
    this.timerEl.textContent = '0';

    header.appendChild(this.mineCountEl);
    header.appendChild(this.faceBtn);
    header.appendChild(this.timerEl);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'game-status';

    // Gamemode info bar
    this.gamemodeInfoEl = document.createElement('div');
    this.gamemodeInfoEl.className = 'gamemode-info';

    // Arcane hand display
    this.arcaneHandEl = document.createElement('div');
    this.arcaneHandEl.className = 'arcane-hand';
    this.arcaneHandEl.style.display = 'none';

    // Resource energy display
    this.resourceEnergyEl = document.createElement('div');
    this.resourceEnergyEl.className = 'resource-energy';
    this.resourceEnergyEl.style.display = 'none';
    const energyLabel = document.createElement('span');
    energyLabel.className = 'energy-label';
    energyLabel.textContent = '⚡';
    this.resourceEnergyEl.appendChild(energyLabel);
    this.resourceEnergyBarEl = document.createElement('div');
    this.resourceEnergyBarEl.className = 'energy-bar';
    this.resourceEnergyBarEl.style.width = '100%';
    this.resourceEnergyEl.appendChild(this.resourceEnergyBarEl);

    // Chain combo display
    this.chainComboEl = document.createElement('div');
    this.chainComboEl.className = 'chain-combo';
    this.chainComboEl.style.display = 'none';

    this.boardEl = document.createElement('div');
    this.boardEl.className = 'board';

    // Scores panel
    this.scoresPanel = document.createElement('div');
    this.scoresPanel.className = 'scores-panel';
    this.scoresPanel.style.display = 'none';

    container.appendChild(title);
    container.appendChild(diffWrap);
    container.appendChild(gmWrap);
    container.appendChild(header);
    container.appendChild(this.statusEl);
    container.appendChild(this.gamemodeInfoEl);
    container.appendChild(this.arcaneHandEl);
    container.appendChild(this.resourceEnergyEl);
    container.appendChild(this.chainComboEl);
    container.appendChild(this.boardEl);
    container.appendChild(this.scoresPanel);
  }

  getFaceBtn(): HTMLElement {
    return this.faceBtn;
  }

  getDifficultySelector(): HTMLSelectElement {
    return this.difficultySelector;
  }

  getGamemodeSelector(): HTMLSelectElement {
    return this.gamemodeSelector;
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
    this.mineCountEl.textContent = String(Math.max(0, totalMines - state.flagsPlaced));
    this.timerEl.textContent = String(state.elapsedSeconds);

    // ─── Gamemode Info ───────────────────────────────────────────────────
    this.renderGamemodeInfo(state);

    // ─── Gamemode-Specific UI ────────────────────────────────────────────
    this.renderArcaneHand(state);
    this.renderResourceEnergy(state);
    this.renderChainCombo(state);
    this.renderShadowFog(state);

    // ─── Board ───────────────────────────────────────────────────────────
    // Rebuild board if dimensions changed
    const expectedCells = rows * cols;
    if (this.boardEl.children.length !== expectedCells) {
      this.buildBoard(rows, cols);
    }

    // Update cells (board uses flat list, not 2D nested structure)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const cellEl = this.boardEl.children[index] as HTMLElement;
        const cellData = state.grid[r][c];
        this.updateCell(cellEl, cellData, state);
      }
    }

    // Update cursor highlight
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const cellEl = this.boardEl.children[index] as HTMLElement;
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
    // Responsive: use min for smaller screens
    const maxBoardWidth = Math.min(window.innerWidth - 48, cols * CELL_SIZE + (cols - 1));
    const cellSize = Math.floor(maxBoardWidth / cols);
    const actualCellSize = Math.max(cellSize, 24); // minimum 24px

    this.boardEl.style.gridTemplateColumns = `repeat(${cols}, ${actualCellSize}px)`;
    this.boardEl.style.gridTemplateRows = `repeat(${rows}, ${actualCellSize}px)`;

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

  private updateCell(el: HTMLElement, cell: Cell, _state: GameState): void {
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
        // Show energy cell indicator
        if (cell.isEnergyCell) {
          el.textContent = '⚡';
        }
      }
    }
  }

  // ─── Gamemode Info ─────────────────────────────────────────────────────

  private renderGamemodeInfo(state: GameState): void {
    const modeNames: Record<string, string> = {
      [Gamemode.Classic]: 'Classic Minesweeper',
      [Gamemode.Arcane]: '🔮 Arcane Minesweeper',
      [Gamemode.Shadow]: '🌑 Shadow Minesweeper',
      [Gamemode.Resource]: '⚡ Resource Minesweeper',
      [Gamemode.Chain]: '🔥 Chain Minesweeper',
    };
    this.gamemodeInfoEl.textContent = modeNames[state.gamemode] || 'Classic';
  }

  // ─── Arcane: Card Hand ─────────────────────────────────────────────────

  private renderArcaneHand(state: GameState): void {
    if (state.gamemode !== Gamemode.Arcane) {
      this.arcaneHandEl.style.display = 'none';
      return;
    }
    this.arcaneHandEl.style.display = 'block';
    this.arcaneHandEl.innerHTML = '';

    const hand = (state as GameState & { arcaneHand?: Card[] }).arcaneHand;
    if (!hand || hand.length === 0) {
      this.arcaneHandEl.textContent = 'No cards';
      return;
    }

    for (const card of hand) {
      const cardEl = document.createElement('div');
      cardEl.className = 'arcane-card';
      const rarityColors: Record<string, string> = {
        common: '#95a5a6',
        rare: '#3498db',
        legendary: '#f1c40f',
      };
      cardEl.style.borderLeft = `3px solid ${rarityColors[card.rarity] || '#95a5a6'}`;
      cardEl.textContent = card.name;
      cardEl.title = `${card.name}: ${card.description}`;
      this.arcaneHandEl.appendChild(cardEl);
    }
  }

  // ─── Resource: Energy Bar ──────────────────────────────────────────────

  private renderResourceEnergy(state: GameState): void {
    if (state.gamemode !== Gamemode.Resource) {
      this.resourceEnergyEl.style.display = 'none';
      return;
    }
    this.resourceEnergyEl.style.display = 'flex';

    const energy = (state as GameState & { resourceEnergy?: number }).resourceEnergy ?? 10;
    const maxEnergy = 20;
    const pct = Math.max(0, Math.min(100, (energy / maxEnergy) * 100));
    this.resourceEnergyBarEl.style.width = `${pct}%`;

    const energyLabel = this.resourceEnergyEl.querySelector('.energy-label') as HTMLElement;
    energyLabel.textContent = `⚡ ${energy}`;

    // Color based on energy level
    if (energy <= 2) {
      this.resourceEnergyBarEl.style.background = '#e74c3c';
    } else if (energy <= 5) {
      this.resourceEnergyBarEl.style.background = '#f39c12';
    } else {
      this.resourceEnergyBarEl.style.background = '#27ae60';
    }
  }

  // ─── Chain: Combo Meter ────────────────────────────────────────────────

  private renderChainCombo(state: GameState): void {
    if (state.gamemode !== Gamemode.Chain) {
      this.chainComboEl.style.display = 'none';
      return;
    }
    this.chainComboEl.style.display = 'block';

    const combo = (state as GameState & { chainCombo?: number }).chainCombo ?? 0;
    if (combo === 0) {
      this.chainComboEl.textContent = '';
      return;
    }

    this.chainComboEl.innerHTML = `🔥 Combo x${combo}`;
    const multiplier = combo >= 15 ? '🌟 BLAST!' : combo >= 10 ? '⛓ Chain!' : combo >= 5 ? '🧲 Flag!' : '';
    if (multiplier) {
      this.chainComboEl.innerHTML += ` <span class="combo-bonus">${multiplier}</span>`;
    }
  }

  // ─── Shadow: Fog Overlay ───────────────────────────────────────────────

  private renderShadowFog(state: GameState): void {
    if (state.gamemode !== Gamemode.Shadow) return;

    const fogMask = (state as GameState & { shadowFogMask?: boolean[][] }).shadowFogMask;
    if (!fogMask) return;

    const rows = state.grid.length;
    const cols = state.grid[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const cellEl = this.boardEl.children[index] as HTMLElement;
        const cellData = state.grid[r][c];

        if (!fogMask[r]?.[c] && cellData.state === CellState.Hidden) {
          cellEl.classList.add('fog-hidden');
          cellEl.textContent = '?';
          cellEl.style.opacity = '0.3';
        } else {
          cellEl.classList.remove('fog-hidden');
          cellEl.style.opacity = '';
        }
      }
    }
  }

  showWin(_time: number, _difficulty: string): void {
    this.statusEl.className = 'game-status win-flash';
    setTimeout(() => { this.statusEl.className = 'game-status'; }, 1500);
  }

  showLoss(): void {
    // Staggered mine reveal effect handled via CSS animation
    const mineCells = this.boardEl.querySelectorAll('.cell.mine');
    mineCells.forEach((el, i) => {
      (el as HTMLElement).style.animationDelay = `${i * 60}ms`;
      el.classList.add('explode');
    });
  }

  // High score management
  saveScore(time: number, config: GameConfig, difficulty: string): void {
    const scores = loadScores();
    scores.push({
      time,
      date: new Date().toISOString(),
      difficulty,
      config,
    });
    // Sort by time ascending (fastest first), keep top 10 per difficulty
    scores.sort((a, b) => a.time - b.time);
    saveScores(scores.slice(0, 50)); // Keep at most 50 total
  }

  getTopScores(difficulty: string, limit = 10): ScoreEntry[] {
    return loadScores()
      .filter(s => s.difficulty === difficulty)
      .sort((a, b) => a.time - b.time)
      .slice(0, limit);
  }

  renderScores(difficulty: string): void {
    const scores = this.getTopScores(difficulty);
    this.scoresPanel.innerHTML = '';

    if (scores.length === 0) {
      this.scoresPanel.textContent = `No ${difficulty} scores yet. Win a game!`;
      this.scoresPanel.style.display = 'block';
      return;
    }

    const title = document.createElement('h3');
    title.textContent = `🏆 Best ${difficulty} Times`;
    this.scoresPanel.appendChild(title);

    const table = document.createElement('table');
    table.className = 'scores-table';
    const headerRow = document.createElement('tr');
    for (const h of ['Rank', 'Time', 'Date']) {
      const th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    }
    table.appendChild(headerRow);

    scores.forEach((score, i) => {
      const tr = document.createElement('tr');
      const rankTd = document.createElement('td');
      rankTd.textContent = String(i + 1);
      const timeTd = document.createElement('td');
      timeTd.textContent = `${score.time}s`;
      const dateTd = document.createElement('td');
      dateTd.textContent = new Date(score.date).toLocaleDateString();
      tr.appendChild(rankTd);
      tr.appendChild(timeTd);
      tr.appendChild(dateTd);
      table.appendChild(tr);
    });

    this.scoresPanel.appendChild(table);
    this.scoresPanel.style.display = 'block';
  }

  hideScores(): void {
    this.scoresPanel.style.display = 'none';
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