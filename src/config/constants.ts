export const IKEA_COLORS = {
  blue: 0x0058a3,
  yellow: 0xffda1a,
  darkNavy: 0x162436,
  concreteFloor: 0xcfd6de,
  wallLight: 0xeef2f6,
  wallTrim: 0x263849,
  wood: 0xd4a373,
  darkWood: 0x8d5b3c,
  securityShirt: 0x1b1e23,
  poloCollar: 0x15181d,
  securityPants: 0xc8b598,
  boots: 0x222226,
  skin: 0xf2ccb7,
  hair: 0x4e3422,
  hairFade: 0x75563e,
  facialHair: 0x462e1e,
  accentRed: 0xd64045,
  monitorGlowBlue: 0x1e90ff,
  monitorGlowGreen: 0x2ecc71,
  metalGrey: 0x6b7a8c,
  metalDark: 0x394554,
  cardboard: 0xc89f6d,
  white: 0xf8fafc,
  gold: 0xf4c430,
} as const;

export const PLAYER_CONFIG = {
  radius: 0.38,
  height: 1.75,
  walkSpeed: 4.5,
  runSpeed: 8.0,
  acceleration: 28,
  deceleration: 24,
  jumpVelocity: 7.4,
  gravity: -20,
  turnSpeed: 12,
} as const;

export const CAMERA_CONFIG = {
  distance: 4.2,
  minDistance: 1.0,
  pivotHeight: 1.45,
  minPitch: -0.45,
  maxPitch: 1.05,
  sensitivity: 0.0022,
  followSmoothness: 12,
  collisionPadding: 0.25,
  inwardSnapSpeed: 28,
  outwardRecoverSpeed: 8,
} as const;

export const CONTROL_ROOM_BOUNDS = {
  width: 14,
  depth: 12,
  height: 4.2,
  wallThickness: 0.3,
  spawnX: 0,
  spawnY: 0,
  spawnZ: 2.5,
} as const;

export const PHYSICS_STEP = 1 / 60;
export const MAX_FRAME_DELTA = 0.05;
