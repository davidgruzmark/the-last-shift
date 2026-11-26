import * as THREE from 'three';
import { createKfirModel, type KfirRig } from '../assets/characters/KfirModel';
import { SurveillanceCameraSystem } from '../camera/SurveillanceCameraSystem';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import type { CollectibleManager } from '../collectibles/CollectibleManager';
import { PerfumeCollection } from '../collectibles/PerfumeCollection';
import { WatchCollection } from '../collectibles/WatchCollection';
import { WorldCollectionProps } from '../collectibles/WorldCollectionProps';
import {
  CONTROL_ROOM_BOUNDS,
  MAX_FRAME_DELTA,
  PHYSICS_STEP,
} from '../config/constants';
import { GRAPHICS_PRESETS, type GraphicsQuality } from '../config/graphicsPresets';
import { AssetManager } from '../core/AssetManager';
import { sfx } from '../audio/SoundEffects';
import { bindContextAwareNpcDialogues } from '../config/worldInteractions';
import { EventBus, type GameEvents } from '../core/EventBus';
import { InputManager, type InputState } from '../core/InputManager';
import { i18n } from '../i18n/LocalizationManager';
import type { ComputerInteraction } from '../interaction/ComputerInteraction';
import { InteractionManager } from '../interaction/InteractionManager';
import { DialogueManager } from '../npcs/DialogueManager';
import { CAMPAIGN_MISSIONS } from '../missions/MissionDefinitions';
import { MissionManager } from '../missions/MissionManager';
import { MissionPropsController } from '../missions/MissionPropsController';
import { ObjectiveMarker } from '../missions/ObjectiveMarker';
import { ControlRoomStaffingSystem } from '../npcs/ControlRoomStaffingSystem';
import { FootballMiniGame } from '../minigames/FootballMiniGame';
import { PlayerAnimation } from '../player/PlayerAnimation';
import { PlayerController } from '../player/PlayerController';
import { CollectionUI } from '../ui/CollectionUI';
import { FootballUI } from '../ui/FootballUI';
import { InteractionUI } from '../ui/InteractionUI';
import { MissionUI } from '../ui/MissionUI';
import { PhoneManager } from '../ui/PhoneManager';
import { PrototypeHUD } from '../ui/PrototypeHUD';
import { SettingsUI } from '../ui/SettingsUI';
import { VehicleManager } from '../vehicles/VehicleManager';
import { CollisionManager } from '../world/CollisionManager';
import { WORLD_ANCHORS } from '../world/WorldAnchors';
import { WorldManager } from '../world/WorldManager';
import { WorldProgressionManager } from '../world/WorldProgressionManager';
import { createInitialGameState, type GameState } from './GameState';
import { TimeScaleController } from './TimeScaleController';

const IDLE_INPUT: InputState = {
  moveX: 0,
  moveZ: 0,
  sprint: false,
  jumpPressed: false,
  lookDeltaX: 0,
  lookDeltaY: 0,
};

