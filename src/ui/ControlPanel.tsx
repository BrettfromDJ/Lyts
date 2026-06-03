import { useState } from 'react';
import { useMockupStore, DEFAULTS } from '../store/useMockupStore';
import type { MockupState, BgMode, CrtBlend, CrtMode } from '../store/useMockupStore';
import { ExportSection } from './ExportSection';
import { AnglePresets } from './AnglePresets';

/* ---- tiny store-bound primitives -------------------------------------- */

type NumKey = {
  [K in keyof MockupState]: MockupState[K] extends number ? K : never;
}[keyof MockupState];

type StrKey = {
  [K in keyof MockupState]: MockupState[K] extends string ? K : never;
}[keyof MockupState];

type BoolKey = {
  [K in keyof MockupState]: MockupState[K] extends boolean ? K : never;
}[keyof MockupState];

function SwitchButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`switch ${on ? 'on' : ''}`}
      onClick={onClick}
    >
      <span className="switch-knob" />
    </button>
  );
}

function Switch({ field, label }: { field: BoolKey; label: string }) {
  const value = useMockupStore((s) => s[field]) as boolean;
  const set = useMockupStore((s) => s.set);
  return (
    <label className="ctl ctl-toggle">
      <span className="ctl-label">{label}</span>
      <SwitchButton on={value} onClick={() => set({ [field]: !value } as Partial<MockupState>)} />
    </label>
  );
}

/** Switch bound to a numeric field — toggles between `onValue` and 0. */
function ValueSwitch({ field, label, onValue }: { field: NumKey; label: string; onValue: number }) {
  const value = useMockupStore((s) => s[field]) as number;
  const set = useMockupStore((s) => s.set);
  const on = value > 1e-6;
  return (
    <label className="ctl ctl-toggle">
      <span className="ctl-label">{label}</span>
      <SwitchButton on={on} onClick={() => set({ [field]: on ? 0 : onValue } as Partial<MockupState>)} />
    </label>
  );
}

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

const BG_MODES: BgMode[] = ['solid', 'gradient', 'env-blur', 'transparent'];

/* ---- the panel -------------------------------------------------------- */

export function ControlPanel() {
  const set = useMockupStore((s) => s.set);
  const bgMode = useMockupStore((s) => s.bgMode);
  const crtEnabled = useMockupStore((s) => s.crtEnabled);
  const crtBlend = useMockupStore((s) => s.crtBlend);
  const crtMode = useMockupStore((s) => s.crtMode);
  const crtRoll = useMockupStore((s) => s.crtRoll);

  const [openIds, setOpen] = useState<Set<string>>(
    new Set(['angle', 'camera', 'focus', 'post']),
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

      <Group title="Angle" id="angle" openIds={openIds} toggle={toggle}>
        <AnglePresets />
      </Group>

      <Group title="Camera" id="camera" openIds={openIds} toggle={toggle}>
        <Slider field="roll" label="Roll" min={-45} max={45} step={0.5} />
        <Slider field="zoom" label="Zoom" min={0.2} max={10} step={0.01} />
        <button
          className="ghost reset-view"
          onClick={() =>
            set({
              azimuth: DEFAULTS.azimuth,
              polar: DEFAULTS.polar,
              zoom: DEFAULTS.zoom,
              roll: DEFAULTS.roll,
              targetX: 0,
              targetY: 0,
              targetZ: 0,
            })
          }
        >
          Reset view
        </button>
        <p className="ctl-hint">
          Drag · orbit · Shift+drag · pan · ⌥+drag · perspective · scroll · zoom
        </p>
      </Group>

      <Group title="Screen" id="screen" openIds={openIds} toggle={toggle}>
        <Slider field="screenBrightness" label="Brightness" min={0} max={2} />
        <Slider field="cornerRadius" label="Corner radius" min={0} max={0.5} step={0.005} />
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
        <ValueSwitch field="chromaticAberration" label="Chromatic aberration" onValue={0.001} />
        <Slider field="grain" label="Grain" min={0} max={0.4} step={0.005} />
      </Group>

      <Group title="CRT" id="crt" openIds={openIds} toggle={toggle}>
        <Switch field="crtEnabled" label="Enable CRT" />
        {crtEnabled && (
          <>
            <label className="ctl">
              <span className="ctl-label">Mode</span>
              <select value={crtMode} onChange={(e) => set({ crtMode: e.target.value as CrtMode })}>
                <option value="aperture">Aperture grille (Trinitron)</option>
                <option value="shadow">Shadow mask (dot trio)</option>
                <option value="slot">Slot mask</option>
                <option value="lcd">LCD grid</option>
                <option value="mono">Monochrome</option>
              </select>
            </label>
            {crtMode === 'mono' && <ColorRow field="crtTint" label="Phosphor tint" />}
            <label className="ctl">
              <span className="ctl-label">Blend mode</span>
              <select
                value={crtBlend}
                onChange={(e) => set({ crtBlend: e.target.value as CrtBlend })}
              >
                <option value="normal">Normal</option>
                <option value="screen">Screen</option>
                <option value="overlay">Overlay</option>
                <option value="multiply">Multiply</option>
                <option value="softlight">Soft light</option>
                <option value="add">Add</option>
              </select>
            </label>
            <Slider field="crtOpacity" label="Opacity" min={0} max={1} />
            <Slider field="crtFlicker" label="Flicker" min={0} max={1} />
            <ValueSwitch field="crtRoll" label="Roll bar" onValue={0.5} />
            {crtRoll > 0 && (
              <>
                <Slider field="crtRoll" label="Roll bar opacity" min={0.05} max={1} />
                <Slider field="crtSpeed" label="Speed" min={0} max={3} />
              </>
            )}
          </>
        )}
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

      <ExportSection />
    </aside>
  );
}
