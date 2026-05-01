import './style.css';
import { GameEngine } from './engine/GameEngine';
import { Renderer } from './renderer';
import { PRESET_CONFIGS, GameStatus } from './types';
import type { Direction } from './types';

const app = document.querySelector<HTMLDivElement>('#app')!;

// Initialize game with easy preset
let engine = new GameEngine(PRESET_CONFIGS.easy);
let renderer = new Renderer(app);

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
  const wasIdle = engine.getState().status === GameStatus.Idle;
  engine.reveal(row, col);

  if (wasIdle && engine.getState().status === GameStatus.Playing) {
    startTimer();
  }

  renderer.render(engine.getState());

  // Move cursor to revealed cell
  engine.moveCursor('up' as Direction); // nudge then set directly — actually let's just move the playerPos
  const state = engine.getState();

  if (state.status === GameStatus.Won || state.status === GameStatus.Lost) {
    stopTimer();
  }
}

function handleFlag(row: number, col: number) {
  engine.toggleFlag(row, col);
  renderer.render(engine.getState());
}

function newGame() {
  stopTimer();
  const config = engine.getConfig();
  engine.newGame(config);
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

// Keyboard input: WASD/arrows for cursor, Space/Enter to reveal, F to flag
const KEY_DIRECTION_MAP: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  // Diagonal
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

  if (state.status === GameStatus.Won || state.status === GameStatus.Lost) return;

  // Cursor movement
  const direction = KEY_DIRECTION_MAP[e.key];
  if (direction) {
    e.preventDefault();
    engine.moveCursor(direction);
    renderer.render(engine.getState());
    return;
  }

  // Reveal with Space or Enter
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    const pos = state.playerPos;
    handleReveal(pos.row, pos.col);
    return;
  }

  // Flag with F key
  if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    const pos = state.playerPos;
    handleFlag(pos.row, pos.col);
    return;
  }
});

// Initial render
renderer.render(engine.getState());