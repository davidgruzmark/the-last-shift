import * as THREE from 'three';
import { createNpcModel } from '../assets/characters/NpcModel';
import {
  createFootballMesh,
  createIkeaGoalMesh,
  FOOTBALL_RADIUS,
} from '../assets/collectibles/FootballModel';
import type { MaterialPalette } from '../assets/materials/Palette';
import {
  IKEA_COLORS,
  PLAYER_CONFIG,
  WAREHOUSE_BALL_PICKUP_ZONE,
} from '../config/constants';
import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';
import type { Interactable } from '../interaction/Interactable';
import type { InteractionManager } from '../interaction/InteractionManager';
import type { MissionManager } from '../missions/MissionManager';
import type { CollisionManager } from '../world/CollisionManager';
import { WORLD_ANCHORS } from '../world/WorldAnchors';

const PITCH_CENTER = WORLD_ANCHORS.parking.miniPitchCenter.position;

export const FOOTBALL_PITCH_BOUNDS = {
  minX: PITCH_CENTER.x - 5.0,
  maxX: PITCH_CENTER.x + 5.0,
  minZ: PITCH_CENTER.z - 6.0,
  maxZ: PITCH_CENTER.z + 6.0,
  centerX: PITCH_CENTER.x,
  centerZ: PITCH_CENTER.z,
  goalWidth: 3.2,
  goalHeight: 1.65,
  opponentGoalZ: PITCH_CENTER.z - 6.0,
  kfirGoalZ: PITCH_CENTER.z + 6.0,
} as const;

export const FOOTBALL_MATCH_DURATION = 60;
export const FOOTBALL_WIN_GOALS = 3;

export type FootballPhase = 'idle' | 'active' | 'goal_pause' | 'ended';
export type FootballMode = 'none' | 'match' | 'freeplay';
export type FootballAIState = 'defend' | 'intercept' | 'attack' | 'shoot';
export type FootballSnapshot = GameEvents['football:stateChanged'];

const OPPONENT_BODY_RADIUS = 0.48;
const OPPONENT_BODY_HEIGHT = 1.75;
const PLAYER_BODY_RADIUS = 0.42;
const PLAYER_BODY_HEIGHT = 1.75;

/**
 * Tuned balance parameters for Yossi's 1v1 AI so an average player can retain
 * possession, beat him with angled shots or feints, and win with fair effort
 * while keeping Yossi a credible threat when left unguarded.
 */
export const FOOTBALL_AI_BALANCE = {
  shootRange: 1.15,
  shootSpeed: 9.4,
  kickCooldownSec: 2.15,
  kickoffCooldownSec: 1.15,
  contestRange: 2.2,
  contestDelaySec: 0.22,
  interceptTriggerVz: -3.2,
  interceptResetVz: -2.0,
  interceptMaxZOffset: 2.2,
  interceptDelaySec: 0.22,
  interceptShadowSpeed: 2.6,
  interceptSpeed: 3.35,
  interceptAimErrorRange: 1.3,
  attackMaxZOffset: 1.2,
  attackLooseBallSpeedThreshold: 1.6,
  attackContestSpeed: 2.9,
  attackLooseSpeed: 4.0,
  defendSpeed: 2.8,
  defendTrackWeight: 0.65,
  defendMaxLateralOffset: 2.1,
  defendDepthFromGoal: 2.4,
  maxAccel: 13.0,
} as const;

class PitchInteractable implements Interactable {
  readonly id: string;
  readonly type = 'interact' as const;
  readonly floor = 1 as const;
  readonly radius: number;
  readonly meshGroup: THREE.Group;

  private readonly worldPos: THREE.Vector3;
  private readonly promptFn: () => string;
  private readonly eligibleFn: () => boolean;
  private readonly triggerFn: () => void;
  private readonly ring: THREE.Mesh;

  constructor(options: {
    id: string;
    position: THREE.Vector3;
    radius: number;
    mesh: THREE.Object3D;
    getPrompt: () => string;
    canInteract: () => boolean;
    onTrigger: () => void;
  }) {
    this.id = options.id;
    this.radius = options.radius;
    this.worldPos = options.position.clone();
    this.promptFn = options.getPrompt;
    this.eligibleFn = options.canInteract;
    this.triggerFn = options.onTrigger;

    this.meshGroup = new THREE.Group();
    this.meshGroup.name = `FootballProp_${options.id}`;
    this.meshGroup.position.copy(options.position);
    this.meshGroup.add(options.mesh);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.54, 18),
      new THREE.MeshBasicMaterial({
        color: 0xffda1a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.04;
    this.meshGroup.add(this.ring);
  }

  getWorldPosition(): THREE.Vector3 {
    return this.worldPos;
  }

  setPosition(pos: THREE.Vector3): void {
    this.worldPos.copy(pos);
    this.meshGroup.position.copy(pos);
  }

  canInteract(): boolean {
    return this.meshGroup.visible && this.eligibleFn();
  }

  getPromptText(): string {
    return this.promptFn();
  }

  getPriority(): number {
    return 1.3;
  }

  setHighlighted(active: boolean): void {
    const mat = this.ring.material as THREE.MeshBasicMaterial;
    mat.color.setHex(active ? 0x2ecc71 : 0xffda1a);
    this.ring.scale.setScalar(active ? 1.25 : 1.0);
  }

  onInteract(): void {
    if (!this.canInteract()) return;
    this.triggerFn();
  }
}

/**
 * Playable 3D "FIFA at IKEA" 1v1 football mini-game & persistent Parking Lot free-play pitch.
 * Handles Warehouse ball discovery, timed/3-goal match vs. Yossi, dribbling, camera-aimed kicks/passes,
 * goal detection, rematch recovery, and permanent post-M06 free-play ball physics.
 */
export class FootballMiniGame {
  readonly group = new THREE.Group();

