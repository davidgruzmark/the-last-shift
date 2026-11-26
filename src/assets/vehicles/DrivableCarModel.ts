import * as THREE from 'three';
import type { MaterialPalette } from '../materials/Palette';

export interface DrivableCarRig {
  root: THREE.Group;
  frontLeftSteerPivot: THREE.Group;
  frontRightSteerPivot: THREE.Group;
  wheels: THREE.Object3D[];
  steeringWheel: THREE.Object3D;
  brakeLightMat: THREE.MeshStandardMaterial;
  headlightMat: THREE.MeshStandardMaterial;
  headlightBeams: THREE.Group;
  driverSeatLocal: THREE.Vector3;
  halfExtents: THREE.Vector3;
}

function createWheelMesh(palette: MaterialPalette): THREE.Group {
  const wheelSpinGroup = new THREE.Group();

  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.33, 0.24, 12),
    palette.metalDark,
  );
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.25, 8),
    palette.white,
  );
  rim.rotation.z = Math.PI / 2;

  // Cross spoke bar so wheel spin is immediately noticeable while driving
  const spokeA = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.3, 0.055),
    palette.metalGrey,
  );
  const spokeB = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.055, 0.3),
    palette.metalGrey,
  );

  wheelSpinGroup.add(tire, rim, spokeA, spokeB);
  return wheelSpinGroup;
}

/**
 * Stylized low-poly drivable hatchback/sedan matching the world's visual language.
 * Forward faces +Z; left-hand driver seat sits at +X (+0.44) inside an openable interior cabin.
 */
