import { useMockupStore } from '../store/useMockupStore';

/**
 * Phase 5 Pro gate (spec §5 + landmine §6.10).
 *
 * Reality check: a client-side tool is honor-system + friction, not DRM.
 * What's sold is the commercial license + high-res/video output. So:
 *   - validate ONCE against the Merchant-of-Record, then cache locally;
 *   - fail OPEN — never lock out a paying user over a network blip;
 *   - the gate is a single `isPro` boolean checked at each gated capability.
 *
 * The actual validate call is outsourced to the MoR (Lemon Squeezy /
 * Gumroad / Paddle) — no backend to host. Wire the real endpoint where
 * marked; the surrounding cache/fail-open logic stays identical.
 */

const STORAGE_KEY = 'lyts.license';

type CachedLicense = { key: string; validated: boolean; at: number };

const MOR_VALIDATE_URL = ''; // e.g. https://api.lemonsqueezy.com/v1/licenses/validate

async function callMoR(key: string): Promise<boolean> {
  // No endpoint configured yet -> dev/offline mode. Treat any non-trivial
  // key as valid so the Pro experience is exercisable end-to-end. Replace
  // with the real MoR call before shipping paid tiers.
  if (!MOR_VALIDATE_URL) return key.trim().length >= 6;

  try {
    const res = await fetch(MOR_VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ license_key: key }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { valid?: boolean };
    return !!data.valid;
  } catch {
    // Network blip: fail OPEN if we previously validated this exact key.
    const cached = readCache();
    return cached?.key === key && cached.validated;
  }
}

function readCache(): CachedLicense | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CachedLicense) : null;
  } catch {
    return null;
  }
}

function writeCache(c: CachedLicense) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    /* private mode — non-fatal */
  }
}

/** Activate a pasted license key. Returns whether Pro is now unlocked. */
export async function activateLicense(key: string): Promise<boolean> {
  const ok = await callMoR(key);
  if (ok) {
    writeCache({ key, validated: true, at: Date.now() });
    useMockupStore.getState().set({ isPro: true });
  }
  return ok;
}

/** Restore Pro from a previous activation on startup (cached + fail-open). */
export function restoreLicense() {
  const cached = readCache();
  if (cached?.validated) {
    useMockupStore.getState().set({ isPro: true });
    // Re-validate in the background; do NOT downgrade on transient failure.
    callMoR(cached.key).then((ok) => {
      if (!ok && MOR_VALIDATE_URL) {
        // Only a definitive negative from a real endpoint revokes.
        localStorage.removeItem(STORAGE_KEY);
        useMockupStore.getState().set({ isPro: false });
      }
    });
  }
}

export function deactivateLicense() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  useMockupStore.getState().set({ isPro: false });
}
