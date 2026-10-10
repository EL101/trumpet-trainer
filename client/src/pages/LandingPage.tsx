import {
  Center,
  Flex,
  Heading,
  Spinner,
  Text,
  useBreakpointValue,
  useMediaQuery,
  type FlexProps,
} from "@chakra-ui/react";
import { FirebaseError } from "firebase/app";
import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { signInAsGuest, signInWithGoogle } from "@/auth/auth";
import { useAuth } from "@/auth/useAuth";
import { IntonationLegend, Staff } from "@/components/music";
import { Button, Rule } from "@/components/primitives";
import { roles } from "@/theme";

/** A four-bar phrase in C, scored up to the cursor as if someone were playing it now. */
const EXAMPLE = {
  notes:
    "E4/q, G4/8, A4/8, C5/h, B4/q/r, D5/8, C5/8, A4/q, G4/q, F4/q, A4/q, G4/8, F4/8, E4/q, D4/h, C4/h",
  // One entry per note, rests included. Notes past the cursor haven't been played yet.
  cents: [4, -3, 7, 12, null, 18, 6, -2, 9],
  cursor: 9.3,
};

/** Signed-out home (mockup 4b): a title page with the sign-in choices set like an imprint. */
export default function LandingPage() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Center minHeight="100dvh">
        <Spinner color="accent.solid" />
      </Center>
    );
  }
  if (user) {
    // ProtectedRoute records where a signed-out visitor was headed.
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? "/today"} replace />;
  }

  return (
    <Flex
      direction="column"
      align="center"
      minHeight="100dvh"
      bg="bg"
      color="fg"
      pt={{ base: "xl", md: "2xl" }}
      pb={{ base: "lg", md: "xl" }}
    >
      <Flex as="header" direction="column" align="center" gap="xs">
        <Text textStyle="heading.md" letterSpacing="0.02em">
          Trumpet Trainer
        </Text>
        <Rule tone="accent" width="28px" />
      </Flex>

      {/* The trumpets bracket the content in-flow, so they can't end up behind it. */}
      <Fanfare side="left" phase={-2.06} mt={{ base: "sm", md: 0 }} />

      <Flex
        as="main"
        flex="1"
        direction="column"
        align="center"
        justify="center"
        gap="xl"
        width="100%"
        px={{ base: "lg", md: "72px" }}
        py={{ base: "md", md: 0 }}
      >
        <Heading
          as="h1"
          textStyle={{ base: "display.sm", md: "display.lg", lg: "display.xl" }}
          textAlign="center"
          maxWidth="900px"
          textWrap="balance"
          m={0}
        >
          Practice with Interactive Exercises and Live Feedback.
        </Heading>
        <ExamplePassage />
        <SignInChoices />
      </Flex>

      <Fanfare side="right" phase={1.09} />
    </Flex>
  );
}

/** The staff being scored, with the colour key beneath it. */
function ExamplePassage() {
  // All four bars fit on one line from tablet width up; phones get two lines of two.
  const perLine = useBreakpointValue({ base: 2, md: 4 }, { ssr: false });
  const scale = useBreakpointValue({ base: 0.8, md: 0.9, lg: 1.1 }, { ssr: false });

  return (
    <Flex direction="column" align="center" gap="sm" width="100%">
      <Staff
        notes={EXAMPLE.notes}
        timeSig="4/4"
        musicKey="C major"
        cents={EXAMPLE.cents}
        cursor={EXAMPLE.cursor}
        measuresPerLine={perLine}
        scale={scale}
        maxWidth="1000px"
        role="img"
        aria-label="An example exercise in C major. Each note played so far is coloured by how close it was to pitch."
      />
      <IntonationLegend />
    </Flex>
  );
}

