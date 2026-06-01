import type * as THREE from 'three';

/**
 * Record the live canvas to WebM via captureStream + MediaRecorder (spec §5
 * Phase 4, "easy path"). The caller is responsible for putting the scene into
 * an animating state (frameloop "always") for the duration of the capture so
 * the stream has fresh frames. True alpha video in-browser is unreliable, so
 * this records opaque WebM — a known limitation.
 */
export type VideoOptions = {
  duration: number; // seconds
  fps: number;
  filename?: string;
  onProgress?: (fraction: number) => void;
};

function pickMime(): string | null {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  const MR = (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  if (!MR || typeof MR.isTypeSupported !== 'function') return null;
  return candidates.find((m) => MR.isTypeSupported(m)) ?? null;
}

export function videoSupported(): boolean {
  const canvasOk = typeof HTMLCanvasElement !== 'undefined' &&
    'captureStream' in HTMLCanvasElement.prototype;
  return canvasOk && pickMime() !== null;
}

export async function exportVideo(gl: THREE.WebGLRenderer, opts: VideoOptions): Promise<void> {
  const { duration, fps } = opts;
  const mime = pickMime();
  if (!mime) throw new Error('Video recording is not supported in this browser.');

  const canvas = gl.domElement as HTMLCanvasElement & {
    captureStream(fps?: number): MediaStream;
  };
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 16_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start();

  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      opts.onProgress?.(Math.min(elapsed / duration, 1));
      if (elapsed >= duration) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  await stopped;

  const blob = new Blob(chunks, { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename ?? `mockup-${Date.now()}.webm`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
