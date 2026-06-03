import { useMockupStore } from '../store/useMockupStore';

/**
 * Preset camera angles, shown as little projected-plane thumbnails. Selecting
 * one sets the orbit / rake / roll / surface-tilt; zoom and lens are left alone.
 */
type Angle = { az: number; polar: number; roll: number; tiltX?: number; tiltZ?: number };

const PRESETS: Angle[] = [
  { az: 0, polar: 20, roll: 0 },
  { az: 0, polar: 20, roll: -12 },
  { az: 25, polar: 58, roll: -10 },
  { az: -25, polar: 58, roll: 10 },
  { az: 0, polar: 62, roll: -22 },
  { az: 0, polar: 62, roll: 22 },

  { az: 35, polar: 60, roll: 0 },
  { az: -35, polar: 60, roll: 0 },
  { az: 0, polar: 78, roll: 0 },
  { az: 0, polar: 78, roll: 18 },
  { az: 0, polar: 84, roll: 0 },
  { az: 20, polar: 80, roll: 15 },

  { az: 0, polar: 8, roll: 0 },
  { az: 0, polar: 8, roll: -20 },
  { az: 0, polar: 30, roll: 0 },
  { az: 15, polar: 35, roll: -10 },
  { az: 10, polar: 55, roll: -12, tiltX: 15 },
  { az: 20, polar: 60, roll: -17 },
];

const rad = (d: number) => (d * Math.PI) / 180;
type V3 = [number, number, number];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => {
  const m = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / m, a[1] / m, a[2] / m];
};

/** Project the flat plane's corners to 2D thumbnail coords for a given angle. */
function project(p: Angle): [number, number][] {
  const phi = rad(p.polar);
  const theta = rad(p.az);
  const dir: V3 = [Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta)];
  const up: V3 = Math.abs(dir[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0];
  const z = norm(dir);
  const x = norm(cross(up, z));
  const y = cross(z, x);

  const ax = rad(p.tiltX ?? 0);
  const az = rad(p.tiltZ ?? 0);
  const corners: V3[] = [
    [-1, 0, -1],
    [1, 0, -1],
    [1, 0, 1],
    [-1, 0, 1],
  ].map(([px, , pz]) => {
    // tilt: rotate around X then Z
    let cy = -pz * Math.sin(ax);
    const cz = pz * Math.cos(ax);
    const cx2 = px * Math.cos(az) - cy * Math.sin(az);
    cy = px * Math.sin(az) + cy * Math.cos(az);
    return [cx2, cy, cz] as V3;
  });

  const cr = Math.cos(rad(p.roll));
  const sr = Math.sin(rad(p.roll));
  const pts = corners.map((c) => {
    const vx = dot(c, x);
    const vy = dot(c, y);
    return [vx * cr - vy * sr, vx * sr + vy * cr] as [number, number];
  });

  const max = Math.max(...pts.flatMap((q) => [Math.abs(q[0]), Math.abs(q[1])])) || 1;
  const s = 32 / max;
  return pts.map(([qx, qy]) => [50 + qx * s, 50 - qy * s]);
}

function Thumb({ a }: { a: Angle }) {
  const q = project(a);
  const poly = q.map((p) => p.join(',')).join(' ');
  // L axis indicator from corner 0
  const lerp = (i: number, t: number): string =>
    `${q[0][0] + (q[i][0] - q[0][0]) * t},${q[0][1] + (q[i][1] - q[0][1]) * t}`;
  return (
    <svg viewBox="0 0 100 100" className="angle-thumb">
      <polygon points={poly} />
      <line x1={q[0][0]} y1={q[0][1]} x2={lerp(1, 0.62).split(',')[0]} y2={lerp(1, 0.62).split(',')[1]} className="axis-a" />
      <line x1={q[0][0]} y1={q[0][1]} x2={lerp(3, 0.62).split(',')[0]} y2={lerp(3, 0.62).split(',')[1]} className="axis-b" />
    </svg>
  );
}

export function AnglePresets() {
  const set = useMockupStore((s) => s.set);
  const azimuth = useMockupStore((s) => s.azimuth);
  const polar = useMockupStore((s) => s.polar);
  const roll = useMockupStore((s) => s.roll);

  const isActive = (a: Angle) =>
    Math.abs(a.az - azimuth) < 0.5 && Math.abs(a.polar - polar) < 0.5 && Math.abs(a.roll - roll) < 0.5;

  return (
    <div className="angle-grid">
      {PRESETS.map((a, i) => (
        <button
          key={i}
          className={`angle-cell ${isActive(a) ? 'active' : ''}`}
          onClick={() =>
            set({ azimuth: a.az, polar: a.polar, roll: a.roll, tiltX: a.tiltX ?? 0, tiltZ: a.tiltZ ?? 0 })
          }
        >
          <Thumb a={a} />
        </button>
      ))}
    </div>
  );
}