function SignInChoices() {
  const [error, setError] = useState<string | null>(null);

  // On success the auth listener re-renders LandingPage, which redirects.
  const signIn = async (method: () => Promise<void>) => {
    setError(null);
    try {
      await method();
    } catch (err) {
      console.error("Sign-in failed:", err);
      setError(
        err instanceof FirebaseError && err.code === "auth/popup-blocked"
          ? "Your browser blocked the sign-in window. Allow pop-ups for this site and try again."
          : "Couldn't sign in. Check your connection and try again.",
      );
    }
  };

  return (
    <Flex direction="column" align="center" gap="md">
      <Flex
        direction={{ base: "column", sm: "row" }}
        align={{ base: "stretch", sm: "center" }}
        gap="md"
      >
        <Button variant="primary" size="lg" onClick={() => signIn(signInWithGoogle)}>
          Sign in with Google
        </Button>
        <Text as="span" textStyle="epigraph" color="fg.muted" textAlign="center">
          or
        </Text>
        <Button variant="secondary" size="lg" onClick={() => signIn(signInAsGuest)}>
          Continue as guest
        </Button>
      </Flex>
      {error && (
        <Text role="alert" textStyle="meta" color="fg.error" textAlign="center" maxWidth="420px">
          {error}
        </Text>
      )}
    </Flex>
  );
}

// ---- Backdrop -----------------------------------------------------------------------
//
// Each fanfare is a full-width band: a trumpet juts in from one edge and a staff waves out
// of its bell across the page. The drawing scales with the page width (down to a
// minimum), so the trumpet stays pinned to its edge and the far end of the staff runs off
// the other side.

const VIEW_W = 1800;
/** The drawing's vertical extent; nothing is drawn above VIEW_TOP or below VIEW_TOP + VIEW_H. */
const VIEW_TOP = 50;
const VIEW_H = 170;
const AXIS_Y = 130;
const MOUTH_X = 340;
/** Length of the staff, from the middle of the bell to the far edge. */
const FLOW = VIEW_W - MOUTH_X;
const WAVELENGTH = 520;
/** How fast the music drifts out of the bell, in drawing units per second. */
const DRIFT_SPEED = 20;
/** Distance over which notes fade in as they leave the bell. */
const EMERGE = 80;
const BAR = 230;
/** The melody is seven bars long, a little longer than the staff, and loops back into the bell. */
const LOOP = 7 * BAR;

/** Pipes, as centrelines: the bell pipe, then the main tuning slide running into the lead pipe. */
const TUBES = ["M-20 130 H160", "M-20 162 H185 A13 13 0 0 1 185 188 H-20"];
const VALVES = [20, 50, 80];

type BackdropNote = { u: number; step: number; kind: "q" | "h" | "8" };

/**
 * `u` is the distance along the staff before any drift, `step` counts half-spaces up from
 * the middle line. Eighths ("8") come in beamed pairs, never two pairs back to back.
 */
const MELODY: BackdropNote[] = [
  { u: 60, step: -3, kind: "q" },
  { u: 110, step: -1, kind: "8" },
  { u: 150, step: 1, kind: "8" },
  { u: 200, step: 0, kind: "q" },
  { u: 295, step: 2, kind: "h" },
  { u: 385, step: 3, kind: "8" },
  { u: 425, step: 1, kind: "8" },
  { u: 525, step: -1, kind: "q" },
  { u: 575, step: 0, kind: "8" },
  { u: 615, step: 2, kind: "8" },
  { u: 665, step: 4, kind: "q" },
  { u: 760, step: 3, kind: "h" },
  { u: 860, step: 1, kind: "q" },
  { u: 985, step: -2, kind: "8" },
  { u: 1025, step: 0, kind: "8" },
  { u: 1075, step: 2, kind: "q" },
  { u: 1125, step: 1, kind: "q" },
  { u: 1220, step: 3, kind: "h" },
  { u: 1320, step: -1, kind: "q" },
  { u: 1445, step: 2, kind: "8" },
  { u: 1485, step: 0, kind: "8" },
  { u: 1535, step: -2, kind: "q" },
  { u: 1585, step: -1, kind: "q" },
];
const BARLINES = Array.from({ length: LOOP / BAR }, (_, i) => 20 + i * BAR);

