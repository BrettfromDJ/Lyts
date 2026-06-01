import { useRef, useEffect } from 'react';
import { useMockupStore } from '../store/useMockupStore';
import type { MockupState } from '../store/useMockupStore';
import { cancelBlurEdit, okBlurEdit } from './blurEdit';

function BlurEditBar({ editing }: { editing: 'ts' | 'iris' }) {
  // close with Esc (cancel) / Enter (ok)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelBlurEdit();
      else if (e.key === 'Enter') okBlurEdit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="blur-editbar">
      <span className="blur-editbar-title">{editing === 'ts' ? 'Tilt-Shift' : 'Iris Blur'}</span>
      <button className="ghost" onClick={cancelBlurEdit}>
        Cancel
      </button>
      <button className="primary" onClick={okBlurEdit}>
        OK
      </button>
    </div>
  );
}

/**
 * Photoshop-style on-canvas blur controls. Geometry (focus lines, iris ellipse)
 * is drawn in a stretched SVG so it stays consistent with the PhotoBlur shader,
 * which works in the same normalized [0,1] per-axis space. The draggable
 * handles are crisp HTML dots layered on top. Top-left origin throughout.
 */
type Pt = { x: number; y: number };
const A = (d: number) => (d * Math.PI) / 180;
const set = (p: Partial<MockupState>) => useMockupStore.getState().set(p);

