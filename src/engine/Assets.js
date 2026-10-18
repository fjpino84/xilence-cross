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

  // Carga las tipografías del juego. Siempre se resuelve (con un tiempo máximo) para no bloquear el arranque.
  loadFonts(fonts) {
    if (typeof FontFace === 'undefined' || !document.fonts) return Promise.resolve();
    const loads = fonts.map(({ family, url, weight }) => new FontFace(family, `url(${url})`, { weight })
      .load()
      .then((face) => { document.fonts.add(face); })
      .catch(() => {}));
    const timeout = new Promise((resolve) => setTimeout(resolve, 4000));
    return Promise.race([Promise.all(loads), timeout]);
  },

  image(key) {
    return this.images.get(key) || null;
  },
};
