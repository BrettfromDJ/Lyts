# Lyts — Cinematic Isometric Mockup Tool

Upload a screenshot → render it as a cinematic, iso-ish device mockup that looks
**photographed on a high-end DSLR**, not CSS-transformed. Fully client-side
(no accounts, no backend), real-time WebGL.

> The one principle (spec §0): this is a **real-time 3D rendering problem, not a
> CSS one.** A `PerspectiveCamera` at a long focal length (narrow FOV) on a
> diagonal tilt reads "isometric" while keeping real perspective — so
> depth-of-field and bokeh fall off gorgeously across the device.

## Stack

- **Vite + React + TypeScript**
- **three** · **@react-three/fiber** · **@react-three/drei**
- **@react-three/postprocessing** (`postprocessing`) — the DSLR layer
- **zustand** — the parameter store ("the spine")

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + vite build
npm run lint
```

## What's implemented

**Phase 1 — photoreal still.** Upload (drag/drop/click) → screenshot rendered as
a flat surface raked at a grazing angle (no device body) → perspective camera
with an editorial roll → procedural studio HDRI (Lightformers, offline-safe) →
ACES filmic tonemapping with correct sRGB. The post-stack DOF leaves a
cinematic band of focus across the receding surface.

**Phase 2 — full post stack + custom UI.** `EffectComposer` with DepthOfField,
Bloom, BrightnessContrast, ChromaticAberration, Vignette, and a per-frame-ready
grain pass (last). Grouped `ControlPanel`: Camera · Geometry · Screen · Lighting
· Post · Background.

**Phase 3 — presets + export.** Curated looks (Studio Soft, Moody Noir, Bright
SaaS, Golden Hour, Neon) + user save/load presets as JSON. Supersampled still
export (1×/2×/4×) via temporary buffer upscale → `toBlob`. Transparent PNG when
`bgMode === 'transparent'`.

**Phase 5 — Pro gate (architecture).** A single `isPro` selector gates the
*output*, not creation: watermark (composited into the export buffer, never a
DOM overlay), high-res ≥4×, and alpha PNG. License flow is wired to an
outsourced Merchant-of-Record (`src/lib/license.ts`): validate once, cache in
`localStorage`, **fail open**. Set `MOR_VALIDATE_URL` to go live; until then any
6+ char key unlocks Pro for testing.

> **Phase 4 (animation + WebM/MP4 export)** is scoped but not built — the store,
> `frameloop`, grain pass, and gate points are all staged for it.

## Architecture (the spine)

Everything reads/writes one zustand store (`src/store/useMockupStore.ts`). The
full state shape is defined up front so a preset is literally a
`Partial<MockupState>` JSON object. Controls write to the store; scene
components subscribe via selectors — **never lifted into React state**, so
slider drags don't re-render the tree. `frameloop="demand"` renders only on
change.

```
src/
  store/   useMockupStore.ts (spine) · presets.ts
  scene/   Scene · CameraRig · DeviceMesh (screenshot surface) · Lighting · Effects
  ui/      ControlPanel · Uploader · ExportBar
  lib/     useScreenTexture · exportImage · textures · sceneRef · license
```

## Landmines handled (spec §6)

1. Uploaded texture `colorSpace = SRGBColorSpace`.
2. `preserveDrawingBuffer: true` so export isn't blank.
3. ACES tonemapping on the renderer (non-optional).
4. Modest emissive — Bloom does the glow.
5. `envMapIntensity` wired on body + glass (the reflection realism dial).
6. Parameters in zustand via selectors, not React state.
7. `frameloop="demand"` for the still tool.
8. Grain composited last, after DOF/bloom.
9. Watermark composited into the export bitmap; `isPro` skips it.
10. License validated once, cached, fails open.
