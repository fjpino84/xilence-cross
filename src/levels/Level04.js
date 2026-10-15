// Nivel 04 — Vareth Prime (Colonia agrícola)
class Level04 extends Level {
  constructor() {
    super({
      name: 'Nivel 4 — Vareth Prime',
      width: 4400,
      backgroundKey: 'bgLevel04',
      ambient: 'fireflies',
      glowColor: 'rgba(255, 160, 60, 0.35)',
      patrols: [
        { x: 520, y: 450 },
        { x: 1200, y: 480 },
        { x: 2000, y: 440 },
        { x: 2900, y: 470 },
      ],
      waves: [
        { triggerX: 800, spawns: [{ y: 430 }, { y: 460 }, { y: 490 }, { y: 410 }] },
        { triggerX: 1800, spawns: [{ y: 410 }, { y: 440 }, { y: 465 }, { y: 490 }, { y: 495 }] },
        { triggerX: 2800, spawns: [{ y: 400 }, { y: 425 }, { y: 450 }, { y: 475 }, { y: 495 }, { y: 415 }] },
        { triggerX: 3800, spawns: [{ y: 400 }, { y: 420 }, { y: 445 }, { y: 465 }, { y: 485 }, { y: 495 }] },
      ],
    });
  }
}
