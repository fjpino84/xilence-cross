# THE ORDER OF XILENCE
Tipografías del título: Cinzel y Cinzel Decorative (SIL Open Font License, en `assets/fonts/OFL.txt`).

> *El silencio que combates, y la nota que te salva.*

Beat 'em up 2D de desplazamiento lateral con estética rock y cyberpunk, hecho en **HTML5 Canvas y JavaScript puro**, sin frameworks ni dependencias. Todo el contenido está en español.

En un universo donde la música fue prohibida por el régimen de La Quietud, **ECO**, un guerrero ciego, empuña su guitarra de chatarra como arma. Su compañero **Trino** lo acompaña en el aire. Esta demo incluye el **primer nivel** y el cierre con la aparición de **Vóidhar**.

## Jugar

- **Online:** https://fjpino84.github.io/xilence-cross/
- **En tu equipo:** descarga o clona el repositorio y abre `index.html` en Chrome o Edge. No necesita servidor ni instalación.

El navegador no deja sonar nada hasta tu primera pulsación de tecla o toque.

### En el teléfono o la tableta

Se juega con controles táctiles: joystick flotante a la izquierda y botones a la derecha (GOLPE, SALTO, RAYO, SÚPER y BLOQ). Mantén **RAYO** para cargarlo y suéltalo para disparar; se pueden pulsar varios botones a la vez. Arriba, al centro, hay botones de pausa y de sonido.

- **Gira el teléfono** en horizontal: el juego es panorámico.
- **iPhone (Safari):** no permite pantalla completa en páginas web. Para jugar sin barras, toca *Compartir → Añadir a pantalla de inicio* y ábrelo desde ese icono.
- **Android (Chrome):** el botón ⛶ activa la pantalla completa, o usa *Añadir a pantalla de inicio*.
- Si el dispositivo va lento, el juego pasa solo a un modo de efectos reducidos. También puedes forzarlo con `?fx=low` al final de la dirección, y probar los controles táctiles en un ordenador con `?touch=1`.

## Controles

| Acción | Tecla |
|---|---|
| Mover (también por profundidad) | `WASD` o flechas |
| Saltar | `Espacio` |
| Golpe (combo de 5 golpes) | `J` o `Z` |
| Rayo cargable: mantén para cargar, suelta para disparar | `K` o `X` |
| Súper (con la barra AMP llena) | `L` o `C` |
| Bloquear | `Shift` o `E` |
| Pausa | `P` o `Esc` |
| Silenciar | `M` |

## Qué incluye

