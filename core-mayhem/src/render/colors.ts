// src/render/colors.ts
export function colorForAmmo(t: string): string {
  if (t === 'heavy') return '#ffca1a';
  if (t === 'volatile') return '#ff3d3d';
  if (t === 'emp') return '#00ffd5';
  if (t === 'repair') return '#6bffb8';
  if (t === 'shield') return '#9fc5ff';
  return '#b6ff00';
}
