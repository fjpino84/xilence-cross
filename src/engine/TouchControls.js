// Controles táctiles en pantalla (joystick + botones) para teléfono y tableta. Solo se muestran en dispositivos táctiles.
// Usa Pointer Events (iPhone con iOS 13+ y Android) con captura del puntero, de modo que se pueden pulsar varios botones a la vez.
class TouchControls {
  static enabled = false; // lo consultan el HUD y el título para mostrar la ayuda adecuada
  static STICK_DEAD = 0.28;

  // Botones: acción, texto, tamaño y posición en unidades de alto de pantalla (vh) desde la esquina inferior derecha
  static BUTTONS = [
    { action: 'attack', label: 'GOLPE', size: 21, right: 4, bottom: 5, color: 'yellow' },
    { action: 'jump', label: 'SALTO', size: 16, right: 27.5, bottom: 4, color: 'cyan' },
    { action: 'special', label: 'RAYO', size: 16, right: 5, bottom: 29.5, color: 'cyan' },
    { action: 'super', label: 'SÚPER', size: 14, right: 24.5, bottom: 25, color: 'purple' },
    { action: 'block', label: 'BLOQ', size: 12.5, right: 41, bottom: 18, color: 'white' },
  ];

  constructor(input, shell) {
    this.input = input;
    this.shell = shell;
    this.layer = null;
    this.stick = null;
    this.stickPointer = null;
    this.stickActions = new Set();
    this.buttonEls = new Map();

    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const forced = /[?&]touch=1/.test(window.location.search);
    if (coarse || forced) this.enable();
    // Un dispositivo híbrido (portátil con pantalla táctil) los activa al primer toque
    window.addEventListener('touchstart', () => this.enable(), { once: true, passive: true });
  }

  enable() {
    if (TouchControls.enabled) return;
    TouchControls.enabled = true;
    document.body.classList.add('touch');
    this.build();
  }

  element(tag, className, parent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (parent) parent.appendChild(el);
    return el;
  }

  build() {
    this.layer = this.element('div', 'touch-layer', this.shell);
    this.layer.setAttribute('aria-hidden', 'true');
    this.layer.style.display = 'none'; // se muestra solo durante la partida

    // Aviso para girar el teléfono (visible solo en vertical, por CSS)
    const hint = this.element('div', 'rotate-hint', document.body);
    this.element('div', 'phone', hint);
    const text = this.element('div', '', hint);
    text.textContent = 'Gira tu teléfono';

    this.buildStick();
    for (const config of TouchControls.BUTTONS) this.buildButton(config);
    this.buildSystemButtons();
    this.buildDuelPads();

    // Sin menú contextual ni selección al mantener el dedo
    this.layer.addEventListener('contextmenu', (event) => event.preventDefault());
    // Safari en iPhone: evita el zoom por gestos
    for (const name of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(name, (event) => event.preventDefault());
  }

  // --- Joystick flotante a la izquierda ---
  buildStick() {
    const zone = this.element('div', 'touch-stick-zone', this.layer);
    const base = this.element('div', 'touch-stick-base', zone);
    const knob = this.element('div', 'touch-stick-knob', base);
    this.stick = { zone, base, knob };

    const move = (event) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = rect.width / 2;
      let dx = (event.clientX - cx) / radius;
      let dy = (event.clientY - cy) / radius;
      const length = Math.hypot(dx, dy);
      if (length > 1) { dx /= length; dy /= length; }
      knob.style.transform = 'translate(' + dx * radius * 0.55 + 'px, ' + dy * radius * 0.55 + 'px)';
      const dead = TouchControls.STICK_DEAD;
      this.setStick({
        left: dx < -dead, right: dx > dead,
        up: dy < -dead * 1.4, down: dy > dead * 1.4,
      });
    };

    zone.addEventListener('pointerdown', (event) => {
      if (this.stickPointer !== null) return;
      event.preventDefault();
      this.stickPointer = event.pointerId;
      zone.setPointerCapture(event.pointerId);
      // La base se coloca donde se apoya el dedo (sin salirse de la zona)
      const zoneRect = zone.getBoundingClientRect();
      const size = base.offsetWidth;
      const left = Math.max(0, Math.min(zoneRect.width - size, event.clientX - zoneRect.left - size / 2));
      const top = Math.max(0, Math.min(zoneRect.height - size, event.clientY - zoneRect.top - size / 2));
      base.style.left = left + 'px';
      base.style.top = top + 'px';
      base.style.bottom = 'auto';
      base.classList.add('active');
      move(event);
    });
    zone.addEventListener('pointermove', (event) => {
      if (event.pointerId === this.stickPointer) { event.preventDefault(); move(event); }
    });
    const release = (event) => {
      if (event.pointerId !== this.stickPointer) return;
      this.stickPointer = null;
      base.classList.remove('active');
      knob.style.transform = 'translate(0, 0)';
      base.style.left = '';
      base.style.top = '';
      base.style.bottom = '';
      this.setStick({});
    };
    zone.addEventListener('pointerup', release);
    zone.addEventListener('pointercancel', release);
    zone.addEventListener('lostpointercapture', release);
  }

