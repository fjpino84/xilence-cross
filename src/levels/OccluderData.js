// Objetos de primer plano de cada fondo ilustrado, que deben TAPAR a los personajes que caminan detrás de ellos (neumáticos, barriles,
// tuberías...). Coordenadas en fracciones de la imagen (x, y), medidas con una rejilla.
//   poly: contorno del objeto.  base: fracción de alto donde el objeto toca el suelo (su "línea de profundidad").
// Un personaje cuyos pies están más arriba que `base` está detrás del objeto, y el objeto se le dibuja encima; si está más abajo, delante.
const OCCLUDERS = {
  pipeLeft: { base: 1.0, poly: [[0, 0.69], [0.045, 0.69], [0.075, 0.71], [0.085, 0.80], [0.09, 0.90], [0.095, 1.0], [0, 1.0]] },
  strutRight: { base: 1.0, poly: [[0.95, 0.60], [0.995, 0.58], [1.0, 0.62], [1.0, 1.0], [0.865, 1.0], [0.89, 0.90], [0.92, 0.80], [0.935, 0.70]] },
  tireBack1: { base: 0.775, poly: [[0.12, 0.74], [0.135, 0.71], [0.17, 0.70], [0.20, 0.715], [0.205, 0.75], [0.19, 0.775], [0.14, 0.78]] },
  tireBack2: { base: 0.775, poly: [[0.18, 0.68], [0.20, 0.66], [0.225, 0.665], [0.25, 0.70], [0.25, 0.74], [0.22, 0.76], [0.195, 0.745]] },
  barrelMid: { base: 0.88, poly: [[0.25, 0.82], [0.27, 0.795], [0.31, 0.79], [0.34, 0.82], [0.345, 0.86], [0.32, 0.885], [0.28, 0.88], [0.255, 0.86]] },
  tireBottom: { base: 0.955, poly: [[0.21, 0.90], [0.225, 0.86], [0.255, 0.845], [0.29, 0.85], [0.325, 0.87], [0.34, 0.91], [0.335, 0.95], [0.30, 0.965], [0.25, 0.96], [0.215, 0.93]] },
  barrelBottom: { base: 1.0, poly: [[0.345, 0.93], [0.37, 0.89], [0.42, 0.885], [0.46, 0.90], [0.47, 0.96], [0.45, 1.0], [0.35, 1.0]] },
  tireRight: { base: 0.93, poly: [[0.77, 0.88], [0.785, 0.84], [0.82, 0.815], [0.86, 0.82], [0.88, 0.86], [0.875, 0.91], [0.84, 0.93], [0.795, 0.925]] },
  cylinderRight: { base: 0.775, poly: [[0.78, 0.68], [0.785, 0.63], [0.82, 0.60], [0.86, 0.585], [0.95, 0.60], [0.95, 0.70], [0.92, 0.76], [0.86, 0.78], [0.80, 0.78]] },
  spoolBottom: { base: 1.0, poly: [[0.475, 0.95], [0.49, 0.905], [0.53, 0.88], [0.58, 0.885], [0.615, 0.92], [0.62, 1.0], [0.48, 1.0]] },
  barrelRight: { base: 0.935, poly: [[0.77, 0.86], [0.785, 0.815], [0.82, 0.795], [0.86, 0.80], [0.88, 0.84], [0.875, 0.91], [0.84, 0.935], [0.79, 0.92]] },
};

const OCCLUDER_DATA = {
  bgLevel01a: [OCCLUDERS.pipeLeft, OCCLUDERS.strutRight],
  bgLevel01b: [OCCLUDERS.pipeLeft, OCCLUDERS.tireBack1, OCCLUDERS.tireBack2, OCCLUDERS.tireBottom, OCCLUDERS.spoolBottom, OCCLUDERS.barrelRight, OCCLUDERS.strutRight],
  bgLevel01c: [OCCLUDERS.pipeLeft, OCCLUDERS.tireBack1, OCCLUDERS.tireBack2, OCCLUDERS.barrelMid, OCCLUDERS.tireBottom, OCCLUDERS.barrelBottom, OCCLUDERS.tireRight, OCCLUDERS.cylinderRight, OCCLUDERS.strutRight],
  bgLevel01d: [OCCLUDERS.pipeLeft, OCCLUDERS.tireBack1, OCCLUDERS.tireBack2, OCCLUDERS.barrelMid, OCCLUDERS.tireBottom, OCCLUDERS.barrelBottom, OCCLUDERS.tireRight, OCCLUDERS.strutRight],
  bgLevel01e: [OCCLUDERS.pipeLeft, OCCLUDERS.tireBack1, OCCLUDERS.tireBack2, OCCLUDERS.barrelMid, OCCLUDERS.tireBottom, OCCLUDERS.barrelBottom, OCCLUDERS.tireRight, OCCLUDERS.strutRight],
};
