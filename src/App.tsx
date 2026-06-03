import { Scene } from './scene/Scene';
import { ControlPanel } from './ui/ControlPanel';
import { Uploader } from './ui/Uploader';
import { ShortcutsOverlay } from './ui/ShortcutsOverlay';
import { AspectFrame } from './ui/AspectFrame';
import { RecordTimer } from './ui/RecordTimer';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <ControlPanel />
      <main className="stage">
        <Scene />
        <Uploader />
        <AspectFrame />
        <RecordTimer />
        <ShortcutsOverlay />
      </main>
    </div>
  );
}