/**
 * Seconds of drift so far, ticking at about 30 fps. Holds still for viewers who ask for
 * reduced motion, and picks up where it left off when a hidden tab comes back.
 */
function useDriftClock() {
  const [reduceMotion] = useMediaQuery(["(prefers-reduced-motion: reduce)"], { ssr: false });
  const [seconds, setSeconds] = useState(0);
  const elapsed = useRef(0);

  useEffect(() => {
    if (reduceMotion) return;
    let prev = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      frame = requestAnimationFrame(tick);
      if (now - prev < 1000 / 30) return;
      elapsed.current += Math.min(now - prev, 100) / 1000;
      prev = now;
      setSeconds(elapsed.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion]);

  return seconds;
}

/**
 * Decorative band: a trumpet jutting in from `side`, playing a wavy staff across the page.
 * `phase` shifts the wave; pick one that keeps the staff away from the content mid-page.
 */
function Fanfare({ side, phase, ...rest }: FlexProps & { side: "left" | "right"; phase: number }) {
  const shift = useDriftClock() * DRIFT_SPEED;
  const x = (u: number) => (side === "left" ? MOUTH_X + u : VIEW_W - MOUTH_X - u);
  const staffAt = (u: number) => {
    const t = u / FLOW;
    // Leaves the bell level, then swings wider and opens up the further it travels. The
    // wave travels outward as fast as the notes, so they ride it out of the bell.
    const swing = 40 * (1 - Math.exp(-5 * t));
    const mid = AXIS_Y + swing * Math.sin((2 * Math.PI * (u - shift)) / WAVELENGTH + phase);
    return { mid, gap: 7 + 7 * t };
  };
  const drifted = (u: number) => (u + shift) % LOOP;

  const lines = [-2, -1, 0, 1, 2].map((k) => {
    const points: string[] = [];
    for (let u = 0; u <= FLOW; u += 8) {
      const { mid, gap } = staffAt(u);
      points.push(`${x(u).toFixed(1)} ${(mid + k * gap).toFixed(1)}`);
    }
    return `M${points.join("L")}`;
  });

  const notes = MELODY.map((note, i) => {
    // A beamed pair drifts as one, so it never splits across the loop.
    const lead = note.kind === "8" && MELODY[i - 1]?.kind === "8" ? MELODY[i - 1] : note;
    const u = drifted(lead.u) + note.u - lead.u;
    const { mid, gap } = staffAt(u);
    const opacity = Math.min(1, u / EMERGE);
    return { ...note, cx: x(u), cy: mid - (note.step * gap) / 2, gap, opacity };
  });

  const fadeId = `tt-fanfare-${side}`;
  const ink = `url(#${fadeId})`;

  return (
    <Flex
      aria-hidden
      width="100%"
      overflow="hidden"
      pointerEvents="none"
      // Below the minimum width the drawing overflows; keep the trumpet's edge in view.
      justify={side === "left" ? "flex-start" : "flex-end"}
      {...rest}
    >
      <svg
        viewBox={`0 ${VIEW_TOP} ${VIEW_W} ${VIEW_H}`}
        style={{ display: "block", width: "100%", minWidth: "900px", flexShrink: 0 }}
      >
        <defs>
          <linearGradient
            id={fadeId}
            gradientUnits="userSpaceOnUse"
            x1={x(0)}
            x2={x(FLOW)}
            y1={0}
            y2={0}
          >
            <stop offset="0" stopColor={roles.accent.solid} stopOpacity={0.75} />
            <stop offset="0.45" stopColor={roles.accent.solid} stopOpacity={0.35} />
            <stop offset="1" stopColor={roles.accent.solid} stopOpacity={0.1} />
          </linearGradient>
        </defs>

        <g transform={side === "right" ? `translate(${VIEW_W} 0) scale(-1 1)` : undefined}>
          <Trumpet />
        </g>

        <g stroke={ink} strokeWidth={1.1} fill="none">
          {lines.map((d, k) => (
            <path key={k} d={d} />
          ))}
          {BARLINES.map((bar) => {
            const u = drifted(bar);
            const { mid, gap } = staffAt(u);
            return (
              <line
                key={bar}
                x1={x(u)}
                x2={x(u)}
                y1={mid - 2 * gap}
                y2={mid + 2 * gap}
                opacity={Math.min(1, u / EMERGE)}
              />
            );
          })}
        </g>

        <g stroke={ink} fill={ink}>
          {notes.map((n, i) => {
            const pairedWith =
              n.kind === "8" ? (notes[i - 1]?.kind === "8" ? i - 1 : i + 1) : undefined;
            // Stems go up below the middle line and down from it; a beamed pair agrees.
            const step = pairedWith != null ? (n.step + notes[pairedWith].step) / 2 : n.step;
            const up = step < 0;
            const rx = n.gap * 0.66;
            const stemX = n.cx + (up ? rx : -rx) * 0.9;
            const stemEnd = n.cy + (up ? -3.5 : 3.5) * n.gap;
            const beamTo = n.kind === "8" && pairedWith === i + 1 ? notes[i + 1] : undefined;
            return (
              <g key={n.u} opacity={n.opacity}>
                <ellipse
                  cx={n.cx}
                  cy={n.cy}
                  rx={rx}
                  ry={n.gap * 0.46}
                  transform={`rotate(-20 ${n.cx} ${n.cy})`}
                  fill={n.kind === "h" ? "none" : undefined}
                  strokeWidth={n.kind === "h" ? 1.6 : 0}
                />
                <line x1={stemX} x2={stemX} y1={n.cy} y2={stemEnd} strokeWidth={1.2} />
                {beamTo && (
                  <line
                    x1={stemX}
                    y1={stemEnd}
                    x2={beamTo.cx + (up ? rx : -rx) * 0.9}
                    y2={beamTo.cy + (up ? -3.5 : 3.5) * beamTo.gap}
                    strokeWidth={n.gap * 0.45}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </Flex>
  );
}

/** A trumpet in profile, bell facing right, drawn as a brass line engraving. */
function Trumpet() {
  const brass = roles.accent.solid;
  const paper = roles.bg.DEFAULT;
  return (
    <g stroke={brass} strokeWidth={1.4} fill={paper}>
      {/* A brass stroke with a paper core draws each pipe as a hollow tube. */}
      <g fill="none">
        {TUBES.map((d) => (
          <path key={d} d={d} strokeWidth={12} />
        ))}
        {TUBES.map((d) => (
          <path key={`core-${d}`} d={d} strokeWidth={9.2} stroke={paper} />
        ))}
      </g>
      {VALVES.map((cx) => (
        <g key={cx}>
          <line x1={cx} x2={cx} y1={84} y2={96} />
          <rect x={cx - 9} y={78} width={18} height={6} rx={3} fill={roles.accent.subtle} />
          <rect x={cx - 12} y={96} width={24} height={6} rx={1.5} />
          <rect x={cx - 10} y={102} width={20} height={102} />
          <rect x={cx - 8} y={204} width={16} height={8} rx={2} />
        </g>
      ))}
      <path d="M150 124 C240 124 300 112 340 60 L340 200 C300 148 240 136 150 136 Z" />
      {/* Sheen along the top of the flare. */}
      <path
        d="M168 127.5 C244 127.5 298 118 331 78"
        fill="none"
        stroke={roles.accent.muted}
        strokeWidth={1.2}
      />
      <ellipse cx={MOUTH_X} cy={AXIS_Y} rx={11} ry={70} fill={roles.accent.subtle} />
      <ellipse cx={MOUTH_X} cy={AXIS_Y} rx={14} ry={73} fill="none" />
    </g>
  );
}
