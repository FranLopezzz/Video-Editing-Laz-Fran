import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { doorDims } from '../config.js';

// Una sola "fuente" (la lámpara dentro de la habitación) repartida en varias luces que
// comparten color:
//   key       SpotLight detrás del vano (un poco más baja que el dintel) apuntando al piso de
//             afuera. Sombra VSM: el muro recorta el charco y la hoja proyecta su sombra.
//   interior  SpotLight desde la misma lámpara mirando al fondo: el interior se ve iluminado
//             a través del arco. Con sombra (la hoja sombrea el fondo).
//   bounce    SpotLight suave y baja que simula el rebote del piso iluminado entre la hoja y el
//             vano: le da volumen a la cara visible de la hoja. Con sombra, como las otras dos.
//   fill      RectAreaLight en el vano, SIN sombras (Three no las soporta): sólo relleno suave
//             cerca del umbral. Se escala y se recorta a la parte descubierta del vano.
// Las luces sin sombra (fill, relleno frontal, ambiente mínima) no están dentro de la
// habitación, así que no "atraviesan" paredes.

const tmpColor = new THREE.Color();

// Temperatura de color (K) → RGB (aprox. de Tanner Helland), en sRGB 0..1.
export function kelvinToRGB(kelvin) {
  const t = THREE.MathUtils.clamp(kelvin, 1000, 40000) / 100;
  let r;
  let g;
  let b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v) => THREE.MathUtils.clamp(v, 0, 255) / 255;
  return { r: c(r), g: c(g), b: c(b) };
}

// Color final de la fuente: mezcla (en lineal) entre blanco a la temperatura elegida y el
// acento, normalizado a luminancia 1 para que cambiar de acento no cambie la exposición.
export function sourceColor(cfg, target = new THREE.Color()) {
  const k = kelvinToRGB(cfg.light.temperature);
  const neutral = tmpColor.setRGB(k.r, k.g, k.b, THREE.SRGBColorSpace);
  target.set(cfg.light.accent).lerp(neutral, 1 - cfg.light.tint);
  const lum = 0.2126 * target.r + 0.7152 * target.g + 0.0722 * target.b;
  return target.multiplyScalar(1 / Math.max(lum, 1e-3));
}

function makeSpot(name, mapSize) {
  const spot = new THREE.SpotLight(0xffffff, 1, 0, Math.PI / 4, 0.9, 2);
  spot.name = name;
  spot.castShadow = true;
  spot.shadow.mapSize.set(mapSize, mapSize);
  spot.shadow.camera.near = 0.15;
  spot.shadow.camera.far = 30;
  spot.shadow.bias = -0.0002;
  spot.shadow.normalBias = 0.0;
  spot.target = new THREE.Object3D();
  spot.target.name = `${name}Target`;
  return spot;
}

