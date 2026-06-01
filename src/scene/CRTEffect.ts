import { Effect } from 'postprocessing';
import { Uniform } from 'three';
import { wrapEffect } from '@react-three/postprocessing';

/**
 * Animated CRT overlay: RGB phosphor mask, drifting scanlines, a rolling
 * refresh bar, flicker and a tube vignette. Time advances in update() (driven
 * by the always-on frameloop while enabled). Overall strength + compositing is
 * controlled by the wrapper's `opacity` and `blendFunction` (blend mode).
 */
const fragment = /* glsl */ `
uniform float uTime;
uniform float uScanline;
uniform float uScanCount;
uniform float uGrille;
uniform float uFlicker;
uniform float uRoll;
uniform float uSpeed;
uniform float uCurve;

float hash(float n){ return fract(sin(n) * 43758.5453); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec3 col = inputColor.rgb;

  // RGB phosphor stripes (aperture grille) across device pixels
  if (uGrille > 0.001) {
    float m = mod(gl_FragCoord.x, 3.0);
    vec3 mask = m < 1.0 ? vec3(1.0, 0.55, 0.55)
              : m < 2.0 ? vec3(0.55, 1.0, 0.55)
              :           vec3(0.55, 0.55, 1.0);
    col *= mix(vec3(1.0), mask, uGrille);
  }

  // drifting scanlines
  if (uScanline > 0.001) {
    float sl = 0.5 + 0.5 * sin(uv.y * uScanCount * 6.2831 - uTime * uSpeed * 6.2831);
    col *= 1.0 - uScanline * (1.0 - sl);
  }

  // rolling refresh bar
  if (uRoll > 0.001) {
    float pos = fract(uv.y + uTime * uSpeed * 0.15);
    float bar = smoothstep(0.0, 0.06, pos) * (1.0 - smoothstep(0.06, 0.18, pos));
    col += bar * uRoll * 0.22;
  }

  // brightness flicker (per ~1/60s tick)
  if (uFlicker > 0.001) {
    col *= 1.0 - uFlicker * 0.12 * hash(floor(uTime * 60.0));
  }

  // tube vignette
  if (uCurve > 0.001) {
    vec2 d = uv - 0.5;
    col *= clamp(1.0 - dot(d, d) * uCurve * 1.7, 0.0, 1.0);
  }

  outputColor = vec4(col, inputColor.a);
}
`;

type Opts = {
  scanline?: number;
  scanCount?: number;
  grille?: number;
  flicker?: number;
  roll?: number;
  speed?: number;
  curve?: number;
};

class CRTEffectImpl extends Effect {
  constructor({
    scanline = 0.5,
    scanCount = 480,
    grille = 0.25,
    flicker = 0.25,
    roll = 0.15,
    speed = 0.6,
    curve = 0.15,
  }: Opts = {}) {
    super('CRTEffect', fragment, {
      uniforms: new Map<string, Uniform<number>>([
        ['uTime', new Uniform(0)],
        ['uScanline', new Uniform(scanline)],
        ['uScanCount', new Uniform(scanCount)],
        ['uGrille', new Uniform(grille)],
        ['uFlicker', new Uniform(flicker)],
        ['uRoll', new Uniform(roll)],
        ['uSpeed', new Uniform(speed)],
        ['uCurve', new Uniform(curve)],
      ]),
    });
  }

  update() {
    const t = this.uniforms.get('uTime');
    if (t) t.value = performance.now() * 0.001;
  }
}

export const CRT = wrapEffect(CRTEffectImpl);
