import {
  Box,
  Center,
  chakra,
  Flex,
  Heading,
  Image,
  Spinner,
  Text,
  useBreakpointValue,
  useMediaQuery,
} from "@chakra-ui/react";
import { FirebaseError } from "firebase/app";
import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { signInAsGuest, signInWithGoogle } from "@/auth/auth";
import googleIcon from "@/assets/google-icon.svg";
import { useAuth } from "@/auth/useAuth";
import { IntonationLegend, Staff } from "@/components/music";
import { Button, Rule } from "@/components/primitives";
import { demoAt, valvesFor, type DemoPacing } from "@/lib/landingDemo";
import { buildTimeline } from "@/lib/timeline";
import { roles } from "@/theme";

/**
 * A four-bar phrase in C, played on a loop: the left herald plays the first two bars and
 * the right one answers with the last two, each note taking its colour as it's played.
 */
const EXAMPLE = {
  notes:
    "E4/q, G4/8, A4/8, C5/h, B4/q/r, D5/8, C5/8, A4/q, G4/q, F4/q, A4/q, G4/8, F4/8, E4/q, D4/h, C4/h",
  timeSig: "4/4",
  // One entry per note, rests included.
  cents: [4, -3, 7, 12, null, 18, 6, -2, 9, 3, 11, -27, -8, 2, -1, 5],
  /** For viewers who'd rather not see motion: the phrase stopped part-way through. */
  stillCursor: 9.3,
};
const EXAMPLE_TIMELINE = buildTimeline(EXAMPLE.notes, EXAMPLE.timeSig);
const PACING: DemoPacing = { bpm: 100, lead: 0.8, hold: 2.2 };

/**
 * The entrance, in ms after the page appears. The brand and headline rise in, the music
 * is laid down left to right while the heralds raise their horns to it (the right a beat
 * after the left), then the colour key fills in and the sign-in choices pop in. The
 * heralds start playing once the staff is down.
 */
const INTRO = {
  brand: 0,
  headline: 120,
  textFor: 800,
  music: 400,
  musicFor: 1600,
  heralds: 500,
  /** The right herald raises its horn this long after the left. */
  heraldsStagger: 220,
  heraldsFor: 1300,
  /** The colour key fills in once the staff is down. */
  legendFor: 600,
  signInFor: 500,
};
const LEGEND_AT = INTRO.music + INTRO.musicFor;
const SIGN_IN_AT = LEGEND_AT + INTRO.legendFor;
const PLAY_FROM = LEGEND_AT + 200;

/** easeOutCubic. */
const EASE_OUT = "cubic-bezier(0.33, 1, 0.68, 1)";
/** easeInOutSine, for left-to-right reveals that should read at an even pace. */
const EASE_IN_OUT = "cubic-bezier(0.45, 0, 0.55, 1)";
/** easeOutBack: overshoots a little, so things spring into place. */
const POP_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

/**
 * Signed-out home: a title page whose example staff is played by two heralds, one at each
 * end, in front of notation drifting up through a pool of light.
 */
