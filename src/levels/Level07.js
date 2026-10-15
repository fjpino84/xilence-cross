// Nivel 07 — Ignaro (Planeta en llamas)
class Level07 extends Level {
  constructor() {
    super({
      name: 'Nivel 7 — Ignaro',
      width: 4600,
      backgroundKey: 'bgLevel07',
      ambient: 'embers',
      glowColor: 'rgba(255, 90, 0, 0.45)',
      patrols: [
        { x: 520, y: 450 },
        { x: 1250, y: 470 },
        { x: 2100, y: 430 },
        { x: 3000, y: 480 },
      ],
      waves: [
        { triggerX: 800, spawns: [{ y: 420 }, { y: 450 }, { y: 480 }, { y: 495 }] },
        { triggerX: 1800, spawns: [{ y: 405 }, { y: 430 }, { y: 455 }, { y: 480 }, { y: 495 }] },
        { triggerX: 2900, spawns: [{ y: 400 }, { y: 420 }, { y: 445 }, { y: 465 }, { y: 485 }, { y: 495 }] },
        { triggerX: 4000, spawns: [{ y: 400 }, { y: 415 }, { y: 435 }, { y: 455 }, { y: 475 }, { y: 490 }, { y: 497 }] },
      ],
    });
  }
}
