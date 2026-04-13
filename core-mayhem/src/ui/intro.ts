// intro.ts — landing screen welcome dialog shown before the first game start
let overlayEl: HTMLElement | null = null;
let onStartCb: (() => void) | null = null;

export function initIntroOverlay(onStart: () => void): void {
  onStartCb = onStart;

  if (overlayEl) return; // already initialized

  // Root overlay
  const overlay = document.createElement('div');
  overlay.id = 'introOverlay';
  overlay.setAttribute('aria-hidden', 'false');

  // Backdrop (non-dismissible on click — player must press Start)
  const backdrop = document.createElement('div');
  backdrop.className = 'intro-backdrop';

  // Panel
  const panel = document.createElement('div');
  panel.className = 'intro-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Welcome to Core Mayhem');
  (panel as HTMLElement).tabIndex = -1;

  // ——— Title banner ———
  const title = document.createElement('div');
  title.className = 'intro-title';
  const titleH1 = document.createElement('h1');
  titleH1.innerHTML = 'CORE<span class="intro-title-accent">MAYHEM</span>';
  title.appendChild(titleH1);

  // ——— Tagline ———
  const tagline = document.createElement('p');
  tagline.className = 'intro-tagline';
  tagline.textContent = '— an idle arcade battle simulation —';

  // ——— How to play section ———
  const howTo = document.createElement('div');
  howTo.className = 'intro-howto';

  const steps: { icon: string; text: string }[] = [
    {
      icon: '⛏',
      text: 'Two opposing Cores mine the arena for resources, racing to stockpile energy.',
    },
    {
      icon: '🔋',
      text: 'Resources power weapons — lasers, homing missiles, shields, and more.',
    },
    {
      icon: '💥',
      text: 'Cores take structural damage from incoming fire. Knock the enemy Core to zero to win the round.',
    },
    {
      icon: '🏆',
      text: 'Matches are best-of series. Win rounds to claim the championship, then the next battle begins.',
    },
  ];

  for (const step of steps) {
    const row = document.createElement('div');
    row.className = 'intro-step';

    const iconEl = document.createElement('span');
    iconEl.className = 'intro-step-icon';
    iconEl.textContent = step.icon;

    const textEl = document.createElement('span');
    textEl.className = 'intro-step-text';
    textEl.textContent = step.text;

    row.append(iconEl, textEl);
    howTo.appendChild(row);
  }

  // ——— Tip ———
  const tip = document.createElement('p');
  tip.className = 'intro-tip';
  tip.textContent =
    'Sit back and watch — or tweak weapons, audio, and banter settings from the header.';

  // ——— Start button ———
  const btnStart = document.createElement('button');
  btnStart.className = 'intro-start-btn';
  btnStart.type = 'button';
  btnStart.textContent = '▶  START';
  btnStart.addEventListener('click', handleStart);

  panel.append(title, tagline, howTo, tip, btnStart);
  overlay.append(backdrop, panel);
  document.body.appendChild(overlay);

  overlayEl = overlay;

  // Allow Enter/Space on the focused panel to start
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!overlayEl || overlayEl.style.display === 'none') return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleStart();
    }
  });

  // Focus the start button for keyboard accessibility
  btnStart.focus();
}

function handleStart(): void {
  closeIntroOverlay();
  onStartCb?.();
}

function closeIntroOverlay(): void {
  if (!overlayEl) return;
  try {
    const active = document.activeElement as HTMLElement | null;
    if (active && overlayEl.contains(active)) active.blur();
  } catch { /* ignore */ void 0; }
  overlayEl.style.display = 'none';
  overlayEl.setAttribute('aria-hidden', 'true');
}
