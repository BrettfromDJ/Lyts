import type * as THREE from 'three';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/**
 * Video export.
 *
 * Primary path: WebCodecs `VideoEncoder` (H.264) muxed into a real, non-
 * fragmented MP4 via mp4-muxer with `fastStart: 'in-memory'` — the moov atom is
 * written at the FRONT of the file, so the result is seekable and plays in
 * QuickTime, Safari, iMessage, editors, etc. This replaces the old
 * MediaRecorder MP4 path, whose output was a fragmented stream that several
 * players refused to open (and which silently produced 0-byte files on browsers
 * that report `video/mp4` as supported without a working H.264 encoder).
 *
 * Fallback path: when the browser can't H.264-encode via WebCodecs, record WebM
 * (VP9/VP8) through MediaRecorder — reliably encodable everywhere and playable
 * in browsers/VLC. Extension reflects the real container so the file is valid.
 *
 * The caller keeps the scene rendering continuously (frameloop "always") for the
 * duration; whatever is live on the canvas (camera move if `animate` is on, plus
 * the CRT / film surface animation) is captured. Resolution comes from the
 * caller bumping the canvas DPR before recording.
 */
export type VideoOptions = {
  duration: number; // seconds
  fps: number;
  filename?: string;
  onProgress?: (fraction: number) => void;
};

/**
 * H.264 codec strings to try, HIGHEST level first so the declared level always
 * covers the (already-clamped, ≤4K) frame size. Ordering by level matters:
 * probing a low-level string (e.g. baseline 3.0) against an HD frame reports
 * "unsupported", which is exactly what used to force the WebM fallback.
 * high@5.2 → main@5.2 → high@5.1 → high@5.0 → high@4.0 → baseline@4.0.
 */
const AVC_CODECS = [
  'avc1.640034',
  'avc1.4d0034',
  'avc1.640033',
  'avc1.640032',
  'avc1.640028',
  'avc1.42e028',
];
const WEBM_CANDIDATES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

// H.264 can't encode arbitrarily large frames — no level goes past ~4K, and
// hardware encoders (VideoToolbox etc.) cap there too. Clamp the VIDEO encode
// size into a 4K box so H.264 is always available; the High/Ultra quality tiers
// still render the canvas at high DPR and we downscale each frame for sharpness.
// (Still image export is unaffected and keeps full 8K.)
const MAX_H264_SIDE = 3840;
const MAX_H264_AREA = 3840 * 2160;

/** Largest even-dimensioned frame that fits the H.264 4K box, preserving aspect. */
function clampToH264(w: number, h: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_H264_SIDE / Math.max(w, h), Math.sqrt(MAX_H264_AREA / (w * h)));
  return {
    width: Math.max(2, Math.floor((w * scale) / 2) * 2),
    height: Math.max(2, Math.floor((h * scale) / 2) * 2),
  };
}

/** A reasonable H.264 bitrate for the given frame size / rate (8–40 Mbps). */
function avcBitrate(width: number, height: number, fps: number): number {
  return Math.min(40_000_000, Math.max(8_000_000, Math.round(width * height * fps * 0.07)));
}

function hasWebCodecs(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { VideoEncoder?: unknown }).VideoEncoder === 'function' &&
    typeof (window as unknown as { VideoFrame?: unknown }).VideoFrame === 'function'
  );
}

/** First H.264 codec string WebCodecs can actually encode at this size, or null. */
async function pickAvcCodec(width: number, height: number, framerate: number): Promise<string | null> {
  if (!hasWebCodecs() || typeof VideoEncoder.isConfigSupported !== 'function') return null;
  const bitrate = avcBitrate(width, height, framerate);
  for (const codec of AVC_CODECS) {
    try {
      const support = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate });
      if (support.supported) return codec;
    } catch {
      /* try next */
    }
  }
  return null;
}

