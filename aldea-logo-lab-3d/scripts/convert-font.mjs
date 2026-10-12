// Convierte Jost (peso 500) a formato "typeface JSON" para THREE.FontLoader / TextGeometry.
//
//   npm run font
//
// Lee el WOFF estático de @fontsource/jost (OFL) y escribe src/assets/jost-500.typeface.json.
// El formato es el mismo que genera facetype.js: para cada glifo, `o` es una lista de
// comandos (m, l, q, b) donde las curvas llevan PRIMERO el punto final y después los
// puntos de control, que es lo que espera THREE.Font.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2] ?? path.join(root, 'node_modules/@fontsource/jost/files/jost-latin-500-normal.woff');
const output = process.argv[3] ?? path.join(root, 'src/assets/jost-500.typeface.json');

// Subconjunto: ASCII imprimible + letras acentuadas del español.
const CHARS = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('') + 'áéíóúüñÁÉÍÓÚÜÑ¿¡';

const buffer = fs.readFileSync(input);
const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
const round = (v) => Math.round(v * 100) / 100;

const glyphs = {};
for (const ch of CHARS) {
  const glyph = font.charToGlyph(ch);
  if (!glyph || glyph.index === 0) continue;

  // glyph.path está en unidades de la fuente con Y hacia arriba (igual que el JSON).
  let o = '';
  for (const c of glyph.path.commands) {
    switch (c.type) {
      case 'M': o += `m ${round(c.x)} ${round(c.y)} `; break;
      case 'L': o += `l ${round(c.x)} ${round(c.y)} `; break;
      case 'Q': o += `q ${round(c.x)} ${round(c.y)} ${round(c.x1)} ${round(c.y1)} `; break;
      case 'C': o += `b ${round(c.x)} ${round(c.y)} ${round(c.x1)} ${round(c.y1)} ${round(c.x2)} ${round(c.y2)} `; break;
      default: break; // 'Z': THREE.Font cierra los contornos solo
    }
  }

  const bb = glyph.getBoundingBox();
  glyphs[ch] = {
    ha: round(glyph.advanceWidth),
    x_min: round(bb.x1),
    x_max: round(bb.x2),
    o: o.trim(),
  };
}

const os2 = font.tables.os2;
const head = font.tables.head;
const post = font.tables.post;

const json = {
  glyphs,
  familyName: font.names.fontFamily?.en ?? 'Jost',
  ascender: round(font.ascender),
  descender: round(font.descender),
  underlinePosition: post?.underlinePosition ?? -100,
  underlineThickness: post?.underlineThickness ?? 50,
  boundingBox: { xMin: head.xMin, yMin: head.yMin, xMax: head.xMax, yMax: head.yMax },
  resolution: font.unitsPerEm,
  // Métricas extra que usa wordmark.js para dimensionar la puerta-punto.
  xHeight: os2?.sxHeight ?? null,
  capHeight: os2?.sCapHeight ?? null,
  cssFontWeight: '500',
  cssFontStyle: 'normal',
  original_font_information: {
    format: 0,
    fontFamily: font.names.fontFamily?.en ?? 'Jost',
    fontSubfamily: font.names.fontSubfamily?.en ?? 'Medium',
    copyright: font.names.copyright?.en ?? '',
    licence: font.names.license?.en ?? 'SIL Open Font License 1.1',
  },
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(json));
console.log(`OK: ${Object.keys(glyphs).length} glifos → ${path.relative(root, output)} (xHeight ${json.xHeight}, capHeight ${json.capHeight}, upm ${json.resolution})`);
