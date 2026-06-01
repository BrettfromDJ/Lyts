import { useMemo, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform, Vector2 } from 'three';
import { useMockupStore } from '../store/useMockupStore';

/**
 * Photoshop-style screen-space Blur Gallery: a Tilt-Shift gradient and an Iris
 * (elliptical) mask, each producing a per-pixel blur amount, combined (sharpest
 * wins) and applied as a golden-angle disc blur. Bokeh "Effects" weight bright
 * samples (Light Bokeh) within a luminance window (Light Range) and can boost
 * their saturation (Bokeh Color). Positions are normalized with a top-left
 * origin to match the on-canvas overlay handles.
 */
const fragment = /* glsl */ `
uniform float uTsOn;
uniform vec2  uTsC;
uniform float uTsAngle;
uniform float uTsFocus;
uniform float uTsFeather;
uniform float uTsBlur;
uniform float uTsDistort;
uniform float uTsSym;

uniform float uIrisOn;
uniform vec2  uIrisC;
uniform vec2  uIrisR;
uniform float uIrisAngle;
uniform float uIrisRound;
uniform float uIrisFeather;
uniform float uIrisBlur;

uniform float uLightBokeh;
uniform float uBokehColor;
uniform vec2  uLightRange;
uniform float uAspect;

float tsT(vec2 p){
  vec2 perp = vec2(-sin(uTsAngle), cos(uTsAngle));
  float d = dot(p - uTsC, perp);
  float side = d < 0.0 ? -1.0 : 1.0;
  float feather = uTsFeather * (uTsSym > 0.5 ? 1.0 : (1.0 + uTsDistort * side));
  feather = max(feather, 0.002);
  return smoothstep(uTsFocus, uTsFocus + feather, abs(d));
}

float irisT(vec2 p){
  vec2 q = p - uIrisC;
  float ca = cos(uIrisAngle), sa = sin(uIrisAngle);
  vec2 lq = vec2(q.x * ca + q.y * sa, -q.x * sa + q.y * ca) / max(uIrisR, vec2(0.002));
  float e = mix(2.0, 8.0, uIrisRound);
  float d = pow(pow(abs(lq.x), e) + pow(abs(lq.y), e), 1.0 / e);
  return smoothstep(uIrisFeather, 1.0, d);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 p = vec2(uv.x, 1.0 - uv.y);
  float radius = 0.0;
  if (uTsOn > 0.5)   radius = max(radius, tsT(p)   * uTsBlur);
  if (uIrisOn > 0.5) radius = max(radius, irisT(p) * uIrisBlur);

  if (radius < 0.0008) {
    outputColor = inputColor;
    return;
  }

  const int N = 48;
  const float GA = 2.39996323;
  float jitter = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453) * 6.28318;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < N; i++) {
    float t = (float(i) + 0.5) / float(N);
    float r = sqrt(t) * radius;
    float a = jitter + float(i) * GA;
    vec2 off = vec2(cos(a) * r / uAspect, sin(a) * r);
    vec3 c = texture2D(inputBuffer, uv + off).rgb;
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    float inRange = step(uLightRange.x, lum) * step(lum, uLightRange.y);
    if (uBokehColor > 0.001 && inRange > 0.5) {
      c = mix(vec3(lum), c, 1.0 + uBokehColor * 1.6);
    }
    float w = mix(1.0, 1.0 + lum * lum * 8.0 * inRange, uLightBokeh);
    acc += c * w;
    wsum += w;
  }
  outputColor = vec4(acc / wsum, inputColor.a);
}
`;

class PhotoBlurImpl extends Effect {
  constructor() {
    super('PhotoBlurEffect', fragment, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform<number | Vector2>>([
        ['uTsOn', new Uniform(0)],
        ['uTsC', new Uniform(new Vector2(0.5, 0.5))],
        ['uTsAngle', new Uniform(0)],
        ['uTsFocus', new Uniform(0.08)],
        ['uTsFeather', new Uniform(0.18)],
        ['uTsBlur', new Uniform(0.03)],
        ['uTsDistort', new Uniform(0)],
        ['uTsSym', new Uniform(0)],
        ['uIrisOn', new Uniform(0)],
        ['uIrisC', new Uniform(new Vector2(0.5, 0.5))],
        ['uIrisR', new Uniform(new Vector2(0.3, 0.26))],
        ['uIrisAngle', new Uniform(0)],
        ['uIrisRound', new Uniform(0.3)],
        ['uIrisFeather', new Uniform(0.55)],
        ['uIrisBlur', new Uniform(0.03)],
        ['uLightBokeh', new Uniform(0)],
        ['uBokehColor', new Uniform(0)],
        ['uLightRange', new Uniform(new Vector2(0.7, 1))],
        ['uAspect', new Uniform(1.6)],
      ]),
    });
  }

  setSize(width: number, height: number) {
    const a = this.uniforms.get('uAspect');
    if (a && height > 0) (a.value as number) = width / height;
  }
}

const D2R = Math.PI / 180;
const MAX_RADIUS = 0.06; // uv units at blur = 1

export function PhotoBlur() {
  const invalidate = useThree((s) => s.invalidate);
  const s = useMockupStore();
  const effect = useMemo(() => new PhotoBlurImpl(), []);
  useEffect(() => () => effect.dispose(), [effect]);

  useEffect(() => {
    const u = effect.uniforms;
    const num = (k: string, v: number) => ((u.get(k)!.value as number) = v);
    const vec = (k: string, x: number, y: number) => (u.get(k)!.value as Vector2).set(x, y);
    num('uTsOn', s.tsEnabled ? 1 : 0);
    vec('uTsC', s.tsX, s.tsY);
    num('uTsAngle', s.tsAngle * D2R);
    num('uTsFocus', s.tsFocus);
    num('uTsFeather', s.tsFeather);
    num('uTsBlur', s.tsBlur * MAX_RADIUS);
    num('uTsDistort', s.tsDistort);
    num('uTsSym', s.tsSym ? 1 : 0);
    num('uIrisOn', s.irisEnabled ? 1 : 0);
    vec('uIrisC', s.irisX, s.irisY);
    vec('uIrisR', s.irisRX, s.irisRY);
    num('uIrisAngle', s.irisAngle * D2R);
    num('uIrisRound', s.irisRound);
    num('uIrisFeather', s.irisFeather);
    num('uIrisBlur', s.irisBlur * MAX_RADIUS);
    num('uLightBokeh', s.lightBokeh);
    num('uBokehColor', s.bokehColor);
    vec('uLightRange', s.lightRangeMin, s.lightRangeMax);
    invalidate();
  });

  return <primitive object={effect} dispose={null} />;
}
