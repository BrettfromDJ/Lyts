import * as THREE from 'three';
import { sceneRef } from './sceneRef';

export type ExportOptions = {
  aspectValue: number; // target width / height
  outWidth: number; // target width in px (height derived from aspectValue)
  format: 'png' | 'jpg';
  transparent: boolean; // alpha PNG (bgMode === 'transparent')
  watermark: boolean; // composited into the buffer
  filename?: string;
};

/**
 * Still export. Renders the current frame through the post stack at the live
 * size (NEVER resizes the renderer/composer — that reallocates the HDR pass
 * targets and can trigger WebGL context loss that wipes the scene), then
 * centre-crops the live canvas to the requested aspect and scales it to the
 * target resolution in 2D.
 */
export async function exportStill(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  opts: ExportOptions,
): Promise<void> {
  const { aspectValue, outWidth, format, transparent, watermark } = opts;
  const composer = sceneRef.composer;
  const prevClearAlpha = gl.getClearAlpha();

  const outW = Math.max(1, Math.round(outWidth));
  const outH = Math.max(1, Math.round(outWidth / aspectValue));

  try {
    if (transparent) gl.setClearAlpha(0);
    if (composer) composer.render();
    else gl.render(scene, camera);

    const src = gl.domElement;
    // largest centred rect of the target aspect within the live buffer
    const srcAspect = src.width / src.height;
    let cw: number, ch: number;
    if (srcAspect > aspectValue) {
      ch = src.height;
      cw = ch * aspectValue;
    } else {
      cw = src.width;
      ch = cw / aspectValue;
    }
    const cx = (src.width - cw) / 2;
    const cy = (src.height - ch) / 2;

    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d')!;

    if (!transparent || format === 'jpg') {
      ctx.fillStyle = '#0b0d12';
      ctx.fillRect(0, 0, outW, outH);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, cx, cy, cw, ch, 0, 0, outW, outH);

    if (watermark) drawWatermark(ctx, outW, outH);

    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const quality = format === 'jpg' ? 0.95 : undefined;
    const blob: Blob | null = await new Promise((res) => out.toBlob(res, mime, quality));
    if (!blob) throw new Error('Export failed: empty blob');

    triggerDownload(blob, opts.filename ?? `mockup-${Date.now()}.${format}`);
  } finally {
    if (transparent) {
      gl.setClearAlpha(prevClearAlpha);
      if (composer) composer.render();
      else gl.render(scene, camera);
    }
  }
}

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const pad = Math.round(h * 0.028);
  const fontSize = Math.max(14, Math.round(h * 0.028));
  ctx.save();
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  const label = 'made with Lyts';
  const metrics = ctx.measureText(label);
  const x = w - pad;
  const y = h - pad;
  // subtle pill behind the text for legibility on any background
  const padX = fontSize * 0.6;
  const padY = fontSize * 0.45;
  const boxW = metrics.width + padX * 2;
  const boxH = fontSize + padY * 2;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, x - boxW, y - fontSize - padY, boxW, boxH, boxH / 2);
  ctx.fill();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, x - padX, y);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