/**
 * Coordinates the Three.js renderer, scene, fixed-timestep gameplay loop,
 * camera, player, world, Phase 3 interactions, and HUD.
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
  private readonly interactionUI: InteractionUI;
  private readonly missionUI: MissionUI;
  private readonly collectionUI: CollectionUI;
  private readonly settingsUI: SettingsUI;
  private readonly footballUI: FootballUI;
  private readonly footballMiniGame: FootballMiniGame;
  private readonly perfumeCollection: PerfumeCollection;
  private readonly watchCollection: WatchCollection;
  private readonly collectionProps: WorldCollectionProps;
  private readonly timeScale: TimeScaleController;
  private readonly worldProgression = new WorldProgressionManager();
  private readonly worldManager: WorldManager;
  private readonly interactions: InteractionManager;
  private readonly dialogue: DialogueManager;
  private readonly collectibles: CollectibleManager;
  private readonly computer: ComputerInteraction;
  private readonly phone: PhoneManager;
  private readonly missionManager: MissionManager;
  private readonly missionProps: MissionPropsController;
  private readonly objectiveMarker = new ObjectiveMarker();
  private readonly surveillance = new SurveillanceCameraSystem();
  private readonly staffingSystem: ControlRoomStaffingSystem;
  private readonly vehicleManager: VehicleManager;
  private readonly sunLight: THREE.DirectionalLight;

  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private fpsSamples = 0;
  private fpsTimer = 0;
  private disposed = false;

  constructor(container: HTMLElement, hudRoot: HTMLElement) {
    this.container = container;
    i18n.setEventBus(this.eventBus);

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

    this.scene.background = new THREE.Color(0x9bc7f0);
    this.scene.fog = new THREE.Fog(0x9bc7f0, 52, 110);

    this.input = new InputManager(this.renderer.domElement, this.eventBus);
    this.interactions = new InteractionManager(this.eventBus, this.collision);
    this.dialogue = new DialogueManager(this.eventBus);
    this.phone = new PhoneManager(this.eventBus, true);

    // Build connected IKEA World + live GPU CCTV wall + Phase 3/2B interactables
    this.worldManager = new WorldManager(
      this.assets,
      this.collision,
      this.surveillance.getWallFeedTextures(),
    );
    this.scene.add(this.worldManager.root);
    this.sunLight = this.worldManager.sunLight;

    const handles = this.worldManager.populateInteractions(
      this.interactions,
      this.dialogue,
      this.eventBus,
      {
        lockedByDefault: true,
        unlockDurationSec: 0.85,
        onUnlockStart: () => {
          this.playerAnimation.playKeyTurnAnimation(0.85);
          sfx.playKeyInsert();
        },
        onUnlockComplete: () => {
          sfx.playKeyTurn();
        },
        onOpen: () => {
          sfx.playDoorOpen();
        },
        onClose: () => {
          sfx.playDoorClose();
        },
        onLock: () => {
          sfx.playDoorLock();
        },
      },
    );
    this.collectibles = handles.collectibles;
    this.computer = handles.computer;
    this.staffingSystem = new ControlRoomStaffingSystem({
      guards: handles.staffGuards,
      staffDoor: handles.staffDoor,
      collision: this.collision,
      dialogue: this.dialogue,
    });
    this.perfumeCollection = new PerfumeCollection(this.collectibles, this.eventBus);
    const initialPerfumes = this.perfumeCollection.getProgress();
    this.state.perfumesCollected = initialPerfumes.collected;
    this.state.perfumesTotal = initialPerfumes.total;

    this.watchCollection = new WatchCollection(this.collectibles, this.eventBus);
    const initialWatches = this.watchCollection.getProgress();
    this.state.watchesCollected = initialWatches.collected;
    this.state.watchesTotal = initialWatches.total;

    this.timeScale = new TimeScaleController(this.eventBus);
    this.collectionProps = new WorldCollectionProps(
      this.worldManager.palette,
      this.interactions,
      this.collectibles,
      this.perfumeCollection,
      this.watchCollection,
      this.eventBus,
    );
    this.scene.add(this.collectionProps.group);

    // Initialize Phase 4 Mission System, 3D Markers & Scripted Mission Props
    this.missionManager = new MissionManager(
      CAMPAIGN_MISSIONS,
      this.eventBus,
      this.dialogue,
      this.phone,
      this.collectibles,
    );
    this.missionManager.registerNpcs(handles.npcs);
    bindContextAwareNpcDialogues(handles.npcs, this.missionManager);
    this.missionProps = new MissionPropsController(
      this.worldManager.palette,
      this.interactions,
      this.missionManager,
      this.collision,
      this.worldProgression,
    );
    this.missionManager.setDynamicMarkerResolver((obj) => {
      if (obj.id === 'm6-find-ball') {
        return this.footballMiniGame.getWarehouseBallPosition();
      }
      return this.missionProps.getDynamicMarkerPosition(obj);
    });
    this.missionManager.setDynamicTravelGetter((key) =>
      this.missionProps.getDynamicTravelDistance(key),
    );
    this.scene.add(this.missionProps.group);
    this.scene.add(this.objectiveMarker.group);

    this.footballMiniGame = new FootballMiniGame(
      this.worldManager.palette,
      this.interactions,
      this.missionManager,
      this.eventBus,
      this.collision,
    );
    this.footballMiniGame.setOnKickoff(() => {
      if (!this.vehicleManager.isInVehicle()) {
        this.playerController.position.set(23.5, 0, 46.6);
        this.playerController.velocity.set(0, 0, 0);
        this.playerController.facingYaw = Math.PI;
      }
    });
    this.scene.add(this.footballMiniGame.group);

    this.state.totalCollectibles = this.collectibles.getTotalCount();
    this.state.unreadMessages = this.phone.getUnreadCount();

    // Build Kfir character + gameplay controller + animation
    this.kfirRig = createKfirModel(this.worldManager.palette);
    this.scene.add(this.kfirRig.root);

    const spawn = new THREE.Vector3(
      CONTROL_ROOM_BOUNDS.spawnX,
      CONTROL_ROOM_BOUNDS.spawnY,
      CONTROL_ROOM_BOUNDS.spawnZ,
    );
    this.playerController = new PlayerController(spawn, this.collision, this.eventBus);
    this.playerAnimation = new PlayerAnimation(this.kfirRig);

    // Phase 5: Drivable vehicle system (spawn Kfir's personal car in IKEA Parking Lot)
    this.vehicleManager = new VehicleManager(
      this.worldManager.palette,
      this.collision,
      this.interactions,
      this.eventBus,
      this.kfirRig,
      this.playerController,
    );
    const kfirCar = this.vehicleManager.spawnVehicle({
      id: 'car-kfir',
      name: 'Car',
      position: WORLD_ANCHORS.parking.kfirCar.position.clone(),
      yaw: WORLD_ANCHORS.parking.kfirCar.facingYaw ?? 0,
      bodyMat: this.worldManager.palette.carColors[0],
    });
    this.scene.add(kfirCar.rig.root);

    this.thirdPersonCamera = new ThirdPersonCamera(
      container.clientWidth / Math.max(1, container.clientHeight),
      this.collision,
    );

    this.hud = new PrototypeHUD(hudRoot, this.eventBus);
    this.interactionUI = new InteractionUI(
      hudRoot,
      this.eventBus,
      this.dialogue,
      this.computer,
      this.phone,
    );
    this.missionUI = new MissionUI(hudRoot, this.eventBus, this.missionManager);
    this.collectionUI = new CollectionUI(
      hudRoot,
      this.perfumeCollection,
      this.watchCollection,
      this.eventBus,
      () => this.syncOverlayState(),
    );
    this.settingsUI = new SettingsUI(
      hudRoot,
      this.eventBus,
      this.state.graphicsQuality,
      () => this.syncOverlayState(),
    );
    this.footballUI = new FootballUI(hudRoot, this.eventBus, this.footballMiniGame);
    this.applyGraphicsQuality(this.state.graphicsQuality);

    this.bindEvents();
    window.addEventListener('resize', this.handleResize);

    // Initial sync so first frame renders properly
    this.syncVisuals(0);
  }

  start(): void {
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
    const qaM6 =
      import.meta.env.DEV &&
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('qa') === 'm6';
    this.missionManager.startCampaign(qaM6 ? 5 : 0);
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
    this.surveillance.dispose();
    this.footballUI.dispose();
    this.settingsUI.dispose();
    this.collectionUI.dispose();
    this.missionUI.dispose();
    this.interactionUI.dispose();
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

    this.eventBus.on('interaction:promptChanged', ({ prompt }) => {
      this.state.activePrompt = prompt;
    });

    this.eventBus.on('collectible:collected', () => {
      this.state.collectedItems = this.collectibles.getCollectedIds();
      this.state.totalCollectibles = Math.max(
        this.state.totalCollectibles,
        this.state.collectedItems.length,
      );
      this.syncCollectionProgress();
    });

    this.eventBus.on('collection:changed', () => {
      this.syncCollectionProgress();
    });

    this.eventBus.on('slowmo:changed', ({ unlocked, active, remainingSec, cooldownSec, notice }) => {
      this.state.slowMoUnlocked = unlocked;
      this.state.slowMoActive = active;
      this.state.slowMoRemaining = remainingSec;
      this.state.slowMoCooldown = cooldownSec;
      if (notice && this.state.activeOverlay === 'none') {
        this.hud.showVehicleNotice(notice);
      }
    });

    this.eventBus.on('input:slowmo', () => {
      if (this.state.activeOverlay === 'none' && !this.dialogue.isActive()) {
        this.timeScale.tryActivate();
      }
    });

    this.eventBus.on('language:changed', () => {
      this.dialogue.refreshLocale();
      const snap = this.missionManager.getSnapshot();
      this.state.activeMissionTitle = snap.title;
      this.state.activeObjectiveTitle = snap.objectiveTitle;
    });

    this.eventBus.on('mission:scriptEvent', ({ eventId }) => {
      this.missionProps.handleScriptEvent(eventId);
    });

    this.eventBus.on('mission:stateChanged', (snap) => {
      this.state.money = snap.money;
      this.state.activeMissionTitle = snap.title;
      this.state.activeObjectiveTitle = snap.objectiveTitle;
      this.state.completedMissions = snap.completedMissions;
      this.objectiveMarker.setTarget(this.missionManager.getCurrentMarkerPosition());
      this.syncOverlayState();
    });

    this.eventBus.on('mission:completionModal', () => this.syncOverlayState());

    this.eventBus.on('input:interact', () => {
      if (this.dialogue.isActive()) {
        this.dialogue.advance();
        return;
      }
      if (this.state.activeOverlay === 'none') {
        if (this.vehicleManager.isInVehicle()) {
          this.vehicleManager.tryExit();
        } else {
          this.interactions.interact();
        }
      }
    });

    this.eventBus.on('input:headlights', () => {
      if (this.state.activeOverlay === 'none' && this.vehicleManager.isInVehicle()) {
        this.vehicleManager.toggleHeadlights();
      }
    });

    this.eventBus.on('input:kick', () => {
      if (this.state.activeOverlay === 'none' && !this.vehicleManager.isInVehicle()) {
        this.footballMiniGame.kick(
          this.playerController.position,
          this.thirdPersonCamera.getGazeRay().direction,
        );
      }
    });

    this.eventBus.on('input:pass', () => {
      if (this.state.activeOverlay === 'none' && !this.vehicleManager.isInVehicle()) {
        this.footballMiniGame.pass(
          this.playerController.position,
          this.thirdPersonCamera.getGazeRay().direction,
        );
      }
    });

    this.eventBus.on('vehicle:stateChanged', (vState) => {
      this.state.inVehicle = vState.inVehicle;
      this.state.vehicleSpeedKmh = vState.speedKmh;
      this.state.vehicleGear = vState.gear;
      this.state.vehicleHandbrake = vState.handbrake;
      this.state.vehicleHeadlights = vState.headlights;
      if (vState.statusToast) {
        this.hud.showVehicleNotice(vState.statusToast);
      }
    });

    this.eventBus.on('input:phone', () => {
      if (this.dialogue.isActive() || this.computer.isOpen()) return;
      this.collectionUI.close();
      this.settingsUI.close();
      this.phone.toggle();
    });

    this.eventBus.on('input:collection', () => {
      if (
        this.dialogue.isActive() ||
        this.computer.isOpen() ||
        this.missionManager.getStatus() === 'completed_screen'
      ) {
        return;
      }
      this.phone.closePhone();
      this.settingsUI.close();
      this.collectionUI.toggle();
    });

    this.eventBus.on('input:settings', () => {
      if (
        this.dialogue.isActive() ||
        this.computer.isOpen() ||
        this.missionManager.getStatus() === 'completed_screen'
      ) {
        return;
      }
      this.phone.closePhone();
      this.collectionUI.close();
      this.settingsUI.toggle();
    });

    this.eventBus.on('input:cancel', () => {
      if (this.dialogue.isActive()) {
        this.dialogue.close();
      } else if (this.computer.isOpen()) {
        this.computer.close();
      } else if (this.settingsUI.isOpen()) {
        this.settingsUI.close();
      } else if (this.collectionUI.isOpen()) {
        this.collectionUI.close();
      } else if (this.phone.isOpen()) {
        this.phone.closePhone();
      }
    });

    this.eventBus.on('dialogue:changed', () => this.syncOverlayState());
    this.eventBus.on('computer:changed', ({ open, activeCam }) => {
      if (open) {
        this.missionManager.notifyCameraInspected(activeCam);
      }
      this.syncOverlayState();
    });
    this.eventBus.on('phone:changed', ({ unreadCount }) => {
      this.state.unreadMessages = unreadCount;
      this.syncOverlayState();
    });
    this.eventBus.on('phone:callChanged', () => this.syncOverlayState());
  }

  private syncCollectionProgress(): void {
    const pProgress = this.perfumeCollection.getProgress();
    this.state.perfumesCollected = pProgress.collected;
    this.state.perfumesTotal = pProgress.total;

    const wProgress = this.watchCollection.getProgress();
    this.state.watchesCollected = wProgress.collected;
    this.state.watchesTotal = wProgress.total;

    const slowMoUnlocked = this.watchCollection.hasLegendaryWatch();
    this.timeScale.setUnlocked(slowMoUnlocked);
    this.state.slowMoUnlocked = slowMoUnlocked;
  }

  private syncOverlayState(): void {
    const nextOverlay =
      this.missionManager.getStatus() === 'completed_screen'
        ? 'mission_complete'
        : this.dialogue.isActive()
          ? 'dialogue'
          : this.computer.isOpen()
            ? 'computer'
            : this.settingsUI.isOpen()
              ? 'settings'
              : this.collectionUI.isOpen()
                ? 'collection'
                : this.phone.isOpen()
                  ? 'phone'
                  : 'none';

    if (nextOverlay !== this.state.activeOverlay) {
      this.state.activeOverlay = nextOverlay;
      if (nextOverlay !== 'none') {
        this.input.clearKeys();
        this.input.releasePointerLock();
      }
    }
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

    this.fpsSamples += 1;
    this.fpsTimer += rawDt;
    if (this.fpsTimer >= 0.4) {
      this.state.fps = this.fpsSamples / this.fpsTimer;
      this.fpsSamples = 0;
      this.fpsTimer = 0;
    }

    const controlsActive = this.state.activeOverlay === 'none';
    if (controlsActive) {
      this.timeScale.update(rawDt);
    }
    const worldScale = this.timeScale.getWorldScale();
    const playerScale = this.timeScale.getPlayerScale();

    this.accumulator += rawDt;
    let firstStep = true;
    while (this.accumulator >= PHYSICS_STEP) {
      const inputState = controlsActive ? this.input.getInputState() : { ...IDLE_INPUT };
      if (!firstStep) {
        inputState.lookDeltaX = 0;
        inputState.lookDeltaY = 0;
        inputState.jumpPressed = false;
      }

      const worldDt = PHYSICS_STEP * worldScale;
      const playerDt = PHYSICS_STEP * playerScale;

      // Advance moving mission obstacles/colliders & Control Room guard rotation
      this.missionProps.update(worldDt);
      this.staffingSystem.update(worldDt);
      this.footballMiniGame.update(
        worldDt,
        this.playerController.position,
        this.playerController.velocity,
        controlsActive && !this.vehicleManager.isInVehicle(),
      );

      if (this.vehicleManager.isInVehicle()) {
        this.vehicleManager.updateDriving(playerDt, inputState, controlsActive);
        const activeCar = this.vehicleManager.getActiveVehicle();
        if (activeCar) {
          this.thirdPersonCamera.updateDriving(
            playerDt,
            activeCar.position,
            activeCar.yaw,
            activeCar.getSpeed(),
            inputState,
          );
        } else {
          this.thirdPersonCamera.update(
            PHYSICS_STEP,
            this.playerController.position,
            inputState,
          );
        }
      } else {
        this.vehicleManager.updateIdle(worldDt);
        this.thirdPersonCamera.update(
          PHYSICS_STEP,
          this.playerController.position,
          inputState,
        );
        this.playerController.update(
          playerDt,
          inputState,
          this.thirdPersonCamera.getYaw(),
        );
      }

      this.accumulator -= PHYSICS_STEP;
      firstStep = false;
    }

    if (firstStep && controlsActive) {
      const inputState = this.input.getInputState();
      if (inputState.lookDeltaX !== 0 || inputState.lookDeltaY !== 0) {
        if (this.vehicleManager.isInVehicle()) {
          const activeCar = this.vehicleManager.getActiveVehicle();
          if (activeCar) {
            this.thirdPersonCamera.updateDriving(
              rawDt,
              activeCar.position,
              activeCar.yaw,
              activeCar.getSpeed(),
              inputState,
            );
          }
        } else {
          this.thirdPersonCamera.update(rawDt, this.playerController.position, inputState);
        }
      }
    }

    this.input.consumeFrameDeltas();

    const focusPos = this.vehicleManager.getActiveVehicle()?.position ?? this.playerController.position;
    const playerFloor = this.vehicleManager.isInVehicle()
      ? undefined
      : this.playerController.getFloorState();
    const onFootInteractActive = controlsActive && !this.vehicleManager.isInVehicle();

    this.interactions.update(
      rawDt,
      this.playerController.position,
      this.playerController.facingYaw,
      onFootInteractActive,
      onFootInteractActive ? this.thirdPersonCamera.getGazeRay() : undefined,
      playerFloor,
    );
    this.missionManager.update(rawDt * worldScale, focusPos, playerFloor);
    this.objectiveMarker.setTarget(this.missionManager.getCurrentMarkerPosition());
    this.objectiveMarker.update(rawDt);
    this.missionUI.updateNavigation(
      this.objectiveMarker.computeScreenNav(
        this.thirdPersonCamera.camera,
        focusPos,
        this.container.clientWidth,
        this.container.clientHeight,
      ),
    );

    this.syncVisuals(rawDt * playerScale);
    this.worldManager.updateAtmosphere(rawDt, this.state.currentZone);

    if (this.computer.isOpen()) {
      const canvases = this.interactionUI.getSurveillanceCanvases();
      this.surveillance.update(
        rawDt,
        this.renderer,
        this.scene,
        true,
        this.computer.getActiveCamera(),
        canvases.main,
        canvases.thumbs,
      );
      this.interactionUI.updateSurveillanceClock();
    } else {
      const canvases = this.interactionUI.getSurveillanceCanvases();
      this.surveillance.update(
        rawDt,
        this.renderer,
        this.scene,
        false,
        0,
        canvases.main,
        canvases.thumbs,
      );
      this.surveillance.updateWallMonitors(
        rawDt,
        this.renderer,
        this.scene,
        this.state.currentZone === 'Control Room',
        false,
      );
    }

    this.renderer.render(this.scene, this.thirdPersonCamera.camera);
  };

  private syncVisuals(dt: number): void {
    const activeCar = this.vehicleManager.getActiveVehicle();
    const inCar = this.vehicleManager.isInVehicle();
    if (!inCar) {
      this.kfirRig.root.position.copy(this.playerController.position);
      this.kfirRig.root.rotation.y = this.playerController.facingYaw;

      this.playerAnimation.update(
        dt,
        this.playerController.animState,
        this.playerController.getHorizontalSpeed(),
      );
    }

    const focusPos = activeCar ? activeCar.position : this.playerController.position;
    const activeFloor = inCar ? 1 : this.playerController.getFloorState().committedFloor;
    this.state.currentZone = this.worldManager.getZoneAt(focusPos, activeFloor);
    this.worldManager.updateShadowTarget(focusPos);

    this.state.playerPosition.copy(focusPos);
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
