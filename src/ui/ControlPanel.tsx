import { useState } from 'react';
import { useMockupStore } from '../store/useMockupStore';
import type { MockupState, BgMode } from '../store/useMockupStore';
import { PRESETS } from '../store/presets';

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
        <Slider field="azimuth" label="Orbit" min={-180} max={180} step={1} />
        <Slider field="polar" label="Rake (tilt)" min={8} max={88} step={1} />
        <Slider field="roll" label="Roll" min={-45} max={45} step={0.5} />
        <Slider field="distance" label="Zoom" min={0.1} max={12} step={0.01} />
        <Slider field="focalLength" label="Focal length (mm)" min={18} max={300} step={1} />
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

      <Group title="Post" id="post" openIds={openIds} toggle={toggle}>
        <Slider field="exposure" label="Exposure" min={0.3} max={2} />
        <Slider field="contrast" label="Contrast" min={0.6} max={1.6} />
        <Slider field="focusDistance" label="Focus plane" min={0} max={1} />
        <Slider field="aperture" label="Aperture (f)" min={0.8} max={11} step={0.1} />
        <Slider field="bokehScale" label="Bokeh" min={0} max={12} step={0.1} />
        <Slider field="bloom" label="Bloom" min={0} max={2} />
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
