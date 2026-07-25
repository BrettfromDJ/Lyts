import { useMemo, useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useMockupStore } from '../store/useMockupStore';
import type { CrtBlend, CrtMode } from '../store/useMockupStore';
import { surfaceMetrics } from '../lib/deviceDims';

const CRT_BLEND_ID: Record<CrtBlend, number> = {
  normal: 0,
  screen: 1,
  add: 2,
  multiply: 3,
  overlay: 4,
  softlight: 5,
};

const CRT_MODE_ID: Record<CrtMode, number> = {
  aperture: 0,
  shadow: 1,
  slot: 2,
  lcd: 3,
  mono: 4,
};

// GLSL injected into the screen material: the CRT pattern lives in surface UV
// space (vEmissiveMapUv), so it tilts/rotates with the screenshot instead of
// floating in screen space. Gated by uCrtEnabled so toggling needs no recompile.
const CRT_HEAD = /* glsl */ `
uniform float uCrtEnabled, uCrtOpacity, uCrtBlend, uCrtScanline, uCrtScanCount,
  uCrtGrille, uCrtFlicker, uCrtRoll, uCrtSpeed, uCrtCurve, uCrtTime, uCrtAspect, uCrtMode,
  uCornerRadius, uHalation, uLeaks, uDust, uDatamosh;
uniform vec3 uCrtTint;
float lytsHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float lytsNoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = lytsHash(i), b = lytsHash(i + vec2(1,0)), c = lytsHash(i + vec2(0,1)), d = lytsHash(i + vec2(1,1));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
vec3 lytsCrtBlend(vec3 b, vec3 o, int m){
  if(m==1) return 1.0-(1.0-b)*(1.0-o);                 // screen
  if(m==2) return b+o;                                 // add
  if(m==3) return b*o;                                 // multiply
  if(m==4) return mix(2.0*b*o, 1.0-2.0*(1.0-b)*(1.0-o), step(0.5,b)); // overlay
  if(m==5) return (1.0-2.0*o)*b*b + 2.0*o*b;           // soft light
  return o;                                            // normal
}
// Phosphor mask per CRT mode. cuv = surface UV, density = cells across height.
vec3 lytsCrtMask(vec2 cuv, float density, float aspect, int mode){
  vec3 R = vec3(1.0, 0.55, 0.55), G = vec3(0.55, 1.0, 0.55), B = vec3(0.55, 0.55, 1.0);
  vec2 cell = cuv * vec2(density * aspect, density);
  if(mode == 1){ // shadow mask — staggered RGB dot trios
    float row = floor(cell.y);
    float ph = mod(floor(cell.x + mod(row, 2.0) * 1.5), 3.0);
    vec3 m = ph < 1.0 ? R : ph < 2.0 ? G : B;
    float dy = abs(fract(cell.y) - 0.5) * 2.0;
    return m * mix(1.0, 0.4, smoothstep(0.55, 1.0, dy));
  }
  if(mode == 2){ // slot mask — staggered vertical slots
    float ph = mod(floor(cell.x), 3.0);
    vec3 m = ph < 1.0 ? R : ph < 2.0 ? G : B;
    float slot = step(0.2, fract(cell.y * 0.5 + mod(floor(cell.x / 3.0), 2.0) * 0.5));
    return m * mix(0.4, 1.0, slot);
  }
  if(mode == 3){ // LCD — square RGB subpixels with a dark grid
    float ph = mod(floor(cell.x), 3.0);
    vec3 m = ph < 1.0 ? R : ph < 2.0 ? G : B;
    float px = cell.x / 3.0;
    float gx = smoothstep(0.0, 0.14, fract(px)) * smoothstep(0.0, 0.14, 1.0 - fract(px));
    float gy = smoothstep(0.0, 0.14, fract(cell.y)) * smoothstep(0.0, 0.14, 1.0 - fract(cell.y));
    return m * mix(0.22, 1.0, gx * gy);
  }
  // aperture grille (Trinitron) — smooth vertical RGB stripes
  float ph = mod(cuv.x * density * aspect, 3.0);
  return ph < 1.0 ? R : ph < 2.0 ? G : B;
}
`;

