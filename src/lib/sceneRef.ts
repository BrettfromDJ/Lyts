import type * as THREE from 'three';

/**
 * Bridge between the DOM-side ExportBar and the live WebGL context inside
 * <Canvas>. A component mounted inside the canvas (SceneCapture) populates
 * this; exportImage / ExportBar read it. Module singleton keeps the export
 * path out of React render churn.
 */
export const sceneRef: {
  gl: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.Camera | null;
} = {
  gl: null,
  scene: null,
  camera: null,
};