- Combo de cinco golpes con animación por cuadros, rayo con carga estilo Mega Man y súper que limpia la pantalla.
- **Trino**, el compañero que orbita a ECO y dispara un proyectil sónico.
- Enemigo pesado (el Martillo) con embestida, combos y rugido propio.
- Efectos al estilo de los juegos de lucha: congelado de impacto, esquirlas de energía, estrellas de cómic, cámara lenta, grietas en el suelo, salpicaduras en los charcos.
- Sonido sintetizado con Web Audio (sin archivos de efectos) y música de fondo.
- Combo con todos los cuadros del video "video golpes" (mezcla suave entre cuadros): puño (1 y 3), patada frontal (2) y patada giratoria con estela (4), y luego el rayo y **patada voladora** (pulsa golpe en el aire), con cuadros propios. Pruebas: `node tests/kick.js`.
- **Video de inicio:** al pulsar ENTER en el título se reproduce `assets/video/intro.mp4` (con sonido; ENTER, clic o toque para saltarlo) y al terminar empieza la partida. Si el video no carga, pasa directo al juego. Para saltarlo al probar, añade `?skipintro=1` a la dirección. Prueba real: `node tests/intro_browser.js <carpeta>`.
- **Objetos sobre las uniones entre escenarios** (`src/levels/Props.js`, sprites en `assets/sprites/props`): un objeto casual y grande (pila, tubería, carrete, valla, generador o cartel) tapa cada unión y ECO pasa por detrás al cambiar de escena; se vuelve translúcido mientras ECO lo cruza.
- **Fondo vivo** (`src/levels/LiveBackground.js`): telas, cadena, cables y grúas que se mecen, carteles y focos que parpadean, el generador que vibra, chispas, brasas y polvo, niebla en tres planos y lluvia en tres planos.
- **Objetos que tapan a los personajes:** neumáticos, barriles y tuberías de primer plano de los fondos (marcados en `src/levels/OccluderData.js`) se dibujan encima de ECO y los enemigos cuando caminan detrás de ellos.
- **Profundidad:** los personajes crecen un poco al bajar hacia la cámara (92 % al fondo, 108 % abajo) y unos cables finos por arriba con parallax.
- Interfaz de rock: barra de vida con daño fantasma, medidor de amplificador por LEDs, combo por niveles (¡RIFF!, ¡SOLO!, ¡LEYENDA!).
- Nivel 1 de 10 escenarios: el 1.º es fijo, el 5.º es el del **sub jefe**, el 10.º el del **jefe** y los demás se sortean en cada partida. Los enemigos entran corriendo y atacando (aviso rojo en el borde de la pantalla) y los **élites** del sub jefe y el jefe llevan barra de vida propia.
- Escenarios vivos: reflectores que barren el suelo desde el cielo (como un helicóptero), focos de aviso que laten y se cortocircuitan con descargas, tormenta eléctrica (relámpagos con réplicas y truenos), reflectores y humo/brasas en las zonas de chatarra. Los élites son la **Garra** (arte propio por cuadros); la tropa normal es el Martillo.
- **Rex Vane (sub jefe, escenario 5):** llega flotando desde el cielo, con diálogo de escena con ECO. Barre la pantalla de lado a lado y ataca de dos formas: cuatro rayos verticales (se esquivan en los huecos) y una descarga horizontal a ras de suelo tras bajar a tierra (se esquiva saltando). Por debajo de la mitad de vida ataca más rápido.
- Dificultad progresiva (enemigos más resistentes y rápidos en los encuentros avanzados), enemigos que caen del cielo con marca roja en el suelo, latido sonoro con poca vida y mejores marcas guardadas (puntuación, combo, tiempo). Prueba automática: `node tests/smoke.js`.
- **Atajos de prueba:** añade `?duel=1` a la dirección para ir al cierre del nivel (Batuk entra, diálogo y duelo) o `?duel=skip` para saltar el diálogo e ir directo al momento previo a la batalla.
- **Música del duelo con Batuk:** al aparecer Batuk suena su canción (`assets/audio/batuk-battle.mp3`) desde el principio; al empezar la batalla salta al 0:43 y se juega hasta el 2:30. La partitura (`src/levels/BatukChart.js`, unas 340 notas) se generó analizando la canción con `tools/make_chart.js`: una nota por cada ataque de la guitarra solista, y el carril sigue la altura de la melodía (grave a la izquierda, agudo a la derecha). Al ganar, la canción sigue sonando (en bucle) durante la imagen de derrota, el epílogo y la pantalla final; al volver al menú vuelve la música normal. Durante el duelo no suena nada sintetizado, salvo un "pac pac" cuando una nota se toca mal. (El tema sintetizado queda como respaldo para otros jefes.)
- **Sonido del duelo (tema sintetizado):** la banda de rock se suma a la percusión del templo de Batuk (taiko, congas, sonajas, gong y relleno de toms) y la guitarra de ECO suena en capas con eco y panorama por carril. Las rachas suben de nivel (×2 en racha, ×3 en llamas, ×4 leyenda) con acorde ascendente, destello, chispas, resplandor lateral y rayos por los bordes de la pista.
- **Jefe del nivel: Batuk** (Vóidhar queda reservado para más adelante). Al vencer a los enemigos, Batuk entra caminando, hay un diálogo con ECO y empieza el **duelo musical (estilo Guitar Hero)**: instrumentos de percusión giran a su alrededor y llegan volando desde distintos lugares al ritmo de la música. Hay un diálogo previo al combate y otro posterior (Batuk se levanta y habla de la Orden del Silencio y de Meridian). Si ECO gana, Batuk cae y aparece su imagen de derrota (Batuk de rodillas, con sus instrumentos). El duelo: ECO y el jefe se enfrentan tocando al ritmo de un tema de rock sintetizado de unos 40 segundos (estrofa, estribillo, solo y final), con las notas a velocidad constante (configurable por jefe). Caen notas por cuatro carriles (teclas Z X C V o las flechas; en móvil, cuatro botones táctiles). Cada acierto empuja la onda de ECO contra el jefe, cada fallo la hace retroceder; si el medidor llega a cero gana el silencio y se reintenta. Las notas acertadas suenan como la melodía de guitarra. Para probarlo directamente, abre el juego con `?duel=1`. Pruebas: `node tests/duel.js`.

## Estructura

```
index.html          Página y estilos de los menús
src/
  config.js         Constantes y lista de recursos
  engine/           Bucle, entrada (teclado y táctil), cámara, partículas, audio, sprites
  entities/         ECO, Trino, enemigos, Vóidhar
  levels/           Nivel 1 (los niveles 2, 4 y 7 están aún sin activar)
  scenes/           Título, juego, fin de partida y cierre
  ui/               HUD y modales
assets/             Imágenes recortadas y música
tools/              Scripts de PowerShell para recortar hojas de sprites (ver tools/LEEME.md)
Claude.md           Especificación original del proyecto
```

El código usa scripts clásicos (sin módulos ES) para poder abrirse con doble clic.

## Créditos y licencias

- **Código y diseño del juego:** fjpino84.
- **Música:** *APEX* (sin coros), de PlayerZero, usada como música de fondo.
- **Arte:** ilustraciones generadas con herramientas de IA y recortadas para el juego.

No se ha definido aún una licencia para el código ni para el arte, por lo que, por defecto, todos los derechos están reservados. Si quieres reutilizar algo, abre una *issue*.
