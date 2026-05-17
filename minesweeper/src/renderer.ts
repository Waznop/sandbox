import { CellState, GameStatus, Gamemode } from './types';
import type { Cell, GameState, GameConfig, Card } from './types';

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
  private gamemodeInstructionsEl!: HTMLElement;
  private arcaneHandEl!: HTMLElement;
  private resourceEnergyEl!: HTMLElement;
  private chainComboEl!: HTMLElement;
  private resourceEnergyBarEl!: HTMLElement;
  private wardMazeMovesEl!: HTMLElement;
  private _currentGrid: Cell[][] = [];
  private _keyboardActive = false;

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
      { value: Gamemode.WardMaze, label: '🗺️ Ward Maze' },
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

    // Gamemode instructions
    this.gamemodeInstructionsEl = document.createElement('div');
    this.gamemodeInstructionsEl.className = 'gamemode-instructions';

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

    // WardMaze move counter
    this.wardMazeMovesEl = document.createElement('div');
    this.wardMazeMovesEl.className = 'wardmaze-moves';
    this.wardMazeMovesEl.style.display = 'none';

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
    container.appendChild(this.gamemodeInstructionsEl);
    container.appendChild(this.arcaneHandEl);
    container.appendChild(this.resourceEnergyEl);
    container.appendChild(this.chainComboEl);
    container.appendChild(this.wardMazeMovesEl);
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
      if (state.gamemode === Gamemode.WardMaze) {
        const moves = (state as GameState & { wardMazeMoves?: number }).wardMazeMoves ?? 0;
        this.statusEl.textContent = `🎉 You Win! (${moves} moves)`;
      } else {
        this.statusEl.textContent = '🎉 You Win!';
      }
      this.faceBtn.textContent = '😎';
    } else if (state.status === GameStatus.Lost) {
      this.statusEl.textContent = '💥 Game Over';
      this.faceBtn.textContent = '😵';
    } else if (state.status === GameStatus.Idle) {
      if (state.gamemode === Gamemode.WardMaze) {
        this.statusEl.textContent = 'Tap any cell to start';
      } else {
        this.statusEl.textContent = 'Click or press Space to start';
      }
      this.faceBtn.textContent = '😊';
    } else {
      if (state.gamemode === Gamemode.WardMaze) {
        this.statusEl.textContent = 'Reach the 🚩!';
      } else {
        this.statusEl.textContent = '';
      }
      this.faceBtn.textContent = '😊';
    }

    // Update mine count and timer
    const rows = state.grid.length;
    const cols = rows > 0 ? state.grid[0].length : 0;
    if (state.gamemode === Gamemode.WardMaze) {
      const wards = (state as GameState & { wardMazeWards?: { row: number; col: number }[] }).wardMazeWards;
      this.mineCountEl.textContent = `🛡 ${(wards ?? []).length}`;
    } else {
      const totalMines = rows * cols - state.totalSafeCells;
      this.mineCountEl.textContent = String(Math.max(0, totalMines - state.flagsPlaced));
    }
    this.timerEl.textContent = String(state.elapsedSeconds);

    // ─── Gamemode Info ───────────────────────────────────────────────────
    this.renderGamemodeInfo(state);

    // ─── Gamemode-Specific UI ────────────────────────────────────────────
    this.renderArcaneHand(state);
    this.renderResourceEnergy(state);
    this.renderChainCombo(state);
    this.renderShadowFog(state);
    this.renderWardMaze(state);

    // ─── Board ───────────────────────────────────────────────────────────
    // Store grid for click handler (needed to detect flagged cells on mobile)
    this._currentGrid = state.grid;

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

    // Update cursor highlight (only when keyboard is active)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const cellEl = this.boardEl.children[index] as HTMLElement;
        if (this._keyboardActive && r === state.playerPos.row && c === state.playerPos.col) {
          cellEl.classList.add('cursor');
        } else {
          cellEl.classList.remove('cursor');
        }
      }
    }
  }

  private buildBoard(rows: number, cols: number): void {
    this.boardEl.innerHTML = '';
    // Calculate cell size: fit available width, bounded by min and max
    const vw = window.innerWidth;
    let isMobile = vw <= 480;
    try {
      if (window.matchMedia('(pointer: coarse)').matches) isMobile = true;
    } catch { /* tests */ }

    const minCellSize = isMobile ? 44 : 24;
    const maxCellSize = isMobile ? 60 : 48; // cap to prevent huge cells on big screens
    const gapTotal = cols - 1;
    const availableWidth = window.innerWidth - 48;
    const cellSize = Math.floor((availableWidth - gapTotal) / cols);
    const actualCellSize = Math.min(Math.max(cellSize, minCellSize), maxCellSize);

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
      [Gamemode.WardMaze]: '🗺️ Ward Maze',
    };
    this.gamemodeInfoEl.textContent = modeNames[state.gamemode] || 'Classic';

    const instructions: Record<string, string> = {
      [Gamemode.Classic]: 'Tap to reveal. Long-press to flag. Numbers show adjacent mines.',
      [Gamemode.Arcane]: 'Tap to reveal and draw cards. Each card triggers automatically: Shield protects one hit, Detonate reveals neighbors, Scanner finds a safe cell, Chain clears zeros.',
      [Gamemode.Shadow]: 'Only cells near revealed tiles are visible. Tap to reveal and expand the fog.',
      [Gamemode.Resource]: 'Reveals cost 1 energy, flags cost 2. ⚡ Energy cells restore 2 energy. You cannot reveal or flag without enough energy — actions are blocked when energy is too low. Don\'t run out!',
      [Gamemode.Chain]: 'Quick successive reveals build combos. 3x auto-flags, 5x clears zeros, 8x blasts a 3×3 area.',
      [Gamemode.WardMaze]: 'Tap ♟ to select yourself, then tap an adjacent cell to move. Tap a ward (🛡 number) to select it, then tap anywhere to relocate it. Reach 🚩 in the fewest moves. Wards destroyed on mines!',
    };
    this.gamemodeInstructionsEl.textContent = instructions[state.gamemode] || '';
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
      // Show low energy warning
      let warningEl = this.resourceEnergyEl.querySelector('.energy-warning') as HTMLElement;
      if (!warningEl) {
        warningEl = document.createElement('span');
        warningEl.className = 'energy-warning';
        warningEl.style.color = '#e74c3c';
        warningEl.style.fontSize = '0.75rem';
        warningEl.style.fontWeight = 'bold';
        warningEl.textContent = '⚠ LOW ENERGY!';
        this.resourceEnergyEl.appendChild(warningEl);
      }
      warningEl.style.display = 'inline';
    } else {
      // Hide warning if energy is sufficient
      const warningEl = this.resourceEnergyEl.querySelector('.energy-warning') as HTMLElement | null;
      if (warningEl) warningEl.style.display = 'none';
      this.resourceEnergyBarEl.style.background = energy <= 5 ? '#f39c12' : '#27ae60';
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
    // Show next threshold bonus
    if (combo >= 8) {
      this.chainComboEl.innerHTML += ` <span class="combo-bonus">🌟 BLAST!</span>`;
    } else if (combo >= 5) {
      this.chainComboEl.innerHTML += ` <span class="combo-bonus">⛓ Chain!</span>`;
    } else if (combo >= 3) {
      this.chainComboEl.innerHTML += ` <span class="combo-bonus">🧲 Flag!</span>`;
    } else {
      this.chainComboEl.innerHTML += ` <span class="combo-bonus" style="opacity:0.5">Next: 3x Flag!</span>`;
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

  // ─── WardMaze: Player, Goal, Wards, Selection ─────────────────────────

  private renderWardMaze(state: GameState): void {
    const isWardMaze = state.gamemode === Gamemode.WardMaze;

    if (!isWardMaze) {
      this.wardMazeMovesEl.style.display = 'none';
      return;
    }

    this.wardMazeMovesEl.style.display = 'block';

    const wmState = state as GameState & {
      wardMazePlayerPos?: { row: number; col: number };
      wardMazeGoalPos?: { row: number; col: number };
      wardMazeWards?: { row: number; col: number }[];
      wardMazeMoves?: number;
      wardMazeSelectedWardIndex?: number | null;
      wardMazePlayerSelected?: boolean;
    };

    // Update move counter
    const moves = wmState.wardMazeMoves ?? 0;
    this.wardMazeMovesEl.textContent = `Moves: ${moves}`;

    const rows = state.grid.length;
    const cols = state.grid[0].length;
    const playerPos = wmState.wardMazePlayerPos;
    const goalPos = wmState.wardMazeGoalPos;
    const wards = wmState.wardMazeWards ?? [];
    const selectedWardIdx = wmState.wardMazeSelectedWardIndex;
    const playerSelected = wmState.wardMazePlayerSelected ?? false;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const cellEl = this.boardEl.children[index] as HTMLElement;

        // Clear WardMaze-specific classes
        cellEl.classList.remove('wardmaze-player', 'wardmaze-goal', 'wardmaze-ward', 'wardmaze-selected');

        // Player position
        if (playerPos && r === playerPos.row && c === playerPos.col) {
          cellEl.classList.add('wardmaze-player');
          cellEl.textContent = '♟';
        }

        // Goal position
        if (goalPos && r === goalPos.row && c === goalPos.col) {
          cellEl.classList.add('wardmaze-goal');
          // Only show goal if not on player
          if (!(playerPos && r === playerPos.row && c === playerPos.col)) {
            cellEl.textContent = '🚩';
          }
        }

        // Wards
        const wardIdx = wards.findIndex(w => w.row === r && w.col === c);
        if (wardIdx !== -1) {
          cellEl.classList.add('wardmaze-ward');
          const cell = state.grid[r][c];
          if (cell.isMine) {
            cellEl.textContent = '💣';
          } else {
            const count = cell.adjacentMines;
            cellEl.textContent = count > 0 ? String(count) : '🛡';
            if (count > 0) {
              cellEl.style.color = NUMBER_COLORS[count] || '#000';
            }
          }
          // Selection highlight
          if (selectedWardIdx === wardIdx) {
            cellEl.classList.add('wardmaze-selected');
          }
        }

        // Player selection highlight
        if (playerSelected && playerPos && r === playerPos.row && c === playerPos.col) {
          cellEl.classList.add('wardmaze-selected');
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

  setKeyboardActive(active: boolean): void {
    this._keyboardActive = active;
  }

  onCellClick(handler: (row: number, col: number) => void): void {
    // Desktop: click
    this.boardEl.addEventListener('click', (e) => {
      this._keyboardActive = false;
      const target = e.target as HTMLElement;
      if (!target.dataset.row || !target.dataset.col) return;
      const row = Number(target.dataset.row);
      const col = Number(target.dataset.col);
      const cell = this._currentGrid[row]?.[col];
      if (cell?.state === CellState.Flagged) return;
      handler(row, col);
    });

    // Mobile: pointer events (no click race condition)
    let pointerDownInfo: { row: number; col: number; startTime: number } | null = null;

    this.boardEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        const target = e.target as HTMLElement;
        if (target && target.dataset.row && target.dataset.col) {
          pointerDownInfo = {
            row: Number(target.dataset.row),
            col: Number(target.dataset.col),
            startTime: Date.now(),
          };
        }
      }
    });

    this.boardEl.addEventListener('pointerup', (e) => {
      if (pointerDownInfo && (e.pointerType === 'touch' || e.pointerType === 'pen')) {
        this._keyboardActive = false;
        // Only reveal for short taps (<=500ms)
        if (Date.now() - pointerDownInfo.startTime <= 500) {
          handler(pointerDownInfo.row, pointerDownInfo.col);
        }
        pointerDownInfo = null;
      }
    });

    this.boardEl.addEventListener('pointermove', () => {
      pointerDownInfo = null;
    });
  }

  onCellRightClick(handler: (row: number, col: number) => void): void {
    // Desktop: right-click
    this.boardEl.addEventListener('contextmenu', (e) => {
      this._keyboardActive = false;
      e.preventDefault();
      const target = e.target as HTMLElement;
      if (!target.dataset.row || !target.dataset.col) return;
      handler(Number(target.dataset.row), Number(target.dataset.col));
    });

    // Mobile: pointer events (no click race condition)
    let pointerDownInfo: { row: number; col: number; startTime: number } | null = null;

    this.boardEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        const target = e.target as HTMLElement;
        if (target && target.dataset.row && target.dataset.col) {
          pointerDownInfo = {
            row: Number(target.dataset.row),
            col: Number(target.dataset.col),
            startTime: Date.now(),
          };
        }
      }
    });

    this.boardEl.addEventListener('pointerup', (e) => {
      if (pointerDownInfo && (e.pointerType === 'touch' || e.pointerType === 'pen')) {
        this._keyboardActive = false;
        // Flag only for long presses (>500ms)
        if (Date.now() - pointerDownInfo.startTime > 500) {
          handler(pointerDownInfo.row, pointerDownInfo.col);
        }
        pointerDownInfo = null;
      }
    });

    this.boardEl.addEventListener('pointermove', () => {
      pointerDownInfo = null;
    });
  }
}