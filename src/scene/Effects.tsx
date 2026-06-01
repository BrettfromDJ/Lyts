import { useEffect, useMemo, useRef } from 'react';
import {
  EffectComposer,
  DepthOfField,
  Bloom,
  Vignette,
  ChromaticAberration,
  Noise,
  BrightnessContrast,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';

/**
 * The DSLR layer (spec §5 Phase 2 + §6.8).
 *
 * Order matters: DOF and Bloom first, colour/contrast next, grain LAST so it
 * sits in screen space on top of everything (static grain on a moving shot
 * looks like dirt on the lens — Phase 4 will re-seed it per frame).
 *
 * Tone mapping is done by the renderer (ACES, set on the <Canvas>, spec §4.1),
 * which RenderPass applies while drawing the scene — so we don't double it here.
 */
export function Effects() {
  const invalidate = useThree((s) => s.invalidate);

  const focusDistance = useMockupStore((s) => s.focusDistance);
  const aperture = useMockupStore((s) => s.aperture);
  const bokehScale = useMockupStore((s) => s.bokehScale);
  const bloom = useMockupStore((s) => s.bloom);
  const vignette = useMockupStore((s) => s.vignette);
  const chromaticAberration = useMockupStore((s) => s.chromaticAberration);
  const grain = useMockupStore((s) => s.grain);
  const contrast = useMockupStore((s) => s.contrast);

  // lower f-stop => shallower DOF => more bokeh
  const effectiveBokeh = bokehScale * (2.8 / Math.max(aperture, 0.7));

  const caOffset = useMemo(
    () => new THREE.Vector2(chromaticAberration, chromaticAberration),
    [chromaticAberration],
  );

  const noiseRef = useRef<{ blendMode: { opacity: { value: number } } }>(null);
  useEffect(() => {
    if (noiseRef.current) noiseRef.current.blendMode.opacity.value = grain;
    invalidate();
  }, [grain, invalidate]);

  return (
    <EffectComposer>
      <DepthOfField
        focusDistance={focusDistance}
        focalLength={0.025}
        bokehScale={effectiveBokeh}
      />
      <Bloom
        intensity={bloom}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.25}
        mipmapBlur
      />
      <BrightnessContrast brightness={0} contrast={contrast - 1} />
      <ChromaticAberration
        offset={caOffset}
        radialModulation={false}
        modulationOffset={0}
      />
      <Vignette darkness={vignette} offset={0.3} eskil={false} />
      <Noise ref={noiseRef as never} premultiply blendFunction={BlendFunction.SOFT_LIGHT} />
    </EffectComposer>
  );
}
