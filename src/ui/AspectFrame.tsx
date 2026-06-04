import { useEffect, useRef, useState } from 'react';
import { useMockupStore } from '../store/useMockupStore';

/**
 * Shows the export crop region on the stage: the largest centred rectangle of
 * the chosen export aspect, with the area outside it dimmed. Matches the
 * centre-crop the still export performs. Sized by measuring the stage.
 * For 'fullscreen' the whole stage is captured, so the guide fills it edge to
 * edge with no dimmed border.
 */
function aspectValue(a: string): number {
  switch (a) {
    case '1:1':
      return 1;
    case '4:5':
      return 4 / 5;
    case '16:9':
      return 16 / 9;
    case '9:16':
      return 9 / 16;
    default:
      return 0; // 'fullscreen' — fill the stage
  }
}

export function AspectFrame() {
  const exportAspect = useMockupStore((s) => s.exportAspect);
  const show = useMockupStore((s) => s.showCaptureFrame);
  const set = useMockupStore((s) => s.set);
  const av = aspectValue(exportAspect);
  const fullscreen = av === 0;

  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (fullscreen) {
        setBox({ w: el.clientWidth, h: el.clientHeight });
        return;
      }
      const pad = 36;
      const cw = el.clientWidth - pad * 2;
      const ch = el.clientHeight - pad * 2;
      if (cw <= 0 || ch <= 0) return;
      const w = cw / ch > av ? ch * av : cw;
      const h = cw / ch > av ? ch : cw / av;
      setBox({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [av, fullscreen]);

  return (
    <>
      {show && (
        <div className={`aspect-frame ${fullscreen ? 'fullscreen' : ''}`} ref={ref} aria-hidden>
          <div className="aspect-frame-box" style={{ width: box.w, height: box.h }} />
        </div>
      )}
      <button
        className={`frame-toggle ${show ? 'on' : ''}`}
        onClick={() => set({ showCaptureFrame: !show })}
        title={show ? 'Hide capture region' : 'Show capture region'}
      >
        ⛶
      </button>
    </>
  );
}
