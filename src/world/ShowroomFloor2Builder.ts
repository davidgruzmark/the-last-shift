import * as THREE from 'three';
import {
  createBillyBookcase,
  createCoffeeTable,
  createKallaxUnit,
  createKitchenDisplay,
  createMalmBed,
  createPoangChair,
  createProductPlacard,
  createRestaurantCounter,
  createRestaurantTable,
  createRug,
  createSofa,
} from '../assets/environments/IkeaFurnitureAssets';
import type { MaterialPalette } from '../assets/materials/Palette';
import type { CollisionManager } from './CollisionManager';
import { addBox, addWallSegment, placeProp } from './WorldGeometryHelpers';

export const FLOOR2_Y = 5.8;
const FLOOR2_SLAB_CENTER_Y = 5.6;
const FLOOR2_SLAB_THICKNESS = 0.4;
const FLOOR2_CEILING_Y = 10.6;

/**
 * Builds the Upper Level (Floor 2, Y = 5.8m) IKEA Rishon LeZion Showroom:
 * - Perimeter floor slabs leaving Central Atrium opening x [19.8, 30.2], z [2.0, 12.6]
 * - Glass Atrium balustrades (preventing drops into F1 while keeping views open)
 * - Winding Showroom departments (Living Room, Home Office, Bedrooms, Kitchens & Dining)
 * - Upstairs IKEA Restaurant & Mezzanine lounge
 */