function Handle({
  x,
  y,
  kind = 'dot',
  onMove,
}: {
  x: number;
  y: number;
  kind?: 'pin' | 'dot' | 'rot';
  onMove: (n: Pt) => void;
}) {
  const dragging = useRef(false);
  const pt = (e: React.PointerEvent): Pt => {
    const host = (e.currentTarget as HTMLElement).parentElement!;
    const r = host.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  return (
    <div
      className={`blur-handle ${kind}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as Element).setPointerCapture(e.pointerId);
        onMove(pt(e));
      }}
      onPointerMove={(e) => dragging.current && onMove(pt(e))}
      onPointerUp={(e) => {
        dragging.current = false;
        try {
          (e.target as Element).releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }}
    />
  );
}

export function BlurOverlay() {
  const s = useMockupStore();
  const editing = s.blurEditing;
  if (editing === 'none') return null;
  return (
    <div className="blur-overlay">
      <svg className="blur-geo" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        {editing === 'ts' && <TiltShiftGeo s={s} />}
        {editing === 'iris' && <IrisGeo s={s} />}
      </svg>
      {editing === 'ts' && <TiltShiftHandles s={s} />}
      {editing === 'iris' && <IrisHandles s={s} />}
      <BlurEditBar editing={editing} />
    </div>
  );
}

/* ---- Tilt-Shift ---- */

function tsFrame(s: MockupState) {
  const a = A(s.tsAngle);
  const dir = { x: Math.cos(a), y: Math.sin(a) };
  const perp = { x: -Math.sin(a), y: Math.cos(a) };
  const c = { x: s.tsX, y: s.tsY };
  return { dir, perp, c, featherOff: s.tsFocus + s.tsFeather };
}

function TiltShiftGeo({ s }: { s: MockupState }) {
  const { dir, perp, c, featherOff } = tsFrame(s);
  const line = (off: number, cls: string, key: string) => {
    const o = { x: c.x + perp.x * off, y: c.y + perp.y * off };
    const L = 2;
    return (
      <line
        key={key}
        className={`blur-line ${cls}`}
        x1={(o.x - dir.x * L) * 1000}
        y1={(o.y - dir.y * L) * 1000}
        x2={(o.x + dir.x * L) * 1000}
        y2={(o.y + dir.y * L) * 1000}
      />
    );
  };
  return (
    <g>
      {line(s.tsFocus, 'solid', 'f1')}
      {line(-s.tsFocus, 'solid', 'f2')}
      {line(featherOff, 'dashed', 'd1')}
      {line(-featherOff, 'dashed', 'd2')}
    </g>
  );
}

function TiltShiftHandles({ s }: { s: MockupState }) {
  const { dir, perp, c, featherOff } = tsFrame(s);
  const perpDist = (n: Pt) => (n.x - c.x) * perp.x + (n.y - c.y) * perp.y;
  return (
    <>
      <Handle x={c.x} y={c.y} kind="pin" onMove={(n) => set({ tsX: n.x, tsY: n.y })} />
      <Handle
        x={c.x + perp.x * s.tsFocus}
        y={c.y + perp.y * s.tsFocus}
        onMove={(n) => set({ tsFocus: Math.max(0.005, Math.abs(perpDist(n))) })}
      />
      <Handle
        x={c.x + perp.x * featherOff}
        y={c.y + perp.y * featherOff}
        onMove={(n) => set({ tsFeather: Math.max(0.005, Math.abs(perpDist(n)) - s.tsFocus) })}
      />
      <Handle
        x={c.x + dir.x * 0.16}
        y={c.y + dir.y * 0.16}
        kind="rot"
        onMove={(n) => set({ tsAngle: (Math.atan2(n.y - c.y, n.x - c.x) * 180) / Math.PI })}
      />
    </>
  );
}

/* ---- Iris ---- */

function irisFrame(s: MockupState) {
  const a = A(s.irisAngle);
  const c = { x: s.irisX, y: s.irisY };
  const ax = { x: Math.cos(a), y: Math.sin(a) };
  const ay = { x: -Math.sin(a), y: Math.cos(a) };
  return { c, ax, ay };
}

function IrisGeo({ s }: { s: MockupState }) {
  const { c } = irisFrame(s);
  const tr = `rotate(${s.irisAngle} ${c.x * 1000} ${c.y * 1000})`;
  return (
    <g>
      <ellipse
        className="blur-ellipse"
        cx={c.x * 1000}
        cy={c.y * 1000}
        rx={s.irisRX * 1000}
        ry={s.irisRY * 1000}
        transform={tr}
      />
      <ellipse
        className="blur-ellipse feather"
        cx={c.x * 1000}
        cy={c.y * 1000}
        rx={s.irisRX * s.irisFeather * 1000}
        ry={s.irisRY * s.irisFeather * 1000}
        transform={tr}
      />
    </g>
  );
}

function IrisHandles({ s }: { s: MockupState }) {
  const { c, ax, ay } = irisFrame(s);
  const proj = (n: Pt, axis: Pt) => (n.x - c.x) * axis.x + (n.y - c.y) * axis.y;
  return (
    <>
      <Handle x={c.x} y={c.y} kind="pin" onMove={(n) => set({ irisX: n.x, irisY: n.y })} />
      <Handle
        x={c.x + ax.x * s.irisRX}
        y={c.y + ax.y * s.irisRX}
        onMove={(n) => set({ irisRX: Math.max(0.03, Math.abs(proj(n, ax))) })}
      />
      <Handle
        x={c.x + ay.x * s.irisRY}
        y={c.y + ay.y * s.irisRY}
        onMove={(n) => set({ irisRY: Math.max(0.03, Math.abs(proj(n, ay))) })}
      />
      <Handle
        x={c.x + ax.x * s.irisRX * s.irisFeather}
        y={c.y + ax.y * s.irisRX * s.irisFeather}
        onMove={(n) =>
          set({
            irisFeather: Math.min(0.98, Math.max(0.05, Math.abs(proj(n, ax)) / Math.max(s.irisRX, 0.03))),
          })
        }
      />
      <Handle
        x={c.x + ax.x * (s.irisRX + 0.05)}
        y={c.y + ax.y * (s.irisRX + 0.05)}
        kind="rot"
        onMove={(n) => set({ irisAngle: (Math.atan2(n.y - c.y, n.x - c.x) * 180) / Math.PI })}
      />
    </>
  );
}
