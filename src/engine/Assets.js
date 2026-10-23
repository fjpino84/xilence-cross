// Carga de imágenes. Si una imagen falla, el juego sigue con sus gráficos procedurales.
const Assets = {
  images: new Map(),
  // Versión tomada de los scripts de index.html (?v=N): cada publicación nueva renueva también las imágenes
  version: (typeof document !== 'undefined' && document.querySelector && (document.querySelector('script[src*="Assets.js?v="]') || { src: '' }).src.split('?v=')[1]) || '0',

  // sources: { clave: 'ruta/relativa.png' } → promesa que siempre se resuelve
  loadImages(sources) {
    const loads = Object.entries(sources).map(([key, src]) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        this.images.set(key, image);
        resolve();
      };
      image.onerror = () => resolve();
      image.src = src + (src.includes('?') ? '&' : '?') + 'v=' + this.version; // la versión del juego evita ver imágenes viejas en caché
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

  // Carga un grupo de imágenes (ASSET_GROUPS) la primera vez que se pide; devuelve la promesa. Si ya están cargadas no hace nada.
  loadGroup(name) {
    const group = ASSET_GROUPS[name];
    if (!group) return Promise.resolve();
    this.groupPromises = this.groupPromises || {};
    if (this.groupPromises[name]) return this.groupPromises[name];
    this.groupPromises[name] = this.loadImages(group);
    return this.groupPromises[name];
  },

  // Libera un grupo entero (por ejemplo, los cuadros de un jefe ya derrotado); se podrá volver a cargar con loadGroup
  unloadGroup(name) {
    const group = ASSET_GROUPS[name];
    if (!group || !this.groupPromises || !this.groupPromises[name]) return;
    for (const key of Object.keys(group)) this.unload(key);
    delete this.groupPromises[name];
  },

  // Carga una sola imagen bajo demanda (promesa que siempre se resuelve)
  loadOne(key, src) {
    if (this.images.has(key) || (this.loading && this.loading.has(key))) return Promise.resolve();
    this.loading = this.loading || new Set();
    this.loading.add(key);
    return this.loadImages({ [key]: src }).then(() => this.loading.delete(key));
  },

  // Libera una imagen (y las copias de color que se hicieron de ella) para devolver memoria
  unload(key) {
    const image = this.images.get(key);
    if (!image) return;
    this.images.delete(key);
    if (typeof Sprite !== 'undefined') Sprite.variantCache.delete(image);
    image.src = '';
  },

  image(key) {
    return this.images.get(key) || null;
  },
};
