import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';
import { wrapEffect } from '@react-three/postprocessing';

/**
 * Tilt-shift style focus: a sharp band (position / size / angle) that blurs off
 * with a feathered falloff. Self-contained single-pass disc blur sampling the
 * input buffer directly (CONVOLUTION) — no internal render target, so it's
 * recreation-safe and every control responds independently. Replaces the
 * built-in TiltShift whose size/feather barely moved and could get stuck dark.
 */
const fragment = /* glsl */ `
uniform float uPosition;  // band centre, -0.5..0.5 across height
uniform float uSize;      // half-width of the sharp band (UV)
uniform float uFeather;   // transition softness (UV)
uniform float uAngle;     // band rotation (rad)
uniform float uBlur;      // max blur radius (UV, height units)
uniform float uAspect;    // width / height, keeps the blur circular

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 c = uv - 0.5;
  float axis = -c.x * sin(uAngle) + c.y * cos(uAngle);
  float dist = abs(axis - uPosition);
  float b = smoothstep(uSize, uSize + uFeather + 0.001, dist);
  float radius = b * uBlur;

  if (radius < 0.0008) {
    outputColor = inputColor;
    return;
  }

  // Even disc sampling via the golden angle (no radial spokes), plus a small
  // per-pixel rotation so any residual structure becomes noise the grain hides.
  const int SAMPLES = 64;
  const float GA = 2.39996323;
  float jitter = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453) * 6.28318;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < SAMPLES; i++) {
    float t = (float(i) + 0.5) / float(SAMPLES);
    float r = sqrt(t) * radius;
    float a = jitter + float(i) * GA;
    vec2 off = vec2(cos(a) * r / uAspect, sin(a) * r);
    acc += texture2D(inputBuffer, uv + off).rgb;
  }
  outputColor = vec4(acc / float(SAMPLES), inputColor.a);
}
`;

type Opts = {
  position?: number;
  size?: number;
  feather?: number;
  angle?: number;
  blur?: number;
};

class FocusEffectImpl extends Effect {
  constructor({ position = 0, size = 0.2, feather = 0.2, angle = 0, blur = 0 }: Opts = {}) {
    super('FocusEffect', fragment, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform<number>>([
        ['uPosition', new Uniform(position)],
        ['uSize', new Uniform(size)],
        ['uFeather', new Uniform(feather)],
        ['uAngle', new Uniform(angle)],
        ['uBlur', new Uniform(blur)],
        ['uAspect', new Uniform(1.6)],
      ]),
    });
  }

  setSize(width: number, height: number) {
    const a = this.uniforms.get('uAspect');
    if (a && height > 0) a.value = width / height;
  }
}

export const Focus = wrapEffect(FocusEffectImpl);
