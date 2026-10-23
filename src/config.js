// Cuadros numerados de una animación: clave1..claveN → carpeta/prefijo_1..N.png
// Piezas recortadas de las hojas de "Nuevo Level 2" (tools/make_scenes.js sheets): objetos del escenario y primeros planos
const NEW_PIECES = [
  'obj1_4', 'obj1_5', 'obj1_7', 'obj1_8', 'obj1_9', 'obj1_10', 'obj1_12', 'obj1_13', 'obj1_14', 'obj1_15',
  'obj2_10', 'obj2_11', 'obj3_1', 'obj3_2', 'obj3_3', 'obj3_4', 'obj3_5', 'obj3_6', 'obj3_7', 'obj3_8', 'obj3_9', 'obj3_10', 'obj3_13',
  'obj4_3', 'obj4_4', 'obj4_5',
  'fgA_1', 'fgA_2', 'fgA_3', 'fgS_1', 'fgS_2', 'fgS_3', 'fgR_1', 'fgR_2', 'fgT_2', 'fgT_3', 'fgT_4',
];
const frameAssets = (key, folder, name, count) => Object.fromEntries(
  Array.from({ length: count }, (_, i) => [`${key}${i + 1}`, `assets/sprites/${folder}/${name}_${i + 1}.webp`]),
);

// Calidad de efectos: se activa sola en dispositivos lentos, o con ?fx=low en la dirección
// Efectos pesados (líquido animado, fondo vivo, niebla): se apagan con ?fx=low y, por defecto, en móviles y tabletas (pantalla táctil), donde
// el dibujo extra hace que el audio se pegue y suene cortado. ?fx=high los fuerza también en móvil.
const IS_TOUCH_DEVICE = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
const FX = {
  low: typeof window !== 'undefined' && !!window.location && (/[?&]fx=low/.test(window.location.search || '') || (IS_TOUCH_DEVICE && !/[?&]fx=high/.test(window.location.search || ''))),
};

