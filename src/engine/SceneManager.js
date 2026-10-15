// Registro y cambio de escenas. Cada escena implementa enter(data), exit(), update(dt) y render(ctx).
class SceneManager {
  constructor() {
    this.scenes = new Map();
    this.current = null;
  }

  register(name, scene) {
    this.scenes.set(name, scene);
  }

  change(name, data = {}) {
    if (this.current) this.current.exit();
    this.current = this.scenes.get(name);
    this.current.enter(data);
  }

  update(dt) {
    if (this.current) this.current.update(dt);
  }

  render(ctx) {
    if (this.current) this.current.render(ctx);
  }
}
