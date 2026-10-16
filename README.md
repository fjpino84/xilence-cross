# XILENCE CROSS

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
- Interfaz de rock: barra de vida con daño fantasma, medidor de amplificador por LEDs, combo por niveles (¡RIFF!, ¡SOLO!, ¡LEYENDA!).
- Nivel 1 de 10 escenarios: el 1.º es fijo, el 5.º es el del **sub jefe**, el 10.º el del **jefe** y los demás se sortean en cada partida. Los enemigos entran corriendo y atacando (aviso rojo en el borde de la pantalla) y los **élites** del sub jefe y el jefe llevan barra de vida propia.
- Escenarios vivos: reflectores que barren el suelo desde el cielo (como un helicóptero), focos de aviso que laten y se cortocircuitan con descargas, tormenta eléctrica (relámpagos con réplicas y truenos), reflectores y humo/brasas en las zonas de chatarra. Los élites son la **Garra** (arte propio por cuadros); la tropa normal es el Martillo.
- **Rex Vane (sub jefe, escenario 5):** llega flotando desde el cielo, con diálogo de escena con ECO. Barre la pantalla de lado a lado y ataca de dos formas: cuatro rayos verticales (se esquivan en los huecos) y una descarga horizontal a ras de suelo tras bajar a tierra (se esquiva saltando). Por debajo de la mitad de vida ataca más rápido.

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
