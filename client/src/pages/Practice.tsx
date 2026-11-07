import { Box, Flex, Grid, Heading, Text, useBreakpointValue } from "@chakra-ui/react";
import {
  ArrowLeft,
  Award,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Eye,
  Headphones,
  Mic,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { AuthUserContext } from "@/auth/AuthUserContext";
import { FocusShell, NAV_ITEMS } from "@/components/layout";
import {
  BeatDots,
  ExerciseMeta,
  ScoreCard,
  Staff,
  SubdivisionControl,
  TempoControl,
  TempoMark,
  Tuner,
} from "@/components/music";
import {
  BRIEF_NOTICE_MS,
  Button,
  IconButton,
  Kicker,
  notify,
  Rule,
  SegmentedControl,
  type ChoiceOption,
} from "@/components/primitives";
import { useLatestScore } from "@/hooks/useLatestScore";
import { usePersistedState } from "@/hooks/usePersistedState";
import { usePlayback } from "@/hooks/usePlayback";
import { useRunRecorder } from "@/hooks/useRunRecorder";
import { EXERCISE_TYPE_LABELS, KEYLESS } from "@/lib/generatorOptions";
import {
  beatAt,
  clampTempo,
  DEFAULT_TEMPO,
  pulseOf,
  subdivisionFor,
  type Pulse,
} from "@/lib/meter";
import { prefersReducedMotion } from "@/lib/motion";
import {
  backTo,
  originFor,
  readPracticeState,
  returnPath,
  type PracticedState,
  type PracticeOrigin,
} from "@/lib/practice";
import { newLiveScore, rewindLive, updateLive } from "@/lib/liveScore";
import { scoreRun, type ScoredRun } from "@/lib/scoring";
import type { GhostNote } from "@/lib/transcribe";
import { barAt, buildTimeline, cursorAt } from "@/lib/timeline";
import { barNow } from "@/lib/transport";
import { getKeySig } from "@/utils/generateMusic";
import { getHistoryEntry } from "@/utils/history";
import { getLibraryEntry } from "@/utils/library";
import { lipSlurFingerings } from "@/utils/lipSlurs";
import { saveScore, scoreLimitOf, unsavedNotice } from "@/utils/scores";
import type { MusicInfo } from "@/schema";

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

const COUNT_IN_OPTIONS: ChoiceOption<"off" | "bar">[] = [
  { value: "off", label: "Off" },
  { value: "bar", label: "One bar" },
];

/** How often a scored run's marks on the staff catch up with what's been heard, in ms. */
const LIVE_MS = 150;

/** Listen hears the exercise played; Play is the player's own run, heard and scored. */
type Mode = "listen" | "play";

const MODE_OPTIONS: ChoiceOption<Mode>[] = [
  {
    value: "listen",
    label: (
      <Flex as="span" align="center" gap="xs">
        <Headphones size={14} aria-hidden />
        Listen
      </Flex>
    ),
  },
  {
    value: "play",
    label: (
      <Flex as="span" align="center" gap="xs">
        <Mic size={14} aria-hidden />
        Play
      </Flex>
    ),
  },
];

const MODE_CAPTIONS: Record<Mode, string> = {
  listen: "Hear the exercise played on a trumpet, with the metronome if it's on.",
  play: "Play it yourself and get a score. Only the metronome sounds, if it's on.",
};

/**
 * The player (mockup 1e), at `/practice/<exerciseId>`. PracticeButton hands it the
 * exercise in its router state; without that (a new tab, a reload, a bookmark) it
 * loads the exercise from history, or from the library once history has let it go.
 */
export default function Practice() {
  const { exerciseId = "" } = useParams();
  const location = useLocation();
  const [params] = useSearchParams();
  const { user } = useContext(AuthUserContext);
  const state = readPracticeState(location.state);
  const handed = state?.exercise.exerciseId === exerciseId ? state.exercise : null;
  const from = state?.from ?? originFor(returnPath(params.get("from")), NAV_ITEMS);

  // What history or the library gave for this id: an exercise, or null when neither has it.
  const [loaded, setLoaded] = useState<{ id: string; exercise: MusicInfo | null } | null>(null);
  const exercise = handed ?? (loaded?.id === exerciseId ? loaded.exercise : undefined);
  const missing = exercise === null;
  // The id whose load failed (offline, or the server erred), and a count of retries.
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    setFailed(null);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    if (handed) return;
    const controller = new AbortController();
    // History keeps only the newest exercises, and a clear empties it; the library
    // keeps a saved one for good.
    getHistoryEntry(exerciseId, user, controller.signal)
      .then((entry) => entry ?? getLibraryEntry(exerciseId, user, controller.signal))
      .then((entry) => {
        if (controller.signal.aborted) return;
        // Deleted rows leave nothing behind, so a cleared exercise and a wrong link
        // look the same here: say it could be either.
        if (!entry) {
          notify({
            tone: "error",
            title: "Exercise not found",
            description:
              "It isn't in your recent history or your library. It may have been cleared, or the link is wrong.",
          });
        }
        setLoaded({ id: exerciseId, exercise: entry });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("load exercise error:", error);
        // Stay put: the exercise may well be there once the connection is back.
        setFailed(exerciseId);
      });
    return () => controller.abort();
  }, [handed, exerciseId, user, attempt]);

  // The notice says why; go back to the page it came from (Generate without one).
  if (missing) return <Navigate to={from.to} replace />;
  // Loading, or a load that failed: the frame, so the back link is already there.
  if (!exercise) {
    return (
      <FocusShell back={from}>
        {failed === exerciseId ? (
          <Flex direction="column" align="flex-start" gap="md">
            <Text role="alert" textStyle="meta" color="fg.error">
              Couldn't load the exercise. Check your connection and try again.
            </Text>
            <Button size="sm" onClick={retry}>
              <RotateCcw />
              Try again
            </Button>
          </Flex>
        ) : (
          <Text role="status" textStyle="meta" color="fg.muted">
            Loading the exercise…
          </Text>
        )}
      </FocusShell>
    );
  }
  return <Player key={exercise.exerciseId} exercise={exercise} from={from} />;
}