// Constantes globales del juego. Un único lugar para ajustar el balance y la paleta.
const CONFIG = Object.freeze({
  WIDTH: 960,
  HEIGHT: 540,
  STEP: 1 / 60, // paso fijo de simulación (segundos)
  GRAVITY: 1800,

  // Franja jugable del suelo (eje de profundidad) y carril fijo de ECO
  GROUND_TOP: 390,
  GROUND_BOTTOM: 500,
  PLAYER_LANE: 450,

  FONT: 'Impact, "Arial Black", sans-serif',
  // Tipografías del título y los textos solemnes (se cargan desde assets/fonts; si fallan, se usa una serif del sistema)
  TITLE_FONT: '"Cinzel Decorative", "Cinzel", "Palatino Linotype", "Book Antiqua", Georgia, serif',
  PLAIN_FONT: '"Cinzel", "Palatino Linotype", "Book Antiqua", Georgia, serif',
  COMIC_FONT: '"Bangers", Impact, "Arial Black", sans-serif', // cajas de diálogo: letras de cómic de superhéroes
  FONT_FILES: [
    { family: 'Bangers', url: 'assets/fonts/Bangers-Regular.ttf', weight: '400' },
    { family: 'Cinzel Decorative', url: 'assets/fonts/CinzelDecorative-Black.ttf', weight: '900' },
    { family: 'Cinzel Decorative', url: 'assets/fonts/CinzelDecorative-Bold.ttf', weight: '700' },
    { family: 'Cinzel', url: 'assets/fonts/Cinzel-Variable.ttf', weight: '400 900' },
  ],

  // Música de fondo (bucle)
  MUSIC: 'assets/audio/zero.mp3',

  // Imágenes a precargar: clave → ruta
  ASSETS: Object.freeze({
    bgTitle: 'assets/backgrounds/titulo-eco.jpg',
    bgFinal: 'assets/backgrounds/final-batalla.jpg',
    spriteVoidhar: 'assets/sprites/voidhar.webp',
    spriteBatuk: 'assets/sprites/batuk/batuk.webp',
    portraitBatuk: 'assets/sprites/batuk/retrato.webp',
    ...frameAssets('batukTocar', 'batuk', 'tocar', 5),
    batukKneel: 'assets/sprites/batuk/derrotado_1.webp',
    batukPoder: 'assets/sprites/batuk/poder_1.webp',
    ...frameAssets('batukInst', 'batuk', 'inst', 6),
    bgLevel01: 'assets/backgrounds/nivel01-cementerio-naves.jpg',
    // Cuadros de derrota (tools/make_defeats.js)
    ...Object.fromEntries(['adv1', 'adv2', 'rex', 'op'].flatMap((id) => [1, 2, 3, 4].map((n) => ['df_' + id + '_' + n, 'assets/sprites/derrotas/' + id + '_' + n + '.webp']))),
    // Rex Vane: 8 cuadros del GIF (vuelo, carga, picado, aterrizaje y golpe)
    ...Object.fromEntries(Array.from({ length: 11 }, (_, i) => ['rexG' + (i + 1), 'assets/sprites/rexvane/gif_' + (i + 1) + '.webp'])),
    // Poder del suelo de Rex Vane (video, segundos 3 a 8): 30 cuadros
    ...Object.fromEntries(Array.from({ length: 30 }, (_, i) => ['rexS' + (i + 1), 'assets/sprites/rexvane/suelo_' + (i + 1) + '.webp'])),
    // Rex Vane en el aire (video): vuelo hacia la derecha (8), flotando de frente (9) y poder de rayos en altura (18)
    ...Object.fromEntries([['fly', 8], ['hov', 9], ['bol', 18]].flatMap(([g, n]) => Array.from({ length: n }, (_, i) => ['rexA_' + g + (i + 1), 'assets/sprites/rexvane/vuelo_' + g + '_' + (i + 1) + '.webp']))),
    a3Point: 'assets/sprites/adversario3/op_point.webp',
    a3Prep: 'assets/sprites/adversario3/op_prep.webp',
    a3Dron: 'assets/sprites/adversario3/dron.webp',
    // Nivel 1: doce escenas con el cielo transparente, el fondo lejano y las piezas sueltas
    // En móviles (IS_TOUCH_DEVICE) solo se precargan 4 escenas: el resto se carga al acercarse y se libera al alejarse (Level.streamTiles)
    ...Object.fromEntries(Array.from({ length: IS_TOUCH_DEVICE ? 4 : 12 }, (_, i) => ['bgN' + (i + 1), 'assets/backgrounds/nivel1/escena-' + (i + 1) + '.webp'])),
    bgNFondo: 'assets/backgrounds/nivel1/fondo.webp',
    ...Object.fromEntries(NEW_PIECES.map((name) => ['pn_' + name, 'assets/sprites/nivel1/' + name + '.webp'])),
    bgLevel02: 'assets/backgrounds/nivel02-estacion-transito.jpg',
    bgLevel04: 'assets/backgrounds/nivel04-colonia-agricola.jpg',
    bgLevel07: 'assets/backgrounds/nivel07-planeta-en-llamas.jpg',
    spriteEco: 'assets/sprites/eco.webp',
    ecoCaminar: 'assets/sprites/eco/caminar.webp',
    ...frameAssets('ecoCaminar', 'eco', 'caminar', 36), // ciclo completo (36 cuadros) del video "Eco caminando"
    ecoCombo1: 'assets/sprites/eco/combo_1.webp',
    ecoCombo2: 'assets/sprites/eco/combo_2.webp',
    ecoCombo3: 'assets/sprites/eco/combo_3.webp',
    ecoCombo4: 'assets/sprites/eco/combo_4.webp',
    ecoCombo5: 'assets/sprites/eco/combo_5.webp',
    ecoCombo6: 'assets/sprites/eco/combo_6.webp',
    ecoCombo7: 'assets/sprites/eco/combo_7.webp',
    ecoCombo8: 'assets/sprites/eco/combo_8.webp',
    ecoCombo9: 'assets/sprites/eco/combo_9.webp',
    ecoCombo10: 'assets/sprites/eco/combo_10.webp',
    ecoGolpes1: 'assets/sprites/eco/golpes_1.webp',
    ecoGolpes2: 'assets/sprites/eco/golpes_2.webp',
    ecoGolpes3: 'assets/sprites/eco/golpes_3.webp',
    ecoGolpes4: 'assets/sprites/eco/golpes_4.webp',
    ecoGolpes5: 'assets/sprites/eco/golpes_5.webp',
    ecoRayo1: 'assets/sprites/eco/rayo_1.webp',
    ecoRayo2: 'assets/sprites/eco/rayo_2.webp',
    ecoRayo3: 'assets/sprites/eco/rayo_3.webp',
    ecoRayo4: 'assets/sprites/eco/rayo_4.webp',
    ecoRayo5: 'assets/sprites/eco/rayo_5.webp',
    // Power Chord (video "Power Chord.mp4"): 56 cuadros con los rayos, los anillos y el polvo ya dibujados
    ...Object.fromEntries(Array.from({ length: 56 }, (_, i) => ['ecoPc' + (i + 1), 'assets/sprites/eco/pc_' + (i + 1) + '.webp'])),
    ecoSuper1: 'assets/sprites/eco/super_1.webp',
    ecoSuper2: 'assets/sprites/eco/super_2.webp',
    ecoSuper3: 'assets/sprites/eco/super_3.webp',
    ecoSuper4: 'assets/sprites/eco/super_4.webp',
    ecoSuper5: 'assets/sprites/eco/super_5.webp',
    trinoVuelo1: 'assets/sprites/trino/vuelo_1.webp',
    trinoVuelo2: 'assets/sprites/trino/vuelo_2.webp',
    trinoVuelo3: 'assets/sprites/trino/vuelo_3.webp',
    trinoVuelo4: 'assets/sprites/trino/vuelo_4.webp',
    trinoVuelo5: 'assets/sprites/trino/vuelo_5.webp',
    ...frameAssets('ecoRayoB', 'eco', 'rayo2', 9),
    ...frameAssets('ecoPatada', 'eco', 'patada', 6),
    ...frameAssets('ecoPuno', 'eco', 'puno', 6),
    ...frameAssets('ecoIdle', 'eco', 'idle', 3),
    ...frameAssets('ecoVPuno', 'eco', 'vpuno', 23), // golpes sacados del video "video golpes"
    ...frameAssets('ecoVPatada', 'eco', 'vpatada', 16),
    ...frameAssets('ecoVGiro', 'eco', 'vgiro', 30),
    ecoMix2: 'assets/sprites/eco/mix_2.webp',
    ecoMix3: 'assets/sprites/eco/mix_3.webp',
    ecoMix4: 'assets/sprites/eco/mix_4.webp',
    ecoGolpe: 'assets/sprites/eco/golpe.webp',
    ecoRayo: 'assets/sprites/eco/rayo.webp',
    ecoPoder: 'assets/sprites/eco/poder.webp',
    ...frameAssets('adv1Walk', 'adversario1', 'caminar', 4),
    ...frameAssets('adv1Slam', 'adversario1', 'ataque1', 5),
    ...frameAssets('adv1Spin', 'adversario1', 'ataque2', 5),
    ...frameAssets('adv1Hurt', 'adversario1', 'herido', 4),
    ...frameAssets('adv2Walk', 'adversario2', 'caminar', 4),
    ...frameAssets('adv2Slam', 'adversario2', 'ataque1', 6),
    ...frameAssets('adv2Spin', 'adversario2', 'ataque2', 8),
    ...frameAssets('adv2Hurt', 'adversario2', 'herido', 6),
    ...frameAssets('rexFly', 'rexvane', 'volar', 6),
    ...frameAssets('rexCharge', 'rexvane', 'carga', 6),
    ...frameAssets('rexLand', 'rexvane', 'bajada', 6),
    portraitRex: 'assets/sprites/rexvane/retrato.webp',
    spriteAdversario1: 'assets/sprites/adversario1.webp',
    spriteAdversario2: 'assets/sprites/adversario2.webp',
    spriteAdversario3: 'assets/sprites/adversario3.webp',
    spriteTrino: 'assets/sprites/trino.webp',
    portraitEco: 'assets/sprites/retrato-eco.webp',
  }),

  COLORS: Object.freeze({
    NAVY: '#03030a',
    CYAN: '#00f5ff',
    RED: '#ff003c',
    YELLOW: '#ffe600',
    PURPLE: '#7c3aff',
    OUTLINE: '#000000',
  }),
});

