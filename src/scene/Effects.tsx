import { useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import type { EffectComposer as EffectComposerImpl } from 'postprocessing';
import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
  BrightnessContrast,
  ToneMapping,
  SMAA,
  Glitch,
} from '@react-three/postprocessing';
import { ToneMappingMode, GlitchMode } from 'postprocessing';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';
import { Exposure } from './ExposureEffect';
import { Focus } from './Focus';
import { Analog } from './Analog';
import { Grain } from './GrainEffect';
import { sceneRef } from '../lib/sceneRef';

const NONE = null as unknown as ReactElement; // conditional effect placeholder

/**
 * The DSLR + analog layer. Pipeline order:
 *   Exposure -> Focus blur -> Bloom (HDR) -> ToneMapping (ACES)
 *   -> contrast / CA / vignette (LDR) -> Analog (halation/leaks/VHS/…)
 *   -> Glitch (datamosh) -> Grain (last).
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

  const halation = useMockupStore((s) => s.halation);
  const lightLeaks = useMockupStore((s) => s.lightLeaks);
  const scanGlow = useMockupStore((s) => s.scanGlow);
  const lensDust = useMockupStore((s) => s.lensDust);
  const vhs = useMockupStore((s) => s.vhs);
  const datamosh = useMockupStore((s) => s.datamosh);

  const analogOn = halation + lightLeaks + scanGlow + lensDust + vhs > 0.001;

  const caOffset = useMemo(
    () => new THREE.Vector2(chromaticAberration, chromaticAberration),
    [chromaticAberration],
  );

  const glitchDelay = useMemo(() => new THREE.Vector2(2.5, 6), []);
  const glitchDuration = useMemo(() => new THREE.Vector2(0.15, 0.5), []);
  const glitchStrength = useMemo(
    () => new THREE.Vector2(0.2 * datamosh, 0.9 * datamosh),
    [datamosh],
  );

  useEffect(() => {
    invalidate();
  }, [
    invalidate, exposure, bloom, vignette, chromaticAberration, grain, contrast,
    halation, lightLeaks, scanGlow, lensDust, vhs, datamosh,
  ]);

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
      {analogOn ? <Analog /> : NONE}
      {datamosh > 0.001 ? (
        <Glitch
          delay={glitchDelay}
          duration={glitchDuration}
          strength={glitchStrength}
          mode={datamosh > 0.6 ? GlitchMode.CONSTANT_WILD : GlitchMode.SPORADIC}
          ratio={0.85}
        />
      ) : (
        NONE
      )}
      <Grain intensity={grain} />
    </EffectComposer>
  );
}
