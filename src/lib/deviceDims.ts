/** Shared device sizing so the camera can auto-frame what DeviceMesh draws. */
export const MAX_DIM = 3; // longest screen dimension in world units

/** Slab footprint (width x depth) for a given screenshot aspect (w/h). */
export function deviceFootprint(screenAspect: number): { w: number; d: number } {
  return screenAspect >= 1
    ? { w: MAX_DIM, d: MAX_DIM / screenAspect }
    : { w: MAX_DIM * screenAspect, d: MAX_DIM };
}

/** Bounding-sphere radius of the slab — used to fit the camera distance. */
export function deviceRadius(screenAspect: number, thickness: number): number {
  const { w, d } = deviceFootprint(screenAspect);
  return 0.5 * Math.sqrt(w * w + d * d + thickness * thickness);
}