  private readonly eventBus: EventBus<GameEvents>;
  private readonly missions: MissionManager;
  private readonly collision?: CollisionManager;
  private readonly pitchGroup = new THREE.Group();
  private readonly ballMesh: THREE.Group;
  private readonly opponentRig: THREE.Group;
  private readonly warehouseBallProp: PitchInteractable;
  private readonly startPitchProp: PitchInteractable;

  readonly ballPosition = new THREE.Vector3(
    FOOTBALL_PITCH_BOUNDS.centerX,
    FOOTBALL_RADIUS,
    FOOTBALL_PITCH_BOUNDS.centerZ,
  );
  readonly ballVelocity = new THREE.Vector3();
  readonly opponentPosition = new THREE.Vector3(
    FOOTBALL_PITCH_BOUNDS.centerX,
    0,
    FOOTBALL_PITCH_BOUNDS.opponentGoalZ + 1.8,
  );
  readonly opponentVelocity = new THREE.Vector3();

  private mode: FootballMode = 'none';
  private phase: FootballPhase = 'idle';
  private kfirScore = 0;
  private opponentScore = 0;
  private timeRemaining = FOOTBALL_MATCH_DURATION;
  private goalPauseTimer = 0;
  private winner: 'kfir' | 'opponent' | 'draw' | null = null;
  private lastScorer: 'kfir' | 'opponent' | null = null;
  private opponentKickCooldown = 0;
  private opponentAIState: FootballAIState = 'defend';
  private opponentRunCycle = 0;
  private opponentKickAnim = 0;
  private opponentKickIgnoreTimer = 0;
  private opponentDeflections = 0;
  private opponentInterceptDelayTimer = 0;
  private opponentInterceptAimError = 0;
  private opponentInterceptTracking = false;
  private opponentContestDelayTimer = 0;
  private readonly opponentMoveVel = new THREE.Vector2(0, 0);
  private dribbleCooldown = 0;
  private lastBallInRange = false;
  private lastEmitSec = -1;
  private matchCompletedM06 = false;
  private onKickoffCb?: () => void;

  setOnKickoff(cb: () => void): void {
    this.onKickoffCb = cb;
  }

  getOpponentAIState(): FootballAIState {
    return this.opponentAIState;
  }

  getOpponentDeflections(): number {
    return this.opponentDeflections;
  }

  constructor(
    palette: MaterialPalette,
    interactions: InteractionManager,
    missions: MissionManager,
    eventBus: EventBus<GameEvents>,
    collision?: CollisionManager,
  ) {
    this.group.name = 'FootballMiniGameGroup';
    this.missions = missions;
    this.eventBus = eventBus;
    this.collision = collision;

    // 1. Warehouse football discovery pickup (visible only during M06 find-ball)
    const warehouseBallVisual = createFootballMesh();
    warehouseBallVisual.position.y = FOOTBALL_RADIUS + 0.12;
    this.warehouseBallProp = new PitchInteractable({
      id: 'm6-warehouse-ball',
      position: new THREE.Vector3(WAREHOUSE_BALL_PICKUP_ZONE.x, 0, WAREHOUSE_BALL_PICKUP_ZONE.z),
      radius: 2.8,
      mesh: warehouseBallVisual,
      getPrompt: () => i18n.t('mprop.m6-warehouse-ball'),
      canInteract: () => this.missions.getActiveObjective()?.id === 'm6-find-ball',
      onTrigger: () => {
        this.warehouseBallProp.meshGroup.visible = false;
        this.missions.notifyInteract('m6-warehouse-ball');
      },
    });
    this.warehouseBallProp.meshGroup.visible = false;
    this.group.add(this.warehouseBallProp.meshGroup);
    interactions.register(this.warehouseBallProp);

    // 2. Parking Lot IKEA Mini-Pitch visuals (goals, turf, markings)
    this.pitchGroup.name = 'IkeaFootballPitch';
    this.buildPitchGeometry(palette);
    this.pitchGroup.visible = false;
    this.group.add(this.pitchGroup);

    // 3. Kickoff starter marker on the pitch center spot
    const markerCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.22, 0.45, 10),
      new THREE.MeshStandardMaterial({ color: IKEA_COLORS.yellow, roughness: 0.4 }),
    );
    markerCone.position.y = 0.25;
    this.startPitchProp = new PitchInteractable({
      id: 'm6-start-match',
      position: new THREE.Vector3(FOOTBALL_PITCH_BOUNDS.centerX, 0, FOOTBALL_PITCH_BOUNDS.centerZ),
      radius: 3.4,
      mesh: markerCone,
      getPrompt: () => i18n.t('mprop.m6-start-match'),
      canInteract: () =>
        this.missions.getActiveObjective()?.id === 'm6-start-match' && this.phase === 'idle',
      onTrigger: () => {
        this.startPitchProp.meshGroup.visible = false;
        this.missions.notifyInteract('m6-start-match');
        this.startMatch();
      },
    });
    this.startPitchProp.meshGroup.visible = false;
    this.group.add(this.startPitchProp.meshGroup);
    interactions.register(this.startPitchProp);

