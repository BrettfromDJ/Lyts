import { useState } from 'react';
import { useMockupStore, DEFAULTS } from '../store/useMockupStore';
import type { MockupState, BgMode } from '../store/useMockupStore';
import { PRESETS } from '../store/presets';
import { XYPad } from './XYPad';

/* ---- tiny store-bound primitives -------------------------------------- */

type NumKey = {
  [K in keyof MockupState]: MockupState[K] extends number ? K : never;
}[keyof MockupState];

type StrKey = {
  [K in keyof MockupState]: MockupState[K] extends string ? K : never;
}[keyof MockupState];

function Slider({
  field,
  label,
  min,
  max,
  step = 0.01,
}: {
  field: NumKey;
  label: string;
  min: number;
  max: number;
  step?: number;
}) {
  const value = useMockupStore((s) => s[field]);
  const set = useMockupStore((s) => s.set);
  return (
    <label className="ctl">
      <span className="ctl-label">
        {label}
        <em>{value.toFixed(step < 1 ? (step < 0.01 ? 4 : 2) : 0)}</em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set({ [field]: parseFloat(e.target.value) } as Partial<MockupState>)}
      />
    </label>
  );
}

function ColorRow({ field, label }: { field: StrKey; label: string }) {
  const value = useMockupStore((s) => s[field]);
  const set = useMockupStore((s) => s.set);
  return (
    <label className="ctl ctl-color">
      <span className="ctl-label">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => set({ [field]: e.target.value } as Partial<MockupState>)}
      />
    </label>
  );
}

function Group({
  title,
  id,
  openIds,
  toggle,
  children,
}: {
  title: string;
  id: string;
  openIds: Set<string>;
  toggle: (id: string) => void;
  children: React.ReactNode;
}) {
  const open = openIds.has(id);
  return (
    <section className={`group ${open ? 'open' : ''}`}>
      <button className="group-head" onClick={() => toggle(id)}>
        <span className="chev">{open ? '▾' : '▸'}</span>
        {title}
      </button>
      {open && <div className="group-body">{children}</div>}
    </section>
  );
}

const HDRI_PRESETS = [
  'studio',
  'apartment',
  'city',
  'sunset',
  'dawn',
  'night',
  'warehouse',
  'lobby',
];

const BG_MODES: BgMode[] = ['solid', 'gradient', 'env-blur', 'transparent'];

/* ---- the panel -------------------------------------------------------- */

