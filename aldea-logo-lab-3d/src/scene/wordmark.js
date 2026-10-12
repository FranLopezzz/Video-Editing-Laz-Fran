import * as THREE from 'three';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import fontData from '../assets/jost-500.typeface.json';
import { doorDims } from '../config.js';

// Wordmark "aldea" + la puerta como punto final.
//
// Escala: la puerta mide 0.7 × altura de x (config.wordmark.doorToXHeight), así que el cuerpo de
// la tipografía se deriva del alto de la puerta: em = (h / 0.7) / (xHeight / unitsPerEm).
// Posición: la puerta ocupa el lugar del glifo "." — su borde izquierdo cae en
// avance("aldea") + margen izquierdo del ".". Jost no tiene kerning en "a." ni entre estas letras,
// así que ese es exactamente el espacio tipográfico del punto.
// La puerta queda en x = 0 (las luces se calculan respecto de ella) y el texto se corre a la izquierda.

const font = new Font(fontData);
const UPM = fontData.resolution;
const X_HEIGHT = fontData.xHeight; // 460 en Jost 500
// Punto más alto del contorno de un glifo (unidades de fuente). Los comandos del JSON son
// "m x y", "l x y", "q x y cx cy", "b x y c1x c1y c2x c2y": las Y están en posiciones impares.
function glyphTop(ch) {
  const tokens = (fontData.glyphs[ch]?.o ?? '').split(' ');
  let top = 0;
  for (let i = 0; i < tokens.length; ) {
    const cmd = tokens[i++];
    const n = cmd === 'm' || cmd === 'l' ? 2 : cmd === 'q' ? 4 : cmd === 'b' ? 6 : 0;
    for (let k = 1; k < n; k += 2) top = Math.max(top, Number(tokens[i + k]));
    i += n;
  }
  return top;
}

const ASCENDER = glyphTop('l'); // alto de la "l" (780 en Jost 500)

function advance(text) {
  let x = 0;
  for (const ch of text) x += fontData.glyphs[ch]?.ha ?? 0;
  return x;
}

export function wordmarkMetrics(cfg) {
  const { w, h } = doorDims(cfg);
  const xHeight = h / cfg.wordmark.doorToXHeight;
  const em = (xHeight * UPM) / X_HEIGHT; // cuerpo en metros
  const unit = em / UPM; // metros por unidad de fuente
  const periodLsb = fontData.glyphs['.'].x_min;
  // Origen del texto de manera que el borde izquierdo de la puerta (x = -w/2) caiga donde empieza
  // la tinta del punto.
  const originX = -w / 2 - (advance(cfg.wordmark.text) + periodLsb) * unit;
  const firstInk = fontData.glyphs[cfg.wordmark.text[0]]?.x_min ?? 0;
  return {
    em,
    unit,
    xHeight,
    ascender: ASCENDER * unit,
    originX,
    // Caja del logotipo completo (tinta de la primera letra → borde derecho de la puerta).
    left: originX + firstInk * unit,
    right: w / 2,
    gap: (advance(cfg.wordmark.text) - fontData.glyphs[cfg.wordmark.text.at(-1)].x_max + periodLsb) * unit,
  };
}

function textGeometry(cfg) {
  const m = wordmarkMetrics(cfg);
  const bevel = cfg.wordmark.bevel * m.em;
  const depth = cfg.wordmark.depth * m.em;
  let geo = new TextGeometry(cfg.wordmark.text, {
    font,
    size: m.em,
    depth: Math.max(depth - 2 * bevel, 0.001),
    curveSegments: cfg.wordmark.curveSegments,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel, // el chaflán no engorda las letras: la silueta es la de Jost 500
    bevelSegments: 3,
  });
  // Cara trasera apenas despegada del muro (z = 0) para evitar z-fighting.
  geo.translate(m.originX, 0, bevel + 0.002);
  geo = toCreasedNormals(geo, THREE.MathUtils.degToRad(30));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function createWordmark(cfg, materials) {
  const group = new THREE.Group();
  group.name = 'Wordmark';

  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), materials.text);
  mesh.name = 'Letters';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const api = {
    group,
    mesh,
    metrics: null,

    rebuild(c = cfg) {
      cfg = c;
      mesh.geometry.dispose();
      mesh.geometry = textGeometry(cfg);
      api.metrics = wordmarkMetrics(cfg);
      return api.metrics;
    },

    setVisible(v) {
      group.visible = v;
    },
  };

  api.rebuild(cfg);
  return api;
}
