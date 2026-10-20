// Objetos y primeros planos del nivel (piezas de "Nuevo Level 2", assets/sprites/nivel1). Todo se reparte al azar en cada partida:
//  · objetos del escenario: pocos (0 a 2 por escena), sobre el suelo, ordenados por profundidad con los personajes (ECO pasa por delante
//    o por detrás según su carril);
//  · primeros planos de abajo: montones, escombros y carteles grandes pegados al borde inferior, delante de todo. Uno tapa cada unión
//    entre escenas y algunos más aparecen dentro de las escenas; se vuelven translúcidos cuando ECO pasa por detrás;
//  · primeros planos de arriba: lámparas y cables con bombillas que cuelgan del borde superior y se mecen.
class Props {
  static FRONT_PARALLAX = 1.14; // los de abajo se mueven algo más rápido que el fondo (más cerca de la cámara)
  static TOP_PARALLAX = 1.2;
  static TOP_ENABLED = false;

  // Objetos del suelo: h = altura en pantalla (px) a escala 1; lights = [fracción x, fracción y, color, radio, ritmo] de luces que laten
  static WORLD = {
    // carteles sobre poste
    obj1_7: { h: 132 }, obj1_8: { h: 132 }, obj1_9: { h: 132 }, obj1_10: { h: 138 },
    obj3_6: { h: 130 }, obj3_7: { h: 128 }, obj3_8: { h: 132 }, obj3_9: { h: 134 }, obj4_4: { h: 138 },
    // escombros, cajas, barriles y máquinas
    obj1_4: { h: 78 }, obj1_5: { h: 50 }, obj1_12: { h: 74 }, obj1_13: { h: 82 }, obj1_14: { h: 94, lights: [[0.82, 0.38, '#35e8ff', 14, 2.2]] },
    obj1_15: { h: 58 }, obj2_10: { h: 56 }, obj2_11: { h: 52 },
    obj3_1: { h: 86, lights: [[0.62, 0.3, '#35e8ff', 14, 2.6]] }, obj3_2: { h: 48 }, obj3_3: { h: 76 }, obj3_4: { h: 48 }, obj3_5: { h: 80 },
    obj3_10: { h: 86, lights: [[0.45, 0.3, '#35e8ff', 14, 2.0]] }, obj3_13: { h: 92 }, obj4_3: { h: 96 }, obj4_5: { h: 80 },
  };
  static SIGNS = ['obj1_7', 'obj1_8', 'obj1_9', 'obj1_10', 'obj3_6', 'obj3_7', 'obj3_8', 'obj3_9', 'obj4_4'];
  static DEBRIS = ['obj1_4', 'obj1_5', 'obj1_12', 'obj1_13', 'obj1_14', 'obj1_15', 'obj2_10', 'obj2_11', 'obj3_1', 'obj3_2', 'obj3_3',
    'obj3_4', 'obj3_5', 'obj3_10', 'obj3_13', 'obj4_3', 'obj4_5'];

  // Primeros planos de abajo (h = altura en pantalla; el pie queda un poco fuera de la pantalla)
  static BOTTOM = {
    fgA_1: { h: 190 }, fgA_2: { h: 190 }, fgA_3: { h: 190 }, fgR_1: { h: 200 }, fgR_2: { h: 250 },
    fgS_1: { h: 300, weight: 0.5 }, fgS_2: { h: 300, weight: 0.5 }, fgS_3: { h: 300, weight: 0.5 },
  };
  // Primeros planos de arriba: h = altura; lights = bombillas que brillan
  static TOP = {
    fgT_2: { h: 190, lights: [[0.18, 0.62, '#ffd890', 46, 1.1], [0.46, 0.66, '#ffd890', 46, 1.6], [0.72, 0.58, '#ffd890', 40, 1.3]] },
    fgT_3: { h: 104, lights: [[0.1, 0.8, '#ffd890', 26, 1.4], [0.36, 0.86, '#ffd890', 26, 1.1], [0.62, 0.86, '#ffd890', 26, 1.7], [0.88, 0.8, '#ffd890', 26, 1.2]] },
    fgT_4: { h: 128, lights: [[0.22, 0.78, '#ffe9b0', 24, 1.5], [0.5, 0.9, '#ffe9b0', 24, 1.2], [0.78, 0.84, '#ffe9b0', 24, 1.8]] },
  };

