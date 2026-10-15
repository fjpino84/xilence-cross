// Modal DOM con el estilo visual del juego (sustituye a alert/confirm/prompt).
class Modal {
  constructor(root) {
    this.root = root;
    this.overlay = null;
  }

  get isOpen() { return this.overlay !== null; }

  // buttons: [{ label, onClick }]
  show({ title, message, buttons, variant = '' }) {
    this.hide();

    const overlay = document.createElement('div');
    overlay.className = variant ? 'modal-overlay modal-overlay--' + variant : 'modal-overlay';

    const panel = document.createElement('section');
    panel.className = 'modal-panel';
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

    panel.append(heading, text, actions);
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
