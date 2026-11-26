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
  hair: 0x4b3120,
  hairMidFade: 0x73523a,
  hairFade: 0x9c7656,
  facialHair: 0x684a35,
  accentRed: 0xd64045,
  monitorGlowBlue: 0x1e90ff,
  monitorGlowGreen: 0x2ecc71,
  metalGrey: 0x6b7a8c,
  metalDark: 0x394554,
  cardboard: 0xc89f6d,
  white: 0xf8fafc,
  gold: 0xf4c430,
  asphalt: 0x343a44,
  parkingLine: 0xf1f5f9,
  grass: 0x4d8b55,
  foliage: 0x3b7a47,
  terracotta: 0xd1664c,
  sofaBlue: 0x2c5e8a,
  rugBeige: 0xd8cbb8,
  forkliftYellow: 0xf4b400,
  rackOrange: 0xe06d24,
  glassTint: 0x9bd3f5,
  meatballBrown: 0x6e3b24,
} as const;

export type WorldZoneId =
  | 'Control Room'
  | 'Staff Break Room'
  | 'Market Hall'
  | 'Showroom'
  | 'Restaurant'
  | 'Warehouse'
  | 'Checkout'
  | 'Parking Lot';

export const WORLD_ZONES = {
  controlRoom: { minX: -7, maxX: 7, minZ: -6, maxZ: 6, height: 4.6 },
  showroom: { minX: 7, maxX: 45, minZ: -14, maxZ: 14, height: 5.8 },
  restaurant: { minX: 30.5, maxX: 45, minZ: -14, maxZ: 1.8 },
  warehouse: { minX: 7, maxX: 45, minZ: -44, maxZ: -14, height: 9.0 },
  checkout: { minX: 7, maxX: 45, minZ: 14, maxZ: 24, height: 5.8 },
  parkingLot: { minX: -12, maxX: 46, minZ: 24, maxZ: 52 },
} as const;

export const PLAYER_CONFIG = {
  radius: 0.38,
  height: 1.75,
  walkSpeed: 6.0,
  runSpeed: 9.8,
  sprintSpeed: 12.2,
  sprintRampDelay: 0.6,
  acceleration: 34,
  deceleration: 30,
  jumpVelocity: 7.4,
  gravity: -20,
  turnSpeed: 14,
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

export const WAREHOUSE_BALL_PICKUP_ZONE = {
  x: 21.0,
  z: -16.8,
  noStopRadius: 3.4,
} as const;
