import * as THREE from 'three';

/**
 * Manages cached procedural textures and placeholder fallbacks so missing assets
 * never block rendering or crash the game.
 */
export class AssetManager {
  private textureCache = new Map<string, THREE.Texture>();

  getOrCreateCanvasTexture(
    key: string,
    width: number,
    height: number,
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    options?: { repeatX?: number; repeatY?: number },
  ): THREE.Texture {
    const existing = this.textureCache.get(key);
    if (existing) {
      return existing;
    }

    if (typeof document === 'undefined') {
      return this.createFallbackTexture(key);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      draw(ctx, width, height);
    } else {
      return this.createFallbackTexture(key);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;

    if (options?.repeatX || options?.repeatY) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(options.repeatX ?? 1, options.repeatY ?? 1);
    }

    this.textureCache.set(key, texture);
    return texture;
  }

  createFallbackTexture(key: string): THREE.Texture {
    const existing = this.textureCache.get(`fallback:${key}`);
    if (existing) return existing;

    const data = new Uint8Array([0, 88, 163, 255]);
    const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    texture.needsUpdate = true;
    this.textureCache.set(`fallback:${key}`, texture);
    return texture;
  }

  dispose(): void {
    for (const texture of this.textureCache.values()) {
      texture.dispose();
    }
    this.textureCache.clear();
  }
}
