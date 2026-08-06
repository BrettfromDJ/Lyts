import { useCallback, useRef, useState } from 'react';
import { useMockupStore } from '../store/useMockupStore';
import {
  loadScreenTexture,
  loadScreenVideoTexture,
  disposeScreenTexture,
} from '../lib/useScreenTexture';

const ACCEPT = 'image/*,video/mp4,video/quicktime,video/webm';

/**
 * Drag/drop (or click, or paste) a screenshot or MP4 -> THREE.Texture in the
 * store. Images become a static texture, videos a looping VideoTexture.
 * Renders a full-canvas hint while empty, then collapses to a corner button.
 */
export function Uploader() {
  const set = useMockupStore((s) => s.set);
  const hasShot = useMockupStore((s) => s.screenshot != null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const isVideo = file.type.startsWith('video/');
      if (!isVideo && !file.type.startsWith('image/')) {
        setError('That isn’t an image or video file.');
        return;
      }
      try {
        const { texture, aspect } = isVideo
          ? await loadScreenVideoTexture(file)
          : await loadScreenTexture(file);
        disposeScreenTexture(useMockupStore.getState().screenshot);
        set({ screenshot: texture, screenAspect: aspect, screenIsVideo: isVideo });
        setError(null);
      } catch {
        setError(isVideo ? 'Couldn’t play that video.' : 'Couldn’t read that image.');
      }
    },
    [set],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  if (hasShot) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <button className="replace-btn" onClick={() => inputRef.current?.click()}>
          ↻ Replace
        </button>
      </>
    );
  }

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <div className="dropzone-inner">
        <div className="dropzone-icon">⤓</div>
        <h2>Drop a screenshot or video</h2>
        <p>or click to browse — PNG / JPG / MP4. It renders as a cinematic device shot.</p>
        {error && <p className="dropzone-error">{error}</p>}
      </div>
    </div>
  );
}
