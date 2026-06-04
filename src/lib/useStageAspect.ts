import { useEffect, useState } from 'react';
import { sceneRef } from './sceneRef';

/**
 * Live aspect ratio (width / height) of the WebGL canvas / stage. Used by the
 * "Full screen" export option so the capture matches exactly what's on screen,
 * and tracks window/stage resizes.
 */
export function useStageAspect(): number {
  const [aspect, setAspect] = useState(() => stageAspect());
  useEffect(() => {
    const el = sceneRef.gl?.domElement;
    const measure = () => setAspect(stageAspect());
    measure();
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  return aspect;
}

/** Current canvas aspect (CSS size), falling back to the window aspect. */
export function stageAspect(): number {
  const el = sceneRef.gl?.domElement;
  const w = el?.clientWidth || window.innerWidth;
  const h = el?.clientHeight || window.innerHeight;
  return h > 0 ? w / h : 16 / 10;
}