export default function LandingPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [reduceMotion] = useMediaQuery(["(prefers-reduced-motion: reduce)"], { ssr: false });
  // Stops the example's loop and the drifting notation (WCAG 2.2.2: pause, stop, hide).
  const [motionPaused, setMotionPaused] = useState(false);

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
    return <Navigate to={from ?? "/generate"} replace />;
  }

  const riseIn = (delay: number) => ({
    animation: `rise-in ${INTRO.textFor}ms ${EASE_OUT} ${delay}ms backwards`,
  });

  return (
    <Flex
      position="relative"
      direction="column"
      align="center"
      minHeight="100dvh"
      overflow="hidden"
      bg="bg"
      color="fg"
      pt={{ base: "xl", md: "2xl" }}
      pb={{ base: "lg", md: "xl" }}
    >
      <NotationDrift paused={motionPaused} />

      <Flex
        as="header"
        position="relative"
        direction="column"
        align="center"
        gap="xs"
        _motionSafe={riseIn(INTRO.brand)}
      >
        <Text textStyle="heading.md" letterSpacing="0.02em">
          Trumpet Trainer
        </Text>
        <Rule tone="accent" width="28px" />
      </Flex>

      <Flex
        as="main"
        position="relative"
        flex="1"
        direction="column"
        align="center"
        justify="center"
        gap="xl"
        width="100%"
        px={{ base: "lg", md: "72px" }}
        py={{ base: "xl", md: "2xl" }}
      >
        <Heading
          as="h1"
          textStyle={{ base: "display.sm", md: "display.lg", lg: "display.xl" }}
          textAlign="center"
          maxWidth="900px"
          textWrap="balance"
          m={0}
          _motionSafe={riseIn(INTRO.headline)}
        >
          Practice with Interactive Exercises and Live Feedback.
        </Heading>
        <ExamplePassage paused={motionPaused} />
        <SignInChoices appearAt={SIGN_IN_AT} />
      </Flex>

      {/* The loop and the drift go on as long as the page is open, so they can be
          stopped. Nothing moves for viewers who ask for reduced motion, so it's not
          offered to them. */}
      {!reduceMotion && (
        <Button
          variant="ghost"
          size="sm"
          position="absolute"
          bottom={{ base: "sm", md: "lg" }}
          right={{ base: "sm", md: "lg" }}
          onClick={() => setMotionPaused((paused) => !paused)}
          _motionSafe={{ animation: `appear 400ms ease-out ${SIGN_IN_AT}ms backwards` }}
        >
          {motionPaused ? <Play aria-hidden /> : <Pause aria-hidden />}
          {motionPaused ? "Play motion" : "Pause motion"}
        </Button>
      )}
    </Flex>
  );
}

/**
 * The example staff with its colour key beneath, played on a loop. From laptop width up,
 * a herald stands at each end of the staff, bell to the lines, and plays its half. While
 * `paused`, it stands still part-way through, as it does for reduced motion.
 */
function ExamplePassage({ paused }: { paused: boolean }) {
  // All four bars fit on one line from tablet width up; phones get two lines of two.
  const perLine = useBreakpointValue({ base: 2, md: 4 }, { ssr: false });
  const scale = useBreakpointValue({ base: 0.8, md: 0.9, lg: 1 }, { ssr: false }) ?? 1;
  const heralds = useBreakpointValue({ base: false, lg: true }, { ssr: false }) ?? false;
  const demo = useDemo(paused);

  // Recoloured only when another note is played, so the staff isn't redrawn every frame.
  const cents = useMemo(
    () => EXAMPLE.cents.map((c, i) => (i < demo.played ? c : null)),
    [demo.played],
  );
  const sounding = demo.sounding == null ? null : EXAMPLE_TIMELINE.notes[demo.sounding].midi;
  const valves = sounding == null ? [] : valvesFor(sounding);

  return (
    <Flex direction="column" align="center" gap="sm" width="100%">
      <Box position="relative" width="100%" maxWidth={{ base: "1000px", lg: "780px" }}>
        {heralds && (
          <Herald
            side="left"
            playing={demo.player === "left"}
            valves={demo.player === "left" ? valves : []}
            staffScale={scale}
          />
        )}
        <Staff
          notes={EXAMPLE.notes}
          timeSig={EXAMPLE.timeSig}
          musicKey="C major"
          cents={cents}
          cursor={demo.cursor}
          measuresPerLine={perLine}
          scale={scale}
          // Laid down left to right as the page arrives.
          _motionSafe={{
            animation: `wipe-in ${INTRO.musicFor}ms ${EASE_IN_OUT} ${INTRO.music}ms backwards`,
          }}
          role="img"
          aria-label="An example exercise in C major. Each note is coloured by how close it was to pitch as it's played."
        />
        {heralds && (
          <Herald
            side="right"
            playing={demo.player === "right"}
            valves={demo.player === "right" ? valves : []}
            staffScale={scale}
          />
        )}
      </Box>
      {/* "In tune", then the colour bar from green to red, then "35¢ off". */}
      <IntonationLegend
        _motionSafe={{
          animation: `wipe-in ${INTRO.legendFor}ms ${EASE_IN_OUT} ${LEGEND_AT}ms backwards`,
        }}
      />
    </Flex>
  );
}