    // 4. Playable 3D Soccer Ball
    this.ballMesh = createFootballMesh();
    this.ballMesh.position.copy(this.ballPosition);
    this.ballMesh.visible = false;
    this.group.add(this.ballMesh);

    // 5. 1v1 Opponent (Yossi on match pitch)
    const oppModel = createNpcModel(palette, {
      skinColor: 0xd9a886,
      hairColor: 0x241c18,
      shirtColor: 0xe11d48,
    });
    this.opponentRig = oppModel.root;
    this.opponentRig.name = 'FootballOpponent_Yossi';
    this.opponentRig.position.copy(this.opponentPosition);
    this.opponentRig.visible = false;
    this.group.add(this.opponentRig);
  }

  private buildPitchGeometry(palette: MaterialPalette): void {
    const { minX, maxX, minZ, maxZ, centerX, centerZ, goalWidth, goalHeight } =
      FOOTBALL_PITCH_BOUNDS;
    const pitchW = maxX - minX;
    const pitchL = maxZ - minZ;

    const turf = new THREE.Mesh(
      new THREE.BoxGeometry(pitchW, 0.04, pitchL),
      new THREE.MeshStandardMaterial({ color: 0x2f7d3a, roughness: 0.88 }),
    );
    turf.position.set(centerX, 0.02, centerZ);
    turf.receiveShadow = true;
    this.pitchGroup.add(turf);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const addLine = (x: number, z: number, w: number, l: number) => {
      const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, l), lineMat);
      line.position.set(x, 0.046, z);
      this.pitchGroup.add(line);
    };
    addLine(centerX, centerZ, pitchW - 0.3, 0.09); // Halfway line
    addLine(centerX, minZ + 0.12, pitchW - 0.3, 0.09); // North goal line
    addLine(centerX, maxZ - 0.12, pitchW - 0.3, 0.09); // South goal line
    addLine(minX + 0.12, centerZ, 0.09, pitchL - 0.24); // West touchline
    addLine(maxX - 0.12, centerZ, 0.09, pitchL - 0.24); // East touchline

    const centerCircle = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.46, 24), lineMat);
    centerCircle.rotation.x = -Math.PI / 2;
    centerCircle.position.set(centerX, 0.048, centerZ);
    this.pitchGroup.add(centerCircle);

    // Opponent Goal (North end, z = minZ, facing +Z into pitch)
    const oppGoal = createIkeaGoalMesh(palette, IKEA_COLORS.yellow, goalWidth, goalHeight, 1.0);
    oppGoal.position.set(centerX, 0.04, minZ);
    oppGoal.rotation.y = Math.PI;
    this.pitchGroup.add(oppGoal);

    // Kfir Goal (South end, z = maxZ, facing -Z into pitch)
    const kfirGoal = createIkeaGoalMesh(palette, IKEA_COLORS.blue, goalWidth, goalHeight, 1.0);
    kfirGoal.position.set(centerX, 0.04, maxZ);
    this.pitchGroup.add(kfirGoal);
  }

  getSnapshot(): FootballSnapshot {
    return {
      visible: this.mode === 'match' || (this.mode === 'freeplay' && this.lastBallInRange),
      phase: this.phase,
      mode: this.mode,
      kfirScore: this.kfirScore,
      opponentScore: this.opponentScore,
      timeRemaining: Math.ceil(this.timeRemaining),
      winner: this.winner,
      lastScorer: this.lastScorer,
      ballInRange: this.lastBallInRange,
    };
  }

  getWarehouseBallPosition(): THREE.Vector3 {
    return this.warehouseBallProp.getWorldPosition().clone();
  }

  /**
   * Ensures the M06 Warehouse ball spawns in an unobstructed, player-accessible spot
   * with clear line of sight so nearby forklifts or props never trap it.
   */
  ensureSafeWarehouseBallPosition(): THREE.Vector3 {
    const primary = new THREE.Vector3(WAREHOUSE_BALL_PICKUP_ZONE.x, 0, WAREHOUSE_BALL_PICKUP_ZONE.z);
    if (!this.collision) {
      return this.warehouseBallProp.getWorldPosition().clone();
    }

    const candidates = [
      primary,
      new THREE.Vector3(23.6, 0, -15.6),
      new THREE.Vector3(18.4, 0, -15.6),
      new THREE.Vector3(21.0, 0, -15.2),
      new THREE.Vector3(25.4, 0, -16.8),
      new THREE.Vector3(16.6, 0, -16.8),
    ];
    const approaches: Array<[number, number]> = [
      [0, 1.15],
      [0, -1.15],
      [1.15, 0],
      [-1.15, 0],
    ];

    for (const candidate of candidates) {
      if (!this.collision.isPositionClear(candidate, 0.55, 1.0)) continue;

      const ballEye = new THREE.Vector3(candidate.x, 0.9, candidate.z);
      const hasApproach = approaches.some(([dx, dz]) => {
        const approachPos = new THREE.Vector3(candidate.x + dx, 0, candidate.z + dz);
        if (
          !this.collision!.isPositionClear(
            approachPos,
            PLAYER_CONFIG.radius,
            PLAYER_CONFIG.height,
          )
        ) {
          return false;
        }
        const approachEye = new THREE.Vector3(approachPos.x, 1.15, approachPos.z);
        return this.collision!.hasLineOfSight(approachEye, ballEye);
      });

      if (hasApproach) {
        if (this.warehouseBallProp.getWorldPosition().distanceToSquared(candidate) > 1e-4) {
          this.warehouseBallProp.setPosition(candidate);
        }
        return candidate.clone();
      }
    }

    return this.warehouseBallProp.getWorldPosition().clone();
  }

  isMatchActive(): boolean {
    return this.mode === 'match' && (this.phase === 'active' || this.phase === 'goal_pause');
  }

  startMatch(): void {
    this.mode = 'match';
    this.phase = 'active';
    this.kfirScore = 0;
    this.opponentScore = 0;
    this.timeRemaining = FOOTBALL_MATCH_DURATION;
    this.goalPauseTimer = 0;
    this.winner = null;
    this.lastScorer = null;
    this.matchCompletedM06 = false;
    this.resetKickoffPositions();
    this.onKickoffCb?.();
    this.pitchGroup.visible = true;
    this.ballMesh.visible = true;
    this.opponentRig.visible = true;
    this.emitState(true);
  }

  restartMatch(): void {
    this.startMatch();
  }

  private resetKickoffPositions(): void {
    this.ballPosition.set(
      FOOTBALL_PITCH_BOUNDS.centerX,
      FOOTBALL_RADIUS,
      FOOTBALL_PITCH_BOUNDS.centerZ,
    );
    this.ballVelocity.set(0, 0, 0);
    this.ballMesh.position.copy(this.ballPosition);
    this.opponentPosition.set(
      FOOTBALL_PITCH_BOUNDS.centerX,
      0,
      FOOTBALL_PITCH_BOUNDS.opponentGoalZ + 1.6,
    );
    this.opponentVelocity.set(0, 0, 0);
    this.opponentRig.position.copy(this.opponentPosition);
    this.opponentRig.rotation.set(0, 0, 0);
    this.opponentAIState = 'defend';
    this.opponentKickAnim = 0;
    this.opponentKickIgnoreTimer = 0;
    this.opponentKickCooldown = FOOTBALL_AI_BALANCE.kickoffCooldownSec;
    this.opponentInterceptDelayTimer = 0;
    this.opponentInterceptAimError = 0;
    this.opponentInterceptTracking = false;
    this.opponentContestDelayTimer = 0;
    this.opponentMoveVel.set(0, 0);
  }

  /** Kicks the ball along the camera's horizontal gaze direction if Kfir is within strike range. */
  kick(playerPos: THREE.Vector3, gazeDirXZ: THREE.Vector3): boolean {
    return this.strikeBall(playerPos, gazeDirXZ, 14.5, 3.2);
  }

  /** Performs a crisp lower ground pass along the camera's horizontal gaze direction. */
  pass(playerPos: THREE.Vector3, gazeDirXZ: THREE.Vector3): boolean {
    return this.strikeBall(playerPos, gazeDirXZ, 8.8, 1.05);
  }

  private strikeBall(
    playerPos: THREE.Vector3,
    gazeDirXZ: THREE.Vector3,
    horizSpeed: number,
    verticalVel: number,
  ): boolean {
    if (this.mode === 'none') return false;
    if (this.mode === 'match' && this.phase !== 'active') return false;

    const dist = Math.hypot(
      this.ballPosition.x - playerPos.x,
      this.ballPosition.z - playerPos.z,
    );
    if (dist > 2.35) return false;

    const dir = new THREE.Vector3(gazeDirXZ.x, 0, gazeDirXZ.z);
    if (dir.lengthSq() < 1e-4) {
      dir.set(this.ballPosition.x - playerPos.x, 0, this.ballPosition.z - playerPos.z);
    }
    if (dir.lengthSq() < 1e-4) {
      dir.set(0, 0, -1);
    }
    dir.normalize();

    this.ballVelocity.set(dir.x * horizSpeed, verticalVel, dir.z * horizSpeed);
    this.dribbleCooldown = 0.22;
    this.opponentKickIgnoreTimer = 0;
    return true;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    playerVelocity: THREE.Vector3,
    allowInput = true,
  ): void {
    const activeMission = this.missions.getActiveMission();
    const activeObj = this.missions.getActiveObjective();
    const m6Active = activeMission?.id === 'mission-06';
    const m6Done = this.missions.hasCompletedMission('mission-06');
    const m6FreePlayReady = m6Done && this.missions.getStatus() !== 'completed_screen';

    // Sync world visibility for Warehouse pickup ball & Parking Lot mini-pitch
    const showFindBall = m6Active && activeObj?.id === 'm6-find-ball';
    if (showFindBall) {
      this.ensureSafeWarehouseBallPosition();
    }
    this.warehouseBallProp.meshGroup.visible = showFindBall;
    this.pitchGroup.visible = m6Active || m6Done;
    this.startPitchProp.meshGroup.visible =
      m6Active && activeObj?.id === 'm6-start-match' && this.phase === 'idle';

    if (m6FreePlayReady && this.mode !== 'freeplay') {
      this.mode = 'freeplay';
      this.phase = 'active';
      this.opponentRig.visible = false;
      this.ballMesh.visible = true;
      this.emitState(true);
    } else if (m6Active && activeObj?.id === 'm6-win-match' && this.mode === 'none') {
      // Auto-begin match if activeObjective transitioned externally (e.g. QA / test hook)
      this.startMatch();
    } else if (!m6Active && !m6Done) {
      this.mode = 'none';
      this.phase = 'idle';
      this.ballMesh.visible = false;
      this.opponentRig.visible = false;
      return;
    }

    // Track proximity hint to show Kick/Pass prompt cleanly when near ball
    const ballDist = Math.hypot(
      this.ballPosition.x - playerPos.x,
      this.ballPosition.z - playerPos.z,
    );
    const ballInRange = ballDist <= 2.35;
    if (ballInRange !== this.lastBallInRange) {
      this.lastBallInRange = ballInRange;
      this.emitState(true);
    }

    if (this.dribbleCooldown > 0) this.dribbleCooldown = Math.max(0, this.dribbleCooldown - dt);
    if (this.opponentKickIgnoreTimer > 0) {
      this.opponentKickIgnoreTimer = Math.max(0, this.opponentKickIgnoreTimer - dt);
    }
    if (this.opponentKickCooldown > 0) {
      this.opponentKickCooldown = Math.max(0, this.opponentKickCooldown - dt);
    }

    if (this.mode === 'match') {
      if (this.phase === 'goal_pause') {
        this.goalPauseTimer -= dt;
        if (this.goalPauseTimer <= 0) {
          this.phase = 'active';
          this.lastScorer = null;
          this.resetKickoffPositions();
          this.emitState(true);
        }
        return;
      }

      if (this.phase !== 'active') {
        return;
      }

      this.timeRemaining = Math.max(0, this.timeRemaining - dt);
      if (this.timeRemaining <= 0) {
        this.finishMatch();
        return;
      }

      this.updateOpponentAI(dt, playerPos);
    }

    // Player dribbling touch when walking/running into the ball
    if (allowInput && this.dribbleCooldown <= 0 && ballDist < FOOTBALL_RADIUS + 0.56 && this.ballPosition.y < 0.75) {
      const pSpeed = Math.hypot(playerVelocity.x, playerVelocity.z);
      const pushDir =
        pSpeed > 0.35
          ? new THREE.Vector2(playerVelocity.x / pSpeed, playerVelocity.z / pSpeed)
          : new THREE.Vector2(
              this.ballPosition.x - playerPos.x,
              this.ballPosition.z - playerPos.z,
            ).normalize();
      const pushSpeed = Math.max(4.0, pSpeed * 1.32);
      this.ballVelocity.x = pushDir.x * pushSpeed;
      this.ballVelocity.z = pushDir.y * pushSpeed;
      this.ballVelocity.y = Math.max(this.ballVelocity.y, 0.45);
      this.dribbleCooldown = 0.08;
    }

    this.stepBallPhysics(dt, playerPos, playerVelocity);
    this.emitState(false);
  }

  private updateOpponentAI(dt: number, playerPos: THREE.Vector3): void {
    const { minX, maxX, centerX, centerZ, opponentGoalZ, kfirGoalZ } = FOOTBALL_PITCH_BOUNDS;
    const B = FOOTBALL_AI_BALANCE;
    const ballSpeed = Math.hypot(this.ballVelocity.x, this.ballVelocity.z);
    const ballDist = Math.hypot(
      this.ballPosition.x - this.opponentPosition.x,
      this.ballPosition.z - this.opponentPosition.z,
    );
    const kfirBallDist = Math.hypot(
      this.ballPosition.x - playerPos.x,
      this.ballPosition.z - playerPos.z,
    );
    const isContested = kfirBallDist < B.contestRange;

    // Reset incoming-shot reaction lock once ball stops travelling quickly North
    if (this.ballVelocity.z >= B.interceptResetVz) {
      this.opponentInterceptTracking = false;
      this.opponentInterceptDelayTimer = 0;
    }

    let speed: number = B.defendSpeed;
    let targetX: number = centerX;
    let targetZ: number = opponentGoalZ + B.defendDepthFromGoal;

    const inShootRange =
      ballDist < B.shootRange && this.opponentKickCooldown <= 0 && this.ballPosition.y < 1.0;

    let shootReady = false;
    if (inShootRange) {
      if (!isContested) {
        shootReady = true;
      } else {
        this.opponentContestDelayTimer += dt;
        if (this.opponentContestDelayTimer >= B.contestDelaySec) {
          shootReady = true;
        }
      }
    } else {
      this.opponentContestDelayTimer = Math.max(0, this.opponentContestDelayTimer - dt * 1.5);
    }

    if (shootReady) {
      // Strike toward Kfir's goal with imperfect placement, or clear South corners cleanly inward
      this.opponentAIState = 'shoot';
      this.opponentContestDelayTimer = 0;
      const inSouthCorner = this.ballPosition.z > kfirGoalZ - 1.4;
      const biasToOpen = Math.random() < 0.4;
      const openSideOffset = playerPos.x >= centerX ? -0.65 : 0.65;
      const spread = biasToOpen
        ? (Math.random() - 0.5) * 2.0
        : (Math.random() - 0.5) * 2.3;
      const targetShotX = THREE.MathUtils.clamp(
        centerX + (biasToOpen ? openSideOffset : 0) + spread,
        minX + 0.9,
        maxX - 0.9,
      );
      const aimX = inSouthCorner
        ? centerX - this.ballPosition.x
        : targetShotX - this.ballPosition.x;
      const aimZ = inSouthCorner
        ? centerZ + 2.0 - this.ballPosition.z
        : kfirGoalZ - this.ballPosition.z;
      const len = Math.max(0.1, Math.hypot(aimX, aimZ));
      this.ballVelocity.set((aimX / len) * B.shootSpeed, 1.55, (aimZ / len) * B.shootSpeed);
      this.opponentKickCooldown = B.kickCooldownSec;
      this.opponentKickIgnoreTimer = 0.22;
      this.opponentKickAnim = 0.28;
      targetX = this.ballPosition.x;
      targetZ = this.ballPosition.z - 0.35;
      speed = B.attackLooseSpeed;
    } else if (
      this.ballVelocity.z < B.interceptTriggerVz &&
      this.ballPosition.z < centerZ + B.interceptMaxZOffset &&
      this.ballPosition.z > opponentGoalZ + 0.4
    ) {
      // Intercept incoming shot with human-like reaction delay and modest lateral misread
      this.opponentAIState = 'intercept';
      if (!this.opponentInterceptTracking) {
        this.opponentInterceptTracking = true;
        this.opponentInterceptDelayTimer = B.interceptDelaySec;
        this.opponentInterceptAimError = (Math.random() - 0.5) * B.interceptAimErrorRange;
      }
      if (this.opponentInterceptDelayTimer > 0) {
        this.opponentInterceptDelayTimer = Math.max(0, this.opponentInterceptDelayTimer - dt);
        targetX = THREE.MathUtils.clamp(
          this.ballPosition.x * B.defendTrackWeight + centerX * (1 - B.defendTrackWeight),
          centerX - B.defendMaxLateralOffset,
          centerX + B.defendMaxLateralOffset,
        );
        targetZ = opponentGoalZ + B.defendDepthFromGoal;
        speed = B.interceptShadowSpeed;
      } else {
        const timeToReach = THREE.MathUtils.clamp(
          (this.opponentPosition.z - this.ballPosition.z) / this.ballVelocity.z,
          0,
          0.7,
        );
        targetX = THREE.MathUtils.clamp(
          this.ballPosition.x + this.ballVelocity.x * timeToReach + this.opponentInterceptAimError,
          minX + 0.9,
          maxX - 0.9,
        );
        targetZ = THREE.MathUtils.clamp(
          this.ballPosition.z + this.ballVelocity.z * timeToReach * 0.42,
          opponentGoalZ + 0.9,
          centerZ + 1.5,
        );
        speed = B.interceptSpeed;
      }
    } else if (
      this.ballPosition.z <= centerZ + B.attackMaxZOffset ||
      (ballSpeed < B.attackLooseBallSpeedThreshold && this.ballPosition.z <= kfirGoalZ - 0.15)
    ) {
      // Press & attack loose balls or threats cleanly (plant/jockey briefly during contest delay)
      this.opponentAIState = 'attack';
      if (inShootRange && isContested) {
        targetX = THREE.MathUtils.clamp(this.ballPosition.x, minX + 0.65, maxX - 0.65);
        targetZ = THREE.MathUtils.clamp(
          this.ballPosition.z - 0.82,
          opponentGoalZ + 0.65,
          kfirGoalZ - 0.65,
        );
        speed = 0.8;
      } else {
        targetX = THREE.MathUtils.clamp(this.ballPosition.x, minX + 0.65, maxX - 0.65);
        targetZ = THREE.MathUtils.clamp(
          this.ballPosition.z - 0.35,
          opponentGoalZ + 0.65,
          kfirGoalZ - 0.65,
        );
        speed = isContested ? B.attackContestSpeed : B.attackLooseSpeed;
      }
    } else {
      // Measured defensive jockey tracking ball lateral position without covering entire goal instantly
      this.opponentAIState = 'defend';
      targetX = THREE.MathUtils.clamp(
        this.ballPosition.x * B.defendTrackWeight + centerX * (1 - B.defendTrackWeight),
        centerX - B.defendMaxLateralOffset,
        centerX + B.defendMaxLateralOffset,
      );
      targetZ = opponentGoalZ + B.defendDepthFromGoal;
      speed = B.defendSpeed;
    }

    const prevX = this.opponentPosition.x;
    const prevZ = this.opponentPosition.z;
    const dx = targetX - this.opponentPosition.x;
    const dz = targetZ - this.opponentPosition.z;
    const dist = Math.hypot(dx, dz);
    const desiredVx = dist > 0.05 ? (dx / dist) * speed : 0;
    const desiredVz = dist > 0.05 ? (dz / dist) * speed : 0;
    const dvx = desiredVx - this.opponentMoveVel.x;
    const dvz = desiredVz - this.opponentMoveVel.y;
    const dvLen = Math.hypot(dvx, dvz);
    const maxDeltaV = B.maxAccel * dt;
    if (dvLen > maxDeltaV && dvLen > 1e-5) {
      this.opponentMoveVel.x += (dvx / dvLen) * maxDeltaV;
      this.opponentMoveVel.y += (dvz / dvLen) * maxDeltaV;
    } else {
      this.opponentMoveVel.set(desiredVx, desiredVz);
    }

    const stepX = this.opponentMoveVel.x * dt;
    const stepZ = this.opponentMoveVel.y * dt;
    if (dist > 0.05 && Math.hypot(stepX, stepZ) > dist) {
      this.opponentPosition.x = targetX;
      this.opponentPosition.z = targetZ;
    } else {
      this.opponentPosition.x += stepX;
      this.opponentPosition.z += stepZ;
    }

    // Keep solid separation between Kfir and Yossi so characters don't overlap
    const sepX = this.opponentPosition.x - playerPos.x;
    const sepZ = this.opponentPosition.z - playerPos.z;
    const sepDist = Math.hypot(sepX, sepZ);
    const minSep = 0.85;
    if (sepDist > 1e-4 && sepDist < minSep) {
      this.opponentPosition.x = playerPos.x + (sepX / sepDist) * minSep;
      this.opponentPosition.z = playerPos.z + (sepZ / sepDist) * minSep;
    }

    this.opponentPosition.x = THREE.MathUtils.clamp(this.opponentPosition.x, minX + 0.6, maxX - 0.6);
    this.opponentPosition.z = THREE.MathUtils.clamp(
      this.opponentPosition.z,
      opponentGoalZ + 0.65,
      kfirGoalZ - 0.65,
    );

    const movedX = this.opponentPosition.x - prevX;
    const movedZ = this.opponentPosition.z - prevZ;
    const safeDt = Math.max(dt, 1e-4);
    this.opponentVelocity.set(movedX / safeDt, 0, movedZ / safeDt);
    const moveSpeed = Math.hypot(this.opponentVelocity.x, this.opponentVelocity.z);

    if (moveSpeed > 0.2) {
      this.opponentRunCycle += moveSpeed * dt * 2.4;
      const targetYaw = Math.atan2(this.opponentVelocity.x, this.opponentVelocity.z);
      let yawDiff = targetYaw - this.opponentRig.rotation.y;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      this.opponentRig.rotation.y += yawDiff * Math.min(1, dt * 12);
    } else {
      const lookYaw = Math.atan2(
        this.ballPosition.x - this.opponentPosition.x,
        this.ballPosition.z - this.opponentPosition.z,
      );
      this.opponentRig.rotation.y = lookYaw;
    }

    if (this.opponentKickAnim > 0) {
      this.opponentKickAnim = Math.max(0, this.opponentKickAnim - dt);
    }
    const strideBob = moveSpeed > 0.2 ? Math.abs(Math.sin(this.opponentRunCycle)) * 0.065 : 0;
    const kickLean = this.opponentKickAnim > 0 ? Math.sin((this.opponentKickAnim / 0.28) * Math.PI) * 0.22 : 0;

    this.opponentRig.position.set(this.opponentPosition.x, strideBob, this.opponentPosition.z);
    this.opponentRig.rotation.x = kickLean;
  }

  private stepBallPhysics(dt: number, playerPos: THREE.Vector3, playerVelocity: THREE.Vector3): void {
    const {
      minX,
      maxX,
      minZ,
      maxZ,
      centerX,
      goalWidth,
      goalHeight,
      opponentGoalZ,
      kfirGoalZ,
    } = FOOTBALL_PITCH_BOUNDS;
    const halfGoal = goalWidth / 2;

    const speed = this.ballVelocity.length();
    const substeps = Math.max(1, Math.ceil((speed * dt) / 0.15));
    const subDt = dt / substeps;

    for (let s = 0; s < substeps; s++) {
      this.ballVelocity.y -= 16.5 * subDt;
      this.ballPosition.addScaledVector(this.ballVelocity, subDt);

      // Ground bounce + grass rolling friction
      if (this.ballPosition.y < FOOTBALL_RADIUS) {
        this.ballPosition.y = FOOTBALL_RADIUS;
        if (Math.abs(this.ballVelocity.y) > 0.65) {
          this.ballVelocity.y = -this.ballVelocity.y * 0.52;
        } else {
          this.ballVelocity.y = 0;
        }
        const drag = Math.exp(-2.1 * subDt);
        this.ballVelocity.x *= drag;
        this.ballVelocity.z *= drag;
      }

      // Ball vs Opponent solid cylinder body collision (prevents ball passing through Yossi)
      if (
        this.mode === 'match' &&
        this.opponentKickIgnoreTimer <= 0 &&
        this.ballPosition.y <= OPPONENT_BODY_HEIGHT + FOOTBALL_RADIUS
      ) {
        const odx = this.ballPosition.x - this.opponentPosition.x;
        const odz = this.ballPosition.z - this.opponentPosition.z;
        const oDist = Math.hypot(odx, odz);
        const minOppDist = OPPONENT_BODY_RADIUS + FOOTBALL_RADIUS;
        if (oDist < minOppDist) {
          const nx = oDist > 1e-4 ? odx / oDist : 0;
          const nz = oDist > 1e-4 ? odz / oDist : 1;
          this.ballPosition.x = this.opponentPosition.x + nx * (minOppDist + 0.01);
          this.ballPosition.z = this.opponentPosition.z + nz * (minOppDist + 0.01);

          const relVx = this.ballVelocity.x - this.opponentVelocity.x;
          const relVz = this.ballVelocity.z - this.opponentVelocity.z;
          const vn = relVx * nx + relVz * nz;
          if (vn < 0) {
            const restitution = 0.62;
            this.ballVelocity.x -= (1 + restitution) * vn * nx - this.opponentVelocity.x * 0.3;
            this.ballVelocity.z -= (1 + restitution) * vn * nz - this.opponentVelocity.z * 0.3;
            this.ballVelocity.y *= 0.65;
            this.opponentDeflections += 1;
          }
        }
      }

      // Ball vs Kfir solid body deflection for fast incoming shots
      if (this.dribbleCooldown <= 0 && this.ballPosition.y <= PLAYER_BODY_HEIGHT + FOOTBALL_RADIUS) {
        const pdx = this.ballPosition.x - playerPos.x;
        const pdz = this.ballPosition.z - playerPos.z;
        const pDist = Math.hypot(pdx, pdz);
        const minPlayerDist = PLAYER_BODY_RADIUS + FOOTBALL_RADIUS;
        if (pDist < minPlayerDist) {
          const nx = pDist > 1e-4 ? pdx / pDist : 0;
          const nz = pDist > 1e-4 ? pdz / pDist : -1;
          const relVx = this.ballVelocity.x - playerVelocity.x;
          const relVz = this.ballVelocity.z - playerVelocity.z;
          const vn = relVx * nx + relVz * nz;
          if (vn < -2.0) {
            this.ballPosition.x = playerPos.x + nx * (minPlayerDist + 0.01);
            this.ballPosition.z = playerPos.z + nz * (minPlayerDist + 0.01);
            this.ballVelocity.x -= 1.55 * vn * nx;
            this.ballVelocity.z -= 1.55 * vn * nz;
            this.ballVelocity.y *= 0.65;
          }
        }
      }

      // Goal detection
      const inGoalWidth = Math.abs(this.ballPosition.x - centerX) <= halfGoal - FOOTBALL_RADIUS * 0.4;
      const underCrossbar = this.ballPosition.y <= goalHeight;

      if (inGoalWidth && underCrossbar && this.ballPosition.z < opponentGoalZ - 0.12) {
        this.handleGoal('kfir');
        return;
      }
      if (inGoalWidth && underCrossbar && this.ballPosition.z > kfirGoalZ + 0.12) {
        this.handleGoal('opponent');
        return;
      }

      // Goalpost rebounds
      const posts: Array<[number, number]> = [
        [centerX - halfGoal, opponentGoalZ],
        [centerX + halfGoal, opponentGoalZ],
        [centerX - halfGoal, kfirGoalZ],
        [centerX + halfGoal, kfirGoalZ],
      ];
      for (const [px, pz] of posts) {
        const pdx = this.ballPosition.x - px;
        const pdz = this.ballPosition.z - pz;
        const pDist = Math.hypot(pdx, pdz);
        const minDist = FOOTBALL_RADIUS + 0.06;
        if (pDist > 1e-4 && pDist < minDist && this.ballPosition.y <= goalHeight + 0.1) {
          const nx = pdx / pDist;
          const nz = pdz / pDist;
          this.ballPosition.x = px + nx * minDist;
          this.ballPosition.z = pz + nz * minDist;
          const vn = this.ballVelocity.x * nx + this.ballVelocity.z * nz;
          if (vn < 0) {
            this.ballVelocity.x -= 1.75 * vn * nx;
            this.ballVelocity.z -= 1.75 * vn * nz;
          }
        }
      }

      // Touchline & endline bounds outside goal mouths
      if (this.ballPosition.x < minX + FOOTBALL_RADIUS) {
        this.ballPosition.x = minX + FOOTBALL_RADIUS;
        this.ballVelocity.x = Math.abs(this.ballVelocity.x) * 0.72;
      } else if (this.ballPosition.x > maxX - FOOTBALL_RADIUS) {
        this.ballPosition.x = maxX - FOOTBALL_RADIUS;
        this.ballVelocity.x = -Math.abs(this.ballVelocity.x) * 0.72;
      }

      if (!inGoalWidth || !underCrossbar) {
        if (this.ballPosition.z < minZ + FOOTBALL_RADIUS) {
          this.ballPosition.z = minZ + FOOTBALL_RADIUS;
          this.ballVelocity.z = Math.abs(this.ballVelocity.z) * 0.72;
        } else if (this.ballPosition.z > maxZ - FOOTBALL_RADIUS) {
          this.ballPosition.z = maxZ - FOOTBALL_RADIUS;
          this.ballVelocity.z = -Math.abs(this.ballVelocity.z) * 0.72;
        }
      }
    }

    this.ballMesh.position.copy(this.ballPosition);
    this.ballMesh.rotation.x += (this.ballVelocity.z * dt) / FOOTBALL_RADIUS;
    this.ballMesh.rotation.z -= (this.ballVelocity.x * dt) / FOOTBALL_RADIUS;
  }

  private handleGoal(scorer: 'kfir' | 'opponent'): void {
    if (this.mode === 'freeplay') {
      this.resetKickoffPositions();
      this.lastScorer = scorer;
      this.emitState(true);
      this.eventBus.emit('mission:notification', {
        kind: 'completed',
        title: i18n.t('football.goalBanner'),
        subtitle: i18n.t(scorer === 'kfir' ? 'football.teamKfir' : 'football.teamYossi'),
      });
      return;
    }

    if (scorer === 'kfir') {
      this.kfirScore += 1;
    } else {
      this.opponentScore += 1;
    }
    this.lastScorer = scorer;
    this.ballVelocity.set(0, 0, 0);

    if (this.kfirScore >= FOOTBALL_WIN_GOALS || this.opponentScore >= FOOTBALL_WIN_GOALS) {
      this.finishMatch();
      return;
    }

    this.phase = 'goal_pause';
    this.goalPauseTimer = 1.5;
    this.emitState(true);
  }

  private finishMatch(): void {
    this.phase = 'ended';
    if (this.kfirScore > this.opponentScore) {
      this.winner = 'kfir';
      this.emitState(true);
      if (!this.matchCompletedM06) {
        this.matchCompletedM06 = true;
        this.missions.notifyMinigameComplete('fifa-at-ikea');
      }
    } else if (this.opponentScore > this.kfirScore) {
      this.winner = 'opponent';
      this.emitState(true);
    } else {
      this.winner = 'draw';
      this.emitState(true);
    }
  }

  private emitState(force: boolean): void {
    const roundedSec = Math.ceil(this.timeRemaining);
    if (!force && roundedSec === this.lastEmitSec) return;
    this.lastEmitSec = roundedSec;
    this.eventBus.emit('football:stateChanged', this.getSnapshot());
  }
}