function Player({ exercise, from }: { exercise: MusicInfo; from: PracticeOrigin }) {
  const { notes, timeSig, exerciseType } = exercise;
  const { user } = useContext(AuthUserContext);
  const timeline = useMemo(() => buildTimeline(notes, timeSig), [notes, timeSig]);
  const pulse = useMemo(() => pulseOf(timeSig), [timeSig]);

  const [storedTempo, setTempo] = usePersistedState("practiceTempo", DEFAULT_TEMPO);
  const tempo = clampTempo(storedTempo);
  const [notesOn, setNotesOn] = usePersistedState("practiceNotes", true);
  const [clickOn, setClickOn] = usePersistedState("practiceClick", true);
  const [clicksPerBeat, setClicksPerBeat] = usePersistedState("practiceSubdivision", 1);
  const [countIn, setCountIn] = usePersistedState("practiceCountIn", true);
  const subdivision = subdivisionFor(pulse, clicksPerBeat);
  const [toolsOpen, setToolsOpen] = usePersistedState("practiceToolsOpen", true);
  const [showFingerings] = usePersistedState("showFingerings", true);
  const [storedMode, setMode] = usePersistedState<Mode>("practiceMode", "play");
  const scoring = storedMode !== "listen";
  // The run just scored, marked on the staff until the next one starts.
  const [run, setRun] = useState<(ScoredRun & { tempo: number; unsaved?: string }) | null>(null);
  const latest = useLatestScore(exercise.exerciseId);
  // The score card, open on the run just played or on the last one saved.
  const [card, setCard] = useState<{ open: boolean; showing: "run" | "saved" }>({
    open: false,
    showing: "run",
  });
  const openCard = (showing: "run" | "saved") => setCard({ open: true, showing });
  const closeCard = () => setCard((c) => ({ ...c, open: false }));

  const {
    status,
    position,
    from: startsAt,
    sound,
    play,
    pause,
    seek,
    restart,
    replay,
    ctx,
    positionHeardAt,
  } = usePlayback(timeline, pulse, {
    tempo,
    // A scored run is the player's own: the trumpet stays quiet.
    notes: notesOn && !scoring,
    click: clickOn,
    subdivision,
    countIn,
    onFinish: () => {
      if (scoring) finishRun();
    },
  });
  const countingIn = status === "countIn";
  const running = countingIn || status === "playing";
  const recording = scoring && running;
  // A scored take keeps one tempo, the one saved with its score: fixed from Play until
  // it ends or restarts (paused included, since Resume carries the take on).
  const tempoLocked = scoring && (running || status === "paused");
  const recorder = useRunRecorder({ ctx, positionHeardAt, recording, from: startsAt });
  const { heard } = recorder;

  // Paused, the microphone goes off (and the browser's microphone light with it): Resume
  // opens it again, and what the take has heard so far is kept.
  const pauseHere = () => {
    pause();
    recorder.close();
  };

  // A hidden page (another tab, a locked phone) stops the frames the microphone is read
  // on while the music plays on, which would score the rest as missed: pause the take
  // instead, and Resume carries it on.
  const pauseTake = useRef(pauseHere);
  useEffect(() => {
    pauseTake.current = pauseHere;
  });
  useEffect(() => {
    if (!recording) return;
    const onHide = () => {
      if (!document.hidden) return;
      pauseTake.current();
      // Toasts wait out a hidden page, so this is there when the player comes back.
      notify({
        tone: "info",
        title: "Your run is paused",
        description: "It paused when the page was hidden. Resume to carry on.",
      });
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [recording]);

  // What's been heard so far in a scored run, marked on the staff as it comes in: the
  // wrong notes as ghosts, and each note's intonation once it's over.
  const [live, setLive] = useState<{ ghosts: GhostNote[]; cents: (number | null)[] } | null>(null);
  // What the live marks keep between updates, so each works only on what's still open
  // (see lib/liveScore.ts). A take from the top rewinds it to nothing.
  const liveScore = useRef(newLiveScore());
  const liveInputs = useRef({ positionHeardAt, tempo });
  useEffect(() => {
    liveInputs.current = { positionHeardAt, tempo };
  });
  useEffect(() => {
    if (!recording) return;
    // A take starting or resuming at `startsAt`: what was kept from there on goes, as
    // the recorder throws away what it heard there too.
    rewindLive(liveScore.current, startsAt, timeline, pulse.quarters);
    const timer = setInterval(() => {
      const now = liveInputs.current.positionHeardAt(ctx.currentTime);
      if (now === null) return;
      const timing = {
        beat: pulse.quarters,
        secondsPerQuarter: 60 / (liveInputs.current.tempo * pulse.quarters),
      };
      // Only the notes that are over are judged; one still sounding (or to come) isn't.
      const marks = updateLive(liveScore.current, heard(), timeline, timing, now);
      // The same marks as last time keep the staff from being drawn again.
      setLive((last) =>
        last && last.ghosts === marks.ghosts && last.cents === marks.cents ? last : marks,
      );
    }, LIVE_MS);
    return () => clearInterval(timer);
  }, [recording, startsAt, heard, ctx, timeline, pulse]);

  /** Scores what the microphone heard, shows it, and saves it. */
  const finishRun = () => {
    recorder.close();
    const scored = scoreRun(timeline, recorder.heard(), {
      beat: pulse.quarters,
      secondsPerQuarter: 60 / (tempo * pulse.quarters),
      keySig: KEYLESS.has(exerciseType) ? "C" : getKeySig(exercise.musicKey),
    });
    if (!scored.heard) {
      notify({
        tone: "error",
        title: "Didn't hear you play",
        description: "Check that the browser is using the right microphone, then try again.",
      });
      return;
    }
    const played = { ...scored, tempo };
    setRun(played);
    openCard("run");
    saveScore(exercise.exerciseId, tempo, scored, user)
      .then((saved) => saved && latest.setScore(saved))
      .catch((error) => {
        if (!scoreLimitOf(error)) console.error("save score error:", error);
        const { title, description, card } = unsavedNotice(error);
        notify({ tone: "error", title, description });
        // Said on its card too, which stays: the notice goes after a few seconds. Only
        // this run's, if another hasn't been played since.
        setRun((shown) => (shown === played ? { ...played, unsaved: card } : shown));
      });
  };

  /** Starts `start` with the microphone listening if the run is scored. */
  const begin = async (start: () => void) => {
    if (scoring) {
      const opened = await recorder.open();
      // The player was left while the browser asked: nothing to start or report.
      if (opened === null) return;
      if (!opened) {
        notify({
          tone: "error",
          title: "Couldn't use the microphone",
          description:
            "Allow it in your browser to be scored, or switch to Listen to hear the music.",
        });
        return;
      }
    }
    start();
  };
  const playHere = () => {
    setRun(null);
    void begin(play);
  };
  const playFromTop = () => {
    setRun(null);
    setLive(null);
    recorder.clear();
    void begin(replay);
  };

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
  const main: { icon: ReactNode; label: string; onClick: () => void } =
    status === "finished"
      ? run
        ? { icon: <Award />, label: "View results", onClick: () => openCard("run") }
        : {
            icon: <RotateCcw />,
            label: scoring ? "Play again" : "Listen again",
            onClick: playFromTop,
          }
      : running
        ? { icon: <Pause />, label: "Pause", onClick: pauseHere }
        : {
            icon: <Play />,
            label: status === "paused" ? "Resume" : scoring ? "Play" : "Listen",
            onClick: playHere,
          };

  const mainButton = useRef<HTMLButtonElement>(null);
  // Restart disables itself, so hand keyboard focus on to Play.
  const restartHere = () => {
    restart();
    setRun(null);
    setLive(null);
    recorder.close();
    recorder.clear();
    mainButton.current?.focus();
  };

  // Previous and next bar: from the bar being heard, or the one Play would start in.
  const bar = barNow({ status, position, from: startsAt }, timeline);
  // A scored run is played through from the top, so in Play the music can't be jumped
  // around: trying to says so, briefly (once, however many times it's tried).
  const jumpTo = (to: number) => {
    if (!scoring) return seek(to);
    notify({
      id: "play-from-the-top",
      tone: "info",
      title: "Play starts from the top",
      description: "To jump around the music, switch to Listen.",
      duration: BRIEF_NOTICE_MS,
    });
  };
  const toBar = (n: number) => jumpTo(n * timeline.bar);

  // Back to the top, ready to play again, with the last run's marks taken off the staff.
  const tryAgain = () => {
    closeCard();
    setRun(null);
    setLive(null);
    restart();
    recorder.clear();
  };

  const changeMode = (mode: Mode) => {
    setMode(mode);
    setRun(null);
    setLive(null);
    restart();
    recorder.close();
    recorder.clear();
  };

  const shown = card.showing === "run" ? run : latest.score;
  // While a take is recorded the staff follows it; after, it shows the run as scored.
  const marks = recording ? live : (run ?? live);

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
          cents={marks?.cents}
          ghosts={marks?.ghosts}
          cursor={cursorAt(timeline, countingIn ? startsAt : position)}
          onNoteClick={(i) => jumpTo(timeline.notes[i].start)}
          role="img"
          aria-label={`Score of ${typeLabel}${exercise.generationNum ? ` No. ${exercise.generationNum}` : ""}`}
        />
        <TempoControl
          pulse={pulse}
          tempo={tempo}
          onChange={setTempo}
          locked={tempoLocked}
          lockedNote="The tempo is set for this take. Restart to change it."
        />
      </Flex>

      <Flex direction="column" align="center" gap="sm">
        <Flex justify="center" align="center" gap="md" wrap="wrap">
          <SegmentedControl
            options={MODE_OPTIONS.map((o) => ({ ...o, disabled: running }))}
            value={scoring ? "play" : "listen"}
            onChange={changeMode}
            aria-label="Mode"
          />
          {latest.score && !running ? (
            <Button variant="ghost" size="sm" onClick={() => openCard("saved")}>
              <ClipboardList />
              Last feedback
            </Button>
          ) : null}
        </Flex>
        <Text textStyle="caption" color="fg.muted" textAlign="center">
          {MODE_CAPTIONS[scoring ? "play" : "listen"]}
        </Text>
        <Flex justify="center" align="center" gap="sm">
          <IconButton
            aria-label="Restart"
            disabled={status === "ready" && startsAt === 0}
            onClick={restartHere}
          >
            <RotateCcw />
          </IconButton>
          <IconButton aria-label="Previous bar" disabled={bar === 0} onClick={() => toBar(bar - 1)}>
            <SkipBack />
          </IconButton>
          <Button
            ref={mainButton}
            variant="primary"
            size="lg"
            minWidth="168px"
            // Waits for the trumpet only if it's to be heard: the click needs no samples.
            disabled={
              status !== "finished" && !running && notesOn && !scoring && sound === "loading"
            }
            onClick={main.onClick}
          >
            {main.icon}
            {main.label}
          </Button>
          <IconButton
            aria-label="Next bar"
            disabled={bar === timeline.bars - 1}
            onClick={() => toBar(bar + 1)}
          >
            <SkipForward />
          </IconButton>
          <IconButton
            aria-label="Hear the notes"
            aria-pressed={notesOn && !scoring}
            // Playing, the notes are the player's own.
            disabled={sound === "failed" || scoring}
            onClick={() => setNotesOn((on) => !on)}
          >
            {notesOn && !scoring && sound !== "failed" ? <Volume2 /> : <VolumeX />}
          </IconButton>
        </Flex>
        <Text role="status" textStyle="meta" color="fg.muted">
          {!scoring && sound === "loading" && "Loading trumpet sounds…"}
          {!scoring &&
            sound === "failed" &&
            "The trumpet sound couldn't be loaded, so only the click plays."}
        </Text>
      </Flex>

      {shown ? (
        <ScoreCard
          open={card.open}
          onOpenChange={(open) => (open ? setCard((c) => ({ ...c, open })) : closeCard())}
          exercise={exercise}
          score={shown}
          tempo={shown.tempo}
          playedAt={card.showing === "saved" ? latest.score?.createdAt : undefined}
          unsaved={card.showing === "run" ? run?.unsaved : undefined}
          actions={
            card.showing === "run" ? (
              <>
                <Button variant="ghost" onClick={closeCard}>
                  <Eye />
                  See it on the staff
                </Button>
                <Button onClick={tryAgain}>
                  <RotateCcw />
                  Try again
                </Button>
                <Button asChild variant="primary">
                  <Link to={back.to} state={back.state}>
                    <ArrowLeft />
                    {backTo(from)}
                  </Link>
                </Button>
              </>
            ) : (
              <Button onClick={closeCard}>Close</Button>
            )
          }
        />
      ) : null}
    </FocusShell>
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
                  <Tuner />
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
        <BeatDots pulse={pulse} beat={beat} />
        <SubdivisionControl pulse={pulse} value={subdivision} onChange={onSubdivisionChange} />
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
