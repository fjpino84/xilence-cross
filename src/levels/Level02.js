// Nivel 02 — Kessen-Vahl (Estación de tránsito)
class Level02 extends Level {
  constructor() {
    super({
      name: 'Nivel 2 — Kessen-Vahl',
      width: 4200,
      backgroundKey: 'bgLevel02',
      ambient: 'motes',
      glowColor: 'rgba(255, 0, 60, 0.35)',
      patrols: [
        { x: 480, y: 440 },
        { x: 1100, y: 470 },
        { x: 1900, y: 430 },
        { x: 2700, y: 480 },
      ],
      waves: [
        { triggerX: 800, spawns: [{ y: 420 }, { y: 470 }, { y: 495 }] },
        { triggerX: 1700, spawns: [{ y: 410 }, { y: 450 }, { y: 480 }, { y: 495 }] },
        { triggerX: 2700, spawns: [{ y: 400 }, { y: 430 }, { y: 460 }, { y: 485 }, { y: 495 }] },
        { triggerX: 3600, spawns: [{ y: 400 }, { y: 425 }, { y: 450 }, { y: 475 }, { y: 495 }, { y: 410 }] },
      ],
    });
  }
}
