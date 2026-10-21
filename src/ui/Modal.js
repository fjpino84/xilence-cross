// Modal DOM con el estilo visual del juego (sustituye a alert/confirm/prompt).
class Modal {
  constructor(root) {
    this.root = root;
    this.overlay = null;
  }

  get isOpen() { return this.overlay !== null; }

  // buttons: [{ label, onClick }]
  // variant: '' | 'card' | 'pause' | 'lose' | 'win'. icon: símbolo sobre el título. stats: [[etiqueta, valor]]. hint: línea pequeña inferior
  show({ title, message, buttons, variant = '', icon = '', stats = [], hint = '' }) {
    this.hide();

    const overlay = document.createElement('div');
    overlay.className = variant ? 'modal-overlay modal-overlay--' + variant : 'modal-overlay';

    const panel = document.createElement('section');
    panel.className = 'modal-panel';
    if (icon) {
      const badge = document.createElement('div');
      badge.className = 'modal-icon';
      badge.setAttribute('aria-hidden', 'true');
      const glyph = document.createElement('span');
      glyph.textContent = icon;
      glyph.style.transform = 'rotate(-45deg)'; // el rombo gira 45°: el símbolo se endereza
      badge.appendChild(glyph);
      panel.appendChild(badge);
    }
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', title);

    const heading = document.createElement('h2');
    heading.className = 'modal-title';
    heading.textContent = title;

    const text = document.createElement('p');
    text.className = 'modal-message';
    text.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    for (const { label, onClick } of buttons) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'modal-button';
      button.textContent = label;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        onClick();
      });
      actions.appendChild(button);
    }

    panel.append(heading, text);
    if (stats.length) {
      const row = document.createElement('div');
      row.className = 'modal-stats';
      for (const [label, value] of stats) {
        const chip = document.createElement('div');
        chip.className = 'modal-stat';
        const number = document.createElement('strong');
        number.textContent = String(value);
        const caption = document.createElement('span');
        caption.textContent = label;
        chip.append(number, caption);
        row.appendChild(chip);
      }
      panel.appendChild(row);
    }
    panel.appendChild(actions);
    if (hint) {
      const note = document.createElement('p');
      note.className = 'modal-hint';
      note.textContent = hint;
      panel.appendChild(note);
    }
    overlay.appendChild(panel);
    this.root.appendChild(overlay);
    this.overlay = overlay;

    const first = actions.querySelector('button');
    if (first) first.focus();
  }

  hide() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}