function pickWebmMime(): string | null {
  const MR = (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  if (!MR || typeof MR.isTypeSupported !== 'function') return null;
  return WEBM_CANDIDATES.find((m) => MR.isTypeSupported(m)) ?? null;
}

export function videoSupported(): boolean {
  const canvasOk =
    typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;
  return hasWebCodecs() || (canvasOk && pickWebmMime() !== null);
}

export type VideoResult = { format: 'mp4' | 'webm' };

export async function exportVideo(gl: THREE.WebGLRenderer, opts: VideoOptions): Promise<VideoResult> {
  const canvas = gl.domElement as HTMLCanvasElement;
  // Clamp the encode size into H.264's 4K ceiling so MP4 is available at every
  // quality tier (High/Ultra render the canvas larger; we downscale per frame).
  const { width, height } = clampToH264(
    Math.max(2, canvas.width & ~1),
    Math.max(2, canvas.height & ~1),
  );

  const avcCodec = await pickAvcCodec(width, height, opts.fps);
  if (avcCodec) {
    await exportMp4WebCodecs(canvas, width, height, avcCodec, opts);
    return { format: 'mp4' };
  }
  await exportWebmMediaRecorder(canvas, opts);
  return { format: 'webm' };
}

/* ---- primary: WebCodecs H.264 -> faststart MP4 --------------------------- */

async function exportMp4WebCodecs(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  codec: string,
  opts: VideoOptions,
): Promise<void> {
  const { duration, fps } = opts;

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height, frameRate: fps },
    fastStart: 'in-memory', // moov at the front -> seekable, universally playable
    firstTimestampBehavior: 'offset',
  });

  let encodeError: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = e;
    },
  });
  encoder.configure({
    codec,
    width,
    height,
    bitrate: avcBitrate(width, height, fps),
    framerate: fps,
    latencyMode: 'quality',
  });

  // When the canvas differs from the encode size (odd dims, or downscaled from a
  // High/Ultra-DPR render), copy each frame through a matching 2D canvas so the
  // VideoFrame lines up with the encoder config.
  const needsResize = canvas.width !== width || canvas.height !== height;
  const scratch = needsResize ? document.createElement('canvas') : null;
  if (scratch) {
    scratch.width = width;
    scratch.height = height;
  }
  const scratchCtx = scratch ? scratch.getContext('2d') : null;
  if (scratchCtx) {
    scratchCtx.imageSmoothingEnabled = true;
    scratchCtx.imageSmoothingQuality = 'high';
  }

  const frameDurUs = 1_000_000 / fps;
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const start = performance.now();
  let frameIndex = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (encodeError) return reject(asError(encodeError));
        const elapsed = (performance.now() - start) / 1000;
        // Pace capture to the target fps: emit every frame whose time has passed.
        const dueFrames = Math.min(totalFrames, Math.floor(elapsed * fps) + 1);
        while (frameIndex < dueFrames) {
          let source: CanvasImageSource = canvas;
          if (scratchCtx && scratch) {
            scratchCtx.drawImage(canvas, 0, 0, width, height);
            source = scratch;
          }
          const frame = new VideoFrame(source, {
            timestamp: Math.round(frameIndex * frameDurUs),
            duration: Math.round(frameDurUs),
          });
          encoder.encode(frame, { keyFrame: frameIndex % (fps * 2) === 0 });
          frame.close();
          frameIndex++;
        }
        opts.onProgress?.(Math.min(frameIndex / totalFrames, 1));
        if (frameIndex >= totalFrames) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await encoder.flush();
    if (encodeError) throw asError(encodeError);
    muxer.finalize();

    const { buffer } = muxer.target;
    if (!buffer || buffer.byteLength === 0) {
      throw new Error('Video export produced an empty file.');
    }
    triggerDownload(new Blob([buffer], { type: 'video/mp4' }), opts.filename ?? defaultName('mp4'));
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
}

function asError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

/* ---- fallback: MediaRecorder WebM ---------------------------------------- */

async function exportWebmMediaRecorder(canvas: HTMLCanvasElement, opts: VideoOptions): Promise<void> {
  const { duration, fps } = opts;
  const mime = pickWebmMime();
  if (!mime) throw new Error('Video recording is not supported in this browser.');

  const stream = (canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 16_000_000 });

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

  if (recorder.state === 'recording') recorder.requestData();
  recorder.stop();
  await stopped;

  const blob = new Blob(chunks, { type: mime });
  if (blob.size === 0) throw new Error('Video export produced an empty file.');
  triggerDownload(blob, opts.filename ?? defaultName('webm'));
}

/* ---- shared -------------------------------------------------------------- */

function defaultName(ext: string): string {
  return `mockup-${Date.now()}.${ext}`;
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
