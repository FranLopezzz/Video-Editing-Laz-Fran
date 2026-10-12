import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';

// Haz volumétrico de la lámpara (single scattering), con la sombra VSM de la SpotLight.
//
// Por cada píxel (a resolución reducida) se marcha el rayo de la cámara dentro de una caja que
// contiene el haz, y en cada muestra se suma la luz dispersada:  σ(p) · fase(HG) · E(spot, 1/d², sombra).
// El medio no es homogéneo: σ(p) cae como una gaussiana alrededor del vano ("polvo" en la puerta).
// Con un medio uniforme la cámara, que está parada dentro del haz, se llenaría de neblina.
// La sombra se lee del mismo shadow map que usan los materiales, así el muro recorta el haz con la
// forma del arco y la hoja lo corta al abrirse. Después se desenfoca (gaussiano separable) y se suma
// a la imagen HDR antes del bloom y el tone mapping.

const raymarchShader = {
  uniforms: {
    tDepth: { value: null },
    tShadow: { value: null },
    shadowMatrix: { value: new THREE.Matrix4() },
    shadowBias: { value: 0 },
    projInv: { value: new THREE.Matrix4() },
    camWorld: { value: new THREE.Matrix4() },
    camPos: { value: new THREE.Vector3() },
    lightPos: { value: new THREE.Vector3() },
    lightDir: { value: new THREE.Vector3(0, 0, 1) },
    coneCos: { value: 0.7 },
    penumbraCos: { value: 0.9 },
    lightColor: { value: new THREE.Color() },
    density: { value: 0.02 },
    phaseG: { value: 0.35 },
    mediumCenter: { value: new THREE.Vector3(0, 0.5, 0.5) },
    mediumRadius: { value: 2.5 },
    lampRadius: { value: 0.4 },
    boxMin: { value: new THREE.Vector3(-5, 0, -4) },
    boxMax: { value: new THREE.Vector3(5, 3, 8) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    #include <common>

    uniform sampler2D tDepth;
    uniform sampler2D tShadow;
    uniform mat4 shadowMatrix;
    uniform float shadowBias;
    uniform mat4 projInv;
    uniform mat4 camWorld;
    uniform vec3 camPos;
    uniform vec3 lightPos;
    uniform vec3 lightDir;
    uniform float coneCos;
    uniform float penumbraCos;
    uniform vec3 lightColor;
    uniform float density;
    uniform float phaseG;
    uniform vec3 mediumCenter; // el polvo en suspensión se concentra junto al vano
    uniform float mediumRadius;
    uniform float lampRadius; // evita la singularidad 1/d² pegada a la lámpara
    uniform vec3 boxMin;
    uniform vec3 boxMax;

    varying vec2 vUv;

    float ign(vec2 p) {
      return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
    }

    // Henyey-Greenstein: g > 0 dispersa hacia adelante (el haz brilla más mirando hacia la luz).
    float phaseHG(float cosTheta, float g) {
      float g2 = g * g;
      return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * cosTheta, 1e-4), 1.5));
    }

    // Misma prueba de Chebyshev que usa three.js para VSM.
    float visibility(vec3 p) {
      vec4 sc = shadowMatrix * vec4(p, 1.0);
      if (sc.w <= 0.0) return 0.0;
      sc.xyz /= sc.w;
      if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
      vec2 m = texture2D(tShadow, sc.xy).rg;
      float z = sc.z + shadowBias;
      if (z <= m.x) return 1.0;
      float variance = max(m.y * m.y, 1e-7);
      float d = z - m.x;
      float pMax = variance / (variance + d * d);
      return clamp((pMax - 0.3) / 0.65, 0.0, 1.0);
    }

    void main() {
      float depth = texture2D(tDepth, vUv).r;
      vec4 ndc = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 view = projInv * ndc;
      view /= view.w;
      vec3 world = (camWorld * vec4(view.xyz, 1.0)).xyz;

      vec3 rd = world - camPos;
      float sceneDist = length(rd);
      rd /= sceneDist;
      if (depth >= 0.99999) sceneDist = 1e4;

      // Sólo marchamos dentro de la caja que contiene el haz.
      vec3 invRd = 1.0 / rd;
      vec3 t0 = (boxMin - camPos) * invRd;
      vec3 t1 = (boxMax - camPos) * invRd;
      vec3 tMinV = min(t0, t1);
      vec3 tMaxV = max(t0, t1);
      float tNear = max(max(tMinV.x, tMinV.y), max(tMinV.z, 0.0));
      float tFar = min(min(tMaxV.x, tMaxV.y), min(tMaxV.z, sceneDist));

      if (tFar <= tNear) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      float stepLen = (tFar - tNear) / float(STEPS);
      float jitter = ign(gl_FragCoord.xy);
      vec3 acc = vec3(0.0);

      for (int i = 0; i < STEPS; i++) {
        float t = tNear + (float(i) + jitter) * stepLen;
        vec3 p = camPos + rd * t;
        vec3 L = lightPos - p;
        float d2 = max(dot(L, L), 1e-4);
        vec3 l = L * inversesqrt(d2);
        float spot = smoothstep(coneCos, penumbraCos, dot(-l, lightDir));
        if (spot <= 0.0) continue;
        vec3 dm = (p - mediumCenter) / mediumRadius;
        float medium = exp(-dot(dm, dm));
        if (medium < 0.01) continue;
        float vis = visibility(p);
        if (vis <= 0.0) continue;
        acc += medium * spot * vis / max(d2, lampRadius * lampRadius) * phaseHG(dot(l, rd), phaseG);
      }

      gl_FragColor = vec4(acc * lightColor * density * stepLen, 1.0);
    }
  `,
};

// Gaussiano separable de 9 taps (muestras bilineales), en HDR.
const blurShader = {
  uniforms: {
    tInput: { value: null },
    direction: { value: new THREE.Vector2(1, 0) },
  },
  vertexShader: raymarchShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tInput;
    uniform vec2 direction; // (1/ancho, 0) o (0, 1/alto), ya escalado
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tInput, vUv).rgb * 0.2270270270;
      c += texture2D(tInput, vUv + direction * 1.3846153846).rgb * 0.3162162162;
      c += texture2D(tInput, vUv - direction * 1.3846153846).rgb * 0.3162162162;
      c += texture2D(tInput, vUv + direction * 3.2307692308).rgb * 0.0702702703;
      c += texture2D(tInput, vUv - direction * 3.2307692308).rgb * 0.0702702703;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

const compositeShader = /* glsl */ `
  uniform sampler2D tVolume;
  uniform float strength;
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    outputColor = vec4(texture2D(tVolume, uv).rgb * strength, 0.0);
  }
