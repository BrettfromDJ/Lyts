import { useMemo, useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';
import type { CrtBlend } from '../store/useMockupStore';
import { surfaceMetrics } from '../lib/deviceDims';

const CRT_BLEND_ID: Record<CrtBlend, number> = {
  normal: 0,
  screen: 1,
  add: 2,
  multiply: 3,
  overlay: 4,
  softlight: 5,
};

// GLSL injected into the screen material: the CRT pattern lives in surface UV
// space (vEmissiveMapUv), so it tilts/rotates with the screenshot instead of
// floating in screen space. Gated by uCrtEnabled so toggling needs no recompile.
const CRT_HEAD = /* glsl */ `
uniform float uCrtEnabled, uCrtOpacity, uCrtBlend, uCrtScanline, uCrtScanCount,
  uCrtGrille, uCrtFlicker, uCrtRoll, uCrtSpeed, uCrtCurve, uCrtTime, uCrtAspect;
vec3 lytsCrtBlend(vec3 b, vec3 o, int m){
  if(m==1) return 1.0-(1.0-b)*(1.0-o);                 // screen
  if(m==2) return b+o;                                 // add
  if(m==3) return b*o;                                 // multiply
  if(m==4) return mix(2.0*b*o, 1.0-2.0*(1.0-b)*(1.0-o), step(0.5,b)); // overlay
  if(m==5) return (1.0-2.0*o)*b*b + 2.0*o*b;           // soft light
  return o;                                            // normal
}
`;

const CRT_BODY = /* glsl */ `
#ifdef USE_EMISSIVEMAP
if(uCrtEnabled > 0.5){
  vec3 base = totalEmissiveRadiance;
  vec3 styled = base;
  vec2 cuv = vEmissiveMapUv;
  if(uCrtGrille > 0.001){
    float ph = mod(cuv.x * uCrtScanCount * uCrtAspect, 3.0);
    vec3 mask = ph < 1.0 ? vec3(1.0,0.55,0.55)
              : ph < 2.0 ? vec3(0.55,1.0,0.55) : vec3(0.55,0.55,1.0);
    styled *= mix(vec3(1.0), mask, uCrtGrille);
  }
  if(uCrtScanline > 0.001){
    float sl = 0.5 + 0.5*sin(cuv.y*uCrtScanCount*6.2831 - uCrtTime*uCrtSpeed*6.2831);
    styled *= 1.0 - uCrtScanline*(1.0-sl);
  }
  if(uCrtRoll > 0.001){
    float p = fract(cuv.y + uCrtTime*uCrtSpeed*0.15);
    styled += smoothstep(0.0,0.06,p)*(1.0-smoothstep(0.06,0.18,p))*uCrtRoll*0.22;
  }
  if(uCrtFlicker > 0.001){
    styled *= 1.0 - uCrtFlicker*0.12*fract(sin(floor(uCrtTime*60.0))*43758.5453);
  }
  if(uCrtCurve > 0.001){
    vec2 d = cuv-0.5;
    styled *= clamp(1.0 - dot(d,d)*uCrtCurve*1.7, 0.0, 1.0);
  }
  vec3 res = lytsCrtBlend(base, styled, int(uCrtBlend + 0.5));
  totalEmissiveRadiance = mix(base, res, uCrtOpacity);
}
#endif
`;

/**
 * The screenshot rendered as a flat surface (no device body) — laid in the XZ
 * plane and centred at the origin, so a grazing camera rakes across it with
 * strong perspective and the post-stack DOF leaves a cinematic band of focus.
 *
 * The screenshot is self-lit (emissive) so it reads regardless of the
 * environment, exactly like a screen. An optional faint glass sheen adds the
 * "photographed" reflection without washing the content.
 */
export function DeviceMesh() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  const screenshot = useMockupStore((s) => s.screenshot);
  const screenAspect = useMockupStore((s) => s.screenAspect);
  const screenBrightness = useMockupStore((s) => s.screenBrightness);
  const reflectionIntensity = useMockupStore((s) => s.reflectionIntensity);
  const glassRoughness = useMockupStore((s) => s.glassRoughness);
  const tiltX = useMockupStore((s) => s.tiltX);
  const tiltZ = useMockupStore((s) => s.tiltZ);

  const crtEnabled = useMockupStore((s) => s.crtEnabled);
  const crtBlend = useMockupStore((s) => s.crtBlend);
  const crtOpacity = useMockupStore((s) => s.crtOpacity);
  const crtScanline = useMockupStore((s) => s.crtScanline);
  const crtScanCount = useMockupStore((s) => s.crtScanCount);
  const crtGrille = useMockupStore((s) => s.crtGrille);
  const crtFlicker = useMockupStore((s) => s.crtFlicker);
  const crtRoll = useMockupStore((s) => s.crtRoll);
  const crtSpeed = useMockupStore((s) => s.crtSpeed);
  const crtCurve = useMockupStore((s) => s.crtCurve);

  const { w, h } = useMemo(() => surfaceMetrics(screenAspect), [screenAspect]);

  const screenRef = useRef<THREE.MeshStandardMaterial>(null);
  const crtUniforms = useRef<Record<string, THREE.IUniform>>({});

  // Inject the CRT pattern into the standard material's emissive output, in
  // surface UV space. Initial uniform values read live from the store.
  const onBeforeCompile = useCallback((shader: THREE.WebGLProgramParametersWithUniforms) => {
    const s = useMockupStore.getState();
    const u: Record<string, THREE.IUniform> = {
      uCrtEnabled: { value: s.crtEnabled ? 1 : 0 },
      uCrtOpacity: { value: s.crtOpacity },
      uCrtBlend: { value: CRT_BLEND_ID[s.crtBlend] },
      uCrtScanline: { value: s.crtScanline },
      uCrtScanCount: { value: s.crtScanCount },
      uCrtGrille: { value: s.crtGrille },
      uCrtFlicker: { value: s.crtFlicker },
      uCrtRoll: { value: s.crtRoll },
      uCrtSpeed: { value: s.crtSpeed },
      uCrtCurve: { value: s.crtCurve },
      uCrtTime: { value: 0 },
      uCrtAspect: { value: s.screenAspect || 1.6 },
    };
    Object.assign(shader.uniforms, u);
    crtUniforms.current = shader.uniforms;
    shader.fragmentShader =
      CRT_HEAD +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n' + CRT_BODY,
      );
  }, []);

  // Recompile the material when the screenshot arrives (it first builds with no
  // map/emissiveMap define) and refresh the texture on the GPU.
  useEffect(() => {
    if (screenshot) {
      screenshot.anisotropy = gl.capabilities.getMaxAnisotropy();
      screenshot.needsUpdate = true;
    }
    if (screenRef.current) screenRef.current.needsUpdate = true;
    invalidate();
  }, [screenshot, gl, invalidate]);

  // Push CRT control changes to the live uniforms.
  useEffect(() => {
    const u = crtUniforms.current;
    if (!u.uCrtEnabled) return;
    u.uCrtEnabled.value = crtEnabled ? 1 : 0;
    u.uCrtOpacity.value = crtOpacity;
    u.uCrtBlend.value = CRT_BLEND_ID[crtBlend];
    u.uCrtScanline.value = crtScanline;
    u.uCrtScanCount.value = crtScanCount;
    u.uCrtGrille.value = crtGrille;
    u.uCrtFlicker.value = crtFlicker;
    u.uCrtRoll.value = crtRoll;
    u.uCrtSpeed.value = crtSpeed;
    u.uCrtCurve.value = crtCurve;
    u.uCrtAspect.value = screenAspect || 1.6;
    invalidate();
  }, [
    crtEnabled, crtBlend, crtOpacity, crtScanline, crtScanCount, crtGrille,
    crtFlicker, crtRoll, crtSpeed, crtCurve, screenAspect, invalidate,
  ]);

  // Advance CRT time while enabled (Scene runs the frameloop continuously).
  useFrame(() => {
    const u = crtUniforms.current;
    if (crtEnabled && u.uCrtTime) u.uCrtTime.value = performance.now() * 0.001;
  });

  return (
    <group
      rotation={[THREE.MathUtils.degToRad(tiltX), 0, THREE.MathUtils.degToRad(tiltZ)]}
    >
      {/* the screenshot surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          ref={screenRef}
          map={screenshot ?? null}
          emissiveMap={screenshot ?? null}
          emissive={screenshot ? '#ffffff' : '#0a0c12'}
          emissiveIntensity={screenshot ? screenBrightness : 0}
          color={screenshot ? '#000000' : '#11141c'}
          roughness={1}
          metalness={0}
          toneMapped
          onBeforeCompile={onBeforeCompile}
        />
      </mesh>

      {/* faint glass sheen just above the surface */}
      {reflectionIntensity > 0.01 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <planeGeometry args={[w, h]} />
          <meshPhysicalMaterial
            color="#ffffff"
            metalness={0}
            roughness={glassRoughness}
            transparent
            opacity={0.03}
            clearcoat={0.35}
            clearcoatRoughness={Math.max(glassRoughness, 0.25)}
            ior={1.4}
            envMapIntensity={reflectionIntensity * 0.45}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
