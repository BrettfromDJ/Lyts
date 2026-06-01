import { useMemo, useRef, useEffect } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';
import { makePixelGridTexture } from '../lib/textures';
import { deviceFootprint } from '../lib/deviceDims';

/**
 * Three stacked elements — this layering is the "real screen" trick (spec §4.3):
 *   1. Body   — beveled RoundedBox, dark, low roughness, high envMapIntensity.
 *   2. Screen — the screenshot as map + modest emissiveMap (let Bloom glow it).
 *   3. Glass  — a near-clear layer fractionally above; catches HDRI reflections
 *               so it reads "screen behind glass", not "sticker on a plane".
 */
export function DeviceMesh() {
  const gl = useThree((s) => s.gl);

  const screenshot = useMockupStore((s) => s.screenshot);
  const screenAspect = useMockupStore((s) => s.screenAspect);
  const cornerRadius = useMockupStore((s) => s.cornerRadius);
  const bevel = useMockupStore((s) => s.bevel);
  const thickness = useMockupStore((s) => s.thickness);
  const screenBrightness = useMockupStore((s) => s.screenBrightness);
  const glassRoughness = useMockupStore((s) => s.glassRoughness);
  const reflectionIntensity = useMockupStore((s) => s.reflectionIntensity);
  const pixelTexture = useMockupStore((s) => s.pixelTexture);

  // Size the slab to the screenshot aspect (shared with the camera auto-fit).
  const { w, d } = useMemo(() => deviceFootprint(screenAspect), [screenAspect]);

  // Raise texture anisotropy to the GPU max now that the renderer exists.
  useEffect(() => {
    if (screenshot) {
      screenshot.anisotropy = gl.capabilities.getMaxAnisotropy();
      screenshot.needsUpdate = true;
    }
  }, [screenshot, gl]);

  const pixelGrid = useMemo(() => makePixelGridTexture(), []);
  useEffect(() => {
    const reps = Math.round((screenAspect >= 1 ? w : d) * 64);
    pixelGrid.repeat.set(reps, reps);
  }, [pixelGrid, w, d, screenAspect]);

  const bezel = 0.06;
  const radius = Math.min(cornerRadius + bevel, Math.min(w, d) / 2 - 0.001);

  const screenRef = useRef<THREE.MeshStandardMaterial>(null);

  return (
    <group>
      {/* 1. Body */}
      <RoundedBox
        args={[w, thickness, d]}
        radius={Math.min(radius, thickness / 2)}
        smoothness={8}
        creaseAngle={0.5}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#0b0c10"
          metalness={0.55}
          roughness={0.35}
          clearcoat={1}
          clearcoatRoughness={THREE.MathUtils.clamp(0.25 - bevel * 4, 0.02, 0.4)}
          envMapIntensity={reflectionIntensity}
        />
      </RoundedBox>

      {/* 2. Screen — sits just above the body face, inset by the bezel */}
      <mesh
        position={[0, thickness / 2 + 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[w - bezel, d - bezel]} />
        <meshStandardMaterial
          ref={screenRef}
          map={screenshot ?? null}
          emissiveMap={screenshot ?? null}
          emissive={screenshot ? '#ffffff' : '#0a0c12'}
          emissiveIntensity={screenshot ? screenBrightness : 0}
          color={screenshot ? '#000000' : '#11141c'}
          roughness={1}
          metalness={0}
          toneMapped
        />
      </mesh>

      {/* optional faint pixel grid */}
      {pixelTexture > 0 && (
        <mesh position={[0, thickness / 2 + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w - bezel, d - bezel]} />
          <meshBasicMaterial
            map={pixelGrid}
            transparent
            opacity={pixelTexture * 0.5}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* 3. Glass — near-clear, strong reflections (the secret) */}
      <mesh position={[0, thickness / 2 + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - bezel * 0.5, d - bezel * 0.5]} />
        <meshPhysicalMaterial
          color="#ffffff"
          metalness={0}
          roughness={glassRoughness}
          transparent
          opacity={0.08}
          transmission={0}
          clearcoat={1}
          clearcoatRoughness={glassRoughness}
          ior={1.5}
          envMapIntensity={reflectionIntensity * 1.6}
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  );
}
