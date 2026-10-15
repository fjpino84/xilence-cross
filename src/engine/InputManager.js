// Teclado → acciones del juego. Las pulsaciones persisten hasta que un paso de simulación las consume.
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
  };

  constructor() {
    this.heldCodes = new Set();
    this.pressedCodes = new Set();
    this.keepPresses = false;
    this.knownCodes = new Set(Object.values(InputManager.BINDINGS).flat());

    window.addEventListener('keydown', (event) => this.handleKeyDown(event));
    window.addEventListener('keyup', (event) => this.heldCodes.delete(event.code));
    window.addEventListener('blur', () => this.heldCodes.clear());
  }

  handleKeyDown(event) {
    if (!this.knownCodes.has(event.code)) return;
    // Los botones del modal conservan su comportamiento nativo (Enter/Espacio)
    if (!(event.target instanceof HTMLButtonElement)) event.preventDefault();
    if (!event.repeat) this.pressedCodes.add(event.code);
    this.heldCodes.add(event.code);
  }

  // ¿La acción está mantenida?
  isDown(action) {
    return InputManager.BINDINGS[action].some((code) => this.heldCodes.has(code));
  }

  // ¿La acción se pulsó desde el último paso de simulación?
  justPressed(action) {
    return InputManager.BINDINGS[action].some((code) => this.pressedCodes.has(code));
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
  }
}
