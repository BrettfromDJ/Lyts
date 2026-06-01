import { useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import {
  EffectComposer,
  TiltShift,
  Bloom,
  Vignette,
  ChromaticAberration,
  BrightnessContrast,
  ToneMapping,
  SMAA,
} from '@react-three/postprocessing';
import { KernelSize, ToneMappingMode, BlendFunction } from 'postprocessing';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';
import type { CrtBlend } from '../store/useMockupStore';
import { Exposure } from './ExposureEffect';
import { Grain } from './GrainEffect';
import { CRT } from './CRTEffect';

const CRT_BLEND: Record<CrtBlend, BlendFunction> = {
  normal: BlendFunction.NORMAL,
  screen: BlendFunction.SCREEN,
  overlay: BlendFunction.OVERLAY,
  multiply: BlendFunction.MULTIPLY,
  softlight: BlendFunction.SOFT_LIGHT,
  add: BlendFunction.ADD,
};

const KERNELS = [
  KernelSize.VERY_SMALL,
  KernelSize.SMALL,
  KernelSize.MEDIUM,
  KernelSize.LARGE,
  KernelSize.VERY_LARGE,
  KernelSize.HUGE,
];

/**
 * The DSLR layer (spec §5 Phase 2 + §6.8). Pipeline order:
 *   Exposure (linear multiply) -> TiltShift focus/blur -> Bloom (HDR)
 *   -> ToneMapping (ACES) -> contrast / CA / vignette (LDR) -> Grain (last).
 *
 * Tone-mapping is an explicit pass because the EffectComposer disables the
 * renderer's tone-mapping; that's also why Exposure is its own pass.
 *
 * Focus is a tilt-shift band: position (offset), size (focusArea), falloff
 * (feather) and angle (rotation) — one Blur control replaces aperture+bokeh.
 */
export function Effects() {
  const invalidate = useThree((s) => s.invalidate);

  const exposure = useMockupStore((s) => s.exposure);
  const focusDistance = useMockupStore((s) => s.focusDistance);
  const focusSize = useMockupStore((s) => s.focusSize);
  const focusFalloff = useMockupStore((s) => s.focusFalloff);
  const focusAngle = useMockupStore((s) => s.focusAngle);
  const blur = useMockupStore((s) => s.blur);
  const bloom = useMockupStore((s) => s.bloom);
  const vignette = useMockupStore((s) => s.vignette);
  const chromaticAberration = useMockupStore((s) => s.chromaticAberration);
  const grain = useMockupStore((s) => s.grain);
  const contrast = useMockupStore((s) => s.contrast);

  const crtEnabled = useMockupStore((s) => s.crtEnabled);
  const crtBlend = useMockupStore((s) => s.crtBlend);
  const crtOpacity = useMockupStore((s) => s.crtOpacity);
  const crtScanline = useMockupStore((s) => s.crtScanline);
  const crtScanCount = useMockupStore((s) => s.crtScanCount);
  const crtGrille = useMockupStore((s) => s.crtGrille);
  const crtFlicker = useMockupStore((s) => s.crtFlicker);
  const crtRoll = useMockupStore((s) => s.crtRoll);
  const crtSpeed = useMockupStore((s) => s.crtSpeed);
  const crtCurve = useMockupStore((s) => s.crtCurve);

  const caOffset = useMemo(
    () => new THREE.Vector2(chromaticAberration, chromaticAberration),
    [chromaticAberration],
  );

  const kernel = KERNELS[Math.round(THREE.MathUtils.clamp(blur, 0, 1) * 5)];

  // frameloop="demand": make sure post-only param changes request a frame.
  useEffect(() => {
    invalidate();
  }, [
    invalidate,
    exposure,
    focusDistance,
    focusSize,
    focusFalloff,
    focusAngle,
    blur,
    bloom,
    vignette,
    chromaticAberration,
    grain,
    contrast,
    crtEnabled,
    crtBlend,
    crtOpacity,
    crtScanline,
    crtScanCount,
    crtGrille,
    crtFlicker,
    crtRoll,
    crtSpeed,
    crtCurve,
  ]);

  return (
    <EffectComposer multisampling={0}>
      <Exposure exposure={exposure} />
      <SMAA />
      <TiltShift
        offset={(focusDistance - 0.5) * 1.2}
        rotation={THREE.MathUtils.degToRad(focusAngle)}
        focusArea={focusSize}
        feather={focusFalloff}
        kernelSize={kernel}
        resolutionScale={0.5}
      />
      <Bloom intensity={bloom} luminanceThreshold={0.78} luminanceSmoothing={0.3} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <BrightnessContrast brightness={0} contrast={contrast - 1} />
      <ChromaticAberration offset={caOffset} radialModulation={false} modulationOffset={0} />
      <Vignette darkness={vignette} offset={0.3} eskil={false} />
      {crtEnabled ? (
        <CRT
          blendFunction={CRT_BLEND[crtBlend] ?? BlendFunction.NORMAL}
          opacity={crtOpacity}
          scanline={crtScanline}
          scanCount={crtScanCount}
          grille={crtGrille}
          flicker={crtFlicker}
          roll={crtRoll}
          speed={crtSpeed}
          curve={crtCurve}
        />
      ) : (
        (null as unknown as ReactElement)
      )}
      <Grain intensity={grain} />
    </EffectComposer>
  );
}
