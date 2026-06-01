import { useMemo, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';
import { useMockupStore } from '../store/useMockupStore';

/**
 * Screen-space tilt-shift Focus: a sharp band (Position / Size / Angle) that
 * blurs off with a feathered falloff. Single-pass 64-tap golden-angle disc
 * (even coverage, no spokes) with a Bokeh highlight weighting. Instantiated
 * once and driven by live uniforms — no per-change recreation, so moving
 * Position never breaks or sticks.
 */
const fragment = /* glsl */ `
uniform float uPosition; // band centre, -0.5..0.5 across height
uniform float uSize;     // half-width of the sharp band (UV)
uniform float uFeather;  // transition softness (UV)
uniform float uAngle;    // band rotation (rad)
uniform float uBlur;     // max blur radius (UV)
uniform float uBokeh;    // highlight emphasis 0..1
uniform float uAspect;   // width / height

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 c = uv - 0.5;
  float axis = -c.x * sin(uAngle) + c.y * cos(uAngle);
  float b = smoothstep(uSize, uSize + uFeather + 0.001, abs(axis - uPosition));
  float radius = b * uBlur;

  if (radius < 0.0008) {
    outputColor = inputColor;
    return;
  }

  const int N = 64;
  const float GA = 2.39996323;
  float jitter = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453) * 6.28318;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < N; i++) {
    float t = (float(i) + 0.5) / float(N);
    float r = sqrt(t) * radius;
    float a = jitter + float(i) * GA;
    vec2 off = vec2(cos(a) * r / uAspect, sin(a) * r);
    vec3 col = texture2D(inputBuffer, uv + off).rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    float w = mix(1.0, 1.0 + lum * lum * 8.0, uBokeh);
    acc += col * w;
    wsum += w;
  }
  outputColor = vec4(acc / wsum, inputColor.a);
}
`;

class FocusImpl extends Effect {
  constructor() {
    super('FocusEffect', fragment, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform<number>>([
        ['uPosition', new Uniform(0)],
        ['uSize', new Uniform(0.25)],
        ['uFeather', new Uniform(0.2)],
        ['uAngle', new Uniform(0)],
        ['uBlur', new Uniform(0.025)],
        ['uBokeh', new Uniform(0.4)],
        ['uAspect', new Uniform(1.6)],
      ]),
    });
  }
  setSize(width: number, height: number) {
    const a = this.uniforms.get('uAspect');
    if (a && height > 0) a.value = width / height;
  }
}

const D2R = Math.PI / 180;
const MAX_RADIUS = 0.035;

export function Focus() {
  const invalidate = useThree((s) => s.invalidate);
  const focusDistance = useMockupStore((s) => s.focusDistance);
  const focusSize = useMockupStore((s) => s.focusSize);
  const focusFalloff = useMockupStore((s) => s.focusFalloff);
  const focusAngle = useMockupStore((s) => s.focusAngle);
  const blur = useMockupStore((s) => s.blur);
  const bokeh = useMockupStore((s) => s.bokeh);

  const effect = useMemo(() => new FocusImpl(), []);
  useEffect(() => () => effect.dispose(), [effect]);

  useEffect(() => {
    const u = effect.uniforms;
    u.get('uPosition')!.value = focusDistance - 0.5;
    u.get('uSize')!.value = focusSize * 0.5;
    u.get('uFeather')!.value = focusFalloff * 0.5;
    u.get('uAngle')!.value = focusAngle * D2R;
    u.get('uBlur')!.value = blur * MAX_RADIUS;
    u.get('uBokeh')!.value = bokeh;
    invalidate();
  }, [effect, focusDistance, focusSize, focusFalloff, focusAngle, blur, bokeh, invalidate]);

  return <primitive object={effect} dispose={null} />;
}