export function ControlPanel() {
  const set = useMockupStore((s) => s.set);
  const loadPreset = useMockupStore((s) => s.loadPreset);
  const isPro = useMockupStore((s) => s.isPro);
  const hdriPreset = useMockupStore((s) => s.hdriPreset);
  const bgMode = useMockupStore((s) => s.bgMode);
  const animate = useMockupStore((s) => s.animate);
  const motion = useMockupStore((s) => s.motion);

  const [openIds, setOpen] = useState<Set<string>>(
    new Set(['presets', 'camera', 'post']),
  );
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <aside className="panel">
      <header className="panel-head">
        <div className="brand">Lyts</div>
        <div className="brand-sub">cinematic mockups</div>
      </header>

      <Group title="Presets" id="presets" openIds={openIds} toggle={toggle}>
        <div className="presets">
          {PRESETS.map((p) => {
            const locked = p.pro && !isPro;
            return (
              <button
                key={p.name}
                className={`preset ${locked ? 'locked' : ''}`}
                title={p.hint}
                onClick={() => !locked && loadPreset(p.data)}
              >
                {p.name}
                {p.pro && <span className="pro-tag">PRO</span>}
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Camera" id="camera" openIds={openIds} toggle={toggle}>
        <XYPad
          label="Tilt — drag to orbit + rake"
          xField="azimuth"
          yField="polar"
          xMin={-180}
          xMax={180}
          yMin={8}
          yMax={88}
          invertY
        />
        <Slider field="roll" label="Roll" min={-45} max={45} step={0.5} />
        <Slider field="zoom" label="Zoom" min={0.2} max={10} step={0.01} />
        <Slider field="focalLength" label="Focal length (mm)" min={18} max={300} step={1} />
        <button
          className="ghost reset-view"
          onClick={() =>
            set({
              azimuth: DEFAULTS.azimuth,
              polar: DEFAULTS.polar,
              zoom: DEFAULTS.zoom,
              roll: DEFAULTS.roll,
              focalLength: DEFAULTS.focalLength,
              targetX: 0,
              targetY: 0,
              targetZ: 0,
            })
          }
        >
          Reset view
        </button>
        <p className="ctl-hint">Drag to orbit · Shift+drag to pan · scroll to zoom</p>
      </Group>

      <Group title="Animate" id="animate" openIds={openIds} toggle={toggle}>
        <button
          className={`play-btn ${animate ? 'playing' : ''}`}
          onClick={() => set({ animate: !animate })}
        >
          {animate ? '◼ Stop preview' : '▶ Preview motion'}
        </button>
        <label className="ctl">
          <span className="ctl-label">Motion</span>
          <select
            value={motion}
            onChange={(e) =>
              set({ motion: e.target.value as 'drift' | 'orbit' | 'push' | 'parallax' })
            }
          >
            <option value="drift">Drift</option>
            <option value="parallax">Parallax</option>
            <option value="orbit">Orbit sway</option>
            <option value="push">Push in/out</option>
          </select>
        </label>
        <Slider field="motionAmount" label="Amount" min={0} max={3} step={0.05} />
        <Slider field="motionSpeed" label="Speed (loops)" min={0.25} max={4} step={0.25} />
        <Slider field="videoDuration" label="Duration (s)" min={2} max={20} step={0.5} />
      </Group>

      <Group title="Screen" id="screen" openIds={openIds} toggle={toggle}>
        <Slider field="screenBrightness" label="Brightness" min={0} max={2} />
        <Slider field="glassRoughness" label="Sheen roughness" min={0} max={0.5} />
        <Slider field="reflectionIntensity" label="Sheen" min={0} max={3} />
      </Group>

      <Group title="Lighting" id="lighting" openIds={openIds} toggle={toggle}>
        <label className="ctl">
          <span className="ctl-label">Environment</span>
          <select
            value={hdriPreset}
            onChange={(e) => set({ hdriPreset: e.target.value })}
          >
            {HDRI_PRESETS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <Slider field="hdriRotation" label="Env rotation" min={0} max={360} step={1} />
        <ColorRow field="keyColor" label="Key" />
        <Slider field="keyIntensity" label="Key intensity" min={0} max={4} />
        <ColorRow field="fillColor" label="Fill" />
        <Slider field="fillIntensity" label="Fill intensity" min={0} max={2} />
        <ColorRow field="rimColor" label="Rim" />
        <Slider field="rimIntensity" label="Rim intensity" min={0} max={4} />
      </Group>

      <Group title="Focus" id="focus" openIds={openIds} toggle={toggle}>
        <Slider field="focusDistance" label="Position" min={0} max={1} />
        <Slider field="focusSize" label="Size" min={0.05} max={1} />
        <Slider field="focusFalloff" label="Falloff" min={0} max={1} />
        <Slider field="focusAngle" label="Angle" min={-45} max={45} step={0.5} />
        <Slider field="blur" label="Blur" min={0} max={1} />
      </Group>

      <Group title="Post" id="post" openIds={openIds} toggle={toggle}>
        <Slider field="exposure" label="Exposure" min={0.2} max={3} />
        <Slider field="contrast" label="Contrast" min={0.6} max={1.6} />
        <Slider field="bloom" label="Bloom" min={0} max={3} />
        <Slider field="vignette" label="Vignette" min={0} max={1} />
        <Slider
          field="chromaticAberration"
          label="Chromatic ab."
          min={0}
          max={0.004}
          step={0.0001}
        />
        <Slider field="grain" label="Grain" min={0} max={0.4} step={0.005} />
      </Group>

      <Group title="Background" id="background" openIds={openIds} toggle={toggle}>
        <label className="ctl">
          <span className="ctl-label">Mode</span>
          <select
            value={bgMode}
            onChange={(e) => set({ bgMode: e.target.value as BgMode })}
          >
            {BG_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <ColorRow field="bgColorA" label="Color A" />
        <ColorRow field="bgColorB" label="Color B" />
      </Group>
    </aside>
  );
}
