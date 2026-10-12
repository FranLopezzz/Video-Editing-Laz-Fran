// Aldea Logo Lab 3D — configuración central.
// Todo lo que se puede tunear vive acá. El panel (ui.js) edita este mismo objeto
// y main.js aplica los cambios. Unidades: metros (la puerta mide 1 m de ancho por defecto).

export const PALETTE = {
  black: '#0B0B0C',
  white: '#F2F2F0',
  accents: {
    celeste: '#00BEFF',
    naranja: '#EE7A3A',
  },
};

export const CONFIG = {
  // 'door' = la puerta sola · 'wordmark' = "aldea" + puerta como punto final
  mode: 'door',

  door: {
    width: 1.0, // w — "tamaño de la puerta" (en modo Wordmark escala todo el logotipo)
    ratio: 1.25, // h = w * ratio (1.0 – 1.7)
    wallDepth: 0.3, // espesor del muro = 0.3 * w
    leafThickness: 0.06, // espesor de la hoja = 0.06 * w
    leafBevel: 0.006, // chaflán de la hoja (× w), hacia adentro: no agranda la silueta
    openAngle: 62, // grados (0 – 110). Abre hacia adentro
    animDuration: 1.6, // s, botón "Abrir / cerrar"
    curveSegments: 48, // resolución del arco
    wall: { width: 80, height: 30 }, // extensión del muro (× w)
    room: { width: 3.2, height: 2.1, depth: 2.6 }, // habitación interior (ancho y fondo × w, alto × h)
  },

  wordmark: {
    text: 'aldea',
    doorToXHeight: 0.7, // alto de la puerta = 0.7 × altura de x
    depth: 0.16, // profundidad de las letras (× em)
    bevel: 0.008, // chaflán de las letras (× em)
    curveSegments: 14,
  },

  materials: {
    wall: { color: '#1a1a1c', roughness: 0.92 },
    room: { color: '#232326', roughness: 0.88 },
    // Hormigón oscuro pulido: albedo bajo pero no nulo (para que el charco difuso se lea) y un
    // especular reducido (F0 ≈ 0.02) para que el reflejo de la lámpara sea un brillo, no un espejo.
    floor: { color: '#262628', roughness: 0.44, specularIntensity: 0.5 },
    leaf: { mode: 'white', white: PALETTE.white, roughness: 0.82 }, // 'white' | 'accent'
    text: { color: PALETTE.white, roughness: 0.48 },
  },

  light: {
    accentPreset: 'celeste', // 'celeste' | 'naranja' | 'libre'
    accent: PALETTE.accents.celeste,
    intensity: 1.0, // multiplicador global de la fuente
    temperature: 6500, // K de la base neutra
    tint: 0.95, // 0 = blanco a la temperatura elegida · 1 = color de acento puro
    shadowBlur: 26, // difusión de la sombra: radio de blur VSM (texels de un mapa de 1024)
    penumbra: 0.9,

    // En Wordmark la puerta es chica y la cámara está lejos: la fuente rinde más para que el
    // charco se lea delante de las letras.
    modeGain: { door: 1, wordmark: 3.2 },

    // Lámpara dentro de la habitación, detrás del vano. Posición relativa:
    // x y z en múltiplos de w (z = distancia detrás de la cara interior del muro), y en múltiplos de h.
    //  · más lejos del muro que el radio de giro de la hoja (w): la hoja siempre queda entre la
    //    lámpara y el vano, así su sombra recorta el charco como en una puerta real;
    //  · un poco más baja que la puerta (y < 1): si estuviera más alta "vería" por encima del canto
    //    de la hoja entreabierta y aparecería una franja de luz suelta lejos del umbral;
    //  · en Wordmark se corre a la derecha: los rayos cruzan la parte descubierta del vano en
    //    diagonal y caen sobre el piso delante de las letras, sin chocar con la "a".
    key: {
      candela: 95,
      position: { door: { x: 0.12, y: 0.92, z: 1.3 }, wordmark: { x: 1.05, y: 0.92, z: 1.15 } },
      target: { door: { x: -0.05, y: 0, z: 1.1 }, wordmark: { x: -1.9, y: 0, z: 2.6 } },
      angle: 40, // semiapertura del cono (grados)
      shadowMapSize: 1024, // con sombras tan difusas, 2048 no suma detalle y cuesta 4× al animar
    },
    // Misma lámpara, mirando hacia el interior: el fondo se ve iluminado a través del arco.
    // Cono moderado: con 80° la cámara de sombra abarca 160° y los texels son tan grandes que el
    // blur VSM festonea la esquina piso/pared del fondo.
    interior: { candela: 240, angle: 58, shadowMapSize: 1024, blur: 0.3, bias: -0.0015 },
    // Rebote del piso que la lámpara ilumina entre la hoja y el vano: luz baja, del lado derecho
    // de la habitación, mirando hacia la hoja. Esa zona sólo existe con la puerta abierta, así que
    // su intensidad escala con la apertura. Le da volumen a la cara visible de la hoja.
    bounce: {
      candela: 6,
      angle: 70,
      shadowMapSize: 512,
      blur: 1.2,
      bias: -0.001,
      position: { x: 0.95, y: 0.08, z: 0.95 },
      target: { x: -0.35, y: 0.5, z: 0.6 },
    },
    // Relleno suave en el vano (RectAreaLight, sin sombras), en nits.
    fill: { nits: 8 },
    // Luz ambiente mínima para que el negro no sea plano.
    ambient: 0.015,
    // Relleno frontal neutro (sólo para legibilidad de las letras en Wordmark).
    front: { door: 0.0, wordmark: 4.5 },
  },

  fog: {
    enabled: true,
    density: 0.035, // FogExp2
    scattering: 0.12, // σ del haz = densidad × esto (m⁻¹): apenas se intuye
  },

  post: {
    exposure: 0.75,
    toneMapping: 'ACES', // 'ACES' | 'AgX' — ACES conserva mejor la saturación del acento
    bloom: { enabled: true, intensity: 0.45, threshold: 0.9, smoothing: 0.5, radius: 0.6 },
    godRays: { enabled: false, intensity: 0.6 },
    smaa: true,
    multisampling: 4,
  },

  camera: {
    fov: 32,
    heightFactor: 0.42, // altura de cámara = 42% del alto de la puerta (en Wordmark, de la "l")
    door: { frame: 0.42 }, // la puerta ocupa ~42% del alto de cuadro
    wordmark: { frame: 0.78 }, // el logotipo ocupa ~78% del ancho de cuadro
    near: 0.05,
    far: 200,
  },

  quality: {
    maxPixelRatio: 2,
    minFps: 40, // por debajo de esto se reduce el shadow map
    shadowSizes: [1024, 768, 512], // niveles del shadow map principal (FPS adaptativo)
    volumetricScale: 0.5, // resolución del haz volumétrico (× CSS px)
    volumetricSteps: 40,
  },

  export: { scale: 2 },
};

const REF_RATIO = 1.25;

// Medidas derivadas de la puerta (todas en metros).
//  · Modo Puerta: w = tamaño, h = w × ratio (el ratio estira la altura).
//  · Modo Wordmark: el alto lo fija la tipografía (0.7 × altura de x), así que el ratio ajusta el
//    ancho: h = tamaño × 1.25, w = h / ratio. El "tamaño" escala todo el logotipo.
export function doorDims(cfg = CONFIG) {
  let w = cfg.door.width;
  let h = w * cfg.door.ratio;
  if (cfg.mode === 'wordmark') {
    h = cfg.door.width * REF_RATIO;
    w = h / cfg.door.ratio;
  }
  return {
    w,
    h,
    depth: cfg.door.wallDepth * w,
    leaf: cfg.door.leafThickness * w,
  };
}
