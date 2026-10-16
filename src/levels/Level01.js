// Nivel 01 — Anclaje Sur (Cementerio de naves): 10 escenarios en fila.
// El 1.º es siempre el de apertura, el 5.º es el del sub jefe y el 10.º el del jefe. Los demás se sortean en cada partida
// (sin repetir el mismo escenario dos veces seguidas). Cada escenario, del 2.º al 10.º, tiene su propio encuentro.
class Level01 extends Level {
  static OPENING = 'bgLevel01a';
  static REGULAR = ['bgLevel01a', 'bgLevel01b', 'bgLevel01c', 'bgLevel01d', 'bgLevel01e'];
  static SUB_BOSS = 'bgLevel01s';
  static BOSS = 'bgLevel01j';
  static COUNT = 10;
  static SUB_BOSS_POSITION = 5;
  static BOSS_POSITION = 10;

  // Encuentro de cada posición: enemigos normales (Martillo) y élites (Garra). El sub jefe y el jefe se configuran aparte
  static ENCOUNTERS = {
    2: { normal: 2 },
    3: { normal: 2, elite: 1 },
    4: { normal: 2, elite: 1 },
    5: { boss: true }, // sub jefe: Rex Vane
    6: { normal: 2, elite: 1 },
    7: { normal: 3, elite: 1 },
    8: { normal: 2, elite: 2 },
    9: { normal: 3, elite: 2 },
    10: { normal: 2, elite: 2 },
  };

  // Elige los escenarios de la partida. Prefiere los menos usados y evita repetir el vecino.
  // El escenario "e" se parece al del sub jefe, así que no se coloca pegado a él.
  static planScenarios() {
    const used = new Map(Level01.REGULAR.map((key) => [key, 0]));
    const keys = [];
    for (let position = 1; position <= Level01.COUNT; position++) {
      if (position === Level01.SUB_BOSS_POSITION) { keys.push(Level01.SUB_BOSS); continue; }
      if (position === Level01.BOSS_POSITION) { keys.push(Level01.BOSS); continue; }
      if (position === 1) {
        keys.push(Level01.OPENING);
        used.set(Level01.OPENING, 1);
        continue;
      }
      const previous = keys[keys.length - 1];
      const nextToSubBoss = Math.abs(position - Level01.SUB_BOSS_POSITION) === 1;
      const candidates = Level01.REGULAR.filter((key) => key !== previous && !(nextToSubBoss && key === 'bgLevel01e'));
      const least = Math.min(...candidates.map((key) => used.get(key)));
      const pool = candidates.filter((key) => used.get(key) === least);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      used.set(pick, used.get(pick) + 1);
      keys.push(pick);
    }
    return keys.map((key, index) => {
      const special = key === Level01.SUB_BOSS || key === Level01.BOSS;
      return { key, flip: !special && index > 0 && Math.random() < 0.5 };
    });
  }

  constructor() {
    const sequence = Level01.planScenarios();
    const waves = Object.entries(Level01.ENCOUNTERS).map(([position, encounter]) => ({
      // Se activa al entrar en la zona central del escenario
      triggerX: (Number(position) - 1) * Level.TILE_STRIDE + 520,
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
