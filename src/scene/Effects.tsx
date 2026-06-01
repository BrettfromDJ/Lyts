import { useEffect, useMemo, useRef } from 'react';
import type { EffectComposer as EffectComposerImpl } from 'postprocessing';
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
import { Focus } from './Focus';
import { Grain } from './GrainEffect';
import { sceneRef } from '../lib/sceneRef';

/**
 * The DSLR layer (spec §5 Phase 2 + §6.8). Pipeline order:
 *   Exposure (linear multiply) -> Focus blur -> Bloom (HDR)
 *   -> ToneMapping (ACES) -> contrast / CA / vignette (LDR) -> Grain (last).
 *
 * Tone-mapping is an explicit pass because the EffectComposer disables the
 * renderer's tone-mapping; that's also why Exposure is its own pass.
 *
 * Focus is a screen-space tilt-shift band (Position/Size/Falloff/Angle/Blur +
 * Bokeh) — see Focus.tsx.
 */
export function Effects() {
  const invalidate = useThree((s) => s.invalidate);
  const composerRef = useRef<EffectComposerImpl>(null);

  // Expose the composer so the still/video export renders through the full post
  // stack (otherwise a raw gl.render skips focus/bloom/tone-mapping/grain).
  useEffect(() => {
    sceneRef.composer = composerRef.current;
    return () => {
      sceneRef.composer = null;
    };
  });

  const exposure = useMockupStore((s) => s.exposure);
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
  // (Focus params are handled inside <Dof>, which invalidates itself.)
  useEffect(() => {
    invalidate();
  }, [invalidate, exposure, bloom, vignette, chromaticAberration, grain, contrast]);

  return (
    <EffectComposer ref={composerRef} multisampling={0}>
      <Exposure exposure={exposure} />
      <SMAA />
      <Focus />
      <Bloom intensity={bloom} luminanceThreshold={0.78} luminanceSmoothing={0.3} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <BrightnessContrast brightness={0} contrast={contrast - 1} />
      <ChromaticAberration offset={caOffset} radialModulation={false} modulationOffset={0} />
      <Vignette darkness={vignette} offset={0.3} eskil={false} />
      <Grain intensity={grain} />
    </EffectComposer>
  );
}
