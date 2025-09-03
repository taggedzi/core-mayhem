import { DEV_KEYS } from '../config';
import { DEV_HELP_LINES } from '../app/devKeys';

let overlayEl: HTMLElement | null = null;
let contentEl: HTMLElement | null = null;

const devKeysOn = (import.meta as any)?.env?.DEV === true || DEV_KEYS.enabledInProd;

export function initHelpOverlay(): void {
  if (overlayEl) return; // already initialized

  // Root overlay
  const overlay = document.createElement('div');
  overlay.id = 'helpOverlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.display = 'none';

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';
  backdrop.addEventListener('click', closeHelpOverlay);

  // Panel
  const panel = document.createElement('div');
  panel.className = 'help-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Dev Hotkeys Help');

  const header = document.createElement('div');
  header.className = 'help-header';
  const hTitle = document.createElement('h2');
  hTitle.textContent = 'Dev Hotkeys';
  const hSmall = document.createElement('span');
  hSmall.className = 'help-sub';
  hSmall.textContent = devKeysOn ? '(enabled)' : '(disabled)';
  const btnX = document.createElement('button');
  btnX.className = 'help-close';
  btnX.type = 'button';
  btnX.textContent = 'Close';
  btnX.title = 'Close (Esc)';
  btnX.addEventListener('click', closeHelpOverlay);
  header.append(hTitle, hSmall, btnX);

  const body = document.createElement('div');
  body.className = 'help-body';

  const p = document.createElement('p');
  p.className = 'help-note';
  p.textContent = 'Press H or click Help to toggle. Hotkeys only work when enabled.';

  // Structured two-column grid with key pills
  const grid = document.createElement('div');
  grid.className = 'help-grid';
  for (const line of DEV_HELP_LINES) {
    const [keysRaw, descRaw] = line.split(':');
    const keys = (keysRaw || '').trim();
    const desc = (descRaw || '').trim();

    const item = document.createElement('div');
    item.className = 'help-item';

    const keysEl = document.createElement('div');
    keysEl.className = 'keys';
    // Split keys on slashes or whitespace around slashes
    const parts = keys.split(/\s*\/\s*/g).filter(Boolean);
    parts.forEach((part, i) => {
      const k = document.createElement('kbd');
      k.textContent = part;
      keysEl.appendChild(k);
      if (i < parts.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = '/';
        keysEl.appendChild(sep);
      }
    });

    const descEl = document.createElement('div');
    descEl.className = 'desc';
    descEl.textContent = desc;

    item.append(keysEl, descEl);
    grid.appendChild(item);
  }

  body.append(p, grid);
  panel.append(header, body);
  overlay.append(backdrop, panel);
  document.body.appendChild(overlay);

  overlayEl = overlay;
  contentEl = panel;

  // Global key handling
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      openHelpOverlay();
    } else if (e.key === 'Escape') {
      if (isOpen()) closeHelpOverlay();
    }
  });
}

export function openHelpOverlay(): void {
  if (!overlayEl) initHelpOverlay();
  if (!overlayEl) return;
  overlayEl.style.display = 'block';
  overlayEl.setAttribute('aria-hidden', 'false');
  // refresh enabled flag text
  const sub = overlayEl.querySelector('.help-sub');
  if (sub) {
    sub.textContent = devKeysOn ? '(enabled)' : '(disabled)';
    sub.classList.toggle('enabled', !!devKeysOn);
    sub.classList.toggle('disabled', !devKeysOn);
  }
  // focus for esc handling accessibility
  (contentEl as HTMLElement | null)?.focus?.();
}

export function closeHelpOverlay(): void {
  if (!overlayEl) return;
  overlayEl.style.display = 'none';
  overlayEl.setAttribute('aria-hidden', 'true');
}

function isOpen(): boolean {
  return !!overlayEl && overlayEl.style.display !== 'none';
}
