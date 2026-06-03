import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';
import { cameraPose, applyPose } from '../lib/cameraMath';
import { surfaceMetrics } from '../lib/deviceDims';

/**
 * Preset camera angles, shown as thumbnails that are projected with the EXACT
 * camera math (cameraPose) and the real screenshot aspect, so each thumbnail is
 * a true mini-preview of the result. A local X (red) / Y (blue) axis L is drawn
 * inside. Selecting one sets orbit / rake / roll; zoom + lens are left alone.
 */
type Angle = { az: number; polar: number; roll: number };

const PRESETS: Angle[] = [
  { az: 0, polar: 40, roll: -12 },
  { az: 0, polar: 40, roll: 12 },
  { az: 24, polar: 42, roll: 0 },
  { az: -24, polar: 42, roll: 0 },
  { az: 10, polar: 44, roll: -16 },
  { az: -10, polar: 44, roll: 16 },
  { az: 0, polar: 55, roll: -10 },
  { az: 0, polar: 55, roll: 10 },
  { az: 28, polar: 58, roll: 0 },
  { az: -28, polar: 58, roll: 0 },
  { az: 12, polar: 64, roll: -14 },
  { az: -12, polar: 64, roll: 14 },
  // row 3 — front / gentle perspective
  { az: 0, polar: 1.5, roll: 0 }, // straight on
  { az: 0, polar: 25, roll: 0 }, // top tilted away (perspective)
  { az: 0, polar: 32, roll: -12 },
  { az: 20, polar: 34, roll: 0 },
  { az: -20, polar: 34, roll: 0 },
  { az: 0, polar: 38, roll: 0 },
];

type P = [number, number];
const _cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
const _t = new THREE.Vector3(0, 0, 0);
const _v = new THREE.Vector3();

/** Project the surface corners with the real camera for a given preset angle. */
function project(p: Angle, aspect: number): P[] {
  const m = surfaceMetrics(aspect);
  // zoom 1 = auto-fit (whole surface visible) so the thumbnail shows the shape
  const pose = cameraPose(
    { azimuth: p.az, polar: p.polar, zoom: 1, focalLength: 300, roll: p.roll },
    m.radius,
  );
  applyPose(_cam, pose, _t);
  const corners: [number, number, number][] = [
    [-m.w / 2, 0, -m.h / 2],
    [m.w / 2, 0, -m.h / 2],
    [m.w / 2, 0, m.h / 2],
    [-m.w / 2, 0, m.h / 2],
  ];
  const pts = corners.map((c) => {
    _v.set(c[0], c[1], c[2]).project(_cam); // NDC, y up
    return [_v.x, _v.y] as P;
  });
  const cx = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
  const cy = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4;
  const c0 = pts.map(([qx, qy]) => [qx - cx, qy - cy] as P);
  const max = Math.max(...c0.flatMap((q) => [Math.abs(q[0]), Math.abs(q[1])])) || 1;
  const s = 33 / max;
  return c0.map(([qx, qy]) => [50 + qx * s, 50 - qy * s] as P);
}

const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function Thumb({ a, aspect }: { a: Angle; aspect: number }) {
  const q = project(a, aspect);
  const poly = q.map((p) => p.join(',')).join(' ');
  const center: P = [
    (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4,
    (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4,
  ];
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
  const aspect = useMockupStore((s) => s.screenAspect);

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
          <Thumb a={a} aspect={aspect} />
        </button>
      ))}
    </div>
  );
}

