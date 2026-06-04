import { Suspense } from 'react';
import { Environment, Lightformer, ContactShadows, MeshReflectorMaterial } from '@react-three/drei';
import { useMockupStore } from '../store/useMockupStore';
import { surfaceMetrics } from '../lib/deviceDims';
import { EnvBoundary } from './EnvBoundary';
import * as THREE from 'three';

/**
 * Lighting / environment. Two modes:
 *  - default: a procedural studio built from Lightformers (offline, fast).
 *  - grounding: a real HDRI (drei preset) drives image-based lighting and an
 *    optional blurred backdrop, with a soft contact shadow and a reflective
 *    floor so the mockup looks photographed in a real space.
 */

type Mood = { envIntensity: number; former: string; formerBack: string };

const MOODS: Record<string, Mood> = {
  studio: { envIntensity: 1.0, former: '#ffffff', formerBack: '#cdd6e6' },
  apartment: { envIntensity: 1.15, former: '#fff4e8', formerBack: '#ffe9cf' },
  city: { envIntensity: 0.9, former: '#dfe8ff', formerBack: '#aab6cf' },
  sunset: { envIntensity: 1.0, former: '#ffd9a0', formerBack: '#ff9d63' },
  dawn: { envIntensity: 0.95, former: '#ffe1e8', formerBack: '#bcd0ff' },
  night: { envIntensity: 0.6, former: '#9fb6ff', formerBack: '#2a3450' },
  warehouse: { envIntensity: 0.85, former: '#eef1f5', formerBack: '#9aa3ad' },
  lobby: { envIntensity: 1.0, former: '#fff0dd', formerBack: '#d8c7ad' },
};

const FLOOR_Y = -0.02;

export function Lighting() {
  const hdriPreset = useMockupStore((s) => s.hdriPreset);
  const hdriRotation = useMockupStore((s) => s.hdriRotation);
  const bgMode = useMockupStore((s) => s.bgMode);

  const grounding = useMockupStore((s) => s.grounding);
  const envIntensity = useMockupStore((s) => s.envIntensity);
  const envBackground = useMockupStore((s) => s.envBackground);
  const envBlur = useMockupStore((s) => s.envBlur);
  const floorReflection = useMockupStore((s) => s.floorReflection);
  const groundShadow = useMockupStore((s) => s.groundShadow);
  const screenAspect = useMockupStore((s) => s.screenAspect);

  const rot: [number, number, number] = [0, THREE.MathUtils.degToRad(hdriRotation), 0];

  if (grounding) {
    const { radius } = surfaceMetrics(screenAspect);
    const span = Math.max(radius * 4, 6);
    return (
      <>
        <EnvBoundary>
          <Suspense fallback={null}>
            <Environment
              preset={hdriPreset as never}
              environmentIntensity={envIntensity}
              environmentRotation={rot}
              background={envBackground}
              backgroundBlurriness={envBlur}
              backgroundIntensity={0.9}
            />
          </Suspense>
        </EnvBoundary>
        <ambientLight intensity={0.15} />

        {/* soft contact shadow on the floor */}
        <ContactShadows
          position={[0, FLOOR_Y + 0.003, 0]}
          scale={span}
          opacity={groundShadow}
          blur={2.6}
          far={4}
          resolution={512}
          color="#000000"
        />

        {/* reflective floor — catches the glowing screen + the HDRI */}
        {floorReflection > 0.01 && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]}>
            <planeGeometry args={[span * 6, span * 6]} />
            <MeshReflectorMaterial
              resolution={1024}
              blur={[400, 160]}
              mixBlur={1}
              mixStrength={floorReflection * 4}
              mirror={floorReflection}
              roughness={1 - floorReflection * 0.45}
              depthScale={1}
              minDepthThreshold={0.4}
              maxDepthThreshold={1.2}
              color="#0a0a0c"
              metalness={0.45}
            />
          </mesh>
        )}
      </>
    );
  }

  const mood = MOODS[hdriPreset] ?? MOODS.studio;
  return (
    <>
      <Environment
        frames={1}
        resolution={256}
        environmentIntensity={mood.envIntensity}
        environmentRotation={rot}
        background={bgMode === 'env-blur'}
        backgroundBlurriness={0.7}
        backgroundIntensity={0.6}
      >
        <Lightformer
          form="rect"
          intensity={1.1}
          color={mood.former}
          position={[0, 5, 1]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[10, 10, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.7}
          color={mood.former}
          position={[-5, 1, 2]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[6, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.3}
          color={mood.formerBack}
          position={[3, 2, -5]}
          rotation={[0, -Math.PI / 3, 0]}
          scale={[5, 5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.3}
          color={mood.formerBack}
          position={[0, -4, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[10, 10, 1]}
        />
      </Environment>
      <ambientLight intensity={0.12} />
    </>
  );
}
