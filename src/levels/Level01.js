// Nivel 01 — Anclaje Sur (Cementerio de naves)
class Level01 extends Level {
  constructor() {
    super({
      name: 'Nivel 1 — Anclaje Sur',
      width: 4000,
      backgroundKey: 'bgLevel01',
      // Tres ilustraciones encadenadas con fundido; la segunda mitad se recorre en espejo (C y B reflejadas).
      // Como C se refleja sobre su propio borde, esa unión central queda perfecta.
      backgroundSequence: [
        { key: 'bgLevel01a' },
        { key: 'bgLevel01b' },
        { key: 'bgLevel01c' },
        { key: 'bgLevel01c', flip: true },
        { key: 'bgLevel01b', flip: true },
      ],
      ambient: 'rain',
      skyTop: CONFIG.COLORS.NAVY,
      skyBottom: '#0d0d3a',
      glowColor: 'rgba(124, 58, 255, 0.45)',
      // Centinelas que patrullan el mapa antes de las oleadas
      patrols: [
        { x: 1250, y: 470 },
        { x: 2150, y: 440 },
      ],
      // Cada oleada bloquea la cámara hasta que todos sus enemigos caen
      waves: [
        { triggerX: 800, spawns: [{ y: 420 }, { y: 470 }] },
        { triggerX: 1700, spawns: [{ y: 410 }, { y: 460 }] },
        { triggerX: 2600, spawns: [{ y: 400 }, { y: 440 }, { y: 480 }] },
        { triggerX: 3400, spawns: [{ y: 410 }, { y: 440 }, { y: 465 }] },
      ],
    });
  }
}
