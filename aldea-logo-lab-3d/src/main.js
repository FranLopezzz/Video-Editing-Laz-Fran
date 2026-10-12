import * as THREE from 'three';
import { CONFIG, doorDims } from './config.js';
import { createMaterials } from './scene/materials.js';
import { createDoor } from './scene/door.js';
import { createWordmark, wordmarkMetrics } from './scene/wordmark.js';
import { createLights } from './scene/lights.js';
import { createCameraRig } from './camera.js';
import { createPost } from './post.js';
import { createUI } from './ui.js';

const params = new URLSearchParams(location.search);
let ui = null;
let exporting = false;

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.quality.maxPixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Luces en unidades físicas (candela, nits): el modo por defecto de three desde r155.
// El tone mapping lo hace el post-procesado (ToneMappingEffect); el renderer entrega HDR lineal.
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
// Las sombras de spots no dependen de la cámara: sólo se recalculan cuando algo cambia.
renderer.shadowMap.autoUpdate = false;

// ---------------------------------------------------------------------------
// Escena
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0c);
// Niebla muy sutil (atmósfera); el haz en el aire lo agrega el efecto volumétrico.
const fog = new THREE.FogExp2(0x0b0b0c, CONFIG.fog.density);

const materials = createMaterials(CONFIG);
const door = createDoor(CONFIG, materials);
scene.add(door.group);

const wordmark = createWordmark(CONFIG, materials);
scene.add(wordmark.group);

// Piso amplio: continúa hacia adentro de la habitación.
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), materials.floor);
floor.name = 'Floor';
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const lights = createLights(CONFIG);
scene.add(lights.group);

const rig = createCameraRig(CONFIG, canvas);
const post = createPost(renderer, scene, rig.camera, lights, CONFIG);

// ---------------------------------------------------------------------------
// Layout por modo (todo relativo a la puerta, que siempre está en x = 0)
// ---------------------------------------------------------------------------
const DOOR_X = 0;

function computeLayout() {
  const { w, h, depth } = doorDims(CONFIG);
  const isWord = CONFIG.mode === 'wordmark';
  const m = isWord ? wordmarkMetrics(CONFIG) : null;
  const roomD = CONFIG.door.room.depth * w;

  // Haz volumétrico: caja que lo contiene y "polvo" concentrado delante del vano.
  const beam = {
    box: new THREE.Box3(
      new THREE.Vector3(isWord ? m.left - 1.5 * w : DOOR_X - 6 * w, 0, -depth - roomD),
      new THREE.Vector3(DOOR_X + 6 * w, isWord ? m.ascender * 1.2 : 2.2 * h, 7 * w),
    ),
    center: new THREE.Vector3(DOOR_X - (isWord ? 0.8 * w : 0), 0.45 * h, 0.9 * w),
    radius: (isWord ? 2.6 : 2.2) * w,
    lampRadius: 0.45 * w,
  };

  // Plano emisor de los god rays (pared del fondo; irradia desde el centro del vano).
  const godRaySource = {
    position: new THREE.Vector3(DOOR_X, 0.5 * h, -depth - roomD + 0.02 * w),
    width: CONFIG.door.room.width * w,
    height: CONFIG.door.room.height * h * 2,
    color: new THREE.Color(),
  };

  // Relleno frontal neutro (sólo Wordmark): un softbox grande arriba y delante del logotipo.
  let frontFill = null;
  if (isWord) {
    const cx = (m.left + m.right) / 2;
    const width = m.right - m.left;
    frontFill = {
      width: width * 1.15,
      height: m.ascender * 0.9,
      position: new THREE.Vector3(cx, m.ascender * 1.7, width * 0.75),
      target: new THREE.Vector3(cx, m.xHeight * 0.5, 0),
    };
  }

  return {
    doorX: DOOR_X,
    openFraction: door.openFraction(CONFIG.door.openAngle),
    beam,
    godRaySource,
    frontFill,
  };
}

