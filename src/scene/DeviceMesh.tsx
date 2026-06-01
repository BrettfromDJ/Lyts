import { useMemo, useRef, useEffect } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';
import {
  laptopMetrics,
  BASE_T,
  SCREEN_T,
} from '../lib/deviceDims';

/**
 * An open laptop with the screenshot on the DISPLAY (not the lid):
 *   - Base (keyboard deck) lying flat, with subtle trackpad + keyboard hints.
 *   - Screen lid hinged at the back, leaning back past vertical.
 *   - Screenshot inset within a dark bezel on the lid's front face, with a
 *     near-clear glass layer over it for reflections.
 *
 * The whole laptop is centred at the origin so the camera auto-fit / DOF
 * (which target the origin) frame it correctly.
 */
export function DeviceMesh() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  const screenshot = useMockupStore((s) => s.screenshot);
  const screenAspect = useMockupStore((s) => s.screenAspect);
  const screenBrightness = useMockupStore((s) => s.screenBrightness);
  const glassRoughness = useMockupStore((s) => s.glassRoughness);
  const reflectionIntensity = useMockupStore((s) => s.reflectionIntensity);
  const cornerRadius = useMockupStore((s) => s.cornerRadius);

  const m = useMemo(() => laptopMetrics(screenAspect), [screenAspect]);

  const screenRef = useRef<THREE.MeshStandardMaterial>(null);

  // Recompile the screen material when the screenshot arrives (it first builds
  // with no map/emissiveMap define) and refresh the texture on the GPU.
  useEffect(() => {
    if (screenshot) {
      screenshot.anisotropy = gl.capabilities.getMaxAnisotropy();
      screenshot.needsUpdate = true;
    }
    if (screenRef.current) screenRef.current.needsUpdate = true;
    invalidate();
  }, [screenshot, gl, invalidate]);

  const lidRadius = Math.min(cornerRadius, m.lidH / 2 - 0.001, 0.12);
  const baseRadius = Math.min(cornerRadius, BASE_T / 2 - 0.001, 0.05);

  return (
    <group position={[0, -m.centerY, -m.centerZ]}>
      {/* --- Base / keyboard deck --- */}
      <RoundedBox
        args={[m.baseW, BASE_T, m.baseD]}
        radius={baseRadius}
        smoothness={5}
        position={[0, BASE_T / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#aeb4bd"
          metalness={0.6}
          roughness={0.55}
          clearcoat={0.3}
          clearcoatRoughness={0.5}
          envMapIntensity={reflectionIntensity * 0.8}
        />
      </RoundedBox>

      {/* keyboard area hint (recessed dark deck) */}
      <mesh position={[0, BASE_T + 0.001, -m.baseD * 0.16]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[m.baseW * 0.86, m.baseD * 0.5]} />
        <meshStandardMaterial color="#14161b" roughness={0.8} metalness={0.2} />
      </mesh>
      {/* trackpad hint */}
      <mesh position={[0, BASE_T + 0.002, m.baseD * 0.26]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[m.baseW * 0.34, m.baseD * 0.32]} />
        <meshStandardMaterial color="#9aa0a9" roughness={0.65} metalness={0.3} />
      </mesh>

      {/* --- Screen, hinged at the back of the base, leaning back --- */}
      <group position={[0, BASE_T, -m.baseD / 2]} rotation={[-m.open, 0, 0]}>
        {/* lid + bezel */}
        <RoundedBox
          args={[m.lidW, m.lidH, SCREEN_T]}
          radius={lidRadius}
          smoothness={5}
          position={[0, m.lidH / 2, -SCREEN_T / 2]}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            color="#0b0c10"
            metalness={0.5}
            roughness={0.45}
            clearcoat={0.8}
            clearcoatRoughness={0.35}
            envMapIntensity={reflectionIntensity * 0.8}
          />
        </RoundedBox>

        {/* the screenshot on the display */}
        <mesh position={[0, m.lidH / 2, 0.002]}>
          <planeGeometry args={[m.screenW, m.screenH]} />
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

        {/* near-clear glass for reflections */}
        <mesh position={[0, m.lidH / 2, 0.006]}>
          <planeGeometry args={[m.screenW, m.screenH]} />
          <meshPhysicalMaterial
            color="#ffffff"
            metalness={0}
            roughness={glassRoughness}
            transparent
            opacity={0.05}
            clearcoat={1}
            clearcoatRoughness={glassRoughness}
            ior={1.5}
            envMapIntensity={reflectionIntensity * 0.6}
            depthWrite={false}
            side={THREE.FrontSide}
          />
        </mesh>
      </group>
    </group>
  );
}
