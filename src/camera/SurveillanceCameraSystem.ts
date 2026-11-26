import * as THREE from 'three';
import { SECURITY_CAMERA_FEEDS } from '../interaction/ComputerInteraction';

const MAIN_WIDTH = 384;
const MAIN_HEIGHT = 216;
const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 90;

const MAIN_INTERVAL = 1 / 15; // ~15 FPS for selected live feed
const THUMB_INTERVAL = 0.18; // Round-robin thumbnail refresh

// Precomputed linear -> sRGB LUT so offscreen WebGLRenderTarget output matches screen brightness
const LINEAR_TO_SRGB = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  const lin = i / 255;
  const srgb =
    lin <= 0.0031308 ? lin * 12.92 : 1.055 * Math.pow(lin, 1 / 2.4) - 0.055;
  LINEAR_TO_SRGB[i] = Math.min(255, Math.max(0, Math.round(srgb * 255)));
}

interface SurveillanceCamEntry {
  camera: THREE.PerspectiveCamera;
  baseLookAt: THREE.Vector3;
  baseOffset: THREE.Vector3;
  phaseOffset: number;
}

/**
 * Renders live 3D surveillance feeds from dedicated world-space cameras into
 * WebGLRenderTargets and blits them to persistent terminal <canvas> elements.
 * Performs zero rendering when the security computer interface is closed.
 */
export class SurveillanceCameraSystem {
  private readonly entries: SurveillanceCamEntry[];
  private readonly mainTarget: THREE.WebGLRenderTarget;
  private readonly thumbTarget: THREE.WebGLRenderTarget;
  private readonly mainPixelBuf = new Uint8Array(MAIN_WIDTH * MAIN_HEIGHT * 4);
  private readonly thumbPixelBuf = new Uint8Array(THUMB_WIDTH * THUMB_HEIGHT * 4);

  private mainImageData: ImageData | null = null;
  private thumbImageData: ImageData | null = null;

  private wasOpen = false;
  private elapsed = 0;
  private mainTimer = 0;
  private thumbTimer = 0;
  private nextThumbIdx = 0;
  private lastRenderedActiveCam = -1;
  private renderCount = 0;

