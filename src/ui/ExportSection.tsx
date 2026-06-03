import { useState } from 'react';
import { useMockupStore } from '../store/useMockupStore';
import type { ExportAspect } from '../store/useMockupStore';
import { exportStill } from '../lib/exportImage';
import { exportVideo, videoSupported } from '../lib/exportVideo';
import { sceneRef } from '../lib/sceneRef';

const ASPECTS: { key: ExportAspect; label: string }[] = [
  { key: 'original', label: 'Original' },
  { key: '1:1', label: '1:1' },
  { key: '4:5', label: '4:5' },
  { key: '16:9', label: '16:9' },
  { key: '9:16', label: '9:16' },
];

const QUALITY = [
  { key: 'standard', label: 'Standard', w: 1920 },
  { key: 'high', label: 'High', w: 3840 },
  { key: 'ultra', label: 'Ultra', w: 7680 },
] as const;

type QualityKey = (typeof QUALITY)[number]['key'];

function aspectValue(a: ExportAspect, screenAspect: number): number {
  switch (a) {
    case '1:1':
      return 1;
    case '4:5':
      return 4 / 5;
    case '16:9':
      return 16 / 9;
    case '9:16':
      return 9 / 16;
    default:
      return screenAspect || 16 / 10;
  }
}

/** Export controls, lives as a collapsible section in the left panel. */
export function ExportSection() {
  const set = useMockupStore((s) => s.set);
  const bgMode = useMockupStore((s) => s.bgMode);
  const exportAspect = useMockupStore((s) => s.exportAspect);
  const screenAspect = useMockupStore((s) => s.screenAspect);
  const videoFps = useMockupStore((s) => s.videoFps);
  const videoDuration = useMockupStore((s) => s.videoDuration);

  const [open, setOpen] = useState(false);
  const [quality, setQuality] = useState<QualityKey>('standard');
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState<number | null>(null);

  const av = aspectValue(exportAspect, screenAspect);
  const dims = (w: number) => `${w}×${Math.round(w / av)}`;
  const transparent = bgMode === 'transparent';

  async function onExport() {
    const { gl, scene, camera } = sceneRef;
    if (!gl || !scene || !camera) return;
    const tier = QUALITY.find((q) => q.key === quality)!;
    setBusy(true);
    try {
      await exportStill(gl, scene, camera, {
        aspectValue: av,
        outWidth: tier.w,
        format,
        transparent,
        watermark: false,
      });
    } finally {
      setBusy(false);
    }
  }

  async function onExportVideo() {
    const { gl } = sceneRef;
    if (!gl) return;
    const s = useMockupStore.getState();
    setRecording(0);
    // keep rendering continuously (animated effects) WITHOUT moving the camera
    s.set({ recording: true });
    await new Promise((r) => setTimeout(r, 200));
    try {
      await exportVideo(gl, {
        duration: s.videoDuration,
        fps: s.videoFps,
        onProgress: (f) => setRecording(Math.round(f * 100)),
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Video export failed.');
    } finally {
      s.set({ recording: false });
      setRecording(null);
    }
  }

  return (
    <section className={`group ${open ? 'open' : ''}`}>
      <button className="group-head" onClick={() => setOpen((o) => !o)}>
        <span className="chev">{open ? '▾' : '▸'}</span>
        Export
      </button>
      {open && (
        <div className="group-body">
          <label className="ctl">
            <span className="ctl-label">Aspect ratio</span>
            <select
              value={exportAspect}
              onChange={(e) => set({ exportAspect: e.target.value as ExportAspect })}
            >
              {ASPECTS.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          <div className="ctl">
            <span className="ctl-label">Quality</span>
            <div className="quality-list">
              {QUALITY.map((q) => (
                <button
                  key={q.key}
                  className={`quality-row ${quality === q.key ? 'active' : ''}`}
                  onClick={() => setQuality(q.key)}
                >
                  <span>{q.label}</span>
                  <em>{dims(q.w)}</em>
                </button>
              ))}
            </div>
          </div>

          <label className="ctl">
            <span className="ctl-label">Format</span>
            <div className="seg">
              <button
                className={`seg-btn ${format === 'png' ? 'active' : ''}`}
                onClick={() => setFormat('png')}
              >
                PNG
              </button>
              <button
                className={`seg-btn ${format === 'jpg' ? 'active' : ''}`}
                onClick={() => setFormat('jpg')}
              >
                JPG
              </button>
            </div>
          </label>

          <button className="export-btn" onClick={onExport} disabled={busy || recording !== null}>
            {busy ? 'Rendering…' : 'Export image'}
          </button>

          <div className="export-divider" />

          <label className="ctl">
            <span className="ctl-label">Frame rate</span>
            <div className="seg">
              {[24, 30, 50, 60].map((f) => (
                <button
                  key={f}
                  className={`seg-btn ${videoFps === f ? 'active' : ''}`}
                  onClick={() => set({ videoFps: f })}
                >
                  {f}
                </button>
              ))}
            </div>
          </label>
          <Slider
            label="Duration (s)"
            value={videoDuration}
            min={1}
            max={30}
            step={0.5}
            onChange={(v) => set({ videoDuration: v })}
          />
          <button
            className="ghost"
            onClick={onExportVideo}
            disabled={recording !== null || !videoSupported()}
          >
            {recording !== null ? `Recording ${recording}%` : 'Export video'}
          </button>
        </div>
      )}
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="ctl">
      <span className="ctl-label">
        {label}
        <em>{value.toFixed(step < 1 ? 1 : 0)}</em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}
