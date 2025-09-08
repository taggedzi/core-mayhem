/** World, geometry, and object placement config. */

export const CANVAS = { width: 1920, height: 1039 } as const;

/** Visual stroke thickness for pipe/lane walls (px). */
export const WALL_T = 6;
export const WALL_PHYS_T = 24; // collider thickness (invisible)

// thin border stroke for boxes (legacy note)
export const BIN_INTAKE_H = 6; // height of the visible intake strip

/** Pipe channel and side intake geometry (left side; right mirrors). */
export const PIPES = {
  channel: {
    // Bottom-left position and size of the inner channel (between the two vertical walls)
    pos: [-3, 81] as [number, number],
    size: [60, 891] as [number, number],
  },
  intake: {
    // Bottom-left position and size of the side intake sensor (off-screen on left)
    pos: [-115, 85] as [number, number],
    size: [110, 36] as [number, number],
  },
} as const;

/** Procedural pin/rotor field parameters. */
export const PINS = {
  width: 450, // pin-field width in px
  startY: 780, // bottom-left Y to first row center (moved down ~20px)
  rows: 9,
  sx: 42, // horizontal spacing
  sy: 35, // vertical spacing
  rotorEvery: 3, // every Nth row becomes rotors
  pinRadius: 4,
  rotorRadius: 12,
  edgeMargin: 18, // keep pins/rotors this far from field edges
} as const;

type WeaponId = 'cannon' | 'laser' | 'missile' | 'mortar';

interface PaddleSpec {
  // Absolute bottom-left position (px) of a fixed 80x8 paddle
  pos: [number, number];
  amp: number;
  spd: number;
  dir: -1 | 1; // initial sweep direction for the left-side copy; right will mirror
  enabled?: boolean;
}

/** Left-side absolute paddles; right mirrors X and flips dir. */
export const PADDLES_LEFT: readonly PaddleSpec[] = [
  { pos: [157, 428], amp: 24, spd: 1.4, dir: +1 },
  { pos: [326, 385], amp: 28, spd: 1.1, dir: -1 },
  { pos: [250, 975], amp: 30, spd: 1.3, dir: -1 },
] as const;

interface GelSpec {
  // Absolute bottom-left position and size in px
  pos: [number, number];
  size: [number, number];
  dampX?: number;
  dampY?: number;
  enabled?: boolean;
}

/** Left-side gel (damping) regions; right mirrors X automatically. */
export const GELS_LEFT: readonly GelSpec[] = [
  { pos: [79, 896], size: [406, 65], dampX: 2.2, dampY: 3.2 },
] as const;

type BinId = 'cannon' | 'laser' | 'missile' | 'mortar' | 'shield' | 'repair' | 'buff' | 'debuff';
type AmmoKind = 'basic' | 'heavy' | 'volatile' | 'emp' | 'shield' | 'repair';
export type IntakeSide = 'top' | 'bottom' | 'left' | 'right';

interface BinStyle {
  stroke?: string;
  box?: string;
  fill?: string;
  gauge?: string;
  text?: string;
}

export interface BinSpec {
  id: BinId;
  accepts: AmmoKind[];
  cap: number;
  // Absolute integer bottom-left position and size (px)
  pos: [number, number];
  size: [number, number];
  intake: IntakeSide;
  rotation?: number;
  label?: string;
  enabled?: boolean;
  style?: BinStyle;
}

/** Left-side bin specs (right side is mirrored automatically). */
export const BINS_LEFT: readonly BinSpec[] = [
  {
    id: 'cannon',
    accepts: ['basic', 'heavy', 'volatile'],
    cap: 28,
    // bottom-left position
    pos: [35, 202],
    size: [70, 27],
    intake: 'top',
    label: 'Cannon',
    style: { fill: '#480072' },
  },
  {
    id: 'laser',
    accepts: ['basic', 'emp'],
    cap: 35,
    pos: [225, 202],
    size: [70, 27],
    intake: 'top',
    label: 'Laser',
    style: { fill: '#ff5d5d' },
  },
  {
    id: 'missile',
    accepts: ['heavy', 'volatile'],
    cap: 45,
    pos: [365, 256],
    size: [70, 27],
    intake: 'top',
    label: 'Missile',
    style: { fill: '#ffb84d' },
  },
  {
    id: 'buff',
    accepts: ['basic', 'heavy', 'emp', 'shield', 'repair'],
    cap: 50,
    pos: [500, 289],
    size: [70, 27],
    intake: 'top',
    label: 'Buff',
    style: { fill: '#5CFF7A' },
  },
  {
    id: 'mortar',
    accepts: ['basic', 'heavy'],
    cap: 30,
    pos: [141, 105],
    size: [70, 27],
    intake: 'top',
    label: 'Mortar',
    style: { fill: '#bd9cff' },
  },
  {
    id: 'shield',
    accepts: ['emp', 'shield'],
    cap: 40,
    pos: [289, 105],
    size: [70, 27],
    intake: 'top',
    label: 'Shield',
    style: { fill: '#72f0ff' },
  },
  {
    id: 'repair',
    accepts: ['repair', 'heavy'],
    cap: 40,
    pos: [436, 181],
    size: [70, 27],
    intake: 'top',
    label: 'Repair',
    style: { fill: '#9cff72' },
  },
  {
    id: 'debuff',
    accepts: ['basic', 'heavy', 'volatile', 'emp', 'shield'],
    cap: 45,
    pos: [605, 267],
    size: [70, 27],
    intake: 'top',
    label: 'Debuff',
    style: { fill: '#FF6B6B' },
  },
] as const;

