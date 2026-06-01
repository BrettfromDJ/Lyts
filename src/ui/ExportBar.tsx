import { useRef, useState } from 'react';
import { useMockupStore, SERIALIZABLE_KEYS } from '../store/useMockupStore';
import type { PresetData } from '../store/useMockupStore';
import { exportStill } from '../lib/exportImage';
import { exportVideo, videoSupported } from '../lib/exportVideo';
import { sceneRef } from '../lib/sceneRef';
import { activateLicense, deactivateLicense } from '../lib/license';

const SCALES = [1, 2, 4] as const;

export function ExportBar() {
  const isPro = useMockupStore((s) => s.isPro);
  const bgMode = useMockupStore((s) => s.bgMode);
  const loadPreset = useMockupStore((s) => s.loadPreset);

  const [scale, setScale] = useState<number>(2);
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState<number | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseMsg, setLicenseMsg] = useState<string | null>(null);
  const presetInput = useRef<HTMLInputElement>(null);

  const transparent = bgMode === 'transparent';
  // Gate points (Phase 5): hi-res (>2x), transparent/alpha, and watermark.
  const maxScale = isPro ? 4 : 2;
  const effectiveScale = Math.min(scale, maxScale);

  async function onExport() {
    const { gl, scene, camera } = sceneRef;
    if (!gl || !scene || !camera) return;
    setBusy(true);
    try {
      await exportStill(gl, scene, camera, {
        scale: effectiveScale,
        format,
        transparent: transparent && isPro, // alpha PNG is Pro
        watermark: !isPro, // composited into the buffer, not a DOM overlay
      });
    } finally {
      setBusy(false);
    }
  }

  async function onExportVideo() {
    const { gl } = sceneRef;
    if (!gl) return;
    const s = useMockupStore.getState();
    if (!s.isPro) {
      alert('Video export is a Pro feature. Preview is free — paste a license key to unlock export.');
      return;
    }
    setRecording(0);
    s.set({ animate: true }); // play the motion + switch frameloop to "always"
    // let a couple of frames settle before recording
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
      s.set({ animate: false });
      setRecording(null);
    }
  }

  function savePreset() {
    const state = useMockupStore.getState();
    const data: PresetData = {};
    for (const k of SERIALIZABLE_KEYS) {
      // @ts-expect-error indexed assignment across the serializable subset
      data[k] = state[k];
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lyts-preset-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function onLoadPresetFile(file: File) {
    try {
      const data = JSON.parse(await file.text()) as PresetData;
      loadPreset(data);
    } catch {
      /* ignore malformed file */
    }
  }

  async function onActivate() {
    setLicenseMsg('Checking…');
    const ok = await activateLicense(licenseKey);
    setLicenseMsg(ok ? 'Pro unlocked ✓' : 'Key not recognized.');
  }

  return (
    <div className="exportbar">
      <div className="export-row">
        <div className="seg">
          <span className="seg-label">Scale</span>
          {SCALES.map((s) => {
            const locked = s > 2 && !isPro;
            return (
              <button
                key={s}
                className={`seg-btn ${effectiveScale === s ? 'active' : ''} ${
                  locked ? 'locked' : ''
                }`}
                onClick={() => setScale(s)}
                title={locked ? 'High-res export is a Pro feature' : `${s}× supersampled`}
              >
                {s}×{locked ? ' 🔒' : ''}
              </button>
            );
          })}
        </div>

        <div className="seg">
          <span className="seg-label">Format</span>
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

        <button className="export-btn" onClick={onExport} disabled={busy || recording !== null}>
          {busy ? 'Rendering…' : 'Export'}
        </button>
        <button
          className={`export-btn video ${!isPro ? 'locked' : ''}`}
          onClick={onExportVideo}
          disabled={recording !== null || !videoSupported()}
          title={
            !isPro
              ? 'Video export is a Pro feature'
              : !videoSupported()
                ? 'Video recording is not supported in this browser'
                : 'Record a WebM video of the motion'
          }
        >
          {recording !== null ? `Recording ${recording}%` : `Video${!isPro ? ' 🔒' : ''}`}
        </button>
      </div>

      <div className="export-row sub">
        <button className="ghost" onClick={savePreset}>
          Save preset
        </button>
        <button className="ghost" onClick={() => presetInput.current?.click()}>
          Load preset
        </button>
        <input
          ref={presetInput}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => e.target.files?.[0] && onLoadPresetFile(e.target.files[0])}
        />

        {transparent && !isPro && (
          <span className="hint-pill">Alpha PNG is Pro</span>
        )}
      </div>

      <div className="export-row pro-row">
        {isPro ? (
          <>
            <span className="pro-badge">PRO</span>
            <span className="pro-note">No watermark · 4× · alpha</span>
            <button className="ghost" onClick={deactivateLicense}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <input
              className="license-input"
              placeholder="Paste license key"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
            />
            <button className="ghost" onClick={onActivate} disabled={!licenseKey.trim()}>
              Activate Pro
            </button>
            {licenseMsg && <span className="hint-pill">{licenseMsg}</span>}
          </>
        )}
      </div>
    </div>
  );
}
