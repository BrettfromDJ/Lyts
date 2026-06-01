import { useRef } from 'react';
import { useMockupStore } from '../store/useMockupStore';
import type { MockupState } from '../store/useMockupStore';

type NumKey = {
  [K in keyof MockupState]: MockupState[K] extends number ? K : never;
}[keyof MockupState];

/**
 * A Figma-style 2D pad: drag the handle to set two parameters at once (e.g.
 * orbit + rake). Replaces a pair of sliders with one spatial control and reads
 * live from the store so pointer-orbit in the scene moves the handle too.
 */
export function XYPad({
  xField,
  yField,
  xMin,
  xMax,
  yMin,
  yMax,
  invertY = false,
  label,
}: {
  xField: NumKey;
  yField: NumKey;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  invertY?: boolean;
  label?: string;
}) {
  const x = useMockupStore((s) => s[xField]) as number;
  const y = useMockupStore((s) => s[yField]) as number;
  const set = useMockupStore((s) => s.set);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const nx = (x - xMin) / (xMax - xMin);
  const ny = (y - yMin) / (yMax - yMin);
  const leftPct = Math.max(0, Math.min(1, nx)) * 100;
  const topPct = Math.max(0, Math.min(1, invertY ? ny : 1 - ny)) * 100;

  const apply = (clientX: number, clientY: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const py = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    const nyv = invertY ? py : 1 - py;
    set({
      [xField]: xMin + px * (xMax - xMin),
      [yField]: yMin + nyv * (yMax - yMin),
    } as Partial<MockupState>);
  };

  return (
    <div className="ctl">
      {label && <span className="ctl-label">{label}</span>}
      <div
        ref={ref}
        className="xypad"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          apply(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging.current) apply(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
      >
        <div className="xypad-cross-h" />
        <div className="xypad-cross-v" />
        <div className="xypad-handle" style={{ left: `${leftPct}%`, top: `${topPct}%` }} />
      </div>
    </div>
  );
}
