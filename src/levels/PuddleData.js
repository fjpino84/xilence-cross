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
  bgLevel01d: [
    { x: 0.270, y: 0.722, rx: 0.100, ry: 0.022, color: '#4ebbc4' },
    { x: 0.695, y: 0.795, rx: 0.175, ry: 0.050, color: '#4fb0af' },
    { x: 0.135, y: 0.905, rx: 0.057, ry: 0.030, color: '#51b5aa' },
    { x: 0.920, y: 0.685, rx: 0.070, ry: 0.016, color: '#4fb0af' },
  ],
  bgLevel01e: [
    { x: 0.270, y: 0.722, rx: 0.100, ry: 0.022, color: '#55bbc4' },
    { x: 0.695, y: 0.795, rx: 0.175, ry: 0.050, color: '#52afaa' },
    { x: 0.100, y: 0.900, rx: 0.057, ry: 0.030, color: '#57bac2' },
  ],
  bgLevel01s: [
    { x: 0.270, y: 0.722, rx: 0.100, ry: 0.022, color: '#64c7ca' },
    { x: 0.695, y: 0.795, rx: 0.175, ry: 0.050, color: '#5fc5c5' },
    { x: 0.100, y: 0.905, rx: 0.060, ry: 0.030, color: '#60bfcb' },
  ],
  bgLevel01j: [
    { x: 0.270, y: 0.800, rx: 0.160, ry: 0.045, color: '#66c1c6' },
  ],
  bgLevel01c: [
    { x: 0.316, y: 0.723, rx: 0.052, ry: 0.022, color: '#50bac5' },
    { x: 0.695, y: 0.795, rx: 0.175, ry: 0.055, color: '#4db3ab' },
    { x: 0.133, y: 0.905, rx: 0.057, ry: 0.030, color: '#50b4ab' },
  ],
};

// Nivel 1 (Nuevo Level 2)
Object.assign(PUDDLE_DATA, {
  bgN1: [{ x: 0.3, y: 0.715, rx: 0.13, ry: 0.026, color: '#3fe0b0' }, { x: 0.57, y: 0.7, rx: 0.08, ry: 0.022, color: '#4b8fe0' }, { x: 0.22, y: 0.745, rx: 0.05, ry: 0.02, color: '#3fb6e0' }],
  bgN2: [{ x: 0.3, y: 0.72, rx: 0.14, ry: 0.026, color: '#3fe0b0' }, { x: 0.58, y: 0.69, rx: 0.08, ry: 0.02, color: '#3fe0b0' }, { x: 0.72, y: 0.7, rx: 0.07, ry: 0.02, color: '#4b8fe0' }],
  bgN3: [{ x: 0.22, y: 0.79, rx: 0.22, ry: 0.035, color: '#3fe0b0' }, { x: 0.46, y: 0.745, rx: 0.12, ry: 0.028, color: '#3fe0b0' }],
  bgN4: [{ x: 0.37, y: 0.725, rx: 0.1, ry: 0.026, color: '#3fe0b0' }, { x: 0.56, y: 0.705, rx: 0.12, ry: 0.024, color: '#3fe0b0' }, { x: 0.69, y: 0.67, rx: 0.05, ry: 0.018, color: '#3fe0b0' }],
  bgN5: [{ x: 0.56, y: 0.735, rx: 0.1, ry: 0.028, color: '#3fe0b0' }, { x: 0.72, y: 0.79, rx: 0.14, ry: 0.03, color: '#3fe0b0' }, { x: 0.9, y: 0.86, rx: 0.1, ry: 0.03, color: '#3fe0b0' }],
  bgN6: [{ x: 0.27, y: 0.72, rx: 0.12, ry: 0.026, color: '#3fe0b0' }, { x: 0.5, y: 0.7, rx: 0.1, ry: 0.024, color: '#3fe0b0' }, { x: 0.72, y: 0.695, rx: 0.09, ry: 0.022, color: '#4b8fe0' }],
  bgN7: [{ x: 0.3, y: 0.72, rx: 0.14, ry: 0.026, color: '#3fe0b0' }, { x: 0.56, y: 0.7, rx: 0.12, ry: 0.024, color: '#4b8fe0' }],
  bgN8: [{ x: 0.3, y: 0.735, rx: 0.28, ry: 0.035, color: '#3fe0b0' }, { x: 0.62, y: 0.73, rx: 0.16, ry: 0.03, color: '#3fe0b0' }, { x: 0.88, y: 0.68, rx: 0.1, ry: 0.04, color: '#3fe0b0' }, { x: 0.12, y: 0.78, rx: 0.12, ry: 0.03, color: '#3fe0b0' }],
  bgN9: [{ x: 0.3, y: 0.74, rx: 0.3, ry: 0.035, color: '#3fe0b0' }, { x: 0.6, y: 0.7, rx: 0.2, ry: 0.03, color: '#3fe0b0' }, { x: 0.88, y: 0.66, rx: 0.1, ry: 0.035, color: '#3fe0b0' }],
  bgN10: [{ x: 0.18, y: 0.8, rx: 0.15, ry: 0.035, color: '#3fe0b0' }, { x: 0.5, y: 0.75, rx: 0.28, ry: 0.035, color: '#3fe0b0' }, { x: 0.85, y: 0.88, rx: 0.14, ry: 0.03, color: '#3fe0b0' }],
  bgN11: [{ x: 0.2, y: 0.7, rx: 0.17, ry: 0.03, color: '#3fe0b0' }, { x: 0.5, y: 0.74, rx: 0.22, ry: 0.03, color: '#3fe0b0' }, { x: 0.82, y: 0.72, rx: 0.14, ry: 0.03, color: '#3fe0b0' }],
  bgN12: [{ x: 0.22, y: 0.78, rx: 0.14, ry: 0.03, color: '#3fe0b0' }, { x: 0.55, y: 0.76, rx: 0.14, ry: 0.03, color: '#3fe0b0' }],
});
