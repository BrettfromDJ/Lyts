import { useEffect, useState } from 'react';
import { Scene } from './scene/Scene';
import { ControlPanel } from './ui/ControlPanel';
import { Uploader } from './ui/Uploader';
import { ShortcutsOverlay } from './ui/ShortcutsOverlay';
import { AspectFrame } from './ui/AspectFrame';
import { RecordTimer } from './ui/RecordTimer';
import './App.css';

export default function App() {
  const [uiHidden, setUiHidden] = useState(false);

  // Toggle with the H key too (ignored while typing in a control).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'h' && e.key !== 'H') return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
      e.preventDefault();
      setUiHidden((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`app${uiHidden ? ' ui-hidden' : ''}`}>
      <ControlPanel />
      <main className="stage">
        <Scene />
        <Uploader />
        <AspectFrame />
        <RecordTimer />
        <ShortcutsOverlay />
      </main>
      <button
        className="eye-toggle"
        onClick={() => setUiHidden((v) => !v)}
        title={uiHidden ? 'Show interface (H)' : 'Hide interface (H)'}
        aria-label={uiHidden ? 'Show interface' : 'Hide interface'}
        aria-pressed={uiHidden}
      >
        {uiHidden ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.6 6.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.3 4M6.3 6.3A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
