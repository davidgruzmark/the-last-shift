export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface GraphicsPreset {
  quality: GraphicsQuality;
  label: string;
  pixelRatioCap: number;
  shadowMapSize: number;
  shadowsEnabled: boolean;
  antialias: boolean;
}

export const GRAPHICS_PRESETS: Record<GraphicsQuality, GraphicsPreset> = {
  low: {
    quality: 'low',
    label: 'Low',
    pixelRatioCap: 1.0,
    shadowMapSize: 512,
    shadowsEnabled: false,
    antialias: false,
  },
  medium: {
    quality: 'medium',
    label: 'Med',
    pixelRatioCap: 1.5,
    shadowMapSize: 1024,
    shadowsEnabled: true,
    antialias: true,
  },
  high: {
    quality: 'high',
    label: 'High',
    pixelRatioCap: 2.0,
    shadowMapSize: 2048,
    shadowsEnabled: true,
    antialias: true,
  },
};
