import * as THREE from 'three';
import type { GraphicsQuality } from '../config/graphicsPresets';
import type { PlayerAnimState } from '../core/EventBus';

export interface GameState {
  graphicsQuality: GraphicsQuality;
  debugVisible: boolean;
  isPointerLocked: boolean;
  fps: number;
  playerPosition: THREE.Vector3;
  playerVelocity: THREE.Vector3;
  playerAnimState: PlayerAnimState;
  playerGrounded: boolean;
  cameraDistance: number;
}

export function createInitialGameState(): GameState {
  return {
    graphicsQuality: 'medium',
    debugVisible: false,
    isPointerLocked: false,
    fps: 60,
    playerPosition: new THREE.Vector3(),
    playerVelocity: new THREE.Vector3(),
    playerAnimState: 'idle',
    playerGrounded: true,
    cameraDistance: 4.2,
  };
}
