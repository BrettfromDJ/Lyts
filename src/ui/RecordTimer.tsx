import { useMockupStore } from '../store/useMockupStore';

/**
 * Video-recording timer shown over the stage while capturing. It's a DOM
 * overlay (not on the canvas), so it never ends up in the exported video.
 */
function fmt(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function RecordTimer() {
  const recording = useMockupStore((s) => s.recording);
  const elapsed = useMockupStore((s) => s.recordElapsed);
  const duration = useMockupStore((s) => s.videoDuration);
  if (!recording) return null;
  return (
    <div className="rec-timer">
      <span className="rec-dot" />
      <span className="rec-time">
        {fmt(elapsed)} / {fmt(duration)}
      </span>
    </div>
  );
}
