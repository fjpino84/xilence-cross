// Cuadros de derrota (4 por personaje) de los adversarios 1, 2 y 3 y de Rex Vane, cortados de las hojas "Derrota" con tools/make_defeats.js.
// Todos los cuadros de un personaje comparten escala: STAND = altura en pantalla (px) de la viñeta 1 (el personaje de pie).
class DefeatFrames {
  // [ancho, alto, ancla horizontal 0-1] de cada cuadro en el PNG (alto de la viñeta 1 = 300 px)
  static META = {"adv1":[{"w":287,"h":324,"anchor":0.514},{"w":281,"h":337,"anchor":0.483},{"w":275,"h":339,"anchor":0.524},{"w":281,"h":255,"anchor":0.505}],"adv2":[{"w":276,"h":326,"anchor":0.515},{"w":265,"h":335,"anchor":0.542},{"w":479,"h":168,"anchor":0.506},{"w":538,"h":161,"anchor":0.536}],"rex":[{"w":274,"h":336,"anchor":0.452},{"w":278,"h":359,"anchor":0.468},{"w":408,"h":194,"anchor":0.427},{"w":608,"h":145,"anchor":0.493}],"op":[{"w":207,"h":299,"anchor":0.439},{"w":244,"h":231,"anchor":0.454},{"w":346,"h":147,"anchor":0.537},{"w":420,"h":137,"anchor":0.525}]};
  static STAND = { adv1: 205, adv2: 165, rex: 230, op: 156 };
  // Hacia qué lado queda la cabeza al tumbarse en el dibujo original (-1 izquierda, 1 derecha)
  // Ajuste por cuadro [escala, bajar px]: al caer la armadura queda más pequeña y más abajo
  static TWEAK = { adv1: [[1, 0], [1, 0], [0.9, 6], [0.78, 14]], adv2: [[1, 0], [1, 0], [0.95, 4], [0.88, 8]], rex: [[1, 0], [1, 0], [1, 0], [1, 0]], op: [[1, 0], [1, 0], [1, 0], [1, 0]] };
  static HEAD = { adv1: -1, adv2: -1, rex: -1, op: 1 };

  static has(id) { return !!Assets.image('df_' + id + '_1'); }

  // Se tumban con la cabeza lejos de quien los golpeó (enemyFacing = hacia dónde mira el personaje, o sea hacia ECO)
  static facingFor(id, enemyFacing) {
    return DefeatFrames.HEAD[id] === -enemyFacing ? 1 : -1;
  }

  // Dibuja el cuadro n (1-4) con los pies en (x, footY). options: alpha, flash, tint, additive, offsetX, offsetY, scale
  static draw(ctx, id, n, x, footY, enemyFacing, options = {}) {
    const image = Assets.image('df_' + id + '_' + n);
    const info = DefeatFrames.META[id][n - 1];
    if (!image || !info) return;
    const height = info.h * (DefeatFrames.STAND[id] / 300) * (options.scale || 1);
    Sprite.draw(ctx, image, {
      x: x + (options.offsetX || 0), y: footY + (options.offsetY || 0), height, anchorX: info.anchor, facing: DefeatFrames.facingFor(id, enemyFacing),
      alpha: options.alpha ?? 1, flash: !!options.flash, tint: options.tint || null, additive: !!options.additive,
    });
  }
}
