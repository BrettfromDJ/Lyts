import { useCallback, useRef, useState } from 'react';
import { useMockupStore } from '../store/useMockupStore';
import { loadScreenTexture } from '../lib/useScreenTexture';

/**
 * Drag/drop (or click, or paste) a screenshot -> THREE.Texture in the store.
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
      if (!file.type.startsWith('image/')) {
        setError('That isn’t an image file.');
        return;
      }
      try {
        const { texture, aspect } = await loadScreenTexture(file);
        const prev = useMockupStore.getState().screenshot;
        prev?.dispose();
        set({ screenshot: texture, screenAspect: aspect });
        setError(null);
      } catch {
        setError('Couldn’t read that image.');
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
          accept="image/*"
          hidden
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <button className="replace-btn" onClick={() => inputRef.current?.click()}>
          ↻ Replace screenshot
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
        accept="image/*"
        hidden
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <div className="dropzone-inner">
        <div className="dropzone-icon">⤓</div>
        <h2>Drop a screenshot</h2>
        <p>or click to browse — PNG / JPG. It renders as a cinematic device shot.</p>
        {error && <p className="dropzone-error">{error}</p>}
      </div>
    </div>
  );
}
