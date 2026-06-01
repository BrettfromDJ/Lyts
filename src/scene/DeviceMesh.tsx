import { useMemo, useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';
import { surfaceMetrics } from '../lib/deviceDims';

/**
 * The screenshot rendered as a flat surface (no device body) — laid in the XZ
 * plane and centred at the origin, so a grazing camera rakes across it with
 * strong perspective and the post-stack DOF leaves a cinematic band of focus.
 *
 * The screenshot is self-lit (emissive) so it reads regardless of the
 * environment, exactly like a screen. An optional faint glass sheen adds the
 * "photographed" reflection without washing the content.
 */
export function DeviceMesh() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  const screenshot = useMockupStore((s) => s.screenshot);
  const screenAspect = useMockupStore((s) => s.screenAspect);
  const screenBrightness = useMockupStore((s) => s.screenBrightness);
  const reflectionIntensity = useMockupStore((s) => s.reflectionIntensity);
  const glassRoughness = useMockupStore((s) => s.glassRoughness);
  const tiltX = useMockupStore((s) => s.tiltX);
  const tiltZ = useMockupStore((s) => s.tiltZ);

  const { w, h } = useMemo(() => surfaceMetrics(screenAspect), [screenAspect]);

  const screenRef = useRef<THREE.MeshStandardMaterial>(null);

  // Recompile the material when the screenshot arrives (it first builds with no
  // map/emissiveMap define) and refresh the texture on the GPU.
  useEffect(() => {
    if (screenshot) {
      screenshot.anisotropy = gl.capabilities.getMaxAnisotropy();
      screenshot.needsUpdate = true;
    }
    if (screenRef.current) screenRef.current.needsUpdate = true;
    invalidate();
  }, [screenshot, gl, invalidate]);

  return (
    <group
      rotation={[THREE.MathUtils.degToRad(tiltX), 0, THREE.MathUtils.degToRad(tiltZ)]}
    >
      {/* the screenshot surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
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

      {/* faint glass sheen just above the surface */}
      {reflectionIntensity > 0.01 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <planeGeometry args={[w, h]} />
          <meshPhysicalMaterial
            color="#ffffff"
            metalness={0}
            roughness={glassRoughness}
            transparent
            opacity={0.03}
            clearcoat={0.35}
            clearcoatRoughness={Math.max(glassRoughness, 0.25)}
            ior={1.4}
            envMapIntensity={reflectionIntensity * 0.45}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
