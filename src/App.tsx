import { useEffect } from 'react';
import { Scene } from './scene/Scene';
import { ControlPanel } from './ui/ControlPanel';
import { Uploader } from './ui/Uploader';
import { ExportBar } from './ui/ExportBar';
import { ShortcutsOverlay } from './ui/ShortcutsOverlay';
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
        <ShortcutsOverlay />
        <ExportBar />
      </main>
    </div>
  );
}
