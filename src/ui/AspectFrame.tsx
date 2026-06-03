import { useEffect, useRef, useState } from 'react';
import { useMockupStore } from '../store/useMockupStore';

/**
 * Shows the export crop region on the stage: the largest centred rectangle of
 * the chosen export aspect, with the area outside it dimmed. Matches the
 * centre-crop the still export performs. Sized by measuring the stage.
 */
function aspectValue(a: string, screenAspect: number): number {
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
      return screenAspect || 16 / 10;
  }
}

export function AspectFrame() {
  const exportAspect = useMockupStore((s) => s.exportAspect);
  const screenAspect = useMockupStore((s) => s.screenAspect);
  const av = aspectValue(exportAspect, screenAspect);

  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
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
  }, [av]);

  return (
    <div className="aspect-frame" ref={ref} aria-hidden>
      <div className="aspect-frame-box" style={{ width: box.w, height: box.h }} />
    </div>
  );
}