  constructor() {
    this.entries = SECURITY_CAMERA_FEEDS.map((feed, idx) => {
      const cam = new THREE.PerspectiveCamera(62, MAIN_WIDTH / MAIN_HEIGHT, 0.2, 95);
      cam.position.copy(feed.position);
      cam.lookAt(feed.lookAt);
      return {
        camera: cam,
        baseLookAt: feed.lookAt.clone(),
        baseOffset: feed.lookAt.clone().sub(feed.position),
        phaseOffset: idx * 1.4,
      };
    });

    this.mainTarget = new THREE.WebGLRenderTarget(MAIN_WIDTH, MAIN_HEIGHT, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
    });
    this.thumbTarget = new THREE.WebGLRenderTarget(THUMB_WIDTH, THUMB_HEIGHT, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
    });
  }

  getCameras(): readonly THREE.PerspectiveCamera[] {
    return this.entries.map((e) => e.camera);
  }

  getRenderCount(): number {
    return this.renderCount;
  }

  update(
    dt: number,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    isOpen: boolean,
    activeCamIndex: number,
    mainCanvas: HTMLCanvasElement,
    thumbCanvases: readonly HTMLCanvasElement[],
  ): void {
    if (!isOpen) {
      this.wasOpen = false;
      this.lastRenderedActiveCam = -1;
      return;
    }

    this.elapsed += dt;
    this.mainTimer += dt;
    this.thumbTimer += dt;

    // Gentle CCTV pan sweep around each camera's target
    for (const entry of this.entries) {
      const panAngle = Math.sin(this.elapsed * 0.45 + entry.phaseOffset) * 0.08;
      const cos = Math.cos(panAngle);
      const sin = Math.sin(panAngle);
      const rx = entry.baseOffset.x * cos - entry.baseOffset.z * sin;
      const rz = entry.baseOffset.x * sin + entry.baseOffset.z * cos;
      entry.camera.lookAt(
        entry.camera.position.x + rx,
        entry.baseLookAt.y,
        entry.camera.position.z + rz,
      );
    }

    const justOpened = !this.wasOpen;
    this.wasOpen = true;

    const prevTarget = renderer.getRenderTarget();
    const prevAutoUpdate = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;

    try {
      // On first frame after opening, render all 4 thumbnails + active main feed immediately
      if (justOpened) {
        for (let i = 0; i < this.entries.length; i++) {
          const thumbCanvas = thumbCanvases[i];
          if (thumbCanvas) {
            this.renderFeedToCanvas(
              renderer,
              scene,
              this.entries[i].camera,
              this.thumbTarget,
              this.thumbPixelBuf,
              THUMB_WIDTH,
              THUMB_HEIGHT,
              thumbCanvas,
              true,
            );
          }
        }
        this.renderMainFeed(renderer, scene, activeCamIndex, mainCanvas);
        this.mainTimer = 0;
        this.thumbTimer = 0;
        this.lastRenderedActiveCam = activeCamIndex;
        return;
      }

      // Render main active feed immediately on camera switch, or at ~15 FPS
      if (activeCamIndex !== this.lastRenderedActiveCam || this.mainTimer >= MAIN_INTERVAL) {
        this.renderMainFeed(renderer, scene, activeCamIndex, mainCanvas);
        this.mainTimer = 0;
        this.lastRenderedActiveCam = activeCamIndex;
      }

      // Refresh one thumbnail round-robin every THUMB_INTERVAL
      if (this.thumbTimer >= THUMB_INTERVAL && thumbCanvases.length > 0) {
        const idx = this.nextThumbIdx % this.entries.length;
        const thumbCanvas = thumbCanvases[idx];
        if (thumbCanvas) {
          this.renderFeedToCanvas(
            renderer,
            scene,
            this.entries[idx].camera,
            this.thumbTarget,
            this.thumbPixelBuf,
            THUMB_WIDTH,
            THUMB_HEIGHT,
            thumbCanvas,
            true,
          );
        }
        this.nextThumbIdx = (idx + 1) % this.entries.length;
        this.thumbTimer = 0;
      }
    } finally {
      renderer.setRenderTarget(prevTarget);
      renderer.shadowMap.autoUpdate = prevAutoUpdate;
    }
  }

  dispose(): void {
    this.mainTarget.dispose();
    this.thumbTarget.dispose();
  }

  private renderMainFeed(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camIndex: number,
    canvas: HTMLCanvasElement,
  ): void {
    const entry = this.entries[camIndex] ?? this.entries[0];
    this.renderFeedToCanvas(
      renderer,
      scene,
      entry.camera,
      this.mainTarget,
      this.mainPixelBuf,
      MAIN_WIDTH,
      MAIN_HEIGHT,
      canvas,
      false,
    );
  }

  private renderFeedToCanvas(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    target: THREE.WebGLRenderTarget,
    pixelBuf: Uint8Array,
    width: number,
    height: number,
    canvas: HTMLCanvasElement,
    isThumb: boolean,
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixelBuf);
    this.renderCount += 1;

    let imgData = isThumb ? this.thumbImageData : this.mainImageData;
    if (!imgData || imgData.width !== width || imgData.height !== height) {
      imgData = ctx.createImageData(width, height);
      if (isThumb) {
        this.thumbImageData = imgData;
      } else {
        this.mainImageData = imgData;
      }
    }

    const dst = imgData.data;
    const rowBytes = width * 4;
    // Flip Y from WebGL bottom-up origin to Canvas 2D top-down + convert linear to sRGB
    for (let y = 0; y < height; y++) {
      const srcRow = (height - 1 - y) * rowBytes;
      const dstRow = y * rowBytes;
      for (let x = 0; x < rowBytes; x += 4) {
        dst[dstRow + x] = LINEAR_TO_SRGB[pixelBuf[srcRow + x]];
        dst[dstRow + x + 1] = LINEAR_TO_SRGB[pixelBuf[srcRow + x + 1]];
        dst[dstRow + x + 2] = LINEAR_TO_SRGB[pixelBuf[srcRow + x + 2]];
        dst[dstRow + x + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }
}
