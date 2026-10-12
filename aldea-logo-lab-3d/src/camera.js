import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Cámara frontal en perspectiva de un punto + OrbitControls con límites:
// nunca por debajo del piso ni detrás del muro (z = 0).

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createCameraRig(cfg, canvas) {
  const camera = new THREE.PerspectiveCamera(cfg.camera.fov, 1, cfg.camera.near, cfg.camera.far);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.8;
  controls.maxDistance = 40;
  controls.minAzimuthAngle = THREE.MathUtils.degToRad(-78);
  controls.maxAzimuthAngle = THREE.MathUtils.degToRad(78);
  controls.minPolarAngle = THREE.MathUtils.degToRad(8);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(96);
  controls.screenSpacePanning = true;

  // Encuadre frontal: lo calcula main.js según el modo (centro, alto de cámara, distancia).
  const frontal = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  let tween = null;

  // Mantiene cámara y target en zona válida (delante del muro, sobre el piso).
  function clamp() {
    const t = controls.target;
    t.y = THREE.MathUtils.clamp(t.y, 0.02, 6);
    t.z = THREE.MathUtils.clamp(t.z, 0, 8);
    t.x = THREE.MathUtils.clamp(t.x, -12, 12);
    const p = camera.position;
    p.y = Math.max(p.y, 0.04);
    p.z = Math.max(p.z, 0.25);
  }

  const api = {
    camera,
    controls,
    frontal,

    setFrontal(target, distance) {
      frontal.target.copy(target);
      frontal.position.set(target.x, target.y, target.z + distance);
    },

    // Salto inmediato a la vista frontal.
    snapToFrontal() {
      tween = null;
      camera.position.copy(frontal.position);
      controls.target.copy(frontal.target);
      camera.lookAt(frontal.target);
      controls.update();
    },

    // "Volver a la vista frontal" con una transición suave.
    animateToFrontal(duration = 1.1) {
      tween = {
        t: 0,
        duration,
        fromPos: camera.position.clone(),
        fromTarget: controls.target.clone(),
      };
    },

    resize(width, height) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },

    // Devuelve true si la cámara se movió (para el FPS adaptativo / acumulación).
    update(dt) {
      if (tween) {
        tween.t = Math.min(tween.t + dt / tween.duration, 1);
        const k = easeInOutCubic(tween.t);
        camera.position.lerpVectors(tween.fromPos, frontal.position, k);
        controls.target.lerpVectors(tween.fromTarget, frontal.target, k);
        if (tween.t >= 1) tween = null;
      }
      controls.update();
      clamp();
    },
  };

  return api;
}
