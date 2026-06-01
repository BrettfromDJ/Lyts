import { useState } from 'react';

const SHORTCUTS: [string, string][] = [
  ['Drag', 'Orbit'],
  ['⇧ Drag', 'Pan'],
  ['⌥ Drag', 'Perspective'],
  ['Scroll', 'Zoom'],
];

/** Compact on-canvas legend of the pointer shortcuts; collapses to an icon. */
export function ShortcutsOverlay() {
  const [open, setOpen] = useState(true);
  return (
    <div className={`shortcuts ${open ? 'open' : ''}`}>
      <button className="shortcuts-toggle" onClick={() => setOpen((o) => !o)} title="Shortcuts">
        <span className="kbd-icon">⌨</span>
        {open && <span className="chev">▾</span>}
      </button>
      {open && (
        <ul className="shortcuts-list">
          {SHORTCUTS.map(([k, v]) => (
            <li key={v}>
              <kbd>{k}</kbd>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
