/** Shared laptop sizing so the camera can auto-frame what DeviceMesh draws. */
export const MAX_DIM = 3; // screen (display) width in world units

export const BEZEL = 0.07; // dark border around the screenshot
export const SCREEN_T = 0.05; // lid thickness
export const BASE_T = 0.11; // base (keyboard deck) thickness
export const LEAN_DEG = 100; // screen open angle measured from the base plane

export type LaptopMetrics = {
  screenW: number;
  screenH: number;
  lidW: number;
  lidH: number;
  baseW: number;
  baseD: number;
  open: number; // screen tilt from vertical, radians
  centerY: number;
  centerZ: number;
  baseBottomY: number; // where the laptop sits (for the contact shadow)
  radius: number; // bounding-sphere radius for camera fit
};

/** Full laptop geometry for a given screenshot aspect (w/h). */
export function laptopMetrics(aspect: number): LaptopMetrics {
  const a = Math.max(aspect, 0.2);
  const screenW = MAX_DIM;
  const screenH = MAX_DIM / a;
  const lidW = screenW + 2 * BEZEL;
  const lidH = screenH + 2 * BEZEL;
  const baseW = lidW;
  const baseD = lidH * 0.92;

  const open = ((LEAN_DEG - 90) * Math.PI) / 180; // tilt past vertical
  const screenVert = lidH * Math.cos(open);
  const topY = BASE_T + screenVert;
  const centerY = topY / 2;

  const frontZ = baseD / 2;
  const backZ = -baseD / 2 - lidH * Math.sin(open);
  const centerZ = (frontZ + backZ) / 2;

  const width = baseW;
  const height = topY;
  const depth = frontZ - backZ;
  const radius = 0.5 * Math.sqrt(width * width + height * height + depth * depth);

  return {
    screenW,
    screenH,
    lidW,
    lidH,
    baseW,
    baseD,
    open,
    centerY,
    centerZ,
    baseBottomY: -centerY,
    radius,
  };
}
