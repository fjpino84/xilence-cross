// Carga de imágenes. Si una imagen falla, el juego sigue con sus gráficos procedurales.
const Assets = {
  images: new Map(),

  // sources: { clave: 'ruta/relativa.png' } → promesa que siempre se resuelve
  loadImages(sources) {
    const loads = Object.entries(sources).map(([key, src]) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        this.images.set(key, image);
        resolve();
      };
      image.onerror = () => resolve();
      image.src = src;
    }));
    return Promise.all(loads);
  },

  image(key) {
    return this.images.get(key) || null;
  },
};
