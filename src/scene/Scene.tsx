import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';
import { makeGradientTexture } from '../lib/textures';
import { sceneRef } from '../lib/sceneRef';
import { CameraRig } from './CameraRig';
import { Animator } from './Animator';
import { Lighting } from './Lighting';
import { DeviceMesh } from './DeviceMesh';
import { Effects } from './Effects';

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

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Pointer shortcuts on the canvas (no OrbitControls — values still live in the
 * store so presets/export capture them):
 *   drag           -> orbit (azimuth / polar)
 *   Shift + drag    -> pan (move the look-at target)
 *   Alt/⌥ + drag    -> perspective (tilt the screen plane)
 *   scroll          -> zoom
 */
function PointerCamera() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const cursorFor = (e: { shiftKey: boolean; altKey: boolean }) =>
      e.shiftKey ? 'move' : e.altKey ? 'cell' : 'grabbing';

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = cursorFor(e);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const s = useMockupStore.getState();

      if (e.altKey) {
        // Perspective: tilt the screen plane (one edge away from the camera).
        s.set({
          tiltZ: clamp(s.tiltZ + dx * 0.12, -45, 45),
          tiltX: clamp(s.tiltX + dy * 0.12, -45, 45),
        });
        el.style.cursor = 'cell';
        return;
      }

      if (e.shiftKey) {
        // Pan: shift the look-at target in the camera's screen plane, scaled by
        // distance so it tracks the cursor at any zoom (content follows cursor).
        const target = new THREE.Vector3(s.targetX, s.targetY, s.targetZ);
        const distToTarget = camera.position.distanceTo(target);
        const cam = camera as THREE.PerspectiveCamera;
        const worldPerPx =
          (2 * distToTarget * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) /
          el.clientHeight;
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        target
          .addScaledVector(right, -dx * worldPerPx)
          .addScaledVector(up, dy * worldPerPx);
        s.set({ targetX: target.x, targetY: target.y, targetZ: target.z });
        el.style.cursor = 'move';
        return;
      }

      let az = s.azimuth + dx * 0.3;
      az = ((((az + 180) % 360) + 360) % 360) - 180; // wrap to [-180, 180]
      s.set({
        azimuth: az,
        polar: THREE.MathUtils.clamp(s.polar - dy * 0.3, 8, 88),
      });
      el.style.cursor = 'grabbing';
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
  }, [gl, camera]);
  return null;
}

export function Scene() {
  // "always" while animating/recording or running the CRT, "demand" otherwise.
  const animate = useMockupStore((s) => s.animate);
  const crtEnabled = useMockupStore((s) => s.crtEnabled);
  const recording = useMockupStore((s) => s.recording);
  return (
    <Canvas
      gl={{
        antialias: true,
        preserveDrawingBuffer: true, // needed for still export (§6.2)
        alpha: true, // transparent bgMode + alpha PNG export
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: useMockupStore.getState().exposure,
      }}
      frameloop={animate || crtEnabled || recording ? 'always' : 'demand'}
      dpr={[1, 2]}
      shadows
      camera={{ fov: 28, position: [4, 4, 6] }}
    >
      <SceneCapture />
      <PointerCamera />
      <Background />
      <CameraRig />
      <Animator />
      <Lighting />
      <DeviceMesh />
      <Effects />
    </Canvas>
  );
}
