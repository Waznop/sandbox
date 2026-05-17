import './style.css';
import { GameEngine } from './engine/GameEngine';
import { Renderer } from './renderer';
import { PRESET_CONFIGS, GameStatus, Gamemode } from './types';
import type { Direction } from './types';
import { ArcaneGamemode, ShadowGamemode, ResourceGamemode, ChainGamemode, WardMazeGamemode } from './gamemodes';

const app = document.querySelector<HTMLDivElement>('#app')!;

// Initialize game with easy preset
let currentDifficulty = 'easy';
let currentGamemode: Gamemode = Gamemode.Classic;
let engine = new GameEngine(PRESET_CONFIGS.easy);
let renderer = new Renderer(app);

function initGamemode(mode: Gamemode): void {
  const config = PRESET_CONFIGS[currentDifficulty] ?? PRESET_CONFIGS.easy;

  // Create and set gamemode instance
  let gmInstance: any = null;
  switch (mode) {
    case Gamemode.Arcane:
      gmInstance = new ArcaneGamemode();
      break;
    case Gamemode.Shadow:
      gmInstance = new ShadowGamemode();
      break;
    case Gamemode.Resource:
      gmInstance = new ResourceGamemode();
      break;
    case Gamemode.Chain:
      gmInstance = new ChainGamemode();
      break;
    case Gamemode.WardMaze:
      gmInstance = new WardMazeGamemode();
      break;
  }

  if (gmInstance) {
    engine.setGamemode(gmInstance);
  }

  // Reinitialize with new gamemode
  engine.newGame(config);
  renderer.render(engine.getState());
}

// Wire up gamemode selector
renderer.getGamemodeSelector().addEventListener('change', (e) => {
  const sel = e.target as HTMLSelectElement;
  currentGamemode = sel.value as Gamemode;
  initGamemode(currentGamemode);
});

// Timer interval
let timerInterval: ReturnType<typeof setInterval> | null = null;

function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    if (engine.getState().status === GameStatus.Playing) {
      renderer.render(engine.getState());
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function handleReveal(row: number, col: number) {
  const stateBefore = engine.getState().status;
  engine.reveal(row, col);
  const state = engine.getState();

  if (stateBefore === GameStatus.Idle && state.status === GameStatus.Playing) {
    startTimer();
  }

  renderer.render(state);

  if (state.status === GameStatus.Won) {
    stopTimer();
    renderer.showWin(state.elapsedSeconds, currentDifficulty);
    renderer.saveScore(state.elapsedSeconds, engine.getConfig(), currentDifficulty);
    renderer.renderScores(currentDifficulty);
  } else if (state.status === GameStatus.Lost) {
    stopTimer();
    renderer.showLoss();
  }
}

function handleFlag(row: number, col: number) {
  const state = engine.getState();
  if (state.status !== GameStatus.Playing && state.status !== GameStatus.Idle) return;
  engine.toggleFlag(row, col);
  renderer.render(engine.getState());
}

function newGame(difficulty?: string) {
  stopTimer();
  currentDifficulty = difficulty ?? currentDifficulty;
  const config = PRESET_CONFIGS[currentDifficulty] ?? PRESET_CONFIGS.easy;
  engine.newGame(config);
  renderer.hideScores();
  renderer.render(engine.getState());
}

// Wire up mouse events
renderer.onCellClick((row, col) => {
  if (engine.getState().status === GameStatus.Won || engine.getState().status === GameStatus.Lost) return;
  handleReveal(row, col);
});

renderer.onCellRightClick((row, col) => {
  if (engine.getState().status === GameStatus.Won || engine.getState().status === GameStatus.Lost) return;
  handleFlag(row, col);
});

// Wire up face/new game button
renderer.getFaceBtn().addEventListener('click', () => {
  newGame();
});

// Difficulty selector
renderer.getDifficultySelector().addEventListener('change', (e) => {
  const sel = e.target as HTMLSelectElement;
  currentDifficulty = sel.value;
  initGamemode(currentGamemode);
});

// Keyboard input
const KEY_DIRECTION_MAP: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  q: 'up-left',
  e: 'up-right',
  z: 'down-left',
  c: 'down-right',
};

document.addEventListener('keydown', (e) => {
  const state = engine.getState();

  // New game on R key
  if (e.key === 'r' || e.key === 'R') {
    newGame();
    return;
  }

  // Toggle scores on H key
  if (e.key === 'h' || e.key === 'H') {
    if ((renderer as any)['scoresPanel'].style.display === 'none') {
      renderer.renderScores(currentDifficulty);
    } else {
      renderer.hideScores();
    }
    return;
  }

  if (state.status === GameStatus.Won || state.status === GameStatus.Lost) return;

  // Cursor movement — activate cursor highlight
  const direction = KEY_DIRECTION_MAP[e.key];
  if (direction) {
    e.preventDefault();
    renderer.setKeyboardActive(true);
    engine.moveCursor(direction);
    renderer.render(engine.getState());
    return;
  }

  // Reveal with Space or Enter
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    renderer.setKeyboardActive(true);
    const pos = state.playerPos;
    handleReveal(pos.row, pos.col);
    return;
  }

  // Flag with F key
  if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    renderer.setKeyboardActive(true);
    const pos = state.playerPos;
    handleFlag(pos.row, pos.col);
    return;
  }
});

// Handle window resize for responsive board
window.addEventListener('resize', () => {
  renderer.render(engine.getState());
});

// Initial render
renderer.render(engine.getState());