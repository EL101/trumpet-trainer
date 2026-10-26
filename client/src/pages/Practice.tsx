import {
  Box,
  Dialog,
  Flex,
  Grid,
  Heading,
  Portal,
  Text,
  useBreakpointValue,
  VisuallyHidden,
} from "@chakra-ui/react";
import {
  ArrowLeft,
  Award,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Note } from "tonal";
import { FocusShell } from "@/components/layout";
import {
  ExerciseMeta,
  NoteValue,
  PitchReadout,
  Staff,
  TempoMark,
  TunerGauge,
} from "@/components/music";
import {
  Button,
  IconButton,
  Kicker,
  Rule,
  SegmentedControl,
  Slider,
  Stepper,
  type ChoiceOption,
} from "@/components/primitives";
import { usePersistedState } from "@/hooks/usePersistedState";
import usePitch from "@/hooks/usePitch";
import { usePlayback } from "@/hooks/usePlayback";
import { formatPitch } from "@/lib/format";
import { EXERCISE_TYPE_LABELS, KEYLESS } from "@/lib/generatorOptions";
import { beatAt, MAX_TEMPO, MIN_TEMPO, pulseOf, type Pulse } from "@/lib/meter";
import {
  backTo,
  readPracticeState,
  type PracticedState,
  type PracticeOrigin,
} from "@/lib/practice";
import { barAt, buildTimeline, cursorAt } from "@/lib/timeline";
import { CONCERT_OFFSET, nearestNote } from "@/lib/tuning";
import { lipSlurFingerings } from "@/utils/lipSlurs";
import type { MusicInfo } from "@/schema";

const DEFAULT_TEMPO = 80;

/** The tools drawer opening and closing, timed and eased like the sidebar's entrance. */
const DRAWER_MS = 300;
const DRAWER_EASE = "cubic-bezier(0.2, 0, 0, 1)";
/** The drawer's width open, closed to a rail, and its padding open, in px. */
const DRAWER_WIDTH = 344;
const RAIL_WIDTH = 56;
const DRAWER_PADDING = 28;
/** Open or closed, the toggle sits where the rail centres it, so it stays put as the drawer slides. */
const TOGGLE_SIZE = 30;
const TOGGLE_INSET = (RAIL_WIDTH - TOGGLE_SIZE) / 2;

type Notation = "written" | "concert";

const NOTATION_OPTIONS: ChoiceOption<Notation>[] = [
  { value: "written", label: "Written" },
  { value: "concert", label: "Concert" },
];

const COUNT_IN_OPTIONS: ChoiceOption<"off" | "bar">[] = [
  { value: "off", label: "Off" },
  { value: "bar", label: "One bar" },
];

/** The player (mockup 1e), opened by PracticeButton with the exercise in its router state. */
export default function Practice() {
  const location = useLocation();
  const state = readPracticeState(location.state);
  // Typed in or bookmarked: there's no exercise to play, so go and make one.
  if (!state) return <Navigate to="/generate" replace />;
  return <Player key={state.exercise.id} exercise={state.exercise} from={state.from} />;
}

function Player({ exercise, from }: { exercise: MusicInfo; from: PracticeOrigin }) {
  const { notes, timeSig, exerciseType } = exercise;
  const timeline = useMemo(() => buildTimeline(notes, timeSig), [notes, timeSig]);
  const pulse = useMemo(() => pulseOf(timeSig), [timeSig]);

  const [storedTempo, setTempo] = usePersistedState("practiceTempo", DEFAULT_TEMPO);
  const tempo = Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Number(storedTempo) || DEFAULT_TEMPO));
  const [notesOn, setNotesOn] = usePersistedState("practiceNotes", true);
  const [clickOn, setClickOn] = usePersistedState("practiceClick", true);
  const [clicksPerBeat, setClicksPerBeat] = usePersistedState("practiceSubdivision", 1);
  const [countIn, setCountIn] = usePersistedState("practiceCountIn", true);
  // A choice made in another meter (sixteenths, then 6/8) falls back to the beat.
  const subdivision = pulse.subdivisions.some((s) => s.per === clicksPerBeat) ? clicksPerBeat : 1;
  const [toolsOpen, setToolsOpen] = usePersistedState("practiceToolsOpen", true);
  const [showFingerings] = usePersistedState("showFingerings", true);
  const [resultsOpen, setResultsOpen] = useState(false);

  const {
    status,
    position,
    from: startsAt,
    sound,
    play,
    pause,
    seek,
    restart,
  } = usePlayback(timeline, pulse, {
    tempo,
    notes: notesOn,
    click: clickOn,
    subdivision,
    countIn,
  });
  const countingIn = status === "countIn";
  const running = countingIn || status === "playing";

  const fingerings = useMemo(
    () => (exerciseType === "LIP_SLURS" && showFingerings ? lipSlurFingerings(notes) : undefined),
    [exerciseType, notes, showFingerings],
  );
  const perLine = useBreakpointValue({ base: 1, sm: 2, xl: 4 }, { ssr: false });
  const scale = useBreakpointValue({ base: 0.8, md: 1 }, { ssr: false });

  const typeLabel = EXERCISE_TYPE_LABELS[exerciseType];
  const back = {
    to: from.to,
    label: from.label,
    state: { practiced: exercise } satisfies PracticedState,
  };

  // One button that changes, so keyboard focus stays put as it does.
  const main =
    status === "finished"
      ? { icon: <Award />, label: "View results", onClick: () => setResultsOpen(true) }
      : running
        ? { icon: <Pause />, label: "Pause", onClick: pause }
        : { icon: <Play />, label: status === "paused" ? "Resume" : "Play", onClick: play };

  const mainButton = useRef<HTMLButtonElement>(null);
  // Restart disables itself, so hand keyboard focus on to Play.
  const restartHere = () => {
    restart();
    mainButton.current?.focus();
  };

  const tryAgain = () => {
    setResultsOpen(false);
    restart();
  };

  return (
    <FocusShell
      back={back}
      title={
        <Flex as="h1" align="baseline" justify="center" gap="sm" m={0} minWidth={0}>
          <Text as="span" textStyle="heading.md" truncate>
            {typeLabel}
          </Text>
          {exercise.generationNum ? (
            <Text as="span" textStyle="meta" color="fg.muted" fontVariantNumeric="tabular-nums">
              No. {exercise.generationNum}
            </Text>
          ) : null}
        </Flex>
      }
      aside={
        <ToolsDrawer
          open={toolsOpen}
          onToggle={() => setToolsOpen((open) => !open)}
          pulse={pulse}
          beat={running ? beatAt(pulse, position) : null}
          click={clickOn}
          onClickChange={setClickOn}
          subdivision={subdivision}
          onSubdivisionChange={setClicksPerBeat}
          countIn={countIn}
          onCountInChange={setCountIn}
        />
      }
      display="flex"
      flexDirection="column"
      gap="xl"
    >
      <ExerciseMeta
        keyLabel={KEYLESS.has(exerciseType) ? undefined : exercise.musicKey}
        extra={[
          <TempoMark pulse={pulse} bpm={tempo} />,
          countingIn ? "Count-in" : `Bar ${barAt(timeline, position) + 1} of ${timeline.bars}`,
        ]}
      />

      <Flex flex="1" direction="column" justify="center" gap="xl">
        <Staff
          notes={notes}
          timeSig={timeSig}
          musicKey={exercise.musicKey}
          scale={scale}
          measuresPerLine={perLine}
          labels={fingerings}
          cursor={cursorAt(timeline, countingIn ? startsAt : position)}
          onNoteClick={(i) => seek(timeline.notes[i].start)}
          role="img"
          aria-label={`Score of ${typeLabel}${exercise.generationNum ? ` No. ${exercise.generationNum}` : ""}`}
        />
        <TempoControl pulse={pulse} tempo={tempo} onChange={setTempo} />
      </Flex>

      <Flex direction="column" align="center" gap="sm">
        <Flex justify="center" align="center" gap="sm">
          <IconButton
            aria-label="Restart"
            disabled={status === "ready" && startsAt === 0}
            onClick={restartHere}
          >
            <RotateCcw />
          </IconButton>
          <Button
            ref={mainButton}
            variant="primary"
            size="lg"
            minWidth="168px"
            disabled={status !== "finished" && !running && sound === "loading"}
            onClick={main.onClick}
          >
            {main.icon}
            {main.label}
          </Button>
          <IconButton
            aria-label="Hear the notes"
            aria-pressed={notesOn}
            disabled={sound === "failed"}
            onClick={() => setNotesOn((on) => !on)}
          >
            {notesOn && sound !== "failed" ? <Volume2 /> : <VolumeX />}
          </IconButton>
        </Flex>
        {sound === "failed" && (
          <Text role="status" textStyle="meta" color="fg.muted">
            The trumpet sound couldn't be loaded, so only the click plays.
          </Text>
        )}
      </Flex>

      <ResultsDialog
        open={resultsOpen}
        onOpenChange={setResultsOpen}
        back={back}
        backLabel={backTo(from)}
        onTryAgain={tryAgain}
      />
    </FocusShell>
  );
}

/** The tempo as a stepper for fine steps and a slider for big ones. */
function TempoControl({
  pulse,
  tempo,
  onChange,
}: {
  pulse: Pulse;
  tempo: number;
  onChange: (tempo: number) => void;
}) {
  return (
    <Flex justify="center" align="center" gap="md" wrap="wrap">
      <Text as="span" textStyle="meta" color="fg.muted">
        Tempo
      </Text>
      <Stepper
        value={tempo}
        onChange={onChange}
        min={MIN_TEMPO}
        max={MAX_TEMPO}
        format={(v) => <TempoMark pulse={pulse} bpm={v} />}
        aria-label="Tempo"
      />
      <Slider
        value={tempo}
        onChange={onChange}
        min={MIN_TEMPO}
        max={MAX_TEMPO}
        width="160px"
        aria-label="Tempo"
        aria-valuetext={`${tempo} beats per minute`}
      />
    </Flex>
  );
}

/**
 * The right-hand drawer of tools, collapsible to a rail. It slides open and shut; on
 * narrow screens, where it sits below the music, it folds up instead.
 */
function ToolsDrawer({
  open,
  onToggle,
  ...metronome
}: { open: boolean; onToggle: () => void } & MetronomeToolProps) {
  const wide = useBreakpointValue({ base: false, lg: true }, { ssr: false });
  const bodyId = useId();
  // The tools stay mounted while the drawer closes, then go (turning the microphone off).
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => setMounted(false), prefersReducedMotion() ? 0 : DRAWER_MS);
    return () => clearTimeout(timer);
  }, [open]);
  const rail = wide && !open && !mounted;
  const motion = `${DRAWER_MS}ms ${DRAWER_EASE}`;

  const toggle = (
    <IconButton
      variant="ghost"
      size="sm"
      aria-label={open ? "Hide tools" : "Show tools"}
      aria-expanded={open}
      aria-controls={bodyId}
      onClick={onToggle}
    >
      {wide ? open ? <ChevronRight /> : <ChevronLeft /> : open ? <ChevronUp /> : <ChevronDown />}
    </IconButton>
  );

  return (
    <Flex
      as="aside"
      aria-label="Tools"
      direction="column"
      // The panel keeps its width and hugs the right edge, so as the drawer narrows it
      // slides out of sight behind the music rather than squashing.
      align={{ base: "stretch", lg: "flex-end" }}
      flex="none"
      width={{ lg: `${open ? DRAWER_WIDTH : RAIL_WIDTH}px` }}
      overflowX="hidden"
      overflowY={{ lg: "auto" }}
      bg="bg.subtle"
      borderColor="border"
      borderTopWidth={{ base: "1px", lg: 0 }}
      borderLeftWidth={{ lg: "1px" }}
      _motionSafe={{ transition: `width ${motion}` }}
    >
      {rail ? (
        <Flex
          direction="column"
          align="center"
          gap="lg"
          width={`${RAIL_WIDTH}px`}
          px="xs"
          py="22px"
        >
          {toggle}
          <Kicker
            tone="muted"
            css={{ writingMode: "vertical-rl" }}
            _motionSafe={{ animation: `appear ${motion} backwards` }}
          >
            Tools
          </Kicker>
        </Flex>
      ) : (
        <Box
          flex="none"
          width={{ lg: `${DRAWER_WIDTH}px` }}
          px={{ base: "md", md: `${DRAWER_PADDING}px` }}
          py="22px"
        >
          <Flex
            justify="space-between"
            align="center"
            mr={{ lg: `${TOGGLE_INSET - DRAWER_PADDING}px` }}
          >
            <Kicker tone="muted">Tools</Kicker>
            {toggle}
          </Flex>
          <Grid
            id={bodyId}
            templateRows={{ base: open ? "1fr" : "0fr", lg: "1fr" }}
            opacity={open ? 1 : 0}
            _motionSafe={{ transition: `grid-template-rows ${motion}, opacity ${motion}` }}
          >
            {/* Clips the tools as they fold up, with room for their focus rings. */}
            <Box minHeight={0} overflow="hidden" mx="-sm" px="sm">
              {mounted && (
                <Flex
                  direction="column"
                  gap="lg"
                  pt="lg"
                  pb="xs"
                  _motionSafe={{ animation: `appear ${motion} backwards` }}
                >
                  <TunerTool />
                  <Rule />
                  <MetronomeTool {...metronome} />
                </Flex>
              )}
            </Box>
          </Grid>
        </Box>
      )}
    </Flex>
  );
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The tuner. It only listens once asked to, and stops when the drawer closes. */
function TunerTool() {
  const { pitch, error, start, stop } = usePitch();
  const [listening, setListening] = useState(false);
  const [notation, setNotation] = usePersistedState<Notation>("tunerNotation", "written");
  const active = listening && !error;
  const heard = active ? nearestNote(pitch) : null;
  // The microphone hears concert pitch; written is a whole tone above it.
  const written = (midi: number) => midi - CONCERT_OFFSET;
  const name = (midi: number) => formatPitch(Note.fromMidi(midi));
  const shown = heard && (notation === "written" ? written(heard.midi) : heard.midi);
  const other =
    heard &&
    (notation === "written"
      ? `Concert ${name(heard.midi)}`
      : `Written ${name(written(heard.midi))}`);

  const toggle = () => {
    if (active) {
      stop();
      setListening(false);
    } else {
      setListening(true);
      void start();
    }
  };

  return (
    <Flex direction="column" gap="md">
      <Flex justify="space-between" align="center" gap="sm" wrap="wrap">
        <Heading as="h2" textStyle="heading.md" m={0}>
          Tuner
        </Heading>
        <SegmentedControl
          options={NOTATION_OPTIONS}
          value={notation}
          onChange={setNotation}
          aria-label="Notes shown as"
        />
      </Flex>
      <TunerGauge cents={heard?.cents ?? null} alignSelf="center" />
      <PitchReadout
        note={shown != null ? name(shown) : null}
        cents={heard?.cents ?? null}
        justify="center"
      />
      <Text
        textStyle="caption"
        color="fg.muted"
        textAlign="center"
        fontVariantNumeric="tabular-nums"
      >
        {heard
          ? `${other} · ${pitch} Hz`
          : active
            ? "Listening…"
            : "Uses your microphone only while it's listening."}
      </Text>
      {error && (
        <Text role="alert" textStyle="meta" color="fg.error" textAlign="center">
          The microphone couldn't be opened. Check that this site may use it.
        </Text>
      )}
      <Button size="sm" alignSelf="center" onClick={toggle}>
        {active ? <MicOff /> : <Mic />}
        {active ? "Stop listening" : "Listen"}
      </Button>
    </Flex>
  );
}

type MetronomeToolProps = {
  pulse: Pulse;
  /** The beat sounding now, from 0; null while stopped. */
  beat: number | null;
  click: boolean;
  onClickChange: (click: boolean) => void;
  subdivision: number;
  onSubdivisionChange: (subdivision: number) => void;
  /** Whether Play counts in a bar first. */
  countIn: boolean;
  onCountInChange: (countIn: boolean) => void;
};

/** The click's settings and the beat it's on. The tempo is set under the music. */
function MetronomeTool({
  pulse,
  beat,
  click,
  onClickChange,
  subdivision,
  onSubdivisionChange,
  countIn,
  onCountInChange,
}: MetronomeToolProps) {
  const options = pulse.subdivisions.map((s) => ({
    value: String(s.per),
    label: (
      <>
        <span aria-hidden>
          <NoteValue symbol={s.symbol} />
        </span>
        <VisuallyHidden>{s.label}</VisuallyHidden>
      </>
    ),
  }));

  return (
    <Flex direction="column" gap="md">
      <Flex justify="space-between" align="center">
        <Heading as="h2" textStyle="heading.md" m={0}>
          Metronome
        </Heading>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="Click along"
          aria-pressed={click}
          onClick={() => onClickChange(!click)}
        >
          {click ? <Volume2 /> : <VolumeX />}
        </IconButton>
      </Flex>
      <Flex justify="space-between" align="center" gap="sm" wrap="wrap">
        <Flex gap="sm" aria-hidden>
          {Array.from({ length: pulse.beats }, (_, i) => (
            <Box
              key={i}
              boxSize="20px"
              borderRadius="full"
              borderWidth={i === beat ? "1.5px" : "1px"}
              borderColor={i === beat ? "accent.solid" : i === 0 ? "border.strong" : "border"}
              bg={i === beat ? "accent.subtle" : undefined}
            />
          ))}
        </Flex>
        <SegmentedControl
          options={options}
          value={String(subdivision)}
          onChange={(v) => onSubdivisionChange(Number(v))}
          aria-label="Clicks per beat"
        />
      </Flex>
      <Flex justify="space-between" align="center" gap="sm" wrap="wrap">
        <Text as="span" textStyle="meta" color="fg.muted">
          Count-in
        </Text>
        <SegmentedControl
          options={COUNT_IN_OPTIONS}
          value={countIn ? "bar" : "off"}
          onChange={(v) => onCountInChange(v === "bar")}
          aria-label="Count-in"
        />
      </Flex>
      <Text textStyle="caption" color="fg.muted">
        {countIn
          ? `Counts you in for a bar when you press Play${click ? ", then clicks along." : ", even with the click off."}`
          : click
            ? "Clicks along from the moment you press Play."
            : "No count-in and no click: the music starts as soon as you press Play."}
      </Text>
    </Flex>
  );
}

/** A placeholder until scoring arrives. */
function ResultsDialog({
  open,
  onOpenChange,
  back,
  backLabel,
  onTryAgain,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  back: { to: string; state: PracticedState };
  backLabel: string;
  onTryAgain: () => void;
}) {
  return (
    <Dialog.Root placement="center" open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Portal>
        <Dialog.Backdrop bg="bg.backdrop" />
        <Dialog.Positioner>
          <Dialog.Content maxWidth="400px" p="lg" gap="md" borderWidth="1px" borderColor="border">
            <Dialog.Title textStyle="heading.lg">Congrats!</Dialog.Title>
            <Dialog.Description textStyle="body">Your score is: --</Dialog.Description>
            <Flex justify="flex-end" gap="sm" mt="sm" wrap="wrap">
              <Button onClick={onTryAgain}>
                <RotateCcw />
                Try again
              </Button>
              <Button asChild variant="primary">
                <Link to={back.to} state={back.state}>
                  <ArrowLeft />
                  {backLabel}
                </Link>
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
