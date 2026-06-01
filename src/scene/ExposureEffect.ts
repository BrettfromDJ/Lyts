import { Effect } from 'postprocessing';
import { Uniform } from 'three';
import { wrapEffect } from '@react-three/postprocessing';

/**
 * Exposure as a linear multiply, applied BEFORE bloom/tone-mapping. Needed
 * because @react-three/postprocessing's EffectComposer forces the renderer to
 * NoToneMapping, so the built-in `gl.toneMappingExposure` does nothing — this
 * restores a working exposure control. ACES tone-mapping is then done by a
 * ToneMapping pass downstream.
 */
const fragment = /* glsl */ `
uniform float uExposure;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  outputColor = vec4(inputColor.rgb * uExposure, inputColor.a);
}
`;

class ExposureEffectImpl extends Effect {
  constructor({ exposure = 1 }: { exposure?: number } = {}) {
    super('ExposureEffect', fragment, {
      uniforms: new Map([['uExposure', new Uniform(exposure)]]),
    });
  }
}

export const Exposure = wrapEffect(ExposureEffectImpl);
