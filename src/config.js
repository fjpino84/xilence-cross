// Cuadros numerados de una animación: clave1..claveN → carpeta/prefijo_1..N.png
// Piezas recortadas de las hojas de "Nuevo Level 2" (tools/make_scenes.js sheets): objetos del escenario y primeros planos
const NEW_PIECES = [
  'obj1_4', 'obj1_5', 'obj1_7', 'obj1_8', 'obj1_9', 'obj1_10', 'obj1_12', 'obj1_13', 'obj1_14', 'obj1_15',
  'obj2_10', 'obj2_11', 'obj3_1', 'obj3_2', 'obj3_3', 'obj3_4', 'obj3_5', 'obj3_6', 'obj3_7', 'obj3_8', 'obj3_9', 'obj3_10', 'obj3_13',
  'obj4_3', 'obj4_4', 'obj4_5',
  'fgA_1', 'fgA_2', 'fgA_3', 'fgS_1', 'fgS_2', 'fgS_3', 'fgR_1', 'fgR_2', 'fgT_2', 'fgT_3', 'fgT_4',
];
const frameAssets = (key, folder, name, count) => Object.fromEntries(
  Array.from({ length: count }, (_, i) => [`${key}${i + 1}`, `assets/sprites/${folder}/${name}_${i + 1}.png`]),
);

// Calidad de efectos: se activa sola en dispositivos lentos, o con ?fx=low en la dirección
const FX = { low: typeof window !== 'undefined' && !!window.location && /[?&]fx=low/.test(window.location.search || '') };

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
    spriteVoidhar: 'assets/sprites/voidhar.png',
    spriteBatuk: 'assets/sprites/batuk/batuk.png',
    portraitBatuk: 'assets/sprites/batuk/retrato.png',
    ...frameAssets('batukTocar', 'batuk', 'tocar', 5),
    batukKneel: 'assets/sprites/batuk/derrotado_1.png',
    batukPoder: 'assets/sprites/batuk/poder_1.png',
    ...frameAssets('batukInst', 'batuk', 'inst', 6),
    bgLevel01: 'assets/backgrounds/nivel01-cementerio-naves.jpg',
    a3Point: 'assets/sprites/adversario3/op_point.png',
    a3Prep: 'assets/sprites/adversario3/op_prep.png',
    a3Dron: 'assets/sprites/adversario3/dron.png',
    // Nivel 1: doce escenas con el cielo transparente, el fondo lejano y las piezas sueltas
    ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['bgN' + (i + 1), 'assets/backgrounds/nivel1/escena-' + (i + 1) + '.webp'])),
    bgNFondo: 'assets/backgrounds/nivel1/fondo.webp',
    ...Object.fromEntries(NEW_PIECES.map((name) => ['pn_' + name, 'assets/sprites/nivel1/' + name + '.png'])),
    bgLevel02: 'assets/backgrounds/nivel02-estacion-transito.jpg',
    bgLevel04: 'assets/backgrounds/nivel04-colonia-agricola.jpg',
    bgLevel07: 'assets/backgrounds/nivel07-planeta-en-llamas.jpg',
    spriteEco: 'assets/sprites/eco.png',
    ecoCaminar: 'assets/sprites/eco/caminar.png',
    ...frameAssets('ecoCaminar', 'eco', 'caminar', 36), // ciclo completo (36 cuadros) del video "Eco caminando"
    ecoCombo1: 'assets/sprites/eco/combo_1.png',
    ecoCombo2: 'assets/sprites/eco/combo_2.png',
    ecoCombo3: 'assets/sprites/eco/combo_3.png',
    ecoCombo4: 'assets/sprites/eco/combo_4.png',
    ecoCombo5: 'assets/sprites/eco/combo_5.png',
    ecoCombo6: 'assets/sprites/eco/combo_6.png',
    ecoCombo7: 'assets/sprites/eco/combo_7.png',
    ecoCombo8: 'assets/sprites/eco/combo_8.png',
    ecoCombo9: 'assets/sprites/eco/combo_9.png',
    ecoCombo10: 'assets/sprites/eco/combo_10.png',
    ecoGolpes1: 'assets/sprites/eco/golpes_1.png',
    ecoGolpes2: 'assets/sprites/eco/golpes_2.png',
    ecoGolpes3: 'assets/sprites/eco/golpes_3.png',
    ecoGolpes4: 'assets/sprites/eco/golpes_4.png',
    ecoGolpes5: 'assets/sprites/eco/golpes_5.png',
    ecoRayo1: 'assets/sprites/eco/rayo_1.png',
    ecoRayo2: 'assets/sprites/eco/rayo_2.png',
    ecoRayo3: 'assets/sprites/eco/rayo_3.png',
    ecoRayo4: 'assets/sprites/eco/rayo_4.png',
    ecoRayo5: 'assets/sprites/eco/rayo_5.png',
    // Power Chord (video "Power Chord.mp4"): 56 cuadros con los rayos, los anillos y el polvo ya dibujados
    ...Object.fromEntries(Array.from({ length: 56 }, (_, i) => ['ecoPc' + (i + 1), 'assets/sprites/eco/pc_' + (i + 1) + '.webp'])),
    ecoSuper1: 'assets/sprites/eco/super_1.png',
    ecoSuper2: 'assets/sprites/eco/super_2.png',
    ecoSuper3: 'assets/sprites/eco/super_3.png',
    ecoSuper4: 'assets/sprites/eco/super_4.png',
    ecoSuper5: 'assets/sprites/eco/super_5.png',
    trinoVuelo1: 'assets/sprites/trino/vuelo_1.png',
    trinoVuelo2: 'assets/sprites/trino/vuelo_2.png',
    trinoVuelo3: 'assets/sprites/trino/vuelo_3.png',
    trinoVuelo4: 'assets/sprites/trino/vuelo_4.png',
    trinoVuelo5: 'assets/sprites/trino/vuelo_5.png',
    ...frameAssets('ecoRayoB', 'eco', 'rayo2', 9),
    ...frameAssets('ecoPatada', 'eco', 'patada', 6),
    ...frameAssets('ecoPuno', 'eco', 'puno', 6),
    ...frameAssets('ecoIdle', 'eco', 'idle', 3),
    ...frameAssets('ecoVPuno', 'eco', 'vpuno', 23), // golpes sacados del video "video golpes"
    ...frameAssets('ecoVPatada', 'eco', 'vpatada', 16),
    ...frameAssets('ecoVGiro', 'eco', 'vgiro', 30),
    ecoMix2: 'assets/sprites/eco/mix_2.png',
    ecoMix3: 'assets/sprites/eco/mix_3.png',
    ecoMix4: 'assets/sprites/eco/mix_4.png',
    ecoGolpe: 'assets/sprites/eco/golpe.png',
    ecoRayo: 'assets/sprites/eco/rayo.png',
    ecoPoder: 'assets/sprites/eco/poder.png',
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
    portraitRex: 'assets/sprites/rexvane/retrato.png',
    spriteAdversario1: 'assets/sprites/adversario1.png',
    spriteAdversario2: 'assets/sprites/adversario2.png',
    spriteAdversario3: 'assets/sprites/adversario3.png',
    spriteTrino: 'assets/sprites/trino.png',
    portraitEco: 'assets/sprites/retrato-eco.png',
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
