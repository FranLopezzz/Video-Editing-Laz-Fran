import * as THREE from 'three';

// Materiales de la escena. Paleta mínima: negros, blanco y el acento sólo en la luz
// (y opcionalmente en la hoja).

export function createMaterials(cfg) {
  const m = cfg.materials;

  const wall = new THREE.MeshStandardMaterial({
    name: 'Wall',
    color: m.wall.color,
    roughness: m.wall.roughness,
    metalness: 0,
  });

  const room = new THREE.MeshStandardMaterial({
    name: 'Room',
    color: m.room.color,
    roughness: m.room.roughness,
    metalness: 0,
    side: THREE.BackSide, // la caja se ve desde adentro
  });

  // Piso oscuro, levemente brillante: dieléctrico con roughness media. Nada de espejo.
  const floor = new THREE.MeshPhysicalMaterial({
    name: 'Floor',
    color: m.floor.color,
    roughness: m.floor.roughness,
    metalness: 0,
    specularIntensity: m.floor.specularIntensity,
  });

  const leaf = new THREE.MeshStandardMaterial({
    name: 'Leaf',
    color: m.leaf.white,
    roughness: m.leaf.roughness,
    metalness: 0,
  });

  const text = new THREE.MeshPhysicalMaterial({
    name: 'Text',
    color: m.text.color,
    roughness: m.text.roughness,
    metalness: 0,
  });

  const api = {
    wall,
    room,
    floor,
    leaf,
    text,

    update(c = cfg) {
      floor.roughness = c.materials.floor.roughness;

      // Hoja: blanco mate o color del acento oscurecido al 50%.
      if (c.materials.leaf.mode === 'accent') {
        // 50% en sRGB (lo que un diseñador entiende por "oscurecido al 50%"), no en lineal.
        const srgb = new THREE.Color(c.light.accent).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
        leaf.color.setRGB(srgb.r * 0.5, srgb.g * 0.5, srgb.b * 0.5, THREE.SRGBColorSpace);
      } else {
        leaf.color.set(c.materials.leaf.white);
      }
    },
  };

  api.update(cfg);
  return api;
}
