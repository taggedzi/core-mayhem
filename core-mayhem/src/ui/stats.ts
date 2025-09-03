import { buildCSVs, exportAllCSVs, resetStats, getSummary } from '../app/stats';

let overlayEl: HTMLElement | null = null;
let panelEl: HTMLElement | null = null;
let lastFocusEl: Element | null = null;

export function initStatsOverlay(): void {
  if (overlayEl) return;

  const root = document.createElement('div');
  root.id = 'statsOverlay';
  root.setAttribute('aria-hidden', 'true');
  root.style.display = 'none';

  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';
  backdrop.addEventListener('click', closeStatsOverlay);

  const panel = document.createElement('div');
  panel.className = 'help-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Stats');
  // Make panel programmatically focusable for accessibility
  (panel as any).tabIndex = -1;

  const header = document.createElement('div');
  header.className = 'help-header';
  const h2 = document.createElement('h2');
  h2.textContent = 'Stats Export';
  const btnX = document.createElement('button');
  btnX.className = 'help-close';
  btnX.type = 'button';
  btnX.textContent = 'Close';
  btnX.title = 'Close';
  btnX.addEventListener('click', closeStatsOverlay);
  header.append(h2, btnX);

  const body = document.createElement('div');
  body.className = 'help-body';

  const intro = document.createElement('p');
  intro.className = 'help-note';
  intro.textContent = 'Download aggregate CSVs for the current stats session.';

  const summary = document.createElement('div');
  summary.style.display = 'grid';
  summary.style.gridTemplateColumns = 'repeat(4, minmax(120px, 1fr))';
  summary.style.gap = '8px';
  summary.style.margin = '8px 0 14px 0';
  function renderSummary() {
    const s = getSummary();
    const chip = (label: string, value: string) => {
      const el = document.createElement('div');
      el.style.background = '#0e1730cc';
      el.style.border = '1px solid #2b3a78';
      el.style.borderRadius = '6px';
      el.style.padding = '6px 8px';
      el.style.fontSize = '12px';
      el.innerHTML = `<span style="opacity:.75;margin-right:6px;">${label}</span><strong>${value}</strong>`;
      return el;
    };
    summary.innerHTML = '';
    summary.append(
      chip('Matches', String(s.matches)),
      chip('Left Wins', String(s.leftWins)),
      chip('Right Wins', String(s.rightWins)),
      chip('Ties', String(s.ties)),
      chip('Buffs L', String(s.buffsL)),
      chip('Buffs R', String(s.buffsR)),
      chip('Debuffs L', String(s.debuffsL)),
      chip('Debuffs R', String(s.debuffsR)),
    );
  }

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.margin = '8px 0 14px 0';

  const btnAll = document.createElement('button');
  btnAll.textContent = 'Download All CSVs';
  btnAll.onclick = () => exportAllCSVs();

  const btnReset = document.createElement('button');
  btnReset.textContent = 'Reset Stats';
  btnReset.onclick = () => {
    const ok = confirm('Reset all collected stats for this session? This clears localStorage.');
    if (!ok) return;
    resetStats();
    // Re-render links since data set changed
    renderLinks(list);
    renderSummary();
  };

  actions.append(btnAll, btnReset);

  const list = document.createElement('div');
  list.style.display = 'grid';
  list.style.gridTemplateColumns = '1fr 1fr';
  list.style.gap = '8px 12px';

  function downloadOne(name: string, data: string): void {
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function renderLinks(container: HTMLElement): void {
    container.innerHTML = '';
    const files = buildCSVs();
    const order = [
      'weapon_agg.csv',
      'bin_cycles.csv',
      'matches.csv',
      'damage_timeline.csv',
      'first_hits.csv',
      'mods_agg.csv',
      'mods_per_match.csv',
    ];
    for (const key of order) {
      const data = files[key];
      if (!data) continue;
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '8px';
      row.style.border = '1px solid #1a2a48';
      row.style.background = '#0d1930';
      row.style.borderRadius = '8px';
      row.style.padding = '8px 10px';

      const label = document.createElement('span');
      label.textContent = key;

      const btn = document.createElement('button');
      btn.textContent = 'Download';
      btn.onclick = () => downloadOne(key, data);

      row.append(label, btn);
      container.appendChild(row);
    }
  }

  renderLinks(list);
  renderSummary();

  body.append(intro, summary, actions, list);
  panel.append(header, body);
  root.append(backdrop, panel);
  document.body.appendChild(root);

  overlayEl = root;
  panelEl = panel;

  // Expose a refresh hook so we can re-render on open
  (overlayEl as any)._statsRender = () => {
    renderLinks(list);
    renderSummary();
  };

  // Global key handling: Esc closes when stats overlay is open
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && overlayEl && overlayEl.style.display !== 'none') {
      e.preventDefault();
      closeStatsOverlay();
    }
  });
}

export function openStatsOverlay(): void {
  if (!overlayEl) initStatsOverlay();
  if (!overlayEl) return;
  // Refresh contents on each open in case stats changed
  try { (overlayEl as any)._statsRender?.(); } catch {}
  lastFocusEl = document.activeElement;
  overlayEl.style.display = 'block';
  overlayEl.setAttribute('aria-hidden', 'false');
  (panelEl as HTMLElement | null)?.focus?.();
}

export function closeStatsOverlay(): void {
  if (!overlayEl) return;
  // Move focus off hidden subtree to avoid aria-hidden warning
  try {
    (panelEl as HTMLElement | null)?.blur?.();
    const active = document.activeElement as HTMLElement | null;
    if (active && overlayEl.contains(active)) active.blur();
  } catch {}
  overlayEl.style.display = 'none';
  overlayEl.setAttribute('aria-hidden', 'true');
  // Restore focus to the trigger if possible
  if (lastFocusEl && (lastFocusEl as HTMLElement).focus) {
    try { (lastFocusEl as HTMLElement).focus(); } catch {}
  }
}
