import { palette } from "./palette";

const { paper, vellum, ink, neutral, brass, pitch } = palette;

/** A translucent version of `color`, matching the design system's color-mix() tints. */
const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

/**
 * Semantic colour roles. These become Chakra semantic tokens (e.g. `roles.fg.muted` →
 * `color="fg.muted"`), and are also exported as plain values for code that draws outside
 * of CSS (VexFlow, canvas).
 *
 * `bg`, `fg` and `border` reuse Chakra's own role names so built-in Chakra components
 * (Dialog, Toast, Select…) pick up the design system automatically.
 */
export const roles = {
  bg: {
    DEFAULT: paper,
    panel: vellum,
    subtle: neutral[100],
    muted: neutral[200],
    emphasized: neutral[300],
    /** Hover / pressed tints for neutral (secondary) interactive elements. */
    hover: tint(ink, 7),
    pressed: tint(ink, 14),
    /** Row hover for tables and lists. */
    row: tint(ink, 4),
    backdrop: tint(neutral[900], 50),
  },
  fg: {
    DEFAULT: ink,
    muted: neutral[700],
    subtle: neutral[500],
    faint: neutral[600],
    /** The design system's 55% ink, used for captions and `.text-muted`. */
    soft: tint(ink, 55),
  },
  border: {
    DEFAULT: tint(ink, 16),
    emphasized: tint(ink, 45),
    muted: neutral[300],
    subtle: neutral[200],
    strong: neutral[500],
  },
  accent: {
    /** The brass accent itself. Strokes, icons, large text — not body copy (3:1 only). */
    solid: brass.base,
    /** Accent-coloured text at body sizes. */
    fg: brass[700],
    emphasized: brass[600],
    muted: brass[300],
    subtle: brass[100],
    /** Text on an `accent.subtle` fill. */
    contrast: brass[800],
    hover: tint(brass.base, 12),
    pressed: tint(brass.base, 22),
    ghostHover: tint(brass.base, 10),
    ghostPressed: tint(brass.base, 18),
    selection: tint(brass.base, 30),
    /** Playback cursor band behind the current note. */
    cursor: tint(brass.base, 13),
  },
  intonation: {
    good: pitch.green,
    fair: pitch.olive,
    warn: pitch.ochre,
    bad: pitch.red,
  },
} as const;
