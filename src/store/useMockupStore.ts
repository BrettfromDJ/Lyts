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
export type CrtBlend = 'normal' | 'screen' | 'overlay' | 'multiply' | 'softlight' | 'add';
export type CrtMode = 'aperture' | 'shadow' | 'slot' | 'lcd' | 'mono';
export type ExportAspect = 'fullscreen' | '1:1' | '4:5' | '16:9' | '9:16';

export type MockupState = {
  // --- Camera ---
  azimuth: number; // deg, orbit around Y
  polar: number; // deg, grazing "rake" tilt
  zoom: number; // magnification; higher = closer / more zoomed in
  focalLength: number; // mm-ish; maps to FOV
  roll: number; // deg, editorial roll around the view axis
  tiltX: number; // surface tilt around X (deg) — tips far/near edge away
  tiltZ: number; // surface tilt around Z (deg) — tips left/right edge away
  targetX: number; // pan offset of the look-at point (world units)
  targetY: number;
  targetZ: number;

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
  bloom: number;
  vignette: number;
  chromaticAberration: number;
  grain: number; // screen-space, post-tonemap

  // --- Focus (screen-space tilt-shift band) ---
  focusDistance: number; // band position (0..1)
  focusSize: number; // sharp band half-width (0..1)
  focusFalloff: number; // feather / falloff (0..1)
  focusAngle: number; // band rotation (deg)
  blur: number; // max out-of-focus blur (0..1)
  bokeh: number; // bokeh highlight emphasis (0..1)

  // --- CRT overlay (animated) ---
  crtEnabled: boolean;
  crtMode: CrtMode; // phosphor mask type
  crtTint: string; // monochrome phosphor colour
  crtBlend: CrtBlend;
  crtOpacity: number;
  crtScanline: number;
  crtScanCount: number;
  crtGrille: number;
  crtFlicker: number;
  crtRoll: number;
  crtSpeed: number;
  crtCurve: number;

  // --- Film / analog (moody-filmic suite, applied on the screen surface) ---
  halation: number; // warm glow bleeding from highlights
  lightLeaks: number; // animated colored leaks
  lensDust: number; // dust specks / motes
  datamosh: number; // block displacement / chroma tear

  // --- Background ---
  bgMode: BgMode;
  bgColorA: string;
  bgColorB: string;

  // --- Animation (Phase 4) ---
  animate: boolean; // preview playing (also drives frameloop)
  motion: 'drift' | 'orbit' | 'push' | 'parallax';
  motionAmount: number; // amplitude
  motionSpeed: number; // cycles over the clip (1 = one seamless loop)
  videoDuration: number; // seconds
  videoFps: number;

  // --- Asset ---
  screenshot: THREE.Texture | null;
  screenAspect: number; // width / height of the uploaded screenshot

  // --- Export framing ---
  exportAspect: ExportAspect; // crop aspect for export (+ on-canvas frame)
  recording: boolean; // transient: video capture in progress (forces frameloop)
  recordElapsed: number; // transient: seconds elapsed in the current capture
  recordDpr: number; // transient: canvas DPR override while recording (0 = off)
  showCaptureFrame: boolean; // transient: show the export crop guide on canvas

  // --- Pro / license gate (all features enabled for everyone) ---
  isPro: boolean;

  // --- actions ---
  set: (partial: Partial<MockupState>) => void;
  loadPreset: (p: Partial<MockupState>) => void;
};

export const DEFAULTS: Omit<MockupState, 'set' | 'loadPreset'> = {
  // Camera — diagonal iso-ish tilt, long lens for minimal convergence.
  // `zoom` is magnification on the auto-fit (1 = whole surface fits; higher = closer).
  azimuth: 20,
  polar: 60,
  zoom: 3.0,
  focalLength: 300,
  roll: -17,
  tiltX: 0,
  tiltZ: 0,
  targetX: 0,
  targetY: 0,
  targetZ: 0,

  // Geometry
  cornerRadius: 0.015,
  bevel: 0.02,
  thickness: 0, // 0 = flat screen; raise for a physical device slab

  // Screen material
  screenBrightness: 1.0,
  glassRoughness: 0.5, // sheen roughness locked to max (control removed)
  reflectionIntensity: 0, // sheen off (control removed)
  pixelTexture: 0.0,

  // Lighting
  hdriPreset: 'studio',
  hdriRotation: 0,
  keyColor: '#ffffff',
  keyIntensity: 1.1,
  fillColor: '#cfd2d6',
  fillIntensity: 0.5,
  rimColor: '#ffffff',
  rimIntensity: 1.6,
  shadowSoftness: 2.4,
  shadowOpacity: 0.55,

  // Post
  exposure: 1.0,
  contrast: 1.12,
  bloom: 0.2,
  vignette: 0.42,
  chromaticAberration: 0.001,
  grain: 0.15,

  // Focus
  focusDistance: 0.5,
  focusSize: 0.5,
  focusFalloff: 0.4,
  focusAngle: 0,
  blur: 0.45,
  bokeh: 0,

  // CRT overlay
  crtEnabled: true,
  crtMode: 'aperture',
  crtTint: '#3bff7a',
  crtBlend: 'normal',
  crtOpacity: 0.3,
  crtScanline: 0.45,
  crtScanCount: 480,
  crtGrille: 0.3,
  crtFlicker: 0.3,
  crtRoll: 0,
  crtSpeed: 0.6,
  crtCurve: 0,

  // Film / analog
  halation: 0,
  lightLeaks: 0,
  lensDust: 0,
  datamosh: 0,

  // Background
  bgMode: 'gradient',
  bgColorA: '#1a1d24',
  bgColorB: '#05060a',

  // Animation
  animate: false,
  motion: 'drift',
  motionAmount: 1,
  motionSpeed: 1,
  videoDuration: 6,
  videoFps: 30,

  // Asset
  screenshot: null,
  screenAspect: 16 / 10,
  exportAspect: 'fullscreen',
  recording: false,
  recordElapsed: 0,
  recordDpr: 0,
  showCaptureFrame: false,

  // Pro
  isPro: true,
};

export const useMockupStore = create<MockupState>((set) => ({
  ...DEFAULTS,
  set: (partial) => set(partial),
  loadPreset: (p) => set(p),
}));

/** Keys that are safe to serialize into a JSON preset (excludes runtime assets + actions). */
export const SERIALIZABLE_KEYS = (
  Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]
).filter(
  (k) =>
    k !== 'screenshot' &&
    k !== 'screenAspect' &&
    k !== 'isPro' &&
    k !== 'animate' &&
    k !== 'recording' &&
    k !== 'recordElapsed' &&
    k !== 'recordDpr' &&
    k !== 'showCaptureFrame' &&
    k !== 'exportAspect' &&
    k !== 'targetX' &&
    k !== 'targetY' &&
    k !== 'targetZ',
);

export type PresetData = Partial<
  Pick<MockupState, (typeof SERIALIZABLE_KEYS)[number]>
>;
