import { useEffect, useMemo } from 'react';
import {
  EffectComposer,
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
import { Exposure } from './ExposureEffect';
import { Focus } from './FocusEffect';
import { Grain } from './GrainEffect';

/**
 * The DSLR layer (spec §5 Phase 2 + §6.8). Pipeline order:
 *   Exposure (linear multiply) -> Focus blur -> Bloom (HDR)
 *   -> ToneMapping (ACES) -> contrast / CA / vignette (LDR) -> Grain (last).
 *
 * Tone-mapping is an explicit pass because the EffectComposer disables the
 * renderer's tone-mapping; that's also why Exposure is its own pass.
 *
 * Focus is a custom tilt-shift band: position, size, falloff and angle define a
 * sharp strip; everything outside blurs by Blur. One Blur control, no bokeh.
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

  const caOffset = useMemo(
    () => new THREE.Vector2(chromaticAberration, chromaticAberration),
    [chromaticAberration],
  );

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
  ]);

  return (
    <EffectComposer multisampling={0}>
      <Exposure exposure={exposure} />
      <SMAA />
      <Focus
        position={focusDistance - 0.5}
        size={focusSize * 0.5}
        feather={focusFalloff * 0.5}
        angle={THREE.MathUtils.degToRad(focusAngle)}
        blur={blur * 0.06}
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