// Vista frontal: perspectiva de un punto, cámara a la altura del 42% de la puerta (en Wordmark,
// del 42% de la "l"), mirando de frente. La distancia se calcula con el tamaño por defecto para
// que el control "Tamaño" agrande o achique el sujeto en cuadro.
function computeFrontal() {
  const ref = { ...CONFIG, door: { ...CONFIG.door, width: 1 } };
  const fov = THREE.MathUtils.degToRad(CONFIG.camera.fov);
  const tanV = Math.tan(fov / 2);
  const tanH = tanV * rig.camera.aspect;

  if (CONFIG.mode === 'wordmark') {
    const m = wordmarkMetrics(ref);
    const width = m.right - m.left;
    const camY = CONFIG.camera.heightFactor * m.ascender;
    const dist = Math.max(width / (CONFIG.camera.wordmark.frame * 2 * tanH), (m.ascender * 1.6) / (2 * tanV));
    rig.setFrontal(new THREE.Vector3((m.left + m.right) / 2, camY, 0), dist);
  } else {
    const { w, h } = doorDims(ref);
    const camY = CONFIG.camera.heightFactor * h;
    const dist = Math.max(h / (CONFIG.camera.door.frame * 2 * tanV), (w * 2.2) / (2 * tanH));
    rig.setFrontal(new THREE.Vector3(DOOR_X, camY, 0), dist);
  }
}

// ---------------------------------------------------------------------------
// Aplicar configuración
// ---------------------------------------------------------------------------
let shadowsDirty = true;

// Cambios de luz, materiales, apertura y post (sin geometría).
function applyLook() {
  door.setOpenAngle(CONFIG.door.openAngle);
  const layout = computeLayout();
  materials.update(CONFIG);
  lights.update(CONFIG, layout);

  // El emisor de god rays toma el color de la fuente (recién calculado), a luminancia fija.
  const c = layout.godRaySource.color.copy(lights.color);
  c.multiplyScalar(0.55 / Math.max(0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b, 1e-3));
  post.update(CONFIG, layout);

  scene.fog = CONFIG.fog.enabled ? fog : null;
  fog.density = CONFIG.fog.density;
  shadowsDirty = true;
}

// Cambios de geometría (ratio, tamaño, modo).
function applyGeometry() {
  door.rebuild(CONFIG);
  wordmark.rebuild(CONFIG);
  wordmark.setVisible(CONFIG.mode === 'wordmark');
  applyLook();
}

function setMode(mode, { animate = true } = {}) {
  CONFIG.mode = mode;
  applyGeometry();
  computeFrontal();
  if (animate) rig.animateToFrontal(1.2);
  else rig.snapToFrontal();
}

// ---------------------------------------------------------------------------
// Abrir / cerrar (1.6 s, easing suave)
// ---------------------------------------------------------------------------
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
let doorAnim = null;
let lastOpenAngle = CONFIG.door.openAngle > 1 ? CONFIG.door.openAngle : 62;

function toggleDoor() {
  const from = CONFIG.door.openAngle;
  const opening = doorAnim ? doorAnim.to < doorAnim.from : from < 1;
  if (!opening && from > 1) lastOpenAngle = from;
  doorAnim = { from, to: opening ? lastOpenAngle : 0, t: 0 };
}

function updateDoorAnimation(dt) {
  if (!doorAnim) return false;
  doorAnim.t = Math.min(doorAnim.t + dt / CONFIG.door.animDuration, 1);
  CONFIG.door.openAngle = THREE.MathUtils.lerp(doorAnim.from, doorAnim.to, easeInOutSine(doorAnim.t));
  if (doorAnim.t >= 1) doorAnim = null;
  applyLook();
  return true;
}

// ---------------------------------------------------------------------------
// Calidad adaptativa: si el FPS baja de 40 se reduce el shadow map; si con el mínimo no
// alcanza, los pasos del haz volumétrico y por último el pixel ratio.
// ---------------------------------------------------------------------------
const Q = CONFIG.quality;
const TIERS = [
  { shadow: Q.shadowSizes[0], steps: Q.volumetricSteps, dpr: Q.maxPixelRatio },
  { shadow: Q.shadowSizes[1], steps: Q.volumetricSteps, dpr: Q.maxPixelRatio },
  { shadow: Q.shadowSizes[2], steps: Q.volumetricSteps, dpr: Q.maxPixelRatio },
  { shadow: Q.shadowSizes[2], steps: 28, dpr: 1.5 },
  { shadow: Q.shadowSizes[2], steps: 24, dpr: 1 },
];

const quality = {
  auto: !params.has('fixedquality'),
  tier: 0,
  fps: 0,
  frames: 0,
  elapsed: 0,
  warmup: 2,
  dprCap: Q.maxPixelRatio,
};

function applyQualityTier(tier) {
  quality.tier = THREE.MathUtils.clamp(tier, 0, TIERS.length - 1);
  const t = TIERS[quality.tier];
  lights.setShadowMapSize(t.shadow);
  quality.steps = t.steps;
  quality.dprCap = t.dpr;
  resize();
  shadowsDirty = true;
}

