import { GameEngine } from './game/GameEngine';

const container = document.getElementById('game-container');
const hudRoot = document.getElementById('hud-root');

if (!container || !hudRoot) {
  throw new Error('Missing #game-container or #hud-root element');
}

const engine = new GameEngine(container, hudRoot);
engine.start();

// Expose read-only test/debug hook for browser QA inspection
declare global {
  interface Window {
    __KFIR_GAME__?: GameEngine;
  }
}
window.__KFIR_GAME__ = engine;