`;

export class VolumetricLightEffect extends Effect {
  constructor(camera, light, { steps = 40, resolutionScale = 0.5, blurPasses = 2 } = {}) {
    super('VolumetricLightEffect', compositeShader, {
      blendFunction: BlendFunction.ADD,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([
        ['tVolume', new THREE.Uniform(null)],
        ['strength', new THREE.Uniform(1)],
      ]),
    });

    this.camera = camera;
    this.light = light;
    this.resolutionScale = resolutionScale;
    this.blurPasses = blurPasses;
    this.box = new THREE.Box3(new THREE.Vector3(-5, 0, -4), new THREE.Vector3(5, 3, 8));
    this.mediumCenter = new THREE.Vector3(0, 0.5, 0.5);
    this.mediumRadius = 2.5;
    this.lampRadius = 0.4;
    this.density = 0.02;
    this.active = true;

    const rtOptions = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rtA = new THREE.WebGLRenderTarget(1, 1, rtOptions);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, rtOptions);

    this.raymarchMaterial = new THREE.ShaderMaterial({
      name: 'VolumetricRaymarch',
      uniforms: THREE.UniformsUtils.clone(raymarchShader.uniforms),
      vertexShader: raymarchShader.vertexShader,
      fragmentShader: raymarchShader.fragmentShader,
      defines: { STEPS: steps },
      depthTest: false,
      depthWrite: false,
    });
    this.blurMaterial = new THREE.ShaderMaterial({
      name: 'VolumetricBlur',
      uniforms: THREE.UniformsUtils.clone(blurShader.uniforms),
      vertexShader: blurShader.vertexShader,
      fragmentShader: blurShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.raymarchMaterial);

    this._dir = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this.uniforms.get('tVolume').value = this.rtA.texture;
  }

  set steps(value) {
    const v = Math.max(8, Math.round(value));
    if (this.raymarchMaterial.defines.STEPS !== v) {
      this.raymarchMaterial.defines.STEPS = v;
      this.raymarchMaterial.needsUpdate = true;
    }
  }

  get steps() {
    return this.raymarchMaterial.defines.STEPS;
  }

  setDepthTexture(depthTexture) {
    this.raymarchMaterial.uniforms.tDepth.value = depthTexture;
  }

  setSize(width, height) {
    this._fullSize = { width, height };
    this.applyResolution();
  }

  applyResolution() {
    if (!this._fullSize) return;
    const w = Math.max(1, Math.round(this._fullSize.width * this.resolutionScale));
    const h = Math.max(1, Math.round(this._fullSize.height * this.resolutionScale));
    this.rtA.setSize(w, h);
    this.rtB.setSize(w, h);
  }

  update(renderer) {
    const light = this.light;
    const map = light.shadow.map;
    const u = this.raymarchMaterial.uniforms;
    const strength = this.uniforms.get('strength');

    if (!this.active || this.density <= 0 || !map || !u.tDepth.value) {
      strength.value = 0;
      return;
    }
    strength.value = 1;

    const cam = this.camera;
    u.projInv.value.copy(cam.projectionMatrixInverse);
    u.camWorld.value.copy(cam.matrixWorld);
    u.camPos.value.setFromMatrixPosition(cam.matrixWorld);

    light.getWorldPosition(this._pos);
    light.target.getWorldPosition(this._target);
    u.lightPos.value.copy(this._pos);
    u.lightDir.value.subVectors(this._target, this._pos).normalize();
    u.coneCos.value = Math.cos(light.angle);
    u.penumbraCos.value = Math.cos(light.angle * (1 - light.penumbra));
    u.lightColor.value.copy(light.color).multiplyScalar(light.intensity);
    u.tShadow.value = map.texture;
    u.shadowMatrix.value.copy(light.shadow.matrix);
    u.shadowBias.value = light.shadow.bias;
    u.density.value = this.density;
    u.mediumCenter.value.copy(this.mediumCenter);
    u.mediumRadius.value = this.mediumRadius;
    u.lampRadius.value = this.lampRadius;
    u.boxMin.value.copy(this.box.min);
    u.boxMax.value.copy(this.box.max);

    const prevTarget = renderer.getRenderTarget();

    // 1) raymarch a baja resolución
    this.quad.material = this.raymarchMaterial;
    renderer.setRenderTarget(this.rtA);
    this.quad.render(renderer);

    // 2) blur gaussiano separable (A → B → A)
    this.quad.material = this.blurMaterial;
    const bu = this.blurMaterial.uniforms;
    for (let i = 0; i < this.blurPasses; i++) {
      const spread = 1 + i; // cada pasada abre un poco más el kernel
      bu.tInput.value = this.rtA.texture;
      bu.direction.value.set(spread / this.rtA.width, 0);
      renderer.setRenderTarget(this.rtB);
      this.quad.render(renderer);

      bu.tInput.value = this.rtB.texture;
      bu.direction.value.set(0, spread / this.rtA.height);
      renderer.setRenderTarget(this.rtA);
      this.quad.render(renderer);
    }

    renderer.setRenderTarget(prevTarget);
  }

  dispose() {
    super.dispose();
    this.rtA.dispose();
    this.rtB.dispose();
    this.raymarchMaterial.dispose();
    this.blurMaterial.dispose();
    this.quad.dispose();
  }
}
