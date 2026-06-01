import * as THREE from 'three';
import { sceneRef } from './sceneRef';

export type ExportOptions = {
  scale: number; // supersample multiplier (1..4+). Pro unlocks >2.
  format: 'png' | 'jpg';
  transparent: boolean; // alpha PNG (bgMode === 'transparent')
  watermark: boolean; // composited into the buffer when NOT pro
  filename?: string;
};

/**
 * Supersampled still export (spec §5 Phase 3 + landmines §6.2, §6.9).
 *
 * Strategy: temporarily bump the renderer drawing buffer by `scale`, force a
 * render, read back via toBlob, then restore. preserveDrawingBuffer:true on
 * the Canvas is what makes the readback non-blank (§6.2).
 *
 * The watermark is COMPOSITED INTO the exported bitmap (§6.9) — never a DOM
 * overlay. The isPro flag simply skips this compositing step.
 */
export async function exportStill(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  opts: ExportOptions,
): Promise<void> {
  const { scale, format, transparent, watermark } = opts;
  const composer = sceneRef.composer;

  // IMPORTANT: do NOT resize the renderer/composer here. Bumping the composer to
  // a supersampled size reallocates every HDR pass target (bloom mips, focus…)
  // and can exhaust GPU memory -> WebGL context loss, which wipes the scene's
  // textures (the mockup goes blank/reverts). Instead render the current frame
  // through the post stack at the live size and scale the bitmap in 2D.
  const prevClearAlpha = gl.getClearAlpha();
  const dpr = gl.getPixelRatio() || 1;

  try {
    if (transparent) gl.setClearAlpha(0);
    if (composer) composer.render();
    else gl.render(scene, camera);

    const srcCanvas = gl.domElement;
    // 1x = CSS-pixel size (the live buffer is CSS * dpr). At 2x with dpr 2 this
    // is a 1:1 copy; higher scales upsample the composited bitmap.
    const outW = Math.max(1, Math.round((srcCanvas.width / dpr) * scale));
    const outH = Math.max(1, Math.round((srcCanvas.height / dpr) * scale));
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d')!;

    if (!transparent || format === 'jpg') {
      // JPG has no alpha; fill so transparent edges don't go black.
      ctx.fillStyle = '#0b0d12';
      ctx.fillRect(0, 0, outW, outH);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(srcCanvas, 0, 0, outW, outH);

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
