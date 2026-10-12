import * as THREE from 'three';
import {
  BlendFunction,
  BloomEffect,
  Effect,
  EffectComposer,
  EffectPass,
  EdgeDetectionMode,
  GodRaysEffect,
  KernelSize,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
import { VolumetricLightEffect } from './effects/VolumetricLightEffect.js';
import { PALETTE } from './config.js';

// Cadena de post-procesado (pmndrs/postprocessing), todo en HDR (half float):
//   escena → haz volumétrico (niebla) + god rays → exposición → bloom → tone mapping (ACES / AgX)
//   → negro de marca → SMAA + dithering (evita banding en los degradés oscuros del piso).

class ExposureEffect extends Effect {
  constructor(exposure = 1) {
    super(
      'ExposureEffect',
      /* glsl */ `
        uniform float exposure;
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
        }
      `,
      { blendFunction: BlendFunction.SRC, uniforms: new Map([['exposure', new THREE.Uniform(exposure)]]) },
    );
  }

  get exposure() {
    return this.uniforms.get('exposure').value;
  }

  set exposure(v) {
    this.uniforms.get('exposure').value = v;
  }
}

// Piso de negro de marca: después del tone mapping el negro más profundo pasa a ser #0B0B0C
// (ACES aplasta los negros a #000). En lineal: out = negro + color · (1 − negro).
class BrandBlackEffect extends Effect {
  constructor(hex) {
    const black = new THREE.Color(hex); // Color.set convierte sRGB → lineal
    super(
      'BrandBlackEffect',
      /* glsl */ `
        uniform vec3 brandBlack;
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          outputColor = vec4(brandBlack + inputColor.rgb * (1.0 - brandBlack), 1.0);
        }
      `,
      { blendFunction: BlendFunction.SRC, uniforms: new Map([['brandBlack', new THREE.Uniform(black)]]) },
    );
  }
}

const TONE_MAPPING = {
  AgX: ToneMappingMode.AGX,
  ACES: ToneMappingMode.ACES_FILMIC,
};

// Coeficiente de dispersión del haz (m⁻¹) a partir de la niebla.
export function scatteringDensity(cfg) {
  return cfg.fog.enabled ? cfg.fog.density * cfg.fog.scattering : 0;
}

// Fuente de los god rays: un plano en la pared del fondo de la habitación que NO está en la
// escena principal (no se ve en el render normal). GodRaysEffect lo dibuja en su propia máscara
// con test de profundidad: sólo emite la parte que se ve a través del vano y la hoja la tapa.
function createGodRaySource() {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, fog: false }),
  );
  mesh.name = 'GodRaySource';
  return mesh;
}

export function createPost(renderer, scene, camera, lights, cfg) {
  // Con DPR ≥ 2 la imagen ya está sobremuestreada: MSAA sólo cuando conviene.
  const samples = renderer.getPixelRatio() >= 2 ? 0 : cfg.post.multisampling;

  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
    multisampling: Math.min(samples, renderer.capabilities.maxSamples),
  });

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const volumetric = new VolumetricLightEffect(camera, lights.key, {
    steps: cfg.quality.volumetricSteps,
    resolutionScale: 0.5,
  });

  const bloom = new BloomEffect({
    mipmapBlur: true,
    luminanceThreshold: cfg.post.bloom.threshold,
    luminanceSmoothing: cfg.post.bloom.smoothing,
    intensity: cfg.post.bloom.intensity,
    radius: cfg.post.bloom.radius,
    levels: 6,
  });

  const godRaySource = createGodRaySource();
  const godRays = new GodRaysEffect(camera, godRaySource, {
    blendFunction: BlendFunction.ADD,
    samples: 64,
    density: 0.94,
    decay: 0.93,
    weight: 0.36,
    exposure: 0.55,
    clampMax: 1,
    kernelSize: KernelSize.SMALL,
    resolutionScale: 0.5,
  });

  const exposure = new ExposureEffect(cfg.post.exposure);
  const toneMapping = new ToneMappingEffect({ mode: TONE_MAPPING[cfg.post.toneMapping] ?? ToneMappingMode.AGX });

  // La exposición va antes del bloom: el umbral del bloom queda relativo a lo que se ve.
  composer.addPass(new EffectPass(camera, volumetric, godRays, exposure));
  const hdrPass = new EffectPass(camera, bloom, toneMapping, new BrandBlackEffect(PALETTE.black));
  composer.addPass(hdrPass);

  const smaa = new SMAAEffect({ preset: SMAAPreset.HIGH, edgeDetectionMode: EdgeDetectionMode.COLOR });
  const smaaPass = new EffectPass(camera, smaa);
  smaaPass.dithering = true;
  composer.addPass(smaaPass);

  const api = {
    composer,
    volumetric,
    godRays,
    godRaySource,
    bloom,
    exposure,
    toneMapping,
    smaa,

    update(c = cfg, layout) {
      cfg = c;
      exposure.exposure = c.post.exposure;
      toneMapping.mode = TONE_MAPPING[c.post.toneMapping] ?? ToneMappingMode.AGX;

      bloom.blendMode.opacity.value = c.post.bloom.enabled ? 1 : 0;
      bloom.intensity = c.post.bloom.intensity;

      volumetric.density = scatteringDensity(c);
      volumetric.active = volumetric.density > 0;
      volumetric.blendMode.opacity.value = volumetric.active ? 1 : 0;
      godRays.blendMode.opacity.value = c.post.godRays.enabled ? c.post.godRays.intensity : 0;
      if (layout?.godRaySource) {
        const g = layout.godRaySource;
        godRaySource.position.copy(g.position);
        godRaySource.scale.set(g.width, g.height, 1);
        godRaySource.material.color.copy(g.color);
        godRaySource.updateMatrixWorld();
      }
      if (layout?.beam) {
        volumetric.box.copy(layout.beam.box);
        volumetric.mediumCenter.copy(layout.beam.center);
        volumetric.mediumRadius = layout.beam.radius;
        volumetric.lampRadius = layout.beam.lampRadius;
      }

      // Si se desactiva SMAA, el pase HDR pasa a escribir en pantalla (con dithering).
      smaaPass.enabled = c.post.smaa;
      hdrPass.renderToScreen = !c.post.smaa;
      hdrPass.dithering = !c.post.smaa;
    },

    setQuality({ volumetricScale, volumetricSteps }) {
      const dpr = renderer.getPixelRatio();
      volumetric.resolutionScale = Math.min(1, volumetricScale / dpr);
      volumetric.applyResolution();
      volumetric.steps = volumetricSteps;
    },

    setSize(width, height) {
      composer.setSize(width, height, false);
    },

    render(dt) {
      composer.render(dt);
    },
  };

  api.setQuality(cfg.quality);
  api.update(cfg);
  return api;
}
