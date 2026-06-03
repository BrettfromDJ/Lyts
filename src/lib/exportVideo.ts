import type * as THREE from 'three';

/**
 * Record the live canvas via captureStream + MediaRecorder. Prefers MP4 (H.264)
 * where the browser supports it in MediaRecorder, falling back to WebM. The
 * caller keeps the scene rendering continuously (frameloop "always") for the
 * duration so the stream has fresh frames; the camera is NOT animated.
 *
 * Quality (resolution) is applied by the caller bumping the canvas DPR before
 * recording (R3F resizes the canvas), so this just records whatever the canvas
 * currently is.
 */
export type VideoOptions = {
  duration: number; // seconds
  fps: number;
  filename?: string;
  onProgress?: (fraction: number) => void;
};

const CANDIDATES = [
  'video/mp4;codecs=avc1.640029',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

function pickMime(): string | null {
  const MR = (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  if (!MR || typeof MR.isTypeSupported !== 'function') return null;
  return CANDIDATES.find((m) => MR.isTypeSupported(m)) ?? null;
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
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';

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

  // No timeslice: record one continuous segment and flush on stop. A timeslice
  // forces periodic chunk boundaries that can show up as pauses on playback.
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

  if (recorder.state === 'recording') recorder.requestData();
  recorder.stop();
  await stopped;

  const blob = new Blob(chunks, { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename ?? `mockup-${Date.now()}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
