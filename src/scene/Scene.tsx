import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';
import { makeGradientTexture } from '../lib/textures';
import { sceneRef } from '../lib/sceneRef';
import { CameraRig } from './CameraRig';
import { Lighting } from './Lighting';
import { DeviceMesh } from './DeviceMesh';
import { Effects } from './Effects';

/** Keeps renderer exposure in sync with the store (ACES exposure, spec §4.1). */
function ExposureSync() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const exposure = useMockupStore((s) => s.exposure);
  useEffect(() => {
    gl.toneMappingExposure = exposure;
    invalidate();
  }, [gl, exposure, invalidate]);
  return null;
}

/** Drives scene.background per bgMode. env-blur is handled inside <Lighting>. */
function Background() {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const bgMode = useMockupStore((s) => s.bgMode);
  const bgColorA = useMockupStore((s) => s.bgColorA);
  const bgColorB = useMockupStore((s) => s.bgColorB);

  useEffect(() => {
    let toDispose: THREE.Texture | null = null;
    if (bgMode === 'solid') {
      scene.background = new THREE.Color(bgColorA);
    } else if (bgMode === 'gradient') {
      const tex = makeGradientTexture(bgColorA, bgColorB);
      scene.background = tex;
      toDispose = tex;
    } else {
      // transparent + env-blur => no flat background here
      scene.background = null;
    }
    invalidate();
    return () => {
      toDispose?.dispose();
    };
  }, [scene, bgMode, bgColorA, bgColorB, invalidate]);

  return null;
}

/** Publishes the live gl/scene/camera to the module ref for export. */
function SceneCapture() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    sceneRef.gl = gl;
    sceneRef.scene = scene;
    sceneRef.camera = camera;
  }, [gl, scene, camera]);
  return null;
}

export function Scene() {
  return (
    <Canvas
      gl={{
        antialias: true,
        preserveDrawingBuffer: true, // needed for still export (§6.2)
        alpha: true, // transparent bgMode + alpha PNG export
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: useMockupStore.getState().exposure,
      }}
      frameloop="demand" // still tool — render on change (§6.7)
      dpr={[1, 2]}
      shadows
      camera={{ fov: 28, position: [4, 4, 6] }}
    >
      <SceneCapture />
      <ExposureSync />
      <Background />
      <CameraRig />
      <Lighting />
      <DeviceMesh />
      <Effects />
    </Canvas>
  );
}
