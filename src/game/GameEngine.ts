import * as THREE from 'three';
import { createKfirModel, type KfirRig } from '../assets/characters/KfirModel';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import {
  CONTROL_ROOM_BOUNDS,
  MAX_FRAME_DELTA,
  PHYSICS_STEP,
} from '../config/constants';
import { GRAPHICS_PRESETS, type GraphicsQuality } from '../config/graphicsPresets';
import { AssetManager } from '../core/AssetManager';
import { EventBus, type GameEvents } from '../core/EventBus';
import { InputManager } from '../core/InputManager';
import { PlayerAnimation } from '../player/PlayerAnimation';
import { PlayerController } from '../player/PlayerController';
import { PrototypeHUD } from '../ui/PrototypeHUD';
import { CollisionManager } from '../world/CollisionManager';
import { buildControlRoom } from '../world/ControlRoomBuilder';
import { createInitialGameState, type GameState } from './GameState';

/**
 * Coordinates the Three.js renderer, scene, fixed-timestep gameplay loop,
 * camera, player, world, and HUD for Phase 1.
 */
export class GameEngine {
  private readonly container: HTMLElement;
  private readonly eventBus = new EventBus<GameEvents>();
  private readonly state: GameState = createInitialGameState();
  private readonly assets = new AssetManager();
  private readonly collision = new CollisionManager();

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly input: InputManager;
  private readonly thirdPersonCamera: ThirdPersonCamera;
  private readonly playerController: PlayerController;
  private readonly playerAnimation: PlayerAnimation;
  private readonly kfirRig: KfirRig;
  private readonly hud: PrototypeHUD;
  private readonly sunLight: THREE.DirectionalLight;

  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private fpsSamples = 0;
  private fpsTimer = 0;
  private disposed = false;

  constructor(container: HTMLElement, hudRoot: HTMLElement) {
    this.container = container;

    const preset = GRAPHICS_PRESETS[this.state.graphicsQuality];
    this.renderer = new THREE.WebGLRenderer({
      antialias: preset.antialias,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x101a28);

    this.input = new InputManager(this.renderer.domElement, this.eventBus);

    // Build IKEA Control Room
    const room = buildControlRoom(this.assets, this.collision);
    this.scene.add(room.group);
    this.sunLight = room.sunLight;

    // Build Kfir character + gameplay controller + animation
    this.kfirRig = createKfirModel(room.palette);
    this.scene.add(this.kfirRig.root);

    const spawn = new THREE.Vector3(
      CONTROL_ROOM_BOUNDS.spawnX,
      CONTROL_ROOM_BOUNDS.spawnY,
      CONTROL_ROOM_BOUNDS.spawnZ,
    );
    this.playerController = new PlayerController(spawn, this.collision, this.eventBus);
    this.playerAnimation = new PlayerAnimation(this.kfirRig);

    this.thirdPersonCamera = new ThirdPersonCamera(
      container.clientWidth / Math.max(1, container.clientHeight),
      this.collision,
    );

    this.hud = new PrototypeHUD(hudRoot, this.eventBus, this.state.graphicsQuality);
    this.applyGraphicsQuality(this.state.graphicsQuality);

    this.bindEvents();
    window.addEventListener('resize', this.handleResize);

    // Initial sync so first frame renders properly
    this.syncVisuals(0);
  }

  start(): void {
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  setGraphicsQuality(quality: GraphicsQuality): void {
    this.state.graphicsQuality = quality;
    this.applyGraphicsQuality(quality);
  }

  getState(): Readonly<GameState> {
    return this.state;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
    this.input.dispose();
    this.hud.dispose();
    this.assets.dispose();
    this.eventBus.clear();
    this.renderer.dispose();
  }

  private bindEvents(): void {
    this.eventBus.on('graphics:changed', ({ quality }) => {
      this.setGraphicsQuality(quality);
    });

    this.eventBus.on('debug:toggled', () => {
      this.state.debugVisible = !this.state.debugVisible;
    });

    this.eventBus.on('pointerlock:changed', ({ locked }) => {
      this.state.isPointerLocked = locked;
    });
  }

  private applyGraphicsQuality(quality: GraphicsQuality): void {
    const preset = GRAPHICS_PRESETS[quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatioCap));
    this.renderer.shadowMap.enabled = preset.shadowsEnabled;
    this.sunLight.castShadow = preset.shadowsEnabled;

    if (
      this.sunLight.shadow.mapSize.width !== preset.shadowMapSize ||
      this.sunLight.shadow.mapSize.height !== preset.shadowMapSize
    ) {
      this.sunLight.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    }
    this.renderer.shadowMap.needsUpdate = true;
  }

  private loop = (now: number): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);

    const rawDt = Math.min((now - this.lastTime) / 1000, MAX_FRAME_DELTA);
    this.lastTime = now;

    // FPS measurement
    this.fpsSamples += 1;
    this.fpsTimer += rawDt;
    if (this.fpsTimer >= 0.4) {
      this.state.fps = this.fpsSamples / this.fpsTimer;
      this.fpsSamples = 0;
      this.fpsTimer = 0;
    }

    this.accumulator += rawDt;
    let firstStep = true;
    while (this.accumulator >= PHYSICS_STEP) {
      const inputState = this.input.getInputState();
      // Only apply mouse look deltas once per rendered frame
      if (!firstStep) {
        inputState.lookDeltaX = 0;
        inputState.lookDeltaY = 0;
        inputState.jumpPressed = false;
      }

      this.thirdPersonCamera.update(
        PHYSICS_STEP,
        this.playerController.position,
        inputState,
      );
      this.playerController.update(
        PHYSICS_STEP,
        inputState,
        this.thirdPersonCamera.getYaw(),
      );

      this.accumulator -= PHYSICS_STEP;
      firstStep = false;
    }

    // Ensure camera rotates responsively even if rawDt < PHYSICS_STEP
    if (firstStep) {
      const inputState = this.input.getInputState();
      if (inputState.lookDeltaX !== 0 || inputState.lookDeltaY !== 0) {
        this.thirdPersonCamera.update(rawDt, this.playerController.position, inputState);
      }
    }

    this.input.consumeFrameDeltas();
    this.syncVisuals(rawDt);

    this.renderer.render(this.scene, this.thirdPersonCamera.camera);
  };

  private syncVisuals(dt: number): void {
    this.kfirRig.root.position.copy(this.playerController.position);
    this.kfirRig.root.rotation.y = this.playerController.facingYaw;

    this.playerAnimation.update(
      dt,
      this.playerController.animState,
      this.playerController.getHorizontalSpeed(),
    );

    this.state.playerPosition.copy(this.playerController.position);
    this.state.playerVelocity.copy(this.playerController.velocity);
    this.state.playerAnimState = this.playerController.animState;
    this.state.playerGrounded = this.playerController.grounded;
    this.state.cameraDistance = this.thirdPersonCamera.getCurrentDistance();

    this.hud.update(this.state);
  }

  private handleResize = (): void => {
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.thirdPersonCamera.setAspect(w / h);
  };
}
