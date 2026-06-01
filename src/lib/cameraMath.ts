import * as THREE from 'three';

const SENSOR_HEIGHT = 24; // full-frame, mm

/** focalLength (mm) -> vertical FOV (deg). */
export function focalToFov(focalLength: number): number {
  return (2 * Math.atan(SENSOR_HEIGHT / (2 * focalLength)) * 180) / Math.PI;
}

export type PoseParams = {
  azimuth: number;
  polar: number;
  zoom: number;
  focalLength: number;
  roll: number;
};

export type CameraPose = {
  position: THREE.Vector3;
  fov: number;
  roll: number; // radians
};

/**
 * The camera pose for a set of params, given the surface's bounding radius.
 * Shared by CameraRig (static) and Animator (per-frame) so they never drift.
 * Auto-fit: dolly to fit the vertical FOV, then divide by `zoom` magnification.
 */
export function cameraPose(p: PoseParams, radius: number): CameraPose {
  const fov = focalToFov(p.focalLength);
  const fit = radius / Math.sin(THREE.MathUtils.degToRad(fov) / 2);
  const dist = fit / Math.max(p.zoom, 0.01);
  const phi = THREE.MathUtils.degToRad(p.polar);
  const theta = THREE.MathUtils.degToRad(p.azimuth);
  return {
    position: new THREE.Vector3(
      dist * Math.sin(phi) * Math.sin(theta),
      dist * Math.cos(phi),
      dist * Math.sin(phi) * Math.cos(theta),
    ),
    fov,
    roll: THREE.MathUtils.degToRad(p.roll),
  };
}

/**
 * Apply a pose to a perspective camera: orbit offset is positioned relative to
 * `target` (the pan look-at point), then look at the target and roll.
 */
export function applyPose(
  cam: THREE.PerspectiveCamera,
  pose: CameraPose,
  target: THREE.Vector3,
) {
  cam.position.copy(target).add(pose.position);
  cam.fov = pose.fov;
  cam.up.set(0, 1, 0);
  cam.lookAt(target);
  cam.rotateZ(pose.roll);
  cam.updateProjectionMatrix();
}
