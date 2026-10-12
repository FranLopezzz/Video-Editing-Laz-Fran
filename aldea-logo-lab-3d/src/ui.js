import GUI from 'lil-gui';
import { PALETTE } from './config.js';

// Panel de controles (lil-gui). Edita el objeto CONFIG y llama a las acciones de main.js:
//   applyLook()      luz, materiales, post, apertura (barato)
//   applyGeometry()  ratio / tamaño (reconstruye geometrías)

export function createUI(cfg, actions) {
  const gui = new GUI({ title: 'aldea. — logo lab 3d', width: 300 });
  gui.domElement.classList.add('aldea-gui');

  const look = () => actions.applyLook();
  const geometry = () => actions.applyGeometry();

  // Proxy para controles que no mapean 1:1 con CONFIG.
  const proxy = {
    mode: cfg.mode,
    accentPreset: cfg.light.accentPreset,
    accentFree: cfg.light.accent,
    leaf: cfg.materials.leaf.mode,
    shadowTier: 0,
    get fps() {
      return actions.quality.fps ? Math.round(actions.quality.fps) : 0;
    },
  };

  // --- Escena ---------------------------------------------------------------
  const fScene = gui.addFolder('Escena');
  fScene
    .add(proxy, 'mode', { Puerta: 'door', Wordmark: 'wordmark' })
    .name('Modo')
    .onChange((v) => actions.setMode(v));
  fScene.add({ frontal: actions.frontal }, 'frontal').name('Volver a la vista frontal');
  const exportBtn = fScene
    .add(
      {
        exportPNG: async () => {
          exportBtn.disable();
          exportBtn.name('Exportando…');
          try {
            await actions.exportPNG();
          } finally {
            exportBtn.name('Exportar PNG (2×)');
            exportBtn.enable();
          }
        },
      },
      'exportPNG',
    )
    .name('Exportar PNG (2×)');

  // --- Puerta ---------------------------------------------------------------
  const fDoor = gui.addFolder('Puerta');
  fDoor.add(cfg.door, 'openAngle', 0, 110, 0.5).name('Apertura (°)').onChange(look);
  fDoor.add({ toggle: actions.toggleDoor }, 'toggle').name('Abrir / cerrar');
  fDoor.add(cfg.door, 'ratio', 1.0, 1.7, 0.01).name('Ratio de altura').onChange(geometry);
  fDoor.add(cfg.door, 'width', 0.5, 2.0, 0.01).name('Tamaño').onChange(geometry);
  fDoor
    .add(proxy, 'leaf', { 'Blanco mate': 'white', 'Acento oscurecido 50%': 'accent' })
    .name('Material de la hoja')
    .onChange((v) => {
      cfg.materials.leaf.mode = v;
      look();
    });

  // --- Luz ------------------------------------------------------------------
  const fLight = gui.addFolder('Luz');
  let freeColor = null;
  const syncAccent = () => {
    const preset = proxy.accentPreset;
    cfg.light.accentPreset = preset;
    cfg.light.accent = preset === 'libre' ? proxy.accentFree : PALETTE.accents[preset];
    freeColor.show(preset === 'libre');
    look();
  };
  fLight
    .add(proxy, 'accentPreset', { 'Celeste #00BEFF': 'celeste', 'Naranja #EE7A3A': 'naranja', Libre: 'libre' })
    .name('Color del acento')
    .onChange(syncAccent);
  freeColor = fLight.addColor(proxy, 'accentFree').name('Color libre').onChange(syncAccent);
  freeColor.show(proxy.accentPreset === 'libre');
  fLight.add(cfg.light, 'intensity', 0, 3, 0.01).name('Intensidad').onChange(look);
  fLight.add(cfg.light, 'temperature', 2000, 10000, 50).name('Temperatura (K)').onChange(look);
  fLight.add(cfg.light, 'tint', 0, 1, 0.01).name('Tinte (blanco → acento)').onChange(look);
  fLight.add(cfg.light, 'shadowBlur', 1, 48, 0.5).name('Difusión de la sombra').onChange(look);
  fLight.add(cfg.light, 'penumbra', 0, 1, 0.01).name('Penumbra de la spot').onChange(look);

  // --- Atmósfera ------------------------------------------------------------
  const fAtmo = gui.addFolder('Atmósfera');
  fAtmo.add(cfg.fog, 'enabled').name('Niebla').onChange(look);
  fAtmo.add(cfg.fog, 'density', 0, 0.12, 0.001).name('Densidad').onChange(look);
  fAtmo.add(cfg.post.godRays, 'enabled').name('God rays').onChange(look);
  fAtmo.add(cfg.post.godRays, 'intensity', 0, 2, 0.01).name('Intensidad god rays').onChange(look);

  // --- Imagen ---------------------------------------------------------------
  const fPost = gui.addFolder('Imagen');
  fPost.add(cfg.post.bloom, 'enabled').name('Bloom').onChange(look);
  fPost.add(cfg.post.bloom, 'intensity', 0, 2, 0.01).name('Intensidad bloom').onChange(look);
  fPost.add(cfg.post, 'exposure', 0.1, 3, 0.01).name('Exposición').onChange(look);
  fPost.add(cfg.post, 'toneMapping', ['ACES', 'AgX']).name('Tone mapping').onChange(look);
  fPost.add(cfg.post, 'smaa').name('SMAA').onChange(look);

  // --- Piso -----------------------------------------------------------------
  const fFloor = gui.addFolder('Piso');
  fFloor.add(cfg.materials.floor, 'roughness', 0.35, 0.5, 0.005).name('Brillo (roughness)').onChange(look);

  // --- Calidad --------------------------------------------------------------
  const fQuality = gui.addFolder('Calidad');
  fQuality.add(proxy, 'fps').name('FPS').listen().disable();
  fQuality.add(actions.quality, 'auto').name('Ajuste automático (< 40 fps)');
  const tierOptions = {};
  actions.tiers.forEach((t, i) => {
    tierOptions[`${t.shadow}px · ${t.steps} pasos · ${t.dpr}× px`] = i;
  });
  const tierCtrl = fQuality
    .add(proxy, 'shadowTier', tierOptions)
    .name('Shadow map / nivel')
    .onChange((i) => actions.setQualityTier(i));
  fQuality.close();

  // Abrir sólo lo esencial en pantallas chicas.
  if (window.innerWidth < 720) {
    gui.close();
  } else {
    [fLight, fAtmo, fPost, fFloor].forEach((f) => f.close());
  }

  return {
    gui,
    refresh() {
      proxy.shadowTier = actions.quality.tier;
      tierCtrl.updateDisplay();
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    },
  };
}