export function buildShowroomFloor2(
  palette: MaterialPalette,
  collision: CollisionManager,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ShowroomFloor2';

  // --- 1. Floor 2 Slabs with explicit floor: 2 SurfaceMeta ---
  // West Wing: x [7, 19.8], z [-14, 24]
  addBox(group, collision, 'f2-slab-west', 13.4, FLOOR2_SLAB_CENTER_Y, 5.0, 12.8, FLOOR2_SLAB_THICKNESS, 38.0, palette.showroomFloor, {
    castShadow: false,
    surfaceMeta: { floor: 2, zoneId: 'Showroom' },
  });
  // East-North Wing (Restaurant): x [30.2, 45], z [-14, 2.0]
  addBox(group, collision, 'f2-slab-east-n', 37.6, FLOOR2_SLAB_CENTER_Y, -6.0, 14.8, FLOOR2_SLAB_THICKNESS, 16.0, palette.showroomFloor, {
    castShadow: false,
    surfaceMeta: { floor: 2, zoneId: 'Restaurant' },
  });
  // East-South Wing (Kitchens & Dining): x [30.2, 45], z [2.0, 24]
  addBox(group, collision, 'f2-slab-east-s', 37.6, FLOOR2_SLAB_CENTER_Y, 13.0, 14.8, FLOOR2_SLAB_THICKNESS, 22.0, palette.showroomFloor, {
    castShadow: false,
    surfaceMeta: { floor: 2, zoneId: 'Showroom' },
  });
  // North Bridge / Escalator & Stair Top Landing: x [19.8, 30.2], z [-14, 2.0]
  addBox(group, collision, 'f2-slab-north', 25.0, FLOOR2_SLAB_CENTER_Y, -6.0, 10.4, FLOOR2_SLAB_THICKNESS, 16.0, palette.showroomFloor, {
    castShadow: false,
    surfaceMeta: { floor: 2, zoneId: 'Showroom' },
  });
  // South Mezzanine Bridge: x [19.8, 30.2], z [12.6, 24]
  addBox(group, collision, 'f2-slab-south', 25.0, FLOOR2_SLAB_CENTER_Y, 18.3, 10.4, FLOOR2_SLAB_THICKNESS, 11.4, palette.showroomFloor, {
    castShadow: false,
    surfaceMeta: { floor: 2, zoneId: 'Showroom' },
  });

  // --- 2. Floor 2 Ceiling & Atrium Skylight ---
  addBox(group, collision, 'f2-ceiling', 26.0, FLOOR2_CEILING_Y + 0.4, 5.0, 38.0, 0.8, 38.0, palette.ceiling, {
    castShadow: false,
    receiveShadow: false,
  });

  // Cool bright skylight frame over Atrium
  const skylight = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.08, 9.6), palette.lightPanel);
  skylight.position.set(25.0, FLOOR2_CEILING_Y - 0.04, 7.3);
  group.add(skylight);

  [-8, 0, 10, 19].forEach((z) => {
    [13, 38].forEach((x) => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 0.7), palette.lightPanel);
      panel.position.set(x, FLOOR2_CEILING_Y - 0.04, z);
      group.add(panel);
    });
  });

  // --- 3. Atrium Glass Balustrades (Solid waist-high safety glass around cutout) ---
  const addBalustrade = (id: string, x: number, z: number, w: number, d: number): void => {
    const railH = 1.15;
    addBox(group, collision, id, x, FLOOR2_Y + railH / 2, z, w, railH, d, palette.glass, {
      castShadow: false,
      receiveShadow: false,
      blocksCamera: false,
    });
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.06, d + 0.03), palette.metalDark);
    cap.position.set(x, FLOOR2_Y + railH + 0.03, z);
    group.add(cap);
  };

  addBalustrade('f2-atrium-rail-w', 19.86, 7.3, 0.14, 10.6);
  addBalustrade('f2-atrium-rail-e', 30.14, 7.3, 0.14, 10.6);
  addBalustrade('f2-atrium-rail-s', 25.0, 12.54, 10.18, 0.14);

  // --- 4. Winding Showroom Department Partition Walls ---
  // Low divider between Living Room (z > -2) and Home Office (z < -2), open passage East [15.5, 19.5]
  addWallSegment(group, collision, 'f2-div-living-office', 11.2, -1.6, 8.2, 0.24, 3.2, palette.wall, palette, FLOOR2_Y, false);
  // Divider between Living Room and Bedrooms (z = 12.6), open passage x [14.5, 19.5]
  addWallSegment(group, collision, 'f2-div-living-bed', 10.6, 12.6, 7.0, 0.24, 3.2, palette.wall, palette, FLOOR2_Y, false);
  // Divider between Restaurant (z < 2.0) and Kitchens (z > 2.0) with wide archway x [31, 36.5]
  addWallSegment(group, collision, 'f2-div-rest-kitchen', 40.6, 2.0, 8.6, 0.24, 3.6, palette.wall, palette, FLOOR2_Y, false);

  // Floor 2 Yellow Showroom Path Arrows
  const addF2Arrow = (x: number, z: number, rotY: number): void => {
    const arrow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), palette.floorArrow);
    arrow.rotation.x = -Math.PI / 2;
    arrow.rotation.z = rotY;
    arrow.position.set(x, FLOOR2_Y + 0.025, z);
    arrow.receiveShadow = true;
    group.add(arrow);
  };
  addF2Arrow(21.6, 0.4, Math.PI / 2); // Off up-escalator -> turn West into Living Room
  addF2Arrow(16.6, 4.2, Math.PI); // South through Living Room
  addF2Arrow(16.6, 15.2, -Math.PI / 2); // East across Mezzanine Bridge
  addF2Arrow(25.0, 18.0, -Math.PI / 2); // Toward Kitchens
  addF2Arrow(33.5, 8.0, 0); // North toward Restaurant
  addF2Arrow(32.5, -2.5, Math.PI / 2); // West toward Down Escalator & Stairs

  // --- 5. Living Room Showroom Department (West Wing, Floor 2) ---
  const livingRug = createRug(5.2, 4.2, palette.rugBeige);
  livingRug.position.set(12.2, FLOOR2_Y + 0.02, 6.2);
  group.add(livingRug);
  placeProp(group, collision, 'f2-sr-sofa', createSofa(palette), 12.2, 4.4, 0, FLOOR2_Y);
  placeProp(group, collision, 'f2-sr-coffee', createCoffeeTable(palette), 12.2, 6.2, 0, FLOOR2_Y);
  placeProp(group, collision, 'f2-sr-poang', createPoangChair(palette), 14.5, 6.3, -Math.PI * 0.65, FLOOR2_Y);
  placeProp(group, collision, 'f2-sr-kallax', createKallaxUnit(palette), 9.4, 6.2, Math.PI / 2, FLOOR2_Y);

  const poangTag = createProductPlacard(palette, 'POÄNG');
  poangTag.position.set(15.3, FLOOR2_Y, 7.3);
  const kallaxTag = createProductPlacard(palette, 'KALLAX');
  kallaxTag.position.set(9.6, FLOOR2_Y, 8.0);
  group.add(poangTag, kallaxTag);

  // --- 6. North-West Study & Workspaces (Floor 2) ---
  placeProp(group, collision, 'f2-office-billy', createBillyBookcase(palette), 9.0, -8.5, Math.PI / 2, FLOOR2_Y);
  placeProp(group, collision, 'f2-office-kallax', createKallaxUnit(palette), 14.5, -9.2, 0, FLOOR2_Y);
  const billyTag = createProductPlacard(palette, 'BILLY');
  billyTag.position.set(9.4, FLOOR2_Y, -6.5);
  group.add(billyTag);

  // --- 7. South-West Bedrooms Department (Floor 2) ---
  const bedRug = createRug(5.0, 4.6, palette.ikeaBlue);
  bedRug.position.set(12.2, FLOOR2_Y + 0.02, 18.2);
  group.add(bedRug);
  placeProp(group, collision, 'f2-sr-malm-bed', createMalmBed(palette), 12.2, 18.4, 0, FLOOR2_Y);
  placeProp(group, collision, 'f2-sr-bed-billy', createBillyBookcase(palette), 9.0, 17.8, Math.PI / 2, FLOOR2_Y);
  const malmTag = createProductPlacard(palette, 'MALM');
  malmTag.position.set(14.8, FLOOR2_Y, 20.3);
  group.add(malmTag);

  // --- 8. East-South Kitchens & Dining Department (Floor 2) ---
  placeProp(group, collision, 'f2-sr-kitchen-1', createKitchenDisplay(palette), 41.2, 8.6, -Math.PI / 2, FLOOR2_Y);
  placeProp(group, collision, 'f2-sr-kitchen-2', createKitchenDisplay(palette), 41.2, 17.0, -Math.PI / 2, FLOOR2_Y);
  placeProp(group, collision, 'f2-sr-dining-table', createRestaurantTable(palette), 35.0, 13.0, 0, FLOOR2_Y);

  // --- 9. IKEA Restaurant Wing (North-East, Floor 2) ---
  const restFloor = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.02, 14.4), palette.floor);
  restFloor.position.set(37.6, FLOOR2_Y + 0.022, -6.2);
  restFloor.receiveShadow = true;
  group.add(restFloor);

  const restSign = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.05, 0.14), palette.restaurantSign);
  restSign.position.set(37.6, FLOOR2_Y + 3.8, -13.6);
  group.add(restSign);

  placeProp(group, collision, 'f2-rest-counter', createRestaurantCounter(palette), 37.6, -12.1, 0, FLOOR2_Y);
  placeProp(group, collision, 'f2-rest-table-1', createRestaurantTable(palette), 34.0, -8.2, 0, FLOOR2_Y);
  placeProp(group, collision, 'f2-rest-table-2', createRestaurantTable(palette), 40.6, -8.2, 0, FLOOR2_Y);
  placeProp(group, collision, 'f2-rest-table-3', createRestaurantTable(palette), 34.0, -3.6, 0, FLOOR2_Y);
  placeProp(group, collision, 'f2-rest-table-4', createRestaurantTable(palette), 40.6, -3.6, 0, FLOOR2_Y);

  return group;
}