function monitorQuality(dt) {
  if (document.hidden || exporting) return;
  quality.frames++;
  quality.elapsed += dt;
  if (quality.elapsed < 2) return;
  quality.fps = quality.frames / quality.elapsed;
  quality.frames = 0;
  quality.elapsed = 0;
  if (quality.warmup > 0) {
    quality.warmup--; // los primeros segundos incluyen compilación de shaders
    return;
  }
  if (quality.auto && quality.fps < Q.minFps && quality.tier < TIERS.length - 1) {
    applyQualityTier(quality.tier + 1);
    ui?.refresh();
  }
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, Q.maxPixelRatio, quality.dprCap));
  post.setSize(w, h);
  post.setQuality({ volumetricScale: Q.volumetricScale, volumetricSteps: quality.steps ?? Q.volumetricSteps });
  rig.resize(w, h);
  computeFrontal();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// Render + exportar PNG (2× la resolución de la ventana, fondo negro)
// ---------------------------------------------------------------------------
function renderFrame(dt) {
  if (shadowsDirty) {
    renderer.shadowMap.needsUpdate = true;
    shadowsDirty = false;
  }
  post.render(dt);
}

async function exportPNG() {
  if (exporting) return null;
  exporting = true;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  const maxSize = Math.min(renderer.capabilities.maxTextureSize, 8192);
  const scale = Math.min(CONFIG.export.scale, maxSize / cssW, maxSize / cssH);
  const prevRatio = renderer.getPixelRatio();

  try {
    renderer.setPixelRatio(scale);
    post.setSize(cssW, cssH);
    post.setQuality({ volumetricScale: Q.volumetricScale, volumetricSteps: Q.volumetricSteps });
    renderFrame(0);

    // Se compone sobre el negro de marca: fondo opaco aunque el alfa del canvas no sea 1.
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#0B0B0C';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0); // mismo task que el render: el drawing buffer sigue válido

    const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aldea-logo-lab-${CONFIG.mode}-${out.width}x${out.height}-${stamp}.png`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return { width: out.width, height: out.height, bytes: blob.size };
  } finally {
    renderer.setPixelRatio(prevRatio);
    resize();
    exporting = false;
  }
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
const timer = new THREE.Timer();
const stats = document.querySelector('#stats');
let statsTimer = 0;

function frame() {
  timer.update();
  const realDt = timer.getDelta();
  // Animaciones (puerta 1.6 s, cámara) y medición de FPS en tiempo real, aunque el FPS sea bajo.
  // El tope evita saltos al volver de otra pestaña.
  const dt = Math.min(realDt, 0.5);
  if (updateDoorAnimation(dt)) ui?.refresh();
  rig.update(dt);
  renderFrame(dt);
  monitorQuality(Math.min(realDt, 1));

  statsTimer -= dt;
  if (stats && statsTimer <= 0) {
    statsTimer = 0.5;
    const fps = quality.fps ? `${quality.fps.toFixed(0)} fps` : '…';
    stats.textContent = `${fps} · sombras ${lights.shadowMapSize}px`;
  }
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
if (params.has('angle')) CONFIG.door.openAngle = Number(params.get('angle'));
if (params.get('mode') === 'wordmark') CONFIG.mode = 'wordmark';

applyQualityTier(0);
setMode(CONFIG.mode, { animate: false });

if (params.has('view')) {
  const v = params.get('view').split(',').map(Number);
  rig.camera.position.set(v[0], v[1], v[2]);
  rig.controls.target.set(v[3] ?? 0, v[4] ?? 0.5, v[5] ?? 0);
  rig.controls.update();
}

if (params.has('noui')) document.querySelector('.hud')?.remove();

ui = params.has('noui')
  ? null
  : createUI(CONFIG, {
      applyLook,
      applyGeometry,
      setMode,
      toggleDoor,
      frontal: () => rig.animateToFrontal(),
      exportPNG,
      quality,
      tiers: TIERS,
      setQualityTier: applyQualityTier,
      shadowMapSize: () => lights.shadowMapSize,
    });

renderer.setAnimationLoop(frame);

// Acceso de depuración (consola / capturas automáticas). freeze() deja un último frame quieto.
window.__lab = {
  THREE,
  scene,
  renderer,
  rig,
  door,
  wordmark,
  lights,
  post,
  CONFIG,
  applyScene: applyLook,
  applyGeometry,
  setMode,
  toggleDoor,
  exportPNG,
  quality,
  freeze() {
    renderer.setAnimationLoop(null);
    frame();
  },
};
