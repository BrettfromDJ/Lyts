/** Shared surface sizing so the camera can auto-frame the screenshot plane. */
export const MAX_DIM = 3; // longest side of the screenshot surface, world units

export type SurfaceMetrics = {
  w: number;
  h: number;
  radius: number; // bounding-sphere radius for camera fit
};

/** Flat screenshot surface for a given aspect (w/h). Longest side = MAX_DIM. */
export function surfaceMetrics(aspect: number): SurfaceMetrics {
  const a = Math.max(aspect, 0.2);
  const w = a >= 1 ? MAX_DIM : MAX_DIM * a;
  const h = a >= 1 ? MAX_DIM / a : MAX_DIM;
  const radius = 0.5 * Math.sqrt(w * w + h * h);
  return { w, h, radius };
}
