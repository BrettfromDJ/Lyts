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
 * The DSLR layer. Pipeline: Exposure -> Focus blur -> Bloom (HDR) ->
 * ToneMapping (ACES) -> contrast / CA / vignette (LDR) -> Grain.
 * Film + CRT effects live on the screen surface (see DeviceMesh), not here.
 */
export function Effects() {
  const invalidate = useThree((s) => s.invalidate);
  const composerRef = useRef<EffectComposerImpl>(null);

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

  useEffect(() => {
    invalidate();
  }, [invalidate, exposure, bloom, vignette, chromaticAberration, grain, contrast]);

  return (
    <EffectComposer ref={composerRef} multisampling={0}>
      <Exposure exposure={exposure} />
      <SMAA />
      <Focus />
      <Bloom intensity={bloom} luminanceThreshold={0.42} luminanceSmoothing={0.45} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <BrightnessContrast brightness={0} contrast={contrast - 1} />
      <ChromaticAberration offset={caOffset} radialModulation={false} modulationOffset={0} />
      <Vignette darkness={vignette} offset={0.3} eskil={false} />
      <Grain intensity={grain} />
    </EffectComposer>
  );
}
