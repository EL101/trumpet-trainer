import { chakra, type HTMLChakraProps } from "@chakra-ui/react";
import { centsColor } from "@/lib/intonation";
import { roles } from "@/theme";

// The dial as the mockups draw it, in its 360 × 200 viewBox: an arc about the needle's
// hub, ±50¢ across ±62°, a tick every 10¢.
const CX = 180;
const CY = 185;
const R = 150;
const RANGE = 50;
const SWEEP = 62;
const NEEDLE = 128;
const MINOR_TICKS = [-40, -30, -20, -10, 10, 20, 30, 40];
const MAJOR_TICKS = [-RANGE, 0, RANGE];

type TunerGaugeProps = Omit<HTMLChakraProps<"svg">, "children"> & {
  /** Cents off the nearest note; null while nothing is heard (no needle). */
  cents: number | null;
  /** Half-width of the in-tune zone marked on the arc, in cents. */
  inTune?: number;
};

/** The tuner's dial: the in-tune zone marked in green, a needle coloured by intonation. */
export function TunerGauge({ cents, inTune = 5, ...rest }: TunerGaugeProps) {
  return (
    <chakra.svg
      viewBox="0 0 360 200"
      width="288px"
      maxWidth="100%"
      display="block"
      role="img"
      aria-label={describe(cents)}
      {...rest}
    >
      <path
        d={arc(-RANGE, RANGE)}
        fill="none"
        strokeWidth={3}
        strokeLinecap="round"
        style={{ stroke: roles.border.muted }}
      />
      <path
        d={arc(-inTune, inTune)}
        fill="none"
        strokeWidth={5}
        strokeLinecap="round"
        style={{ stroke: roles.intonation.good }}
      />
      {MINOR_TICKS.map((c) => (
        <line key={c} {...tick(c, 12)} strokeWidth={1.5} style={{ stroke: roles.fg.subtle }} />
      ))}
      {MAJOR_TICKS.map((c) => (
        <line key={c} {...tick(c, 20)} strokeWidth={2} style={{ stroke: roles.fg.DEFAULT }} />
      ))}
      <text x={40} y={140} fontSize={18} style={{ fill: roles.fg.muted }}>
        ♭
      </text>
      <text x={310} y={140} fontSize={18} style={{ fill: roles.fg.muted }}>
        ♯
      </text>
      {cents != null && (
        <chakra.g
          style={{ transform: `rotate(${angle(cents)}deg)`, transformOrigin: `${CX}px ${CY}px` }}
          _motionSafe={{ transition: "transform 120ms ease-out" }}
        >
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={CY - NEEDLE}
            strokeWidth={2.5}
            strokeLinecap="round"
            style={{ stroke: centsColor(cents) }}
          />
        </chakra.g>
      )}
      <circle cx={CX} cy={CY} r={7} style={{ fill: roles.fg.DEFAULT }} />
      <circle cx={CX} cy={CY} r={2.8} style={{ fill: roles.bg.subtle }} />
    </chakra.svg>
  );
}

/** Degrees from upright, clockwise, with the needle pinned at the ends of the dial. */
function angle(cents: number) {
  return (Math.max(-RANGE, Math.min(RANGE, cents)) / RANGE) * SWEEP;
}

function point(cents: number, r: number) {
  const a = (angle(cents) * Math.PI) / 180;
  return { x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) };
}

function arc(from: number, to: number) {
  const a = point(from, R);
  const b = point(to, R);
  return `M${a.x} ${a.y} A${R} ${R} 0 0 1 ${b.x} ${b.y}`;
}

/** A tick `length` long, in from the arc. */
function tick(cents: number, length: number) {
  const outer = point(cents, R);
  const inner = point(cents, R - length);
  return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
}

function describe(cents: number | null) {
  if (cents == null) return "Tuner: nothing heard";
  if (cents === 0) return "Tuner: in tune";
  return `Tuner: ${Math.abs(cents)} cents ${cents > 0 ? "sharp" : "flat"}`;
}
