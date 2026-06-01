import { useEffect } from 'react';
import { Scene } from './scene/Scene';
import { ControlPanel } from './ui/ControlPanel';
import { Uploader } from './ui/Uploader';
import { ExportBar } from './ui/ExportBar';
import { ShortcutsOverlay } from './ui/ShortcutsOverlay';
import { BlurOverlay } from './ui/BlurOverlay';
import { restoreLicense } from './lib/license';
import './App.css';

export default function App() {
  // Restore a previously activated Pro license (cached, fail-open).
  useEffect(() => {
    restoreLicense();
  }, []);

  return (
    <div className="app">
      <ControlPanel />
      <main className="stage">
        <Scene />
        <Uploader />
        <BlurOverlay />
        <ShortcutsOverlay />
        <ExportBar />
      </main>
    </div>
  );
}
