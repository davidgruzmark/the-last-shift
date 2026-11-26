import type { EventBus, GameEvents } from './EventBus';

export interface InputState {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  jumpPressed: boolean;
  handbrake?: boolean;
  lookDeltaX: number;
  lookDeltaY: number;
}

/**
 * Action-oriented input manager supporting keyboard + pointer lock + drag fallback.
 * Designed so mobile touch controls can feed the same InputState in later phases.
 */
export class InputManager {
  private pressedKeys = new Set<string>();
  private jumpQueued = false;
  private lookDeltaX = 0;
  private lookDeltaY = 0;
  private isDragging = false;
  private pointerLocked = false;

  private readonly targetElement: HTMLElement;
  private readonly eventBus: EventBus<GameEvents>;

  constructor(targetElement: HTMLElement, eventBus: EventBus<GameEvents>) {
    this.targetElement = targetElement;
    this.eventBus = eventBus;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('mousemove', this.handleMouseMove);
    this.targetElement.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  requestPointerLock(): void {
    if (document.pointerLockElement !== this.targetElement && this.targetElement.requestPointerLock) {
      try {
        const result = this.targetElement.requestPointerLock() as unknown;
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(() => {
            // Pointer lock may be blocked in automated/headless contexts; drag fallback still works.
          });
        }
      } catch {
        // Ignore pointer lock rejection.
      }
    }
  }

  releasePointerLock(): void {
    if (document.pointerLockElement && document.exitPointerLock) {
      try {
        document.exitPointerLock();
      } catch {
        // Ignore pointer lock exit errors.
      }
    }
  }

  clearKeys(): void {
    this.pressedKeys.clear();
    this.jumpQueued = false;
    this.isDragging = false;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
  }

  getInputState(): InputState {
    let moveX = 0;
    let moveZ = 0;

    if (this.pressedKeys.has('KeyW') || this.pressedKeys.has('ArrowUp')) moveZ += 1;
    if (this.pressedKeys.has('KeyS') || this.pressedKeys.has('ArrowDown')) moveZ -= 1;
    if (this.pressedKeys.has('KeyD') || this.pressedKeys.has('ArrowRight')) moveX += 1;
    if (this.pressedKeys.has('KeyA') || this.pressedKeys.has('ArrowLeft')) moveX -= 1;

    // Normalize diagonal input so diagonal movement isn't faster.
    const length = Math.hypot(moveX, moveZ);
    if (length > 1) {
      moveX /= length;
      moveZ /= length;
    }

    const sprint =
      this.pressedKeys.has('ShiftLeft') || this.pressedKeys.has('ShiftRight');

    return {
      moveX,
      moveZ,
      sprint,
      jumpPressed: this.jumpQueued,
      handbrake: this.pressedKeys.has('Space'),
      lookDeltaX: this.lookDeltaX,
      lookDeltaY: this.lookDeltaY,
    };
  }

  consumeFrameDeltas(): void {
    this.jumpQueued = false;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('mousemove', this.handleMouseMove);
    this.targetElement.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Space' && !event.repeat) {
      this.jumpQueued = true;
    }
    if (event.code === 'KeyE' && !event.repeat) {
      this.eventBus.emit('input:interact', {});
    }
    if (event.code === 'KeyP' && !event.repeat) {
      this.eventBus.emit('input:phone', {});
    }
    if (event.code === 'KeyC' && !event.repeat) {
      this.eventBus.emit('input:collection', {});
    }
    if (event.code === 'KeyQ' && !event.repeat) {
      this.eventBus.emit('input:slowmo', {});
    }
    if (event.code === 'KeyF' && !event.repeat) {
      this.eventBus.emit('input:kick', {});
    }
    if (event.code === 'KeyG' && !event.repeat) {
      this.eventBus.emit('input:pass', {});
    }
    if (event.code === 'KeyH' && !event.repeat) {
      this.eventBus.emit('input:headlights', {});
    }
    if (event.code === 'Escape' && !event.repeat) {
      this.eventBus.emit('input:cancel', {});
    }
    if (event.code === 'F3' && !event.repeat) {
      event.preventDefault();
      this.eventBus.emit('debug:toggled', { visible: true });
    }
    this.pressedKeys.add(event.code);
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code);
  };

  private handleWindowBlur = (): void => {
    this.pressedKeys.clear();
    this.isDragging = false;
    this.jumpQueued = false;
  };

  private handlePointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.targetElement;
    this.eventBus.emit('pointerlock:changed', { locked: this.pointerLocked });
  };

  private handleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    this.isDragging = true;
    if (!this.pointerLocked) {
      this.requestPointerLock();
    }
  };

  private handleMouseUp = (): void => {
    this.isDragging = false;
  };

  private handleMouseMove = (event: MouseEvent): void => {
    if (this.pointerLocked || this.isDragging) {
      this.lookDeltaX += event.movementX;
      this.lookDeltaY += event.movementY;
    }
  };
}