export function createDrivableCarModel(
  palette: MaterialPalette,
  bodyMat: THREE.MeshStandardMaterial,
): DrivableCarRig {
  const root = new THREE.Group();
  root.name = 'DrivableCarRoot';

  // Lower chassis, hood & trunk
  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.56, 4.12), bodyMat);
  lowerBody.position.set(0, 0.52, 0);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.12, 1.15), bodyMat);
  hood.position.set(0, 0.84, 1.42);

  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.12, 0.72), bodyMat);
  trunk.position.set(0, 0.84, -1.62);

  // Open interior cabin with pillars, roof, seats, dashboard & steering wheel
  const interiorFloor = new THREE.Mesh(
    new THREE.BoxGeometry(1.64, 0.08, 1.92),
    palette.metalDark,
  );
  interiorFloor.position.set(0, 0.34, -0.1);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.09, 1.95), bodyMat);
  roof.position.set(0, 1.49, -0.2);

  // Roof pillars
  const pillarOffsets: Array<[number, number, number]> = [
    [-0.78, 1.14, 0.72],
    [0.78, 1.14, 0.72],
    [-0.78, 1.14, -0.2],
    [0.78, 1.14, -0.2],
    [-0.78, 1.14, -1.12],
    [0.78, 1.14, -1.12],
  ];
  for (const [px, py, pz] of pillarOffsets) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.64, 0.12), bodyMat);
    pillar.position.set(px, py, pz);
    root.add(pillar);
  }

  // Translucent cabin glass so Kfir and the steering wheel remain visible inside
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9bd3f5,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.54, 0.05), glassMat);
  frontGlass.position.set(0, 1.15, 0.74);
  frontGlass.rotation.x = -0.24;

  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.5, 0.05), glassMat);
  rearGlass.position.set(0, 1.15, -1.12);
  rearGlass.rotation.x = 0.24;

  // Interior dashboard + two seats
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.24, 0.34), palette.darkNavy);
  dash.position.set(0, 0.78, 0.56);

  const seatGeo = new THREE.BoxGeometry(0.46, 0.16, 0.48);
  const backGeo = new THREE.BoxGeometry(0.46, 0.52, 0.14);
  [0.44, -0.44].forEach((sx) => {
    const base = new THREE.Mesh(seatGeo, palette.metalDark);
    base.position.set(sx, 0.44, -0.04);
    const back = new THREE.Mesh(backGeo, palette.metalDark);
    back.position.set(sx, 0.72, -0.24);
    root.add(base, back);
  });

  // Steering column & visible steering wheel on driver (+X) side
  const steeringPivot = new THREE.Group();
  steeringPivot.position.set(0.44, 0.92, 0.35);
  steeringPivot.rotation.x = 0.35;

  const wheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.15, 0.024, 6, 12),
    palette.metalDark,
  );
  const wheelCross = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.032, 0.025),
    palette.metalGrey,
  );
  steeringPivot.add(wheelRim, wheelCross);

  // Bumpers & license accents
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.22, 0.14), palette.metalDark);
  frontBumper.position.set(0, 0.32, 2.08);
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.22, 0.14), palette.metalDark);
  rearBumper.position.set(0, 0.32, -2.08);

  // Emissive headlights & brake lights (cloned so each car lights independently)
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfff3b0,
    emissive: 0xffe066,
    emissiveIntensity: 1.0,
    roughness: 0.25,
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xd64045,
    emissiveIntensity: 0.25,
    roughness: 0.3,
  });

  const lightGeo = new THREE.BoxGeometry(0.32, 0.14, 0.07);
  const hlL = new THREE.Mesh(lightGeo, headlightMat);
  hlL.position.set(0.62, 0.62, 2.07);
  const hlR = new THREE.Mesh(lightGeo, headlightMat);
  hlR.position.set(-0.62, 0.62, 2.07);

  const tailL = new THREE.Mesh(lightGeo, brakeLightMat);
  tailL.position.set(0.62, 0.64, -2.07);
  const tailR = new THREE.Mesh(lightGeo, brakeLightMat);
  tailR.position.set(-0.62, 0.64, -2.07);

  // Translucent forward headlight beams
  const headlightBeams = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff6bf,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beamGeo = new THREE.ConeGeometry(1.3, 6.0, 10, 1, true);
  beamGeo.rotateX(-Math.PI / 2);
  beamGeo.translate(0, 0, 3.0);
  [-0.62, 0.62].forEach((bx) => {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(bx, 0.56, 2.1);
    headlightBeams.add(beam);
  });

  // Wheels: front wheels sit inside steer pivots, rear wheels sit directly on chassis
  const frontLeftSteerPivot = new THREE.Group();
  frontLeftSteerPivot.position.set(0.92, 0.33, 1.28);
  const flWheel = createWheelMesh(palette);
  frontLeftSteerPivot.add(flWheel);

  const frontRightSteerPivot = new THREE.Group();
  frontRightSteerPivot.position.set(-0.92, 0.33, 1.28);
  const frWheel = createWheelMesh(palette);
  frontRightSteerPivot.add(frWheel);

  const rlWheel = createWheelMesh(palette);
  rlWheel.position.set(0.92, 0.33, -1.28);

  const rrWheel = createWheelMesh(palette);
  rrWheel.position.set(-0.92, 0.33, -1.28);

  root.add(
    lowerBody,
    hood,
    trunk,
    interiorFloor,
    roof,
    frontGlass,
    rearGlass,
    dash,
    steeringPivot,
    frontBumper,
    rearBumper,
    hlL,
    hlR,
    tailL,
    tailR,
    headlightBeams,
    frontLeftSteerPivot,
    frontRightSteerPivot,
    rlWheel,
    rrWheel,
  );

  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material !== glassMat && child.material !== beamMat) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return {
    root,
    frontLeftSteerPivot,
    frontRightSteerPivot,
    wheels: [flWheel, frWheel, rlWheel, rrWheel],
    steeringWheel: steeringPivot,
    brakeLightMat,
    headlightMat,
    headlightBeams,
    driverSeatLocal: new THREE.Vector3(0.44, 0.34, -0.02),
    halfExtents: new THREE.Vector3(0.97, 0.78, 2.1),
  };
}
