import { useEffect, useMemo } from 'react';
import {
  EffectComposer,
  DepthOfField,
  Bloom,
  Vignette,
  ChromaticAberration,
  BrightnessContrast,
  ToneMapping,
  SMAA,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';
import { surfaceMetrics } from '../lib/deviceDims';
import { Exposure } from './ExposureEffect';
import { Grain } from './GrainEffect';

/**
 * The DSLR layer (spec §5 Phase 2 + §6.8). Pipeline order:
 *   Exposure (linear multiply) -> Depth of field -> Bloom (HDR)
 *   -> ToneMapping (ACES) -> contrast / CA / vignette (LDR) -> Grain (last).
 *
 * Tone-mapping is an explicit pass because the EffectComposer disables the
 * renderer's tone-mapping; that's also why Exposure is its own pass.
 *
 * Focus is true depth-of-field: it auto-focuses on a world point on the surface
 * (so the sharp zone follows the perspective), Position sweeps that point along
 * the surface's depth, Size is the in-focus range, Blur is the bokeh scale.
 */
export function Effects() {
  const invalidate = useThree((s) => s.invalidate);

  const exposure = useMockupStore((s) => s.exposure);
  const focusDistance = useMockupStore((s) => s.focusDistance);
  const focusSize = useMockupStore((s) => s.focusSize);
  const blur = useMockupStore((s) => s.blur);
  const screenAspect = useMockupStore((s) => s.screenAspect);
  const targetX = useMockupStore((s) => s.targetX);
  const targetY = useMockupStore((s) => s.targetY);
  const targetZ = useMockupStore((s) => s.targetZ);
  const bloom = useMockupStore((s) => s.bloom);
  const vignette = useMockupStore((s) => s.vignette);
  const chromaticAberration = useMockupStore((s) => s.chromaticAberration);
  const grain = useMockupStore((s) => s.grain);
  const contrast = useMockupStore((s) => s.contrast);

  const caOffset = useMemo(
    () => new THREE.Vector2(chromaticAberration, chromaticAberration),
    [chromaticAberration],
  );

  // Focus point: surface centre (+ pan), swept along the depth axis by Position.
  const surfaceH = surfaceMetrics(screenAspect).h;
  const focusTarget = useMemo<[number, number, number]>(
    () => [targetX, targetY, targetZ + (focusDistance - 0.5) * surfaceH],
    [targetX, targetY, targetZ, focusDistance, surfaceH],
  );
  const focusRange = Math.max(focusSize * surfaceH, 0.02);
  const bokehScale = blur * 8;

  // frameloop="demand": make sure post-only param changes request a frame.
  useEffect(() => {
    invalidate();
  }, [
    invalidate,
    exposure,
    focusDistance,
    focusSize,
    blur,
    bloom,
    vignette,
    chromaticAberration,
    grain,
    contrast,
  ]);

  return (
    <EffectComposer multisampling={0}>
      <Exposure exposure={exposure} />
      <SMAA />
      <DepthOfField
        target={focusTarget}
        focusRange={focusRange}
        bokehScale={bokehScale}
        resolutionScale={0.5}
      />
      <Bloom intensity={bloom} luminanceThreshold={0.78} luminanceSmoothing={0.3} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <BrightnessContrast brightness={0} contrast={contrast - 1} />
      <ChromaticAberration offset={caOffset} radialModulation={false} modulationOffset={0} />
      <Vignette darkness={vignette} offset={0.3} eskil={false} />
      <Grain intensity={grain} />
    </EffectComposer>
  );
}
