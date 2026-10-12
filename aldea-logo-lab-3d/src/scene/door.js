import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { doorDims } from '../config.js';

// Geometría de la puerta-punto:
//   · muro con espesor (0.3 w) y el vano en arco recortado (Shape con hole, extruido)
//   · hoja con la misma silueta del vano (0.06 w), bisagra en el borde izquierdo,
//     apoyada en la cara INTERIOR del muro y abriendo HACIA ADENTRO
//   · habitación cerrada detrás del vano
//
// Convenciones: la cara exterior del muro está en z = 0 y mira a +z (hacia la cámara).
// La cara interior está en z = -depth. El vano está centrado en x = 0 y apoya en el piso (y = 0).

const CREASE = THREE.MathUtils.degToRad(35);

// Silueta del arco: ancho w, alto total h, techo semicircular de radio w/2.
// x0 = borde izquierdo. Recorrido antihorario.
export function archPath(path, x0, w, h) {
  const r = w / 2;
  const springY = h - r; // donde arranca la curva
  path.moveTo(x0, 0);
  path.lineTo(x0 + w, 0);
  path.lineTo(x0 + w, springY);
  path.absarc(x0 + r, springY, r, 0, Math.PI, false);
  path.lineTo(x0, 0);
  return path;
}

function wallGeometry(cfg) {
  const { w, h, depth } = doorDims(cfg);
  const W = cfg.door.wall.width * w;
  const H = cfg.door.wall.height * w;

  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, 0);
  shape.lineTo(W / 2, 0);
  shape.lineTo(W / 2, H);
  shape.lineTo(-W / 2, H);
  shape.lineTo(-W / 2, 0);

  const hole = archPath(new THREE.Path(), -w / 2, w, h);
  shape.holes.push(hole);

  let geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: cfg.door.curveSegments,
  });
  geo.translate(0, 0, -depth); // cara exterior en z = 0
  geo = toCreasedNormals(geo, CREASE); // el intradós del arco queda liso, las aristas vivas
  return geo;
}

function leafGeometry(cfg) {
  const { w, h, leaf } = doorDims(cfg);
  const bevel = Math.min(cfg.door.leafBevel * w, leaf * 0.3);

  // Hoja en coordenadas locales de la bisagra: x ∈ [0, w], z ∈ [0, leaf].
  // El eje de giro es el canto izquierdo de la cara INTERIOR de la hoja (z = 0 local),
  // como una bisagra real de puerta que abre hacia adentro.
  const shape = archPath(new THREE.Shape(), 0, w, h);
  let geo = new THREE.ExtrudeGeometry(shape, {
    depth: leaf - 2 * bevel,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel, // el chaflán no agranda la silueta: la hoja sigue siendo idéntica al vano
    bevelSegments: 2,
    curveSegments: cfg.door.curveSegments,
  });
  geo.translate(0, 0, bevel); // cara interior en z = 0, frente en z = leaf (local)
  geo = toCreasedNormals(geo, CREASE);
  return geo;
}

function roomGeometry(cfg) {
  const { w, h } = doorDims(cfg);
  const room = cfg.door.room;
  return new THREE.BoxGeometry(room.width * w, room.height * h, room.depth * w);
}

export function createDoor(cfg, materials) {
  const group = new THREE.Group();
  group.name = 'DoorAssembly';

  // Muro exterior.
  const wall = new THREE.Mesh(wallGeometry(cfg), materials.wall);
  wall.name = 'Wall';
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // Hoja. El pivote es la bisagra: borde izquierdo del vano, detrás de la cara interior del muro.
  const hinge = new THREE.Group();
  hinge.name = 'Hinge';
  const leaf = new THREE.Mesh(leafGeometry(cfg), materials.leaf);
  leaf.name = 'Leaf';
  leaf.castShadow = true;
  leaf.receiveShadow = true;
  hinge.add(leaf);
  group.add(hinge);

  // Habitación interior: caja vista desde adentro, sin la cara frontal (la cierra el muro)
  // ni el piso (lo aporta el piso general, que continúa hacia adentro).
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const room = new THREE.Mesh(roomGeometry(cfg), [
    materials.room, // +x
    materials.room, // -x
    materials.room, // +y (techo)
    hidden, // -y (piso: lo pone el piso general)
    hidden, // +z (frente: es el muro)
    materials.room, // -z (fondo)
  ]);
  room.name = 'Room';
  room.castShadow = true;
  room.receiveShadow = true;
  group.add(room);

  const api = {
    group,
    wall,
    hinge,
    leaf,
    room,
    dims: doorDims(cfg),

    // Reconstruye geometrías (ratio, tamaño) y reubica bisagra y habitación.
    rebuild(nextCfg = cfg) {
      cfg = nextCfg;
      const d = doorDims(cfg);
      api.dims = d;

      wall.geometry.dispose();
      wall.geometry = wallGeometry(cfg);
      leaf.geometry.dispose();
      leaf.geometry = leafGeometry(cfg);
      room.geometry.dispose();
      room.geometry = roomGeometry(cfg);

      hinge.position.set(-d.w / 2, 0, -d.depth - d.leaf);
      room.position.set(0, (cfg.door.room.height * d.h) / 2, -d.depth - (cfg.door.room.depth * d.w) / 2);
      api.setOpenAngle(cfg.door.openAngle);
    },

    // Abre hacia adentro: rotación +θ alrededor de Y lleva el borde libre hacia -z.
    // Con el eje en el canto interior, un punto local (x, z) con z ∈ [0, leaf] termina en
    // z' = -x·sinθ + z·cosθ ≤ leaf para todo θ ∈ [0°, 180°]: la hoja queda siempre en
    // z ≤ -depth, detrás del muro, que la tapa en cualquier ángulo.
    setOpenAngle(deg) {
      hinge.rotation.y = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(deg, 0, 110));
    },

    // Fracción del vano descubierta vista de frente (0 cerrada, 1 libre).
    openFraction(deg) {
      const t = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(deg, 0, 110));
      return THREE.MathUtils.clamp(1 - Math.cos(t), 0, 1);
    },
  };

  api.rebuild(cfg);
  return api;
}
