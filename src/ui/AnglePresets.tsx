import { useMockupStore } from '../store/useMockupStore';

/**
 * Preset camera angles, shown as projected-square thumbnails (always a square,
 * regardless of the uploaded aspect) with a local X (red) / Y (blue) axis L
 * drawn inside the square. Selecting one sets orbit / rake / roll; zoom + lens
 * are left alone. Thumbnails use the exact camera projection so they match.
 */
type Angle = { az: number; polar: number; roll: number };

const PRESETS: Angle[] = [
  // row 1 — gentle 3/4 tilts
  { az: 0, polar: 40, roll: -12 },
  { az: 0, polar: 40, roll: 12 },
  { az: 24, polar: 42, roll: 0 },
  { az: -24, polar: 42, roll: 0 },
  { az: 10, polar: 44, roll: -16 },
  { az: -10, polar: 44, roll: 16 },
  // row 2 — a touch stronger
  { az: 0, polar: 55, roll: -10 },
  { az: 0, polar: 55, roll: 10 },
  { az: 28, polar: 58, roll: 0 },
  { az: -28, polar: 58, roll: 0 },
  { az: 12, polar: 64, roll: -14 },
  { az: -12, polar: 64, roll: 14 },
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

type P = [number, number];

/** Project the unit square's corners to 2D thumbnail coords for an angle. */
function project(p: Angle): P[] {
  const phi = rad(p.polar);
  const theta = rad(p.az);
  const dir: V3 = [Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta)];
  const up: V3 = Math.abs(dir[1]) > 0.999 ? [0, 0, 1] : [0, 1, 0];
  const z = norm(dir);
  const x = norm(cross(up, z));
  const y = cross(z, x);

  // corners in local order: 0=origin(-,-) 1=+X 2=+X+Y 3=+Y  (square in XZ plane)
  const corners: V3[] = [
    [-1, 0, -1],
    [1, 0, -1],
    [1, 0, 1],
    [-1, 0, 1],
  ];
  const cr = Math.cos(rad(p.roll));
  const sr = Math.sin(rad(p.roll));
  // perspective projection so a tilted square reads as a square (converging
  // edges) rather than a flat parallelogram.
  const D = 3.6; // camera distance
  const f = 2.9; // focal length
  const pts = corners.map((c) => {
    const vx = dot(c, x);
    const vy = dot(c, y);
    const vz = dot(c, z); // toward camera
    const w = f / Math.max(D - vz, 0.2);
    const px = vx * w;
    const py = vy * w;
    return [px * cr - py * sr, px * sr + py * cr] as P;
  });

  // centre on the projected centroid, then scale to fit
  const cx = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
  const cy = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4;
  const c0 = pts.map(([qx, qy]) => [qx - cx, qy - cy] as P);
  const max = Math.max(...c0.flatMap((q) => [Math.abs(q[0]), Math.abs(q[1])])) || 1;
  const s = 33 / max;
  return c0.map(([qx, qy]) => [50 + qx * s, 50 - qy * s] as P);
}

const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function Thumb({ a }: { a: Angle }) {
  const q = project(a);
  const poly = q.map((p) => p.join(',')).join(' ');
  const center: P = [
    (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4,
    (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4,
  ];
  // origin corner + local X / Y axes, inset inside the square
  const o = lerp(q[0], center, 0.18);
  const xEnd = lerp(o, lerp(q[1], center, 0.18), 0.6); // red = local X
  const yEnd = lerp(o, lerp(q[3], center, 0.18), 0.6); // blue = local Y
  return (
    <svg viewBox="0 0 100 100" className="angle-thumb">
      <polygon points={poly} />
      <line x1={o[0]} y1={o[1]} x2={xEnd[0]} y2={xEnd[1]} className="axis-a" />
      <line x1={o[0]} y1={o[1]} x2={yEnd[0]} y2={yEnd[1]} className="axis-b" />
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
          onClick={() => set({ azimuth: a.az, polar: a.polar, roll: a.roll, tiltX: 0, tiltZ: 0 })}
        >
          <Thumb a={a} />
        </button>
      ))}
    </div>
  );
}
