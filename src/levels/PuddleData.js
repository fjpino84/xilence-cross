// Charcos de cada fondo ilustrado, en fracciones de la imagen (x,y = centro; rx,ry = semiejes) y su color de agua.
// Sirven para saber dónde salpicar al pisarlos. Para ver las zonas en el juego, escribe
// `DEBUG_PUDDLES = true` en la consola del navegador.
const PUDDLE_DATA = {
  bgLevel01a: [
    { x: 0.270, y: 0.722, rx: 0.105, ry: 0.022, color: '#4bbfcf' },
    { x: 0.710, y: 0.815, rx: 0.190, ry: 0.058, color: '#44b8b3' },
    { x: 0.135, y: 0.905, rx: 0.058, ry: 0.028, color: '#40b3b3' },
  ],
  bgLevel01b: [
    { x: 0.317, y: 0.723, rx: 0.052, ry: 0.022, color: '#51bcc6' },
    { x: 0.695, y: 0.795, rx: 0.175, ry: 0.050, color: '#4db3ac' },
    { x: 0.820, y: 0.765, rx: 0.075, ry: 0.022, color: '#4db3ac' },
    { x: 0.133, y: 0.905, rx: 0.057, ry: 0.030, color: '#50b4ab' },
  ],
  bgLevel01c: [
    { x: 0.316, y: 0.723, rx: 0.052, ry: 0.022, color: '#50bac5' },
    { x: 0.695, y: 0.795, rx: 0.175, ry: 0.055, color: '#4db3ab' },
    { x: 0.133, y: 0.905, rx: 0.057, ry: 0.030, color: '#50b4ab' },
  ],
};
