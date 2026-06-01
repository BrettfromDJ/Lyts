import { Effect } from 'postprocessing';
import { Uniform } from 'three';
import { wrapEffect } from '@react-three/postprocessing';

/**
 * Film grain that re-seeds every rendered frame (spec §6 Phase 4: static grain
 * on a moving shot looks like dirt on the lens). In demand mode it's only
 * reseeded on the frames that actually render, so stills stay stable.
 */
const fragment = /* glsl */ `
uniform float uSeed;
uniform float uIntensity;
float hash(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 443.8975);
  p3 += dot(p3, p3.yzx + 19.19);
  return fract((p3.x + p3.y) * p3.z);
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  float n = hash(uv + vec2(uSeed, uSeed * 1.37)) - 0.5;
  // Filmic: most grain in the mid/highlights, keep deep blacks clean.
  float luma = dot(inputColor.rgb, vec3(0.299, 0.587, 0.114));
  float amt = uIntensity * (0.12 + 0.88 * luma);
  outputColor = vec4(inputColor.rgb + n * amt, inputColor.a);
}
`;

class GrainEffectImpl extends Effect {
  constructor({ intensity = 0.06 }: { intensity?: number } = {}) {
    super('GrainEffect', fragment, {
      uniforms: new Map([
        ['uSeed', new Uniform(0)],
        ['uIntensity', new Uniform(intensity)],
      ]),
    });
  }

  update() {
    const seed = this.uniforms.get('uSeed');
    if (seed) seed.value = Math.random() * 100.0;
  }
}

export const Grain = wrapEffect(GrainEffectImpl);
