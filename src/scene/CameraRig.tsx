import { useLayoutEffect, useRef } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';
import { surfaceMetrics } from '../lib/deviceDims';
import { cameraPose, applyPose } from '../lib/cameraMath';

/**
 * PerspectiveCamera raking across the flat screenshot surface (spec §0). A low
 * grazing tilt + real perspective gives the receding rows; `roll` adds the
 * subtle editorial rotation. Driven by the store; while an animation plays the
 * Animator takes over this same camera per-frame.
 */
export function CameraRig() {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  const invalidate = useThree((s) => s.invalidate);

  const azimuth = useMockupStore((s) => s.azimuth);
  const polar = useMockupStore((s) => s.polar);
  const zoom = useMockupStore((s) => s.zoom);
  const focalLength = useMockupStore((s) => s.focalLength);
  const roll = useMockupStore((s) => s.roll);
  const targetX = useMockupStore((s) => s.targetX);
  const targetY = useMockupStore((s) => s.targetY);
  const targetZ = useMockupStore((s) => s.targetZ);
  const screenAspect = useMockupStore((s) => s.screenAspect);

  const radius = surfaceMetrics(screenAspect).radius;
  const pose = cameraPose({ azimuth, polar, zoom, focalLength, roll }, radius);

  useLayoutEffect(() => {
    const cam = camRef.current;
    if (!cam) return;
    if (useMockupStore.getState().animate) return; // Animator owns the camera while playing
    applyPose(cam, pose, new THREE.Vector3(targetX, targetY, targetZ));
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pose.position.x,
    pose.position.y,
    pose.position.z,
    pose.fov,
    pose.roll,
    targetX,
    targetY,
    targetZ,
    invalidate,
  ]);

  return <PerspectiveCamera ref={camRef} makeDefault near={0.05} far={2000} />;
}