/**
 * Where the example's loop is now. It starts once the staff has been laid down; for
 * viewers who'd rather not see motion it stays still, part-way through the phrase.
 */
function useDemo(paused: boolean) {
  const [reduceMotion] = useMediaQuery(["(prefers-reduced-motion: reduce)"], { ssr: false });
  const still = reduceMotion || paused;
  const seconds = useLoopClock(!still);

  if (still) {
    const played = Math.floor(EXAMPLE.stillCursor);
    return { cursor: EXAMPLE.stillCursor, played, player: null, sounding: null };
  }
  return demoAt(EXAMPLE_TIMELINE, seconds - PLAY_FROM / 1000, PACING);
}

/**
 * Seconds of running time, re-rendering at about 30 fps while `running`. Time a hidden
 * tab spends away doesn't count: the clock picks up where it left off when the tab comes
 * back, and a stop and restart (`running` false, then true) does the same.
 */
function useLoopClock(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  const elapsed = useRef(0);

  useEffect(() => {
    if (!running) return;
    let prev = performance.now();
    // Frames stop while the tab is hidden; start counting afresh when it's shown again.
    const onVisibility = () => {
      if (!document.hidden) prev = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    let frame = requestAnimationFrame(function tick(now) {
      frame = requestAnimationFrame(tick);
      if (now - prev < 1000 / 30) return;
      // Every moment the page was shown counts, however far apart the frames come, so a
      // slow device plays at the right tempo. A second at most, in case a stall slips by.
      elapsed.current += Math.min(now - prev, 1000) / 1000;
      prev = now;
      setSeconds(elapsed.current);
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [running]);

  return seconds;
}

/** The sign-in buttons. With motion allowed, they pop in at `appearAt` (ms after mount). */
function SignInChoices({ appearAt }: { appearAt: number }) {
  const [error, setError] = useState<string | null>(null);
  // The sign-in under way, so two never race (a guest session starting while the Google
  // popup is open, say). Clicking Google again is still allowed: Firebase closes the old
  // popup and opens a new one, which matters because it only notices a popup was closed
  // by hand 8–10 seconds later.
  const [pending, setPending] = useState<"google" | "guest" | null>(null);
  const latestAttempt = useRef(0);

  // On success the auth listener re-renders LandingPage, which redirects.
  const signIn = async (kind: "google" | "guest") => {
    if (pending && !(pending === "google" && kind === "google")) return;
    const attempt = ++latestAttempt.current;
    setPending(kind);
    setError(null);
    try {
      await (kind === "google" ? signInWithGoogle() : signInAsGuest());
    } catch (err) {
      console.error("Sign-in failed:", err);
      if (attempt !== latestAttempt.current) return;
      setError(
        err instanceof FirebaseError && err.code === "auth/popup-blocked"
          ? "Your browser blocked the sign-in window. Allow pop-ups for this site and try again."
          : "Couldn't sign in. Check your connection and try again.",
      );
    } finally {
      // A newer attempt (a second Google click) owns the state now.
      if (attempt === latestAttempt.current) setPending(null);
    }
  };

  return (
    <Flex direction="column" align="center" gap="md">
      <Flex
        direction={{ base: "column", sm: "row" }}
        align={{ base: "stretch", sm: "center" }}
        gap="md"
        _motionSafe={{
          animation: `pop-in ${INTRO.signInFor}ms ${POP_EASING} ${appearAt}ms backwards`,
        }}
      >
        <Button
          variant="primary"
          size="lg"
          disabled={pending === "guest"}
          onClick={() => signIn("google")}
        >
          <Image src={googleIcon} alt="" boxSize="16px" />
          Sign in with Google
        </Button>
        <Text as="span" textStyle="epigraph" color="fg.muted" textAlign="center">
          or
        </Text>
        <Button
          variant="secondary"
          size="lg"
          disabled={pending !== null}
          onClick={() => signIn("guest")}
        >
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

// ---- The heralds ----------------------------------------------------------------------
//
// Each herald is drawn in its own SVG, laid out in pixels from the point where the staff
// starts (or, for the right one, ends) on its middle line. The trumpet comes up from the
// lower corner, tilted, with its bell just short of the staff, and the staff's lines run
// on into the bell. The right herald is the left one mirrored.

/** How far the bell's centre sits from the end of the staff. */
const BELL_GAP = 34;
/** The trumpet's size against its drawing (which is about 1000 units long). */
const TRUMPET_SCALE = 0.52;
/** Tilt of the trumpet, bell up. */
const TILT = -14;
/** How much further it tips up while playing. */
const LEAN = -2.5;
/** The SVG's extent around that point: it reaches back over the trumpet, and a little onto the staff. */
const HERALD_BOX = { left: 560, right: 20, top: 90, bottom: 270 };
/** Where the staff's middle line is, from the top of `Staff`, in staff units (see `Staff`). */
const STAFF_MIDDLE = 50;
const STAFF_SPACE = 10;

/** The bell's centre in the trumpet drawing's own units. */
const BELL_CENTRE = { x: 965, y: 84 };

/** Where the mouthpiece ends up in the herald's drawing: the end the horn is raised by. */
const MOUTHPIECE = (() => {
  const dx = (22 - BELL_CENTRE.x) * TRUMPET_SCALE;
  const dy = (206 - BELL_CENTRE.y) * TRUMPET_SCALE;
  const a = (TILT * Math.PI) / 180;
  return {
    x: -BELL_GAP + dx * Math.cos(a) - dy * Math.sin(a),
    y: dx * Math.sin(a) + dy * Math.cos(a),
  };
})();

function Herald({
  side,
  playing,
  valves,
  staffScale,
}: {
  side: "left" | "right";
  playing: boolean;
  /** The valves held down (1–3) for the note being played. */
  valves: readonly number[];
  staffScale: number;
}) {
  const { left, right, top, bottom } = HERALD_BOX;
  const width = left + right;
  const height = top + bottom;
  const mirrored = side === "right";
  const id = `tt-herald-${side}`;
  const enterAt = INTRO.heralds + (mirrored ? INTRO.heraldsStagger : 0);

  return (
    <chakra.svg
      aria-hidden
      position="absolute"
      top={`${STAFF_MIDDLE * staffScale - top}px`}
      // The point where the staff ends sits at x = 0 in the drawing.
      left={mirrored ? `calc(100% - ${right}px)` : `${-left}px`}
      width={`${width}px`}
      height={`${height}px`}
      viewBox={
        mirrored ? `${-right} ${-top} ${width} ${height}` : `${-left} ${-top} ${width} ${height}`
      }
      overflow="visible"
      pointerEvents="none"
      // The staff's lines into the bell fade in as the horn comes up to them.
      _motionSafe={{ animation: `appear 600ms ease-out ${enterAt + 300}ms backwards` }}
    >
      <g transform={mirrored ? "scale(-1 1)" : undefined}>
        {/* The staff's lines carried on from its end into the bell. */}
        <g stroke={roles.fg.subtle} strokeWidth={1}>
          {[-2, -1, 0, 1, 2].map((k) => (
            <line
              key={k}
              x1={-BELL_GAP}
              x2={1}
              y1={k * STAFF_SPACE * staffScale}
              y2={k * STAFF_SPACE * staffScale}
            />
          ))}
        </g>
        {/* Raised to the staff on arrival, swinging up from the mouthpiece end, past the
            staff and back down onto it. */}
        <chakra.g
          style={{
            transformBox: "view-box",
            transformOrigin: `${MOUTHPIECE.x}px ${MOUTHPIECE.y}px`,
          }}
          _motionSafe={{
            animation: `raise-horn ${INTRO.heraldsFor}ms ${EASE_OUT} ${enterAt}ms backwards`,
          }}
        >
          {/* Tips up a little while it plays, about the bell, which stays on the staff. */}
          <g
            style={{
              transform: playing ? `rotate(${LEAN}deg)` : "none",
              transformBox: "view-box",
              transformOrigin: `${-BELL_GAP}px 0px`,
              transition: "transform 500ms ease-in-out",
            }}
          >
            <g
              transform={`translate(${-BELL_GAP} 0) rotate(${TILT}) scale(${TRUMPET_SCALE}) translate(${-BELL_CENTRE.x} ${-BELL_CENTRE.y})`}
            >
              <EtchedTrumpet id={id} valves={valves} />
              {/* Rings of sound leaving the bell while it plays. */}
              {playing && (
                <ellipse
                  cx={BELL_CENTRE.x}
                  cy={BELL_CENTRE.y}
                  rx={14}
                  ry={106}
                  fill="none"
                  stroke={roles.engraving.hatch}
                  strokeWidth={2.6}
                  strokeDasharray="6 6"
                  style={{
                    opacity: 0,
                    transformBox: "fill-box",
                    transformOrigin: "0% 50%",
                    animation: "ring-out 1.1s ease-out infinite",
                  }}
                />
              )}
            </g>
          </g>
        </chakra.g>
      </g>
    </chakra.svg>
  );
}

// The trumpet, in its own units: bell to the right with its centre at BELL_CENTRE, the
// mouthpiece at the far left, valves up.

/** Pipes as centrelines, with their bore. */
const PIPES = [
  { d: "M118 206 L260 200 H690", bore: 12 },
  { d: "M690 200 A27 27 0 0 1 690 254 H494", bore: 12 },
  { d: "M175 84 A40 40 0 0 0 175 164 H354", bore: 12 },
  { d: "M354 222 H300 A16 16 0 0 0 300 254 H354", bore: 12 },
  { d: "M416 270 V290 A8 8 0 0 0 432 290 V270", bore: 9 },
  { d: "M466 270 V302 A10 10 0 0 0 486 302 V270", bore: 10 },
];
const BELL_PIPE = "M175 84 H600";
/** Hatching along the underside of each pipe, and on the mouthpiece. */
const PIPE_HATCHING = [
  "M120 209.4 L260 203.4 H690 M120 211.4 L260 205.4 H690",
  "M690 257.4 H494 M690 259.4 H494",
  "M720.4 227 A30.4 30.4 0 0 1 690 257.4 M722.4 227 A32.4 32.4 0 0 1 690 259.4",
  "M175 167.4 H354 M175 169.4 H354",
  "M131.6 124 A43.4 43.4 0 0 0 175 167.4",
  "M354 257.4 H300 M354 259.4 H300",
  "M33 216 C42 213 48 210 58 209",
];
const VALVE_X = [372, 424, 476];
/** How far a valve's button travels when pressed. */
const VALVE_TRAVEL = 8;
const BELL = "M590 77.5 C760 77.5 880 60 965 -21 L965 189 C880 108 760 90.5 590 90.5 Z";
/** Hatching that shades the underside of the flare, and a little on its top. */
const BELL_HATCHING = [
  "M620 92 C760 94 880 112 962 176",
  "M650 91.4 C775 93.4 885 108 962 162",
  "M690 90.8 C795 92.6 893 104 962 148",
  "M740 90.4 C820 92 905 100 962 134",
  "M800 90 C860 91 920 96 962 120",
];
const BELL_TOP_HATCHING = ["M790 76 C860 72 920 52 962 10", "M860 74 C905 68 935 54 962 34"];

/**
 * A trumpet drawn as an etching: brass line work over a pale wash, hatched on its
 * shadowed sides. `valves` lists the valves held down (1–3). `id` prefixes the hatch
 * patterns, so it must be unique on the page.
 */
function EtchedTrumpet({ id, valves }: { id: string; valves: readonly number[] }) {
  const { line, hatch, deep, wash } = roles.engraving;
  const paper = roles.bg.DEFAULT;

  return (
    <g>
      <defs>
        <pattern
          id={`${id}-hatch`}
          patternUnits="userSpaceOnUse"
          width={5}
          height={5}
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={5} stroke={line} strokeWidth={1.3} />
        </pattern>
        <pattern
          id={`${id}-cross`}
          patternUnits="userSpaceOnUse"
          width={4}
          height={4}
          patternTransform="rotate(-45)"
        >
          <line x1={0} y1={0} x2={0} y2={4} stroke={deep} strokeWidth={1.3} />
        </pattern>
      </defs>

      {/* Each pipe: a line-coloured stroke with a wash down its middle draws it as a tube. */}
      <g fill="none">
        {PIPES.map(({ d, bore }) => (
          <path key={d} d={d} stroke={line} strokeWidth={bore + 4.4} />
        ))}
        {PIPES.map(({ d, bore }) => (
          <path key={`wash-${d}`} d={d} stroke={wash} strokeWidth={bore} />
        ))}
        <path d={PIPE_HATCHING.join(" ")} stroke={hatch} strokeWidth={1.4} />
      </g>

      <g stroke={line} strokeWidth={2.4} fill={wash}>
        {/* Braces, the mouthpiece and its receiver. */}
        <rect x={556} y={91} width={7} height={102} />
        <rect x={250} y={91} width={6} height={66} />
        <path d="M22 190 C40 190 46 198 56 201 L96 203 L96 209 L56 211 C46 214 40 222 22 222 Z" />
        <ellipse cx={22} cy={206} rx={4} ry={16} />
        <rect x={92} y={198} width={28} height={16} rx={2} />

        {VALVE_X.map((cx, i) => (
          <g key={cx}>
            {/* The button and stem, which ride down into the cap when the valve's pressed. */}
            <g
              style={{
                transform: valves.includes(i + 1) ? `translateY(${VALVE_TRAVEL}px)` : "none",
                transition: "transform 90ms ease-out",
              }}
            >
              <line x1={cx} x2={cx} y1={36} y2={104} />
              <rect x={cx - 16} y={22} width={32} height={12} rx={6} fill={paper} />
            </g>
            <rect x={cx - 20} y={100} width={40} height={10} rx={2} />
            <rect x={cx - 18} y={110} width={36} height={150} />
            <path
              d={`M${cx + 6} 112 V258 M${cx + 9} 112 V258 M${cx + 12} 112 V258`}
              stroke={hatch}
              strokeWidth={1.4}
            />
            <rect x={cx - 19} y={120} width={38} height={7} rx={1.5} />
            <rect x={cx - 19} y={240} width={38} height={7} rx={1.5} />
            <rect x={cx - 15} y={260} width={30} height={11} rx={3} />
          </g>
        ))}
      </g>

      {/* The bell pipe passes in front of the valve stems. */}
      <path d={BELL_PIPE} fill="none" stroke={line} strokeWidth={16.4} />
      <path d={BELL_PIPE} fill="none" stroke={wash} strokeWidth={12} />
      <path d="M175 87.4 H600 M175 89.4 H600" fill="none" stroke={hatch} strokeWidth={1.4} />

      <path d={BELL} fill={wash} stroke={line} strokeWidth={2.4} />
      <g fill="none" stroke={hatch} strokeWidth={1.5}>
        {BELL_HATCHING.map((d) => (
          <path key={d} d={d} />
        ))}
        {BELL_TOP_HATCHING.map((d) => (
          <path key={d} d={d} opacity={0.5} />
        ))}
      </g>
      {/* Into the bell: hatched, and cross-hatched deeper in. */}
      <ellipse cx={965} cy={84} rx={12} ry={104} fill={wash} />
      <ellipse cx={965} cy={84} rx={12} ry={104} fill={`url(#${id}-hatch)`} />
      <ellipse cx={970} cy={84} rx={7} ry={78} fill={`url(#${id}-cross)`} />
      <ellipse cx={965} cy={84} rx={14} ry={106} fill="none" stroke={line} strokeWidth={3.6} />
      <ellipse cx={965} cy={84} rx={17.5} ry={109.5} fill="none" stroke={line} strokeWidth={1.5} />
    </g>
  );
}

// ---- The backdrop ---------------------------------------------------------------------

/**
 * Notation drifting up the page, as Bravura glyphs (SMuFL code points): `x` across the
 * page (%), glyph `size` (a `notation.*` text style), `opacity`, seconds to `rise` the
 * full height and to `sway` once, and where in its rise it `starts` (a negative delay, in
 * seconds). Big glyphs are faint and slow, small ones clearer and quicker, so they read
 * as near and far.
 */
const DRIFT = [
  { glyph: "\uE050", x: 4, size: "lg", opacity: 0.16, rise: 34, sway: 9, starts: -2 },
  { glyph: "\uE1D7", x: 10, size: "sm", opacity: 0.28, rise: 22, sway: 6, starts: -9 },
  { glyph: "\uE1D9", x: 16, size: "md", opacity: 0.2, rise: 28, sway: 8, starts: -15 },
  { glyph: "\uE1D5", x: 22, size: "sm", opacity: 0.3, rise: 19, sway: 5, starts: -4 },
  { glyph: "\uE1D3", x: 28, size: "xl", opacity: 0.12, rise: 40, sway: 11, starts: -22 },
  { glyph: "\uE262", x: 34, size: "sm", opacity: 0.26, rise: 21, sway: 6, starts: -13 },
  { glyph: "\uE1D7", x: 40, size: "md", opacity: 0.22, rise: 25, sway: 7, starts: -1 },
  { glyph: "\uE050", x: 46, size: "xl", opacity: 0.1, rise: 44, sway: 12, starts: -30 },
  { glyph: "\uE260", x: 52, size: "sm", opacity: 0.3, rise: 20, sway: 5, starts: -7 },
  { glyph: "\uE1D9", x: 58, size: "md", opacity: 0.18, rise: 29, sway: 8, starts: -18 },
  { glyph: "\uE1D5", x: 64, size: "sm", opacity: 0.26, rise: 23, sway: 6, starts: -3 },
  { glyph: "\uE1D3", x: 70, size: "lg", opacity: 0.13, rise: 38, sway: 10, starts: -26 },
  { glyph: "\uE261", x: 76, size: "sm", opacity: 0.28, rise: 21, sway: 6, starts: -11 },
  { glyph: "\uE1D7", x: 82, size: "md", opacity: 0.2, rise: 27, sway: 7, starts: -6 },
  { glyph: "\uE062", x: 88, size: "xl", opacity: 0.12, rise: 42, sway: 11, starts: -16 },
  { glyph: "\uE1D9", x: 94, size: "sm", opacity: 0.26, rise: 22, sway: 6, starts: -14 },
  { glyph: "\uE260", x: 7, size: "md", opacity: 0.22, rise: 26, sway: 7, starts: -19 },
  { glyph: "\uE4E5", x: 48, size: "md", opacity: 0.24, rise: 24, sway: 7, starts: -10 },
  { glyph: "\uE262", x: 72, size: "sm", opacity: 0.3, rise: 19, sway: 5, starts: -17 },
  { glyph: "\uE1D5", x: 91, size: "md", opacity: 0.2, rise: 30, sway: 8, starts: -24 },
] as const;

/**
 * Behind everything: a warm pool of light behind the title, the edges a shade darker, and
 * notation drifting up through it like dust in a spotlight. While `paused`, the notation
 * stops where it is. It's left out for viewers who'd rather not see motion.
 */
function NotationDrift({ paused }: { paused: boolean }) {
  const playState = paused ? "paused" : "running";
  return (
    <Box
      aria-hidden
      position="absolute"
      inset={0}
      pointerEvents="none"
      overflow="hidden"
      // `float-up` climbs the height of this box (`cqh`), the whole page, not just the
      // screen, so the notation passes the title even when the page scrolls.
      css={{ containerType: "size" }}
    >
      <Box
        position="absolute"
        inset={0}
        bgImage={`radial-gradient(ellipse 52% 46% at 50% 46%, ${roles.spotlight.core} 0%, ${roles.spotlight.edge} 55%, transparent 80%)`}
      />
      <Box
        position="absolute"
        inset={0}
        bgImage={`radial-gradient(ellipse 80% 75% at 50% 50%, transparent 60%, ${roles.spotlight.vignette} 100%)`}
      />
      {DRIFT.map((d, i) => (
        <Box
          key={i}
          position="absolute"
          left={`${d.x}%`}
          bottom="-90px"
          display="none"
          _motionSafe={{
            display: "block",
            animation: `float-up ${d.rise}s linear ${d.starts}s infinite`,
            animationPlayState: playState,
          }}
        >
          <Text
            as="span"
            display="inline-block"
            textStyle={`notation.${d.size}`}
            color="accent.fg"
            opacity={d.opacity}
            animation={`sway ${d.sway}s ease-in-out infinite`}
            animationPlayState={playState}
          >
            {d.glyph}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
