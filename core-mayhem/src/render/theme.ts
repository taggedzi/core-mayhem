// One computed-style snapshot per frame, shared by scene painting and banter.

let depth = 0;
let snapshot: CSSStyleDeclaration | null = null;

/** Open a frame. Nested calls keep the snapshot already taken for this frame. */
export function beginThemeFrame(): void {
  if (depth === 0) snapshot = null;
  depth += 1;
}

/** Close a frame opened with beginThemeFrame. */
export function endThemeFrame(): void {
  if (depth === 0) return;
  depth -= 1;
  if (depth === 0) snapshot = null;
}

function themeStyle(): CSSStyleDeclaration {
  if (depth === 0) return getComputedStyle(document.documentElement);
  return (snapshot ??= getComputedStyle(document.documentElement));
}

/** Resolve a paint token. `var(--name)` reads the frame snapshot; other strings pass through. */
export function cssVar(value: string): string {
  if (!value.startsWith('var(')) return value;
  const name = value.slice(4, -1).trim();
  return themeStyle().getPropertyValue(name).trim() || '#000';
}

/** Replace `var(--name[, fallback])` tokens in a canvas font string. */
export function resolveFontVars(font: string): string {
  if (!font || font.indexOf('var(') === -1) return font;
  return font.replace(/var\(([^)]+)\)/g, (_match, raw: string) => {
    const body = String(raw);
    const comma = body.indexOf(',');
    let name: string;
    let fallback = 'monospace';
    if (comma === -1) {
      name = body.trim();
    } else {
      name = body.slice(0, comma).trim();
      const fallbackText = body.slice(comma + 1).trim();
      if (fallbackText !== '') fallback = fallbackText;
    }
    const val = themeStyle().getPropertyValue(name).trim();
    return val !== '' ? val : fallback;
  });
}