  constructor(level) {
    this.time = 0;
    const scenes = (level.config.backgroundSequence || []).length;
    const bossScenes = new Set([scenes > 6 ? 6 : -1, scenes - 1]); // sub jefe y jefe: la arena se deja más despejada
    const stride = Level.TILE_STRIDE;
    const overlap = Level.TILE_OVERLAP;
    const pickWeighted = (names, table, avoid) => {
      const pool = names.filter((name) => name !== avoid);
      const total = pool.reduce((sum, name) => sum + ((table[name] && table[name].weight) || 1), 0);
      let roll = Math.random() * total;
      for (const name of pool) {
        roll -= (table[name] && table[name].weight) || 1;
        if (roll <= 0) return name;
      }
      return pool[pool.length - 1];
    };

    // Objetos del escenario
    this.world = [];
    const used = new Set();
    for (let index = 0; index < scenes; index++) {
      const boss = bossScenes.has(index);
      const roll = Math.random();
      const count = boss ? (roll < 0.5 ? 1 : 0) : (roll < 0.15 ? 0 : roll < 0.6 ? 1 : 2);
      const left = index * stride + (index > 0 ? overlap + 60 : 80);
      const right = index * stride + Level.TILE_WIDTH - (index < scenes - 1 ? overlap + 60 : 80);
      let previousX = -1e9;
      for (let n = 0; n < count; n++) {
        let x = left + Math.random() * (right - left);
        if (boss) x = Math.random() < 0.5 ? left + Math.random() * 160 : right - Math.random() * 160; // lejos del centro de la arena
        if (Math.abs(x - previousX) < 220) x = Math.min(right, Math.max(left, x + (x < (left + right) / 2 ? 240 : -240)));
        previousX = x;
        const pool = Math.random() < 0.4 ? Props.SIGNS : Props.DEBRIS;
        // no se repite el mismo objeto en toda la partida mientras queden otros
        const fresh = pool.filter((candidate) => !used.has(candidate));
        const candidates = fresh.length ? fresh : pool;
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        used.add(chosen);
        const y = CONFIG.GROUND_TOP + 14 + Math.random() * (CONFIG.GROUND_BOTTOM - CONFIG.GROUND_TOP - 22);
        this.world.push({ name: chosen, x, y, flip: Math.random() < 0.5, phase: Math.random() * 6.28 });
      }
    }

    // Primeros planos de abajo: uno sobre cada unión y algunos sueltos dentro de las escenas
    const names = Object.keys(Props.BOTTOM);
    this.front = [];
    let previous = '';
    for (let index = 1; index < scenes; index++) {
      previous = pickWeighted(names, Props.BOTTOM, previous);
      this.front.push({ name: previous, x: index * stride + overlap / 2 + (Math.random() - 0.5) * 40, flip: Math.random() < 0.5, phase: Math.random() * 6.28 });
    }
    for (let index = 0; index < scenes; index++) {
      if (bossScenes.has(index) || Math.random() > 0.3) continue;
      previous = pickWeighted(names, Props.BOTTOM, previous);
      const x = index * stride + overlap + 150 + Math.random() * (Level.TILE_WIDTH - 2 * overlap - 300);
      this.front.push({ name: previous, x, flip: Math.random() < 0.5, phase: Math.random() * 6.28 });
    }

    // Primeros planos de arriba: desactivados (no gustaron); el código queda por si se quieren recuperar con TOP_ENABLED
    const topNames = Object.keys(Props.TOP);
    this.top = [];
    for (let index = 0; index < scenes; index++) {
      if (!Props.TOP_ENABLED || Math.random() > 0.35) continue;
      const name = topNames[Math.floor(Math.random() * topNames.length)];
      const x = index * stride + overlap + 120 + Math.random() * (Level.TILE_WIDTH - 2 * overlap - 240);
      this.top.push({ name, x, flip: Math.random() < 0.5, phase: Math.random() * 6.28 });
    }
  }

  update(dt) {
    this.time += dt;
  }

