import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';
import { surfaceMetrics } from '../lib/deviceDims';
import { cameraPose, applyPose } from '../lib/cameraMath';

/**
 * The "hero move" (spec §5 Phase 4): a subtle, seamless-looping camera motion
 * layered on top of the user's framing while `animate` is on. Reads base
 * params live each frame so the sliders still steer during playback. On stop
 * it restores the static base pose. Grain re-seeds itself in GrainEffect.
 */
export function Animator() {
  const animate = useMockupStore((s) => s.animate);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);

  useFrame((state) => {
    const s = useMockupStore.getState();
    if (!s.animate) return;

    const dur = Math.max(s.videoDuration, 0.5);
    const phase =
      ((state.clock.elapsedTime % dur) / dur) * Math.PI * 2 * Math.max(s.motionSpeed, 0.1);
    const a = s.motionAmount;

    let azimuth = s.azimuth;
    let polar = s.polar;
    let zoom = s.zoom;

    switch (s.motion) {
      case 'orbit':
        azimuth += a * 18 * Math.sin(phase);
        break;
      case 'push':
        zoom *= 1 + a * 0.18 * (1 - Math.cos(phase)) * 0.5;
        break;
      case 'parallax':
        azimuth += a * 6 * Math.sin(phase);
        polar += a * 3 * Math.cos(phase);
        break;
      case 'drift':
      default:
        azimuth += a * 8 * Math.sin(phase);
        polar += a * 2 * Math.cos(phase);
        zoom *= 1 + a * 0.05 * Math.sin(phase);
        break;
    }

    const radius = surfaceMetrics(s.screenAspect).radius;
    applyPose(
      camera,
      cameraPose({ azimuth, polar, zoom, focalLength: s.focalLength, roll: s.roll }, radius),
      new THREE.Vector3(s.targetX, s.targetY, s.targetZ),
    );
  });

  // Restore the static base pose when playback stops.
  useEffect(() => {
    if (animate) return;
    const s = useMockupStore.getState();
    const radius = surfaceMetrics(s.screenAspect).radius;
    applyPose(
      camera,
      cameraPose(
        { azimuth: s.azimuth, polar: s.polar, zoom: s.zoom, focalLength: s.focalLength, roll: s.roll },
        radius,
      ),
      new THREE.Vector3(s.targetX, s.targetY, s.targetZ),
    );
    invalidate();
  }, [animate, camera, invalidate]);

  return null;
}