  // Los controles solo se ven durante la partida (en menús y pantallas finales se toca el canvas o los botones del modal)
  setVisible(visible) {
    if (!this.layer || this.visible === visible) return;
    this.visible = visible;
    this.layer.style.display = visible ? '' : 'none';
    if (!visible) {
      this.setStick({});
      for (const action of ['attack', 'jump', 'special', 'super', 'block']) this.input.virtualUp(action);
    }
  }

  setStick(directions) {
    for (const action of ['left', 'right', 'up', 'down']) {
      const wanted = !!directions[action];
      if (wanted && !this.stickActions.has(action)) { this.stickActions.add(action); this.input.virtualDown(action); }
      if (!wanted && this.stickActions.has(action)) { this.stickActions.delete(action); this.input.virtualUp(action); }
    }
  }

  // --- Botones de acción (se mantienen mientras el dedo esté encima: el rayo se carga así) ---
  buildButton({ action, label, size, right, bottom, color }) {
    const button = this.element('button', 'touch-button touch-' + color, this.layer);
    button.type = 'button';
    button.textContent = label;
    button.style.width = size + 'vh';
    button.style.height = size + 'vh';
    button.style.right = 'calc(' + right + 'vh + env(safe-area-inset-right, 0px))';
    button.style.bottom = 'calc(' + bottom + 'vh + env(safe-area-inset-bottom, 0px))';
    this.bindHold(button, action);
    this.buttonEls.set(action, button);
  }

  bindHold(button, action) {
    let pointer = null;
    button.addEventListener('pointerdown', (event) => {
      if (pointer !== null) return;
      event.preventDefault();
      pointer = event.pointerId;
      button.setPointerCapture(event.pointerId);
      button.classList.add('pressed');
      this.input.virtualDown(action);
    });
    const release = (event) => {
      if (event.pointerId !== pointer) return;
      pointer = null;
      button.classList.remove('pressed');
      this.input.virtualUp(action);
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  // --- Pads del duelo musical: cuatro círculos grandes bajo la pista, uno por carril ---
  buildDuelPads() {
    this.duelLayer = this.element('div', 'touch-duel', this.shell);
    this.duelLayer.setAttribute('aria-hidden', 'true');
    const colors = ['#00f5ff', '#ffe600', '#ff003c', '#9b6bff'];
    const keys = ['D', 'F', 'J', 'K'];
    for (let lane = 0; lane < 4; lane++) {
      const pad = this.element('button', 'touch-pad', this.duelLayer);
      pad.type = 'button';
      pad.textContent = keys[lane];
      pad.style.color = colors[lane];
      pad.style.left = 'calc(50% + ' + (lane - 1.5) * 20 + 'vh)';
      this.bindHold(pad, 'lane' + lane);
    }
    this.duelLayer.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  setDuel(visible) {
    if (!this.duelLayer || this.duelVisible === visible) return;
    this.duelVisible = visible;
    this.duelLayer.style.display = visible ? 'block' : 'none';
    if (!visible) for (let lane = 0; lane < 4; lane++) this.input.virtualUp('lane' + lane);
  }

  // --- Pausa, silencio y pantalla completa ---
  buildSystemButtons() {
    const bar = this.element('div', 'touch-system', this.layer);
    const make = (text, label, handler) => {
      const button = this.element('button', 'touch-small', bar);
      button.type = 'button';
      button.textContent = text;
      button.setAttribute('aria-label', label);
      button.addEventListener('pointerdown', (event) => { event.preventDefault(); handler(); });
      return button;
    };
    make('II', 'Pausa', () => { this.input.virtualDown('pause'); setTimeout(() => this.input.virtualUp('pause'), 60); });
    make('♪', 'Silenciar', () => { this.input.virtualDown('mute'); setTimeout(() => this.input.virtualUp('mute'), 60); });
    // Safari en iPhone no permite pantalla completa en páginas web: solo aparece donde existe
    const root = document.documentElement;
    if (root.requestFullscreen || root.webkitRequestFullscreen) {
      make('⛶', 'Pantalla completa', () => this.toggleFullscreen());
    }
  }

  toggleFullscreen() {
    const root = document.documentElement;
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    if (active) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return;
    }
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    const result = request.call(root);
    const lock = () => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); };
    if (result && result.then) result.then(lock).catch(() => {}); else lock();
  }
}