  // Luces que laten sobre un objeto (en pantalla): fracciones del sprite; espejo si el objeto está girado
  glows(ctx, item, def, sx, sy, width, height, alpha) {
    if (!def.lights || FX.low) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [fx, fy, color, radius, rate] of def.lights) {
      const lx = sx + ((item.flip ? 1 - fx : fx) - 0.5) * width;
      const ly = sy - height + fy * height;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * rate * 3 + item.phase);
      const size = radius * (1.2 + 0.5 * pulse);
      ctx.globalAlpha = (0.3 + 0.5 * pulse) * alpha;
      ctx.drawImage(Atmosphere.glowSprite(color), lx - size, ly - size, size * 2, size * 2);
    }
    ctx.restore();
  }

  // Objetos del suelo que están en pantalla, como "dibujables" para ordenarlos junto a los personajes por su línea de profundidad
  worldDrawables(camera) {
    const list = [];
    for (const item of this.world) {
      if (item.x < camera.left - 160 || item.x > camera.right + 160) continue;
      const def = Props.WORLD[item.name];
      list.push({
        occluder: true, x: item.x, y: item.y, sortY: item.y,
        render: (ctx) => {
          const image = Assets.image('pn_' + item.name);
          if (!image) return;
          const t = (item.y - CONFIG.GROUND_TOP) / (CONFIG.GROUND_BOTTOM - CONFIG.GROUND_TOP);
          const height = def.h * (0.92 + 0.16 * Math.max(0, Math.min(1, t)));
          const width = (image.width / image.height) * height;
          Sprite.draw(ctx, image, { x: item.x, y: item.y, height, anchorX: 0.5, facing: item.flip ? -1 : 1, tint: { color: '#0a0618', alpha: 0.14 } });
          this.glows(ctx, item, def, item.x, item.y, width, height, 1);
        },
      });
    }
    return list;
  }

  // Dibuja un sprite con su base en (sx, sy); devuelve su tamaño en pantalla
  drawImage(ctx, item, def, sx, sy, alpha, tint) {
    const image = Assets.image('pn_' + item.name);
    if (!image) return null;
    const height = def.h;
    const width = (image.width / image.height) * height;
    Sprite.draw(ctx, image, { x: sx, y: sy, height, anchorX: 0.5, facing: item.flip ? -1 : 1, tint, alpha });
    return { width, height };
  }

  // Primeros planos, delante de los personajes: los de abajo (translúcidos cuando ECO está justo detrás) y los de arriba (se mecen)
  renderFront(ctx, camera, player) {
    for (const item of this.front) {
      const sx = CONFIG.WIDTH / 2 + (item.x - camera.x - CONFIG.WIDTH / 2) * Props.FRONT_PARALLAX;
      if (sx < -400 || sx > CONFIG.WIDTH + 400) continue;
      const def = Props.BOTTOM[item.name];
      const image = Assets.image('pn_' + item.name);
      const halfWidth = image ? (image.width / image.height) * def.h * 0.5 : 200;
      let alpha = 0.97;
      if (player) {
        const near = Math.abs(player.x - camera.x - sx) < halfWidth * 0.8;
        const current = item.fade === undefined ? 1 : item.fade;
        item.fade = current + ((near ? 0.42 : 1) - current) * 0.12;
        alpha *= item.fade;
      }
      this.drawImage(ctx, item, def, sx, CONFIG.HEIGHT + 34, alpha, { color: '#05030c', alpha: 0.3 });
    }
    for (const item of this.top) {
      const sx = CONFIG.WIDTH / 2 + (item.x - camera.x - CONFIG.WIDTH / 2) * Props.TOP_PARALLAX;
      if (sx < -300 || sx > CONFIG.WIDTH + 300) continue;
      const def = Props.TOP[item.name];
      // cuelga del borde superior y se mece sobre su punto de sujeción
      const swing = Math.sin(this.time * 0.9 + item.phase) * 0.025 + Math.sin(this.time * 2.3 + item.phase * 2) * 0.01;
      ctx.save();
      ctx.translate(sx, -10);
      ctx.rotate(swing);
      ctx.translate(-sx, 10);
      const size = this.drawImage(ctx, item, def, sx, def.h - 10, 0.95, { color: '#05030c', alpha: 0.18 });
      if (size) this.glows(ctx, item, def, sx, def.h - 10, size.width, size.height, 0.9);
      ctx.restore();
    }
  }

  // El plano trasero ya no se usa (los objetos del escenario se ordenan con los personajes)
  renderBack() {}
}
