// Teclado y controles táctiles → acciones del juego. Las pulsaciones persisten hasta que un paso de simulación las consume.
class InputManager {
  static BINDINGS = {
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    jump: ['Space'],
    attack: ['KeyJ', 'KeyZ'],
    special: ['KeyK', 'KeyX'],
    super: ['KeyL', 'KeyC'],
    block: ['ShiftLeft', 'ShiftRight', 'KeyE'],
    pause: ['Escape', 'KeyP'],
    confirm: ['Enter', 'Space'],
    mute: ['KeyM'],
    // Duelo musical: un carril por tecla (también con las flechas)
    lane0: ['KeyD', 'ArrowLeft'],
    lane1: ['KeyF', 'ArrowDown'],
    lane2: ['KeyJ', 'ArrowUp'],
    lane3: ['KeyK', 'ArrowRight'],
  };

  constructor() {
    this.heldCodes = new Set();
    this.pressedCodes = new Set();
    this.virtualHeld = new Set(); // acciones mantenidas desde los controles táctiles
    this.virtualPressed = new Set(); // acciones pulsadas desde los controles táctiles
    this.keepPresses = false;
    this.knownCodes = new Set(Object.values(InputManager.BINDINGS).flat());

    window.addEventListener('keydown', (event) => this.handleKeyDown(event));
    window.addEventListener('keyup', (event) => this.heldCodes.delete(event.code));
    window.addEventListener('blur', () => {
      this.heldCodes.clear();
      this.virtualHeld.clear();
    });
  }

  handleKeyDown(event) {
    if (!this.knownCodes.has(event.code)) return;
    // Los botones del modal conservan su comportamiento nativo (Enter/Espacio)
    if (!(event.target instanceof HTMLButtonElement)) event.preventDefault();
    if (!event.repeat) this.pressedCodes.add(event.code);
    this.heldCodes.add(event.code);
  }

  // --- Controles táctiles: el mismo vocabulario de acciones que el teclado ---
  virtualDown(action) {
    if (!this.virtualHeld.has(action)) this.virtualPressed.add(action);
    this.virtualHeld.add(action);
  }

  virtualUp(action) {
    this.virtualHeld.delete(action);
  }

  // ¿La acción está mantenida?
  isDown(action) {
    return this.virtualHeld.has(action) || InputManager.BINDINGS[action].some((code) => this.heldCodes.has(code));
  }

  // ¿La acción se pulsó desde el último paso de simulación?
  justPressed(action) {
    return this.virtualPressed.has(action) || InputManager.BINDINGS[action].some((code) => this.pressedCodes.has(code));
  }

  // Durante el hit-stop las pulsaciones no se consumen: se conservan para el siguiente paso
  preserve() {
    this.keepPresses = true;
  }

  // Se llama tras cada paso de simulación
  endStep() {
    if (this.keepPresses) {
      this.keepPresses = false;
      return;
    }
    this.pressedCodes.clear();
    this.virtualPressed.clear();
  }
}