const CRT_BODY = /* glsl */ `
#ifdef USE_EMISSIVEMAP
{
  // rounded corners (rounded-box SDF in aspect-corrected UV space)
  float r = min(uCornerRadius, min(0.5 * uCrtAspect, 0.5));
  if(r > 0.0005){
    vec2 cq = (vEmissiveMapUv - 0.5); cq.x *= uCrtAspect;
    vec2 q2 = abs(cq) - vec2(0.5 * uCrtAspect, 0.5) + r;
    float sd = min(max(q2.x, q2.y), 0.0) + length(max(q2, 0.0)) - r;
    if(sd > 0.0) discard;
  }

  // ---- Film effects, in the screen's UV space ----
  vec2 fuv = vEmissiveMapUv;
  // datamosh: per-row block horizontal displacement (smooth ramp)
  if(uDatamosh > 0.001){
    float by = floor(fuv.y * 28.0);
    float seed = floor(uCrtTime * 7.0);
    float dmAct = step(1.0 - uDatamosh, lytsHash(vec2(by * 0.13, seed)));
    fuv.x += dmAct * (lytsHash(vec2(by, seed + 5.0)) - 0.5) * uDatamosh * 0.28;
  }
  vec3 base = texture2D(emissiveMap, fuv).rgb * emissive;
  if(uDatamosh > 0.001){
    float by = floor(fuv.y * 28.0);
    float seed = floor(uCrtTime * 7.0);
    if(step(1.0 - uDatamosh, lytsHash(vec2(by * 0.13, seed))) > 0.5){
      float o = uDatamosh * 0.012;
      base.r = texture2D(emissiveMap, fuv + vec2(o, 0.0)).r * emissive.r;
      base.b = texture2D(emissiveMap, fuv - vec2(o, 0.0)).b * emissive.b;
    }
  }
  vec3 styled = base;

  // halation — warm glow bleeding from the screen's highlights
  if(uHalation > 0.001){
    float acc = 0.0;
    for(int i = 0; i < 12; i++){
      float a = (float(i) + 0.5) / 12.0 * 6.28318;
      vec2 dir = vec2(cos(a) / uCrtAspect, sin(a));
      vec3 s = texture2D(emissiveMap, fuv + dir * 0.012).rgb * emissive;
      acc += max(max(max(s.r, s.g), s.b) - 0.6, 0.0);
    }
    styled += vec3(1.0, 0.36, 0.12) * (acc / 12.0) * uHalation * 3.0;
  }
  // light leaks — animated warm corner + drifting band (screen blend)
  if(uLeaks > 0.001){
    float t = uCrtTime * 0.18;
    float corner = smoothstep(1.05, 0.25, distance(fuv, vec2(0.96, 0.04)));
    float band = smoothstep(0.45, 0.0, abs((fuv.x + fuv.y * 0.5) - (0.5 + 0.5 * sin(t))));
    vec3 leak = vec3(1.0, 0.5, 0.22) * corner + vec3(1.0, 0.28, 0.45) * band * 0.6;
    styled = 1.0 - (1.0 - styled) * (1.0 - leak * uLeaks * 0.75);
  }
  // lens dust — specks + dark motes
  if(uDust > 0.001){
    vec2 dp = fuv * vec2(uCrtAspect, 1.0);
    styled += smoothstep(0.92, 1.0, lytsNoise(dp * 190.0)) * uDust * 0.55;
    styled *= 1.0 - smoothstep(0.95, 1.0, lytsNoise(dp * 95.0 + 31.0)) * uDust * 0.45;
  }
  totalEmissiveRadiance = styled;

  // ---- CRT, on top of the film look ----
  if(uCrtEnabled > 0.5){
    vec3 cbase = totalEmissiveRadiance;
    vec3 cstyled = cbase;
    vec2 cuv = vEmissiveMapUv;
    if(uCrtMode > 3.5){
      float l = dot(cstyled, vec3(0.299, 0.587, 0.114));
      cstyled = mix(cstyled, l * uCrtTint, uCrtGrille);
    } else if(uCrtGrille > 0.001){
      vec3 mask = lytsCrtMask(cuv, uCrtScanCount, uCrtAspect, int(uCrtMode + 0.5));
      cstyled *= mix(vec3(1.0), mask, uCrtGrille);
    }
    if(uCrtScanline > 0.001){
      float sl = 0.5 + 0.5*sin(cuv.y*uCrtScanCount*6.2831 - uCrtTime*uCrtSpeed*6.2831);
      cstyled *= 1.0 - uCrtScanline*(1.0-sl);
    }
    if(uCrtRoll > 0.001){
      float p = fract(cuv.y + uCrtTime*uCrtSpeed*0.15);
      cstyled += smoothstep(0.0,0.06,p)*(1.0-smoothstep(0.06,0.18,p))*uCrtRoll*0.22;
    }
    if(uCrtFlicker > 0.001){
      float fa = fract(sin(floor(uCrtTime*24.0))*43758.5453);
      float fb = fract(sin(floor(uCrtTime*70.0)+1.7)*12543.13);
      cstyled *= 1.0 - uCrtFlicker*(0.12 + 0.5*fa*fb);
    }
    if(uCrtCurve > 0.001){
      vec2 d = cuv-0.5;
      cstyled *= clamp(1.0 - dot(d,d)*uCrtCurve*1.7, 0.0, 1.0);
    }
    vec3 res = lytsCrtBlend(cbase, cstyled, int(uCrtBlend + 0.5));
    totalEmissiveRadiance = mix(cbase, res, uCrtOpacity);
  }
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
  const thickness = useMockupStore((s) => s.thickness);
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
  const crtMode = useMockupStore((s) => s.crtMode);
  const crtTint = useMockupStore((s) => s.crtTint);
  const cornerRadius = useMockupStore((s) => s.cornerRadius);
  const halation = useMockupStore((s) => s.halation);
  const lightLeaks = useMockupStore((s) => s.lightLeaks);
  const lensDust = useMockupStore((s) => s.lensDust);
  const datamosh = useMockupStore((s) => s.datamosh);

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
      uCrtMode: { value: CRT_MODE_ID[s.crtMode] },
      uCrtTint: { value: new THREE.Color(s.crtTint) },
      uCornerRadius: { value: s.cornerRadius },
      uHalation: { value: s.halation },
      uLeaks: { value: s.lightLeaks },
      uDust: { value: s.lensDust },
      uDatamosh: { value: s.datamosh },
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
    if (u.uCrtMode) u.uCrtMode.value = CRT_MODE_ID[crtMode];
    if (u.uCrtTint) (u.uCrtTint.value as THREE.Color).set(crtTint);
    if (u.uCornerRadius) u.uCornerRadius.value = cornerRadius;
    if (u.uHalation) u.uHalation.value = halation;
    if (u.uLeaks) u.uLeaks.value = lightLeaks;
    if (u.uDust) u.uDust.value = lensDust;
    if (u.uDatamosh) u.uDatamosh.value = datamosh;
    invalidate();
  }, [
    crtEnabled, crtBlend, crtOpacity, crtScanline, crtScanCount, crtGrille,
    crtFlicker, crtRoll, crtSpeed, crtCurve, crtMode, crtTint, cornerRadius,
    halation, lightLeaks, lensDust, datamosh, screenAspect, invalidate,
  ]);

  // Redraw the body slab on thickness change (geometry, demand frameloop).
  useEffect(() => {
    invalidate();
  }, [thickness, invalidate]);

  // Advance surface time while CRT or an animated film effect is on.
  const animated = crtEnabled || lightLeaks > 0 || datamosh > 0;
  useFrame(() => {
    const u = crtUniforms.current;
    if (animated && u.uCrtTime) u.uCrtTime.value = performance.now() * 0.001;
  });

  // Empty state (no upload): show nothing — keep the stage pure black.
  if (!screenshot) return null;

  // Corner radius for the body slab (world units), matched to the screen's and
  // safely bounded so it never exceeds half the slab's smallest dimension.
  const bodyRadius = Math.max(0.001, Math.min(cornerRadius * h, thickness * 0.45));

  return (
    <group
      rotation={[THREE.MathUtils.degToRad(tiltX), 0, THREE.MathUtils.degToRad(tiltZ)]}
    >
      {/* device body — gives the screen physical depth (thickness > 0) */}
      {thickness > 0.001 && (
        <RoundedBox
          args={[w, thickness, h]}
          radius={bodyRadius}
          smoothness={3}
          position={[0, -thickness / 2 - 0.003, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#0c0c0e" metalness={0.35} roughness={0.42} />
        </RoundedBox>
      )}

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
