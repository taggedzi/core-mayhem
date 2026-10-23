let activeModal: HTMLElement | null = null;

export function allowGameShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey)
    return false;
  if (activeModal) return false;
  const target = event.target;
  return !(
    target instanceof Element &&
    target.closest(
      'input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])',
    )
  );
}

/** Trap focus and keyboard handling in the top dialog; restore the opener on close. */
export function activateModal(
  root: HTMLElement,
  panel: HTMLElement,
  close?: () => void,
): () => void {
  const previous = activeModal;
  const opener = document.activeElement as HTMLElement | null;
  const siblings = Array.from(document.body.children)
    .filter((node): node is HTMLElement => node instanceof HTMLElement && node !== root)
    .map((node) => ({ node, inert: node.inert }));
  for (const { node } of siblings) node.inert = true;
  root.inert = false;
  activeModal = panel;
  const focusable = (): HTMLElement[] =>
    Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]',
      ),
    ).filter((node) => node.tabIndex >= 0 && !node.hidden && !node.closest('[hidden], [inert]'));
  const keydown = (event: KeyboardEvent): void => {
    if (activeModal !== panel || event.isComposing) return;
    if (event.key === 'Escape' && close) {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      const controls = focusable();
      const index = controls.indexOf(document.activeElement as HTMLElement);
      if (
        !controls.length ||
        index < 0 ||
        (!event.shiftKey && index === controls.length - 1) ||
        (event.shiftKey && index === 0)
      ) {
        event.preventDefault();
        (event.shiftKey ? controls[controls.length - 1] : controls[0])?.focus();
        if (!controls.length) panel.focus();
      }
    }
  };
  document.addEventListener('keydown', keydown, true);
  panel.focus();
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('keydown', keydown, true);
    for (const { node, inert } of siblings) node.inert = inert;
    if (activeModal === panel) activeModal = previous;
    if (opener?.isConnected && !opener.closest('[inert]')) opener.focus();
  };
}
