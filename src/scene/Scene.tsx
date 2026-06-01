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

/**
 * Drag the canvas to orbit (azimuth/polar), scroll to zoom (magnification). Writes
 * straight to the store so the Camera sliders stay in sync — no OrbitControls,
 * the angle is still a real parameter, just also pointer-driven.
 */
function PointerCamera() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const s = useMockupStore.getState();
      let az = s.azimuth + dx * 0.3;
      az = ((((az + 180) % 360) + 360) % 360) - 180; // wrap to [-180, 180]
      s.set({
        azimuth: az,
        polar: THREE.MathUtils.clamp(s.polar - dy * 0.3, 8, 88),
      });
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      el.style.cursor = 'grab';
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useMockupStore.getState();
      // scroll up (deltaY < 0) => zoom in (increase magnification)
      const next = THREE.MathUtils.clamp(s.zoom * (1 - e.deltaY * 0.0012), 0.2, 12);
      s.set({ zoom: next });
    };

    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointerleave', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointerleave', onUp);
      el.removeEventListener('wheel', onWheel);
      el.style.cursor = '';
    };
  }, [gl]);
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
      <PointerCamera />
      <ExposureSync />
      <Background />
      <CameraRig />
      <Lighting />
      <DeviceMesh />
      <Effects />
    </Canvas>
  );
}
