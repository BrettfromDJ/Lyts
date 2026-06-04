import { useMemo, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';
import { useMockupStore } from '../store/useMockupStore';

/**
 * Analog/film suite in one pass (samples the input buffer): VHS tracking jitter
 * + chroma bleed, film halation (warm glow off highlights), glowing scanlines,
 * animated light leaks and lens dust. Each sub-effect is gated by its amount so
 * disabled ones cost nothing. Time advances in update() for the animated bits.
 */
const fragment = /* glsl */ `
uniform float uTime, uHalation, uLeaks, uScanGlow, uDust, uVhs, uAspect;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1,0)), c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 wuv = uv;

  // --- VHS tracking: per-line horizontal jitter + occasional tear + wobble ---
  if (uVhs > 0.001) {
    float line = floor(uv.y * 240.0);
    float j = hash(vec2(line, floor(uTime * 12.0))) - 0.5;
    float tear = smoothstep(0.93, 1.0, hash(vec2(floor(uTime * 2.5), floor(uv.y * 14.0))));
    wuv.x += (j * 0.010 + tear * 0.055) * uVhs;
    wuv.y += sin(uTime * 3.0 + uv.x * 5.0) * 0.0007 * uVhs;
  }

  // base sample (with VHS chroma bleed)
  vec3 col;
  if (uVhs > 0.001) {
    float ca = 0.004 * uVhs;
    col.r = texture2D(inputBuffer, wuv + vec2(ca, 0.0)).r;
    col.g = texture2D(inputBuffer, wuv).g;
    col.b = texture2D(inputBuffer, wuv - vec2(ca, 0.0)).b;
  } else {
    col = texture2D(inputBuffer, wuv).rgb;
  }

  // --- Halation: warm glow bleeding out of the highlights ---
  if (uHalation > 0.001) {
    float acc = 0.0;
    const int N = 16;
    for (int i = 0; i < N; i++) {
      float a = (float(i) + 0.5) / float(N) * 6.28318;
      vec2 dir = vec2(cos(a) / uAspect, sin(a));
      vec3 s1 = texture2D(inputBuffer, wuv + dir * 0.006).rgb;
      vec3 s2 = texture2D(inputBuffer, wuv + dir * 0.013).rgb;
      acc += max(max(max(s1.r, s1.g), s1.b) - 0.62, 0.0);
      acc += max(max(max(s2.r, s2.g), s2.b) - 0.62, 0.0) * 0.6;
    }
    acc /= float(N);
    col += vec3(1.0, 0.36, 0.12) * acc * uHalation * 3.0;
  }

  // --- Scanline glow: bright glowing horizontal lines ---
  if (uScanGlow > 0.001) {
    float s = 0.5 + 0.5 * sin(uv.y * 760.0);
    col += vec3(0.55, 0.72, 1.0) * pow(s, 3.0) * uScanGlow * 0.16;
  }

  // --- Light leaks: animated warm corner + drifting band (screen blend) ---
  if (uLeaks > 0.001) {
    float t = uTime * 0.18;
    float corner = smoothstep(1.05, 0.25, distance(uv, vec2(0.96, 0.04)));
    float band = smoothstep(0.45, 0.0, abs((uv.x + uv.y * 0.5) - (0.5 + 0.5 * sin(t))));
    vec3 leak = vec3(1.0, 0.5, 0.22) * corner + vec3(1.0, 0.28, 0.45) * band * 0.6;
    col = 1.0 - (1.0 - col) * (1.0 - leak * uLeaks * 0.75);
  }

  // --- Lens dust: faint static specks + dark motes ---
  if (uDust > 0.001) {
    vec2 dp = uv * vec2(uAspect, 1.0);
    col += smoothstep(0.92, 1.0, vnoise(dp * 190.0)) * uDust * 0.55;
    col *= 1.0 - smoothstep(0.95, 1.0, vnoise(dp * 95.0 + 31.0)) * uDust * 0.45;
  }

  outputColor = vec4(col, inputColor.a);
}
`;

class AnalogImpl extends Effect {
  constructor() {
    super('AnalogEffect', fragment, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform<number>>([
        ['uTime', new Uniform(0)],
        ['uHalation', new Uniform(0)],
        ['uLeaks', new Uniform(0)],
        ['uScanGlow', new Uniform(0)],
        ['uDust', new Uniform(0)],
        ['uVhs', new Uniform(0)],
        ['uAspect', new Uniform(1.6)],
      ]),
    });
  }
  setSize(width: number, height: number) {
    const a = this.uniforms.get('uAspect');
    if (a && height > 0) a.value = width / height;
  }
  update() {
    const t = this.uniforms.get('uTime');
    if (t) t.value = performance.now() * 0.001;
  }
}

export function Analog() {
  const invalidate = useThree((s) => s.invalidate);
  const halation = useMockupStore((s) => s.halation);
  const lightLeaks = useMockupStore((s) => s.lightLeaks);
  const scanGlow = useMockupStore((s) => s.scanGlow);
  const lensDust = useMockupStore((s) => s.lensDust);
  const vhs = useMockupStore((s) => s.vhs);

  const effect = useMemo(() => new AnalogImpl(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  useEffect(() => {
    const u = effect.uniforms;
    u.get('uHalation')!.value = halation;
    u.get('uLeaks')!.value = lightLeaks;
    u.get('uScanGlow')!.value = scanGlow;
    u.get('uDust')!.value = lensDust;
    u.get('uVhs')!.value = vhs;
    invalidate();
  }, [effect, halation, lightLeaks, scanGlow, lensDust, vhs, invalidate]);

  return <primitive object={effect} dispose={null} />;
}