export function createLights(cfg) {
  RectAreaLightUniformsLib.init();

  const group = new THREE.Group();
  group.name = 'Lights';

  const key = makeSpot('Key', cfg.light.key.shadowMapSize);
  const interior = makeSpot('Interior', cfg.light.interior.shadowMapSize);
  const bounce = makeSpot('Bounce', cfg.light.bounce.shadowMapSize);

  const fill = new THREE.RectAreaLight(0xffffff, 1, 1, 1);
  fill.name = 'Fill';

  const front = new THREE.RectAreaLight(0xffffff, 0, 6, 2.2);
  front.name = 'FrontFill';

  const ambient = new THREE.HemisphereLight(0xdfe6ee, 0x0b0b0c, cfg.light.ambient);
  ambient.name = 'Ambient';

  for (const s of [key, interior, bounce]) group.add(s, s.target);
  group.add(fill, front, ambient);

  const color = new THREE.Color();
  let shadowScale = 1; // lo baja el control de calidad adaptativo

  const api = {
    group,
    key,
    interior,
    bounce,
    fill,
    front,
    ambient,
    color,

    // Tamaño del shadow map principal (1024 / 768 / 512) — FPS adaptativo. Las otras luces
    // escalan en la misma proporción.
    setShadowMapSize(size) {
      shadowScale = size / cfg.light.key.shadowMapSize;
      api.applyShadowQuality();
    },

    applyShadowQuality() {
      const setMap = (light, base, blurRef, bias) => {
        const size = Math.max(256, Math.round(base * shadowScale));
        if (light.shadow.mapSize.x !== size) light.shadow.mapSize.set(size, size);
        // El radio se expresa en texels de un mapa de 1024: mismo blur físico a cualquier resolución.
        const radius = Math.max(1, blurRef * (size / 1024));
        light.shadow.radius = radius;
        // La 1ª pasada del blur VSM lee profundidad sin filtrar: con pasos > ~1 texel aparece
        // un festoneado. Una muestra por texel de radio (con tope).
        light.shadow.blurSamples = Math.min(Math.max(Math.ceil(radius) | 1, 5), 49);
        light.shadow.bias = bias;
      };
      const L = cfg.light;
      setMap(key, L.key.shadowMapSize, L.shadowBlur, -0.0002);
      // La interior no necesita sombra tan difusa; con blur grande VSM oscurece las esquinas.
      setMap(interior, L.interior.shadowMapSize, L.shadowBlur * L.interior.blur, L.interior.bias);
      setMap(bounce, L.bounce.shadowMapSize, L.shadowBlur * L.bounce.blur, L.bounce.bias);
    },

    get shadowMapSize() {
      return key.shadow.mapSize.x;
    },

    // Reubica y recalcula todo. openFraction: parte descubierta del vano (0..1).
    update(c, layout) {
      cfg = c;
      const { w, h, depth } = doorDims(c);
      const mode = c.mode;
      const L = c.light;
      const doorX = layout?.doorX ?? 0;
      const roomD = c.door.room.depth * w;
      // Intensidades en candela: w² compensa 1/d² al escalar la puerta.
      const sizeGain = w * w * (L.modeGain?.[mode] ?? 1);

      sourceColor(c, color);
      for (const l of [key, interior, bounce, fill]) l.color.copy(color);

      // Lámpara (posición compartida por key e interior).
      const p = L.key.position[mode];
      const lamp = new THREE.Vector3(doorX + p.x * w, p.y * h, -depth - p.z * w);

      key.position.copy(lamp);
      const t = L.key.target[mode];
      key.target.position.set(doorX + t.x * w, t.y * h, t.z * w);
      key.angle = THREE.MathUtils.degToRad(L.key.angle);
      key.penumbra = L.penumbra;
      key.intensity = L.key.candela * L.intensity * sizeGain;

      interior.position.copy(lamp);
      interior.target.position.set(doorX, 0.35 * h, -depth - roomD);
      interior.angle = THREE.MathUtils.degToRad(L.interior.angle);
      interior.penumbra = 1;
      interior.intensity = L.interior.candela * L.intensity * sizeGain;

      const bp = L.bounce.position;
      const bt = L.bounce.target;
      bounce.position.set(doorX + bp.x * w, bp.y * h, -depth - bp.z * w);
      bounce.target.position.set(doorX + bt.x * w, bt.y * h, -depth - bt.z * w);
      bounce.angle = THREE.MathUtils.degToRad(L.bounce.angle);
      bounce.penumbra = 1;
      const open = layout?.openFraction ?? 1;
      bounce.intensity = L.bounce.candela * L.intensity * sizeGain * Math.sqrt(open);

      // Relleno en el vano: cubre sólo la franja descubierta (la hoja tapa desde la izquierda).
      const span = Math.max(open * w, 0.001);
      const fillH = (h - w / 2) + w * 0.3;
      fill.width = span;
      fill.height = fillH;
      fill.position.set(doorX + w / 2 - span / 2, fillH / 2, -depth * 0.5);
      fill.lookAt(fill.position.x, fill.position.y, 10);
      // Se apaga con intensidad 0, nunca con visible = false: cambiar la cantidad de luces
      // obliga a three a recompilar todos los shaders (un tirón al abrir o cerrar la puerta).
      fill.intensity = open > 0.002 ? L.fill.nits * L.intensity * Math.pow(open, 0.75) : 0;

      ambient.intensity = L.ambient;

      // Relleno frontal neutro (legibilidad del wordmark).
      const fw = layout?.frontFill;
      front.intensity = fw ? L.front[mode] : 0;
      if (fw) {
        front.width = fw.width;
        front.height = fw.height;
        front.position.copy(fw.position);
        front.lookAt(fw.target);
        front.color.set(0xffffff);
      }

      api.applyShadowQuality();
    },
  };

  api.update(cfg);
  return api;
}
