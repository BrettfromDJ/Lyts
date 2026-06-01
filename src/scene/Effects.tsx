import { useEffect, useMemo } from 'react';
import {
  EffectComposer,
  DepthOfField,
  Bloom,
  Vignette,
  ChromaticAberration,
  Noise,
  BrightnessContrast,
  SMAA,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';
import { MAX_DIM } from '../lib/deviceDims';

/**
 * The DSLR layer (spec §5 Phase 2 + §6.8).
 *
 * Order matters: AA + DOF + Bloom first, colour/contrast next, grain LAST so it
 * sits in screen space on top of everything (static grain on a moving shot
 * looks like dirt on the lens — Phase 4 will re-seed it per frame).
 *
 * Tone mapping is done by the renderer (ACES, set on the <Canvas>, spec §4.1),
 * which RenderPass applies while drawing the scene — so we don't double it here.
 *
 * NOTE: these effect components are plain-function wrappers, so under React 19
 * NEVER pass them a `ref` — it would be treated as a prop and the wrapper
 * JSON.stringify's its props (crashes on three.js' circular graph). Use the
 * supported scalar props instead (e.g. Noise `opacity`).
 *
 * MSAA is disabled in favour of an SMAA pass: multisampled depth resolves
 * trip a "depth/stencil format not allowed for blit" path on macOS/ANGLE.
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

  // Focus ON the device (at the origin), regardless of camera distance, and
  // let the "Focus plane" slider sweep the focal point across the iso tilt
  // (front edge -> back edge) for the cinematic falloff. Aperture maps to how
  // wide the sharp zone is (low f = shallow = more bokeh).
  const focusTarget = useMemo<[number, number, number]>(
    () => [0, 0, (focusDistance - 0.5) * MAX_DIM],
    [focusDistance],
  );
  const focusRange = THREE.MathUtils.clamp(aperture * 0.045, 0.04, 0.5);

  // frameloop="demand": make sure post-only param changes request a frame.
  useEffect(() => {
    invalidate();
  }, [
    invalidate,
    focusDistance,
    aperture,
    effectiveBokeh,
    bloom,
    vignette,
    chromaticAberration,
    grain,
    contrast,
  ]);

  return (
    <EffectComposer multisampling={0}>
      <SMAA />
      <DepthOfField target={focusTarget} focusRange={focusRange} bokehScale={effectiveBokeh} />
      <Bloom
        intensity={bloom}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.2}
        mipmapBlur
      />
      <BrightnessContrast brightness={0} contrast={contrast - 1} />
      <ChromaticAberration offset={caOffset} radialModulation={false} modulationOffset={0} />
      <Vignette darkness={vignette} offset={0.3} eskil={false} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={grain} />
    </EffectComposer>
  );
}
