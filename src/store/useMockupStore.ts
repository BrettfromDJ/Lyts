import { create } from 'zustand';
import type * as THREE from 'three';

/**
 * The single source of truth — "the spine".
 *
 * Controls write here; scene components subscribe via selectors.
 * NEVER mirror these into React useState for live drags, or slider
 * performance tanks (see spec §6.6). A preset is literally a
 * Partial<MockupState> JSON object — which is why the full shape is
 * defined up front, even where a phase only wires up a subset.
 */
export type BgMode = 'solid' | 'gradient' | 'env-blur' | 'transparent';

export type MockupState = {
  // --- Camera ---
  azimuth: number; // deg, orbit around Y
  polar: number; // deg, tilt (the "iso" angle)
  distance: number; // camera dolly
  focalLength: number; // mm-ish; maps to FOV. long = ~20-30deg iso sweet spot

  // --- Geometry ---
  cornerRadius: number; // device corner roundness
  bevel: number; // edge bevel — rounded+beveled edges catch light; sharp = CG
  thickness: number; // device depth

  // --- Screen material ---
  screenBrightness: number; // emissive intensity (modest — let bloom glow)
  glassRoughness: number;
  reflectionIntensity: number; // envMapIntensity on the glass layer
  pixelTexture: number; // subtle screen-door / pixel grid amount

  // --- Lighting ---
  hdriPreset: string; // named procedural environment mood
  hdriRotation: number;
  keyColor: string;
  keyIntensity: number;
  fillColor: string;
  fillIntensity: number;
  rimColor: string;
  rimIntensity: number;
  shadowSoftness: number;
  shadowOpacity: number;

  // --- Post (the DSLR layer) ---
  exposure: number;
  contrast: number;
  focusDistance: number; // DOF focal plane (normalized 0..1)
  aperture: number; // f-stop -> bokeh strength
  bokehScale: number;
  bloom: number;
  vignette: number;
  chromaticAberration: number;
  grain: number; // screen-space, post-tonemap

  // --- Background ---
  bgMode: BgMode;
  bgColorA: string;
  bgColorB: string;

  // --- Asset ---
  screenshot: THREE.Texture | null;
  screenAspect: number; // width / height of the uploaded screenshot

  // --- Pro / license gate (Phase 5 — config layer, defined now) ---
  isPro: boolean;

  // --- actions ---
  set: (partial: Partial<MockupState>) => void;
  loadPreset: (p: Partial<MockupState>) => void;
};

export const DEFAULTS: Omit<MockupState, 'set' | 'loadPreset'> = {
  // Camera — diagonal iso-ish tilt, long lens for minimal convergence.
  // `distance` is a zoom multiplier on the auto-fit (1 = device fills frame).
  azimuth: 35,
  polar: 48,
  distance: 1.1,
  focalLength: 55,

  // Geometry
  cornerRadius: 0.12,
  bevel: 0.02,
  thickness: 0.18,

  // Screen material
  screenBrightness: 1.0,
  glassRoughness: 0.08,
  reflectionIntensity: 1.1,
  pixelTexture: 0.0,

  // Lighting
  hdriPreset: 'studio',
  hdriRotation: 0,
  keyColor: '#ffffff',
  keyIntensity: 1.4,
  fillColor: '#aac4ff',
  fillIntensity: 0.5,
  rimColor: '#ffffff',
  rimIntensity: 1.6,
  shadowSoftness: 2.4,
  shadowOpacity: 0.55,

  // Post
  exposure: 1.0,
  contrast: 1.05,
  focusDistance: 0.5,
  aperture: 2.8,
  bokehScale: 4,
  bloom: 0.6,
  vignette: 0.35,
  chromaticAberration: 0.0008,
  grain: 0.06,

  // Background
  bgMode: 'gradient',
  bgColorA: '#1a1d24',
  bgColorB: '#05060a',

  // Asset
  screenshot: null,
  screenAspect: 16 / 10,

  // Pro
  isPro: false,
};

export const useMockupStore = create<MockupState>((set) => ({
  ...DEFAULTS,
  set: (partial) => set(partial),
  loadPreset: (p) => set(p),
}));

/** Keys that are safe to serialize into a JSON preset (excludes runtime assets + actions). */
export const SERIALIZABLE_KEYS = (
  Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]
).filter((k) => k !== 'screenshot' && k !== 'screenAspect' && k !== 'isPro');

export type PresetData = Partial<
  Pick<MockupState, (typeof SERIALIZABLE_KEYS)[number]>
>;
