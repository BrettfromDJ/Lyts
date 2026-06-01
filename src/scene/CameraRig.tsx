import { useLayoutEffect, useRef } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';

const SENSOR_HEIGHT = 24; // full-frame, mm

/** focalLength (mm) -> vertical FOV (deg). Long lens => narrow FOV => the iso read. */
function focalToFov(focalLength: number): number {
  return (2 * Math.atan(SENSOR_HEIGHT / (2 * focalLength)) * 180) / Math.PI;
}

/**
 * PerspectiveCamera at a long focal length, positioned on a diagonal (spec §0).
 * Minimal convergence reads "isometric"; real perspective lets DOF/bokeh behave.
 * Driven entirely by the store — the angle is a deliberate parameter, not
 * free-flight, so no OrbitControls in the shipping UI.
 */
export function CameraRig() {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  const invalidate = useThree((s) => s.invalidate);

  const azimuth = useMockupStore((s) => s.azimuth);
  const polar = useMockupStore((s) => s.polar);
  const distance = useMockupStore((s) => s.distance);
  const focalLength = useMockupStore((s) => s.focalLength);

  const phi = THREE.MathUtils.degToRad(polar);
  const theta = THREE.MathUtils.degToRad(azimuth);
  const x = distance * Math.sin(phi) * Math.sin(theta);
  const y = distance * Math.cos(phi);
  const z = distance * Math.sin(phi) * Math.cos(theta);
  const fov = focalToFov(focalLength);

  useLayoutEffect(() => {
    const cam = camRef.current;
    if (!cam) return;
    cam.position.set(x, y, z);
    cam.fov = fov;
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    invalidate();
  }, [x, y, z, fov, invalidate]);

  return <PerspectiveCamera ref={camRef} makeDefault near={0.1} far={100} />;
}
