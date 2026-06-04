import { Environment, Lightformer } from '@react-three/drei';
import { useMockupStore } from '../store/useMockupStore';
import * as THREE from 'three';

/**
 * Procedural studio environment built from Lightformers — no network HDRI
 * fetch, so reflections work fully offline (custom .hdr upload is the Phase 5
 * Pro feature). The Environment drives reflections in the body + glass (the
 * single biggest realism lever, spec §4.4); the discrete key/fill/rim lights
 * drive direct shading and the contact shadow.
 */

type Mood = {
  envIntensity: number;
  // tint applied to the soft lightformers that show up as reflections
  former: string;
  formerBack: string;
};

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

export function Lighting() {
  const hdriPreset = useMockupStore((s) => s.hdriPreset);
  const hdriRotation = useMockupStore((s) => s.hdriRotation);
  const bgMode = useMockupStore((s) => s.bgMode);

  const keyColor = useMockupStore((s) => s.keyColor);
  const keyIntensity = useMockupStore((s) => s.keyIntensity);
  const fillColor = useMockupStore((s) => s.fillColor);
  const fillIntensity = useMockupStore((s) => s.fillIntensity);
  const rimColor = useMockupStore((s) => s.rimColor);
  const rimIntensity = useMockupStore((s) => s.rimIntensity);

  const mood = MOODS[hdriPreset] ?? MOODS.studio;
  const rot: [number, number, number] = [0, THREE.MathUtils.degToRad(hdriRotation), 0];

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
        {/* large soft top key — the broad reflection in the glass */}
        <Lightformer
          form="rect"
          intensity={1.1}
          color={mood.former}
          position={[0, 5, 1]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[10, 10, 1]}
        />
        {/* side wrap */}
        <Lightformer
          form="rect"
          intensity={0.7}
          color={mood.former}
          position={[-5, 1, 2]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[6, 6, 1]}
        />
        {/* back strip — the premium edge glint */}
        <Lightformer
          form="rect"
          intensity={1.3}
          color={mood.formerBack}
          position={[3, 2, -5]}
          rotation={[0, -Math.PI / 3, 0]}
          scale={[5, 5, 1]}
        />
        {/* ground bounce */}
        <Lightformer
          form="rect"
          intensity={0.3}
          color={mood.formerBack}
          position={[0, -4, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[10, 10, 1]}
        />
      </Environment>

      {/* Direct lights — shading + shadow. Key from front-top, soft fill, rim behind. */}
      <directionalLight
        color={keyColor}
        intensity={keyIntensity}
        position={[4, 7, 5]}
        castShadow
      />
      <directionalLight color={fillColor} intensity={fillIntensity} position={[-6, 3, 4]} />
      <directionalLight color={rimColor} intensity={rimIntensity} position={[-3, 5, -6]} />
      <ambientLight intensity={0.12} />
    </>
  );
}
