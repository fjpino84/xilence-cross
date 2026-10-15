// Colisiones del beat 'em up: caja en X + tolerancia de profundidad (Y) + tolerancia de altura (Z).
const Collision = {
  // Intersección de rectángulos genéricos {x, y, w, h} con x,y en la esquina superior izquierda
  overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  },

  // ¿La caja de ataque {x (izquierda), w, y, z} alcanza a la entidad objetivo?
  hitTest(box, target, depthTolerance = 48, heightTolerance = 70) {
    const targetLeft = target.x - target.w / 2;
    return (
      box.x < targetLeft + target.w &&
      box.x + box.w > targetLeft &&
      Math.abs(box.y - target.y) <= depthTolerance &&
      Math.abs(box.z - target.z) <= heightTolerance
    );
  },

  // Caja de ataque frente a una entidad, según hacia dónde mira
  frontBox(entity, range, width = range) {
    const left = entity.facing > 0 ? entity.x + entity.w / 2 - 6 : entity.x - entity.w / 2 + 6 - width;
    return { x: left, w: width, y: entity.y, z: entity.z };
  },
};