// Carga por etapas: al abrir solo se precarga lo que hace falta desde el principio (CORE_ASSETS). Los jefes y los extras se piden cuando el jugador
// se acerca a su escena (Assets.loadGroup, desde GameScene.streamGroups). Menos descarga inicial y mucha menos memoria, sobre todo en móviles.
const ASSET_GROUPS = { rex: {}, operador: {}, batuk: {}, final: {}, extra: {} };
const ASSET_GROUP_RULES = [
  ['rex', /^(df_rex|rexG[0-9]|rexS[0-9]|rexA_|rexFly|rexCharge|rexLand)/],
  ['operador', /^(df_op|a3)/],
  ['batuk', /^(batuk|spriteBatuk|portraitBatuk)/],
  ['final', /^(bgFinal|spriteVoidhar)/],
  ['extra', /^pn_(obj|fgT)/], // objetos sueltos y lámparas de arriba: desactivados (Props.WORLD_ENABLED / TOP_ENABLED)
];
const CORE_ASSETS = {};
for (const [key, source] of Object.entries(CONFIG.ASSETS)) {
  const rule = ASSET_GROUP_RULES.find(([, pattern]) => pattern.test(key));
  if (rule) ASSET_GROUPS[rule[0]][key] = source; else CORE_ASSETS[key] = source;
}
