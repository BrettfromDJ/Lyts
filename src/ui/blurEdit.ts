import { useMockupStore } from '../store/useMockupStore';
import type { MockupState } from '../store/useMockupStore';

/**
 * Blur-gallery edit session: snapshot a tool's params on entry so Cancel can
 * restore them; OK just leaves edit mode (keeping the blur).
 */
const TS_KEYS = [
  'tsEnabled', 'tsX', 'tsY', 'tsAngle', 'tsFocus', 'tsFeather', 'tsBlur', 'tsDistort', 'tsSym',
] as const;
const IRIS_KEYS = [
  'irisEnabled', 'irisX', 'irisY', 'irisRX', 'irisRY', 'irisAngle', 'irisRound', 'irisFeather', 'irisBlur',
] as const;

let editSnapshot: Partial<MockupState> = {};

export function startBlurEdit(tool: 'ts' | 'iris') {
  const st = useMockupStore.getState();
  const keys = tool === 'ts' ? TS_KEYS : IRIS_KEYS;
  const snap: Partial<MockupState> = {};
  keys.forEach((k) => ((snap as Record<string, unknown>)[k] = st[k]));
  editSnapshot = snap;
  st.set({ [tool === 'ts' ? 'tsEnabled' : 'irisEnabled']: true, blurEditing: tool });
}

export function cancelBlurEdit() {
  useMockupStore.getState().set({ ...editSnapshot, blurEditing: 'none' });
}

export function okBlurEdit() {
  useMockupStore.getState().set({ blurEditing: 'none' });
}
