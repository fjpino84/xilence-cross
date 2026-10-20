// Nivel 01 — Anclaje Sur (Cementerio de naves): 12 escenarios en fila, en el orden de sus nombres (escena 1 … escena 12).
// La escena 7 es la del sub jefe (Rex Vane) y la 12 la del jefe (Batuk). Las ilustraciones tienen el cielo transparente: detrás
// se ve el fondo lejano (la ciudad) con parallax. Los objetos y primeros planos se reparten al azar en cada partida (ver Props.js).
class Level01 extends Level {
  static COUNT = 12;
  static SUB_BOSS_POSITION = 7;
  static BOSS_POSITION = 12;
  static BACKDROP = 'bgNFondo';

  // Encuentro de cada posición: enemigos normales (Martillo) y élites (Garra). El sub jefe y el jefe se configuran aparte
  static ENCOUNTERS = {
    2: { normal: 2 },
    3: { normal: 2 },
    4: { normal: 2, elite: 1 },
    5: { normal: 2, elite: 1 },
    6: { normal: 3, elite: 1 },
    7: { boss: true }, // sub jefe: Rex Vane
    8: { normal: 2, elite: 1 },
    9: { normal: 3, elite: 1 },
    10: { normal: 2, elite: 2 },
    11: { normal: 3, elite: 2 },
    12: { normal: 2, elite: 2 }, // tras este encuentro entra Batuk
  };

  // Escenarios de la partida: siempre los mismos y en orden
  static planScenarios() {
    return Array.from({ length: Level01.COUNT }, (_, index) => ({ key: 'bgN' + (index + 1), flip: false }));
  }

  constructor() {
    const sequence = Level01.planScenarios();
    const waves = Object.entries(Level01.ENCOUNTERS).map(([position, encounter]) => ({
      // Se activa al entrar en la zona central del escenario
      triggerX: (Number(position) - 1) * Level.TILE_STRIDE + 520,
      difficulty: (Number(position) - 2) / (Level01.COUNT - 2), // 0 en el primer encuentro, 1 en el último
      spawns: [
        ...Array.from({ length: encounter.normal || 0 }, () => ({})),
        ...Array.from({ length: encounter.elite || 0 }, () => ({ elite: true })),
        ...(encounter.boss ? [{ boss: true }] : []),
      ],
    }));
    super({
      name: 'Nivel 1 — Anclaje Sur',
      width: (Level01.COUNT - 1) * Level.TILE_STRIDE + Level.TILE_WIDTH,
      backgroundKey: 'bgLevel01',
      backgroundSequence: sequence,
      backdropKey: Level01.BACKDROP,
      ambient: 'rain',
      skyTop: CONFIG.COLORS.NAVY,
      skyBottom: '#0d0d3a',
      glowColor: 'rgba(124, 58, 255, 0.45)',
      // Centinelas que patrullan el primer escenario
      patrols: [
        { x: 620, y: 440 },
        { x: 1250, y: 470 },
      ],
      waves,
    });
  }
}
