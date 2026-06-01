import { useLayoutEffect, useRef } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';
import { surfaceMetrics } from '../lib/deviceDims';

const SENSOR_HEIGHT = 24; // full-frame, mm

/** focalLength (mm) -> vertical FOV (deg). */
function focalToFov(focalLength: number): number {
  return (2 * Math.atan(SENSOR_HEIGHT / (2 * focalLength)) * 180) / Math.PI;
}

/**
 * PerspectiveCamera raking across the flat screenshot surface (spec §0). A low
 * grazing tilt + real perspective gives the receding rows; `roll` adds the
 * subtle editorial rotation. Driven entirely by the store — the angle is a
 * deliberate parameter, not free-flight, so no OrbitControls in the shipping UI.
 */
export function CameraRig() {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  const invalidate = useThree((s) => s.invalidate);

  const azimuth = useMockupStore((s) => s.azimuth);
  const polar = useMockupStore((s) => s.polar);
  const distance = useMockupStore((s) => s.distance); // zoom multiplier on the auto-fit
  const focalLength = useMockupStore((s) => s.focalLength);
  const roll = useMockupStore((s) => s.roll);
  const screenAspect = useMockupStore((s) => s.screenAspect);
  const fov = focalToFov(focalLength);

  // Auto-frame: dolly so the surface fits the vertical FOV, then apply the
  // user's `distance` as a zoom multiplier (<1 crops in for the close, raked
  // look). Keeps framing sane across any focal length / screenshot aspect.
  const radius = surfaceMetrics(screenAspect).radius;
  const fitDistance = radius / Math.sin(THREE.MathUtils.degToRad(fov) / 2);
  const dist = fitDistance * distance;

  const phi = THREE.MathUtils.degToRad(polar);
  const theta = THREE.MathUtils.degToRad(azimuth);
  const x = dist * Math.sin(phi) * Math.sin(theta);
  const y = dist * Math.cos(phi);
  const z = dist * Math.sin(phi) * Math.cos(theta);
  const rollRad = THREE.MathUtils.degToRad(roll);

  useLayoutEffect(() => {
    const cam = camRef.current;
    if (!cam) return;
    cam.position.set(x, y, z);
    cam.fov = fov;
    cam.lookAt(0, 0, 0);
    cam.rotateZ(rollRad); // editorial roll around the view axis
    cam.updateProjectionMatrix();
    invalidate();
  }, [x, y, z, fov, rollRad, invalidate]);

  return <PerspectiveCamera ref={camRef} makeDefault near={0.1} far={100} />;
}
