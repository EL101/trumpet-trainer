import {
  Box,
  chakra,
  Dialog,
  Flex,
  Grid,
  Heading,
  Portal,
  Text,
  useBreakpointValue,
  VisuallyHidden,
  type FlexProps,
} from "@chakra-ui/react";
import { Bookmark, BookmarkCheck, ChevronDown, ChevronUp, Eye, EyeOff, Play } from "lucide-react";
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { Link as RouterLink } from "react-router-dom";
import { AuthUserContext } from "@/auth/AuthUserContext";
import { usePersistedState } from "@/hooks/usePersistedState";
import { AppShell, PageHeader } from "@/components/layout";
import { ExerciseMeta, PitchText, Staff } from "@/components/music";
import {
  Button,
  ChoiceGrid,
  Field,
  Kicker,
  RadioGroup,
  SegmentedControl,
  Stepper,
  type ChoiceOption,
} from "@/components/primitives";
import {
  DIFFICULTY_LABELS,
  difficultyFor,
  EXERCISE_TYPE_LABELS,
  isCommonKey,
  keyChoices,
  measureLimitsFor,
  measuresFor,
  RANGE_LABELS,
  TIME_SIGNATURES,
  TYPE_DIFFICULTIES,
  type TimeSignature,
} from "@/lib/generatorOptions";
import {
  generateLongTones,
  generateMusic,
  generateScaleExercise,
  RANGE_NOTES,
} from "@/utils/generateMusic";
import { fetchEtudeQuota, requestEtude, type EtudeQuota } from "@/utils/etudes";
import { clearHistory, getInitialHistory, insertToHistory } from "@/utils/history";
import { generateLipSlurs, lipSlurFingerings } from "@/utils/lipSlurs";
import { getInitialLibrary, saveToLibrary } from "@/utils/library";
import { splitNotes } from "@/utils/splitNotes";
import {
  EXERCISE_TYPES,
  HISTORY_LIMIT,
  RANGES,
  type Difficulty,
  type ExerciseType,
  type Key,
  type MusicInfo,
  type Range,
} from "@/schema";

type Settings = {
  type: ExerciseType;
  key: Key;
  timeSig: TimeSignature;
  measures: number;
  range: Range;
  difficulty: Difficulty;
};

/** The notes for each type made in the browser. Etudes come from the server instead. */
const GENERATORS: Partial<Record<ExerciseType, (settings: Settings) => string>> = {
  // The margin only offers long tones at low or high difficulty (see TYPE_DIFFICULTIES).
  LONG_TONES: ({ measures, timeSig, key, range, difficulty }) =>
    generateLongTones(measures, timeSig, key, range, difficulty === "HIGH" ? "HIGH" : "LOW"),
  LIP_SLURS: ({ measures, timeSig, range, difficulty }) =>
    generateLipSlurs(measures, timeSig, range, difficulty),
  SCALES: ({ timeSig, key, range, difficulty }) =>
    generateScaleExercise(timeSig, key, range, difficulty),
  RANDOM: ({ measures, timeSig, key, range, difficulty }) =>
    generateMusic(measures, timeSig, key, range, difficulty),
};

/** Types whose length comes from the music itself, so the Measures setting is ignored. */
const SETS_OWN_LENGTH: ReadonlySet<ExerciseType> = new Set(["SCALES"]);

/**
 * Types written without a key, so the Key setting is ignored. Lip slurs follow each
 * valve combination's own notes. They're stored as C major, which has no signature.
 */
const KEYLESS: ReadonlySet<ExerciseType> = new Set(["LIP_SLURS"]);

/**
 * Types that can be picked: those made here, and etudes, which Claude writes on the
 * server for signed-in players only (the server refuses guests too).
 */
const canGenerate = (type: ExerciseType, isGuest: boolean) =>
  type === "ETUDES" ? !isGuest : !!GENERATORS[type];

const typeOptions = (isGuest: boolean): ChoiceOption<ExerciseType>[] =>
  EXERCISE_TYPES.map((t) => ({
    value: t,
    label: EXERCISE_TYPE_LABELS[t],
    disabled: !canGenerate(t, isGuest),
  }));

const DEFAULT_SETTINGS: Settings = {
  type: "RANDOM",
  key: "C major",
  timeSig: "4/4",
  measures: 4,
  range: "MED",
  difficulty: "LOW",
};

const TIME_OPTIONS = TIME_SIGNATURES.map((t) => ({ value: t, label: t }));
const RANGE_OPTIONS = RANGES.map((r) => ({ value: r, label: RANGE_LABELS[r] }));

/** The settings margin's entrance: it slides in, then its settings rise in one by one. */
const ENTER_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";
const ENTER_MS = 250;
const ENTER_FIRST_AT = 100;
const ENTER_STAGGER = 50;
/** Header plus the six settings; Generate follows them. */
const ENTER_ITEMS = 7;
const riseIn = (i: number) => ({
  animation: `rise-in ${ENTER_MS}ms ${ENTER_EASE} ${ENTER_FIRST_AT + i * ENTER_STAGGER}ms backwards`,
});
const SETTINGS_ENTRANCE = Object.fromEntries(
  Array.from({ length: ENTER_ITEMS }, (_, i) => [`& > :nth-child(${i + 1})`, riseIn(i)]),
);

/** History's entrance: the rule wipes in, then the loaded entries rise in one by one. */
const HISTORY_WIPE_MS = 400;
const HISTORY_FIRST_AT = 50;
const HISTORY_STAGGER = 50;
/** Entries past this many share its delay; they start below the fold anyway. */
const HISTORY_STAGGER_CAP = 6;

/** The entry grid: a number box in the margin, the exercise beside it. */
const ENTRY_COLUMNS = "40px minmax(0, 1fr)";

export function Generate() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<Record<number, MusicInfo>>({});
  const [generated, setGenerated] = useState<MusicInfo | null>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  // Four bars to a line once the page is wide enough to give each bar room.
  const perLine = useBreakpointValue({ base: 2, xl: 4 }, { ssr: false });

  const { user } = useContext(AuthUserContext);
  useEffect(() => getInitialHistory(user, setHistory), [user]);
  // Until the first generate, open or clear, entries that appear are the loaded
  // history, so they rise in one after another. After that they arrive alone.
  const [intro, setIntro] = useState(true);

  const [library, setLibrary] = useState<MusicInfo[]>([]);
  // Valve numbers under lip slurs, on unless the player hides them.
  const [showFingerings, setShowFingerings] = usePersistedState("showFingerings", true);
  useEffect(() => getInitialLibrary(user, setLibrary), [user]);
  const savedIds = new Set(library.map((entry) => entry.exerciseId));
  const isSaved = (exercise: MusicInfo) => savedIds.has(exercise.exerciseId);

  // History requests go one at a time. The server numbers saves in the order they
  // arrive, so sent together (a double-click on Generate) they could be numbered out
  // of order, and a clear could land before a save made just ahead of it.
  const historyQueue = useRef<Promise<void>>(Promise.resolve());
  const enqueue = (task: () => Promise<void>) => {
    historyQueue.current = historyQueue.current.then(task);
  };

  // The exercise on the plate now, for queued work that runs after later renders.
  const plateNow = useRef<MusicInfo | null>(null);
  useEffect(() => {
    plateNow.current = generated;
  }, [generated]);

  /** Save the exercise, then number it on the plate once the server has. */
  const save = async (exercise: MusicInfo) => {
    const saved = await insertToHistory(exercise, user, setHistory);
    if (!saved) return;
    // Only if it's still on the plate: a newer exercise may have replaced it.
    setGenerated((current) => (current?.id === exercise.id ? saved : current));
  };

  const saveToHistory = (exercise: MusicInfo) => enqueue(() => save(exercise));

  const showPlate = () => {
    plateRef.current?.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  // Etudes are written by Claude on the server, which takes a while and is rationed.
  const [writing, setWriting] = useState(false);
  const [etudeError, setEtudeError] = useState<string | null>(null);
  const [etudeQuota, setEtudeQuota] = useState<EtudeQuota | null>(null);
  const isGuest = !!user?.isAnonymous;
  const etudesChosen = settings.type === "ETUDES";
  useEffect(() => {
    if (!etudesChosen || !user || user.isAnonymous) return;
    // Checked each time etudes are chosen: slots free up as the day goes on.
    const controller = new AbortController();
    fetchEtudeQuota(user, controller.signal).then((quota) => quota && setEtudeQuota(quota));
    return () => controller.abort();
  }, [etudesChosen, user]);

  /** The notes for `settings`, or null when an etude couldn't be written. */
  const notesFor = async (settings: Settings): Promise<string | null> => {
    const { type, key, timeSig, measures, range, difficulty } = settings;
    if (type !== "ETUDES") return GENERATORS[type]?.(settings) ?? null;

    setWriting(true);
    showPlate();
    const result = await requestEtude(user, {
      musicKey: key,
      timeSig,
      measures,
      noteRange: range,
      difficulty,
    });
    setWriting(false);
    if (result.quota) setEtudeQuota(result.quota);
    if (!result.ok) setEtudeError(result.message);
    return result.ok ? result.notes : null;
  };

  const handleGenerate = async () => {
    if (writing) return;
    // The settings as they were when Generate was pressed, however long an etude takes.
    const requested = settings;
    setIntro(false);
    setEtudeError(null);
    const notes = await notesFor(requested);
    if (notes === null) return;

    const { type, key, timeSig, range, difficulty } = requested;
    const exercise: MusicInfo = {
      id: crypto.randomUUID(),
      exerciseId: crypto.randomUUID(),
      exerciseType: type,
      notes,
      timeSig,
      musicKey: KEYLESS.has(type) ? "C major" : key,
      noteRange: range,
      difficulty,
      generationNum: 0,
    };

    setGenerated(exercise);
    saveToHistory(exercise);
    showPlate();
  };

  const handleOpen = (exercise: MusicInfo) => {
    setIntro(false);
    // The exercise leaving the plate joins the list below it (once it's numbered).
    if (generated?.generationNum && !history[generated.generationNum]) {
      setHistory((prev) => ({ ...prev, [generated.generationNum]: generated }));
    }
    setGenerated(exercise);
    showPlate();
  };

  const handleClear = () => {
    setIntro(false);
    const plate = generated;
    enqueue(async () => {
      if (!(await clearHistory(user, setHistory)) || !plate) return;
      // An exercise generated during the clear has its own save queued after this.
      if (plateNow.current?.id !== plate.id) return;
      // The exercise on the plate stays: saved again, it's the server's new No. 1.
      const kept = { ...plate, generationNum: 0 };
      setGenerated((current) => (current?.id === plate.id ? kept : current));
      await save(kept);
    });
  };

  // The server keeps only the newest HISTORY_LIMIT; match it as the session adds more.
  const earlier = Object.values(history)
    .sort((a, b) => b.generationNum - a.generationNum)
    .slice(0, HISTORY_LIMIT)
    .filter((exercise) => exercise.generationNum !== generated?.generationNum);

  return (
    <AppShell
      px={0}
      py={0}
      display="grid"
      gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 312px" }}
      gridTemplateRows={{ lg: "minmax(0, 1fr)" }}
      overflowY={{ base: "auto", lg: "hidden" }}
    >
      <Flex
        direction="column"
        gap="lg"
        minWidth={0}
        minHeight={{ lg: 0 }}
        overflowY={{ lg: "auto" }}
        pt="2xl"
        pb="2xl"
        ps={{ base: "xl", lg: "48px" }}
        pe={{ base: "xl", lg: "40px" }}
      >
        <PageHeader title="Generate" hideBelow="lg" />
        <CurrentExercise
          ref={plateRef}
          exercise={generated}
          pendingType={settings.type}
          writing={writing}
          error={etudeError}
          perLine={perLine}
          saved={!!generated && isSaved(generated)}
          onSaved={(exercise) => setLibrary((prev) => [...prev, exercise])}
          showFingerings={showFingerings}
          onToggleFingerings={() => setShowFingerings((shown) => !shown)}
        />

        <Flex
          justify="space-between"
          align="baseline"
          borderTopWidth="1px"
          borderColor="border"
          pt="md"
          _motionSafe={{
            animation: `wipe-in ${HISTORY_WIPE_MS}ms ${ENTER_EASE} backwards`,
          }}
        >
          <Kicker tone="muted">Earlier</Kicker>
          <ClearHistoryButton
            disabled={Object.keys(history).length === 0}
            keepsPlate={!!generated}
            onClear={handleClear}
          />
        </Flex>
        {earlier.length > 0 && (
          <Flex
            as="ol"
            aria-label="Earlier exercises"
            direction="column"
            gap="lg"
            listStyle="none"
            m={0}
            p={0}
          >
            {earlier.map((exercise, i) => (
              <EarlierExercise
                key={exercise.generationNum}
                exercise={exercise}
                enterDelay={
                  intro ? HISTORY_FIRST_AT + Math.min(i, HISTORY_STAGGER_CAP) * HISTORY_STAGGER : 0
                }
                perLine={perLine}
                saved={isSaved(exercise)}
                showFingerings={showFingerings}
                onOpen={() => handleOpen(exercise)}
              />
            ))}
          </Flex>
        )}
      </Flex>

      {/* Below lg the margin moves above the music, so the settings come first. */}
      <SettingsMargin
        settings={settings}
        onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
        onGenerate={handleGenerate}
        writing={writing}
        etudeQuota={etudeQuota}
        isGuest={isGuest}
        order={{ base: -1, lg: 0 }}
      />
    </AppShell>
  );
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The valve numbers to print under an exercise's notes: only lip slurs have them, and
 * only while they're shown. Kept the same array between renders, so the staff isn't
 * redrawn for nothing.
 */
function useFingeringLabels(exercise: MusicInfo | null, show: boolean) {
  const notes = exercise?.exerciseType === "LIP_SLURS" ? exercise.notes : null;
  return useMemo(() => (show && notes ? lipSlurFingerings(notes) : undefined), [notes, show]);
}

/** The exercise just generated (or brought back), on a plate, with what to do with it. */
function CurrentExercise({
  exercise: current,
  pendingType,
  writing,
  error,
  perLine,
  saved,
  onSaved,
  showFingerings,
  onToggleFingerings,
  ref,
}: {
  exercise: MusicInfo | null;
  /** The type Generate will make, titling the plate while it's empty. */
  pendingType: ExerciseType;
  /** Whether an etude is being written. The plate waits for it, clear of the last exercise. */
  writing: boolean;
  /** Why the last etude couldn't be written, if it couldn't. */
  error: string | null;
  perLine?: number;
  /** Whether the exercise is already in the library. */
  saved: boolean;
  onSaved: (exercise: MusicInfo) => void;
  /** Whether lip slurs show their valve numbers under the notes. */
  showFingerings: boolean;
  onToggleFingerings: () => void;
  ref: Ref<HTMLDivElement>;
}) {
  const exercise = writing ? null : current;
  const fingerings = useFingeringLabels(exercise, showFingerings);
  return (
    <Grid ref={ref} templateColumns={ENTRY_COLUMNS} gap="md" scrollMarginTop="2xl">
      <Box>
        {exercise?.generationNum ? <NumberMark n={exercise.generationNum} current /> : null}
      </Box>
      <Flex direction="column" gap="md" minWidth={0}>
        <Flex justify="space-between" align="baseline" gap="md" wrap="wrap">
          <Heading as="h2" textStyle="heading.md" m={0}>
            {EXERCISE_TYPE_LABELS[writing ? "ETUDES" : (exercise?.exerciseType ?? pendingType)]}
          </Heading>
          {exercise && <ExerciseDetails exercise={exercise} long />}
        </Flex>

        <Plate>
          {writing ? (
            <Flex direction="column" align="center" gap="xs" py="xl" role="status">
              <WritingNotes />
              <Text textStyle="epigraph" color="fg.muted" mt="sm">
                Writing your etude…
              </Text>
              <Text fontSize="13px" color="fg.subtle">
                This usually takes 10 to 40 seconds.
              </Text>
            </Flex>
          ) : exercise ? (
            <Staff
              key={exercise.id}
              notes={exercise.notes}
              timeSig={exercise.timeSig}
              musicKey={exercise.musicKey}
              scale={0.95}
              measuresPerLine={perLine}
              labels={fingerings}
              role="img"
              aria-label={
                exercise.generationNum
                  ? `Score of No. ${exercise.generationNum}`
                  : "Score of the new exercise"
              }
              _motionSafe={{ animation: "appear 400ms ease-out backwards" }}
            />
          ) : (
            <Text textStyle="epigraph" color="fg.muted" textAlign="center" py="xl">
              Choose your settings, then press Generate.
            </Text>
          )}
        </Plate>

        {error && (
          <Text role="alert" fontSize="14px" color="fg.error">
            {error}
          </Text>
        )}

        <Flex gap="sm" wrap="wrap">
          {/* The practice view isn't built yet. */}
          <Button variant="primary" disabled={!exercise}>
            <Play />
            Practice with feedback
          </Button>
          <SaveToLibraryButton exercise={exercise} saved={saved} onSaved={onSaved} />
          {exercise?.exerciseType === "LIP_SLURS" && (
            <Button variant="ghost" onClick={onToggleFingerings}>
              {showFingerings ? <EyeOff /> : <Eye />}
              {showFingerings ? "Hide fingerings" : "Show fingerings"}
            </Button>
          )}
        </Flex>
      </Flex>
    </Grid>
  );
}

/** A past exercise as a full staff. Choosing it brings it back up to the plate. */
function EarlierExercise({
  exercise,
  perLine,
  enterDelay,
  saved,
  showFingerings,
  onOpen,
}: {
  exercise: MusicInfo;
  /** How long to wait before rising in, in ms. */
  enterDelay: number;
  perLine?: number;
  /** Whether the exercise is in the library, shown as a bookmark by its details. */
  saved: boolean;
  /** Whether lip slurs show their valve numbers under the notes. */
  showFingerings: boolean;
  onOpen: () => void;
}) {
  const title = EXERCISE_TYPE_LABELS[exercise.exerciseType];
  const fingerings = useFingeringLabels(exercise, showFingerings);
  // Fixed when the entry mounts: a later change would restart or cut short its rise.
  const [delay] = useState(enterDelay);
  return (
    <Grid
      as="li"
      className="group"
      position="relative"
      templateColumns={ENTRY_COLUMNS}
      gap="md"
      _motionSafe={{ animation: `rise-in ${ENTER_MS}ms ${ENTER_EASE} ${delay}ms backwards` }}
    >
      <NumberMark n={exercise.generationNum} />
      <Flex direction="column" gap="xs" minWidth={0}>
        <Flex justify="space-between" align="baseline" gap="md" wrap="wrap">
          <chakra.button
            type="button"
            onClick={onOpen}
            aria-label={`Open ${title} No. ${exercise.generationNum}`}
            textStyle="heading.sm"
            textAlign="start"
            cursor="pointer"
            transitionProperty="color"
            transitionDuration="fast"
            _groupHover={{ color: "accent.fg" }}
            // The button stretches over the whole entry so the staff is clickable too;
            // the focus ring goes round the entry rather than the title.
            _after={{ content: '""', position: "absolute", inset: "-6px", borderRadius: "md" }}
            _focusVisible={{ outline: "none" }}
            css={{
              "&:focus-visible::after": { outline: "2px solid {colors.accent.solid}" },
            }}
          >
            {title}
          </chakra.button>
          <Flex align="baseline" gap="xs">
            {saved && (
              // Centred on the details line; the text alone sets the row's baseline.
              <chakra.span alignSelf="center" display="inline-flex" color="accent.solid">
                <Bookmark size={12} fill="currentColor" aria-hidden />
                <VisuallyHidden>Saved to library</VisuallyHidden>
              </chakra.span>
            )}
            <ExerciseDetails exercise={exercise} />
          </Flex>
        </Flex>
        <Staff
          notes={exercise.notes}
          timeSig={exercise.timeSig}
          musicKey={exercise.musicKey}
          scale={0.7}
          measuresPerLine={perLine}
          labels={fingerings}
          aria-hidden
        />
      </Flex>
    </Grid>
  );
}

/**
 * "C major · 4/4 · 8 bars · Medium range · Low difficulty" (short form drops the nouns).
 * Exercises written without a key leave it out.
 */
function ExerciseDetails({ exercise, long }: { exercise: MusicInfo; long?: boolean }) {
  const range = RANGE_LABELS[exercise.noteRange];
  const difficulty = DIFFICULTY_LABELS[exercise.difficulty];
  return (
    <ExerciseMeta
      keyLabel={KEYLESS.has(exercise.exerciseType) ? undefined : exercise.musicKey}
      timeSig={exercise.timeSig}
      bars={splitNotes(exercise.notes, exercise.timeSig).length}
      extra={long ? [`${range} range`, `${difficulty} difficulty`] : [range, difficulty]}
    />
  );
}

/** An entry's number in a small box: accent for the exercise on the plate. */
function NumberMark({ n, current }: { n: number; current?: boolean }) {
  return (
    <Flex
      align="center"
      justify="center"
      minWidth="34px"
      height="34px"
      px="xs"
      borderWidth={current ? "1.5px" : "1px"}
      borderColor={current ? "accent.solid" : "border.strong"}
      color={current ? "accent.fg" : "fg.muted"}
      textStyle="figure.xs"
      transitionProperty="border-color, color"
      transitionDuration="fast"
      _groupHover={current ? undefined : { borderColor: "accent.solid", color: "accent.fg" }}
    >
      <VisuallyHidden>No. </VisuallyHidden>
      {n}
    </Flex>
  );
}

/** The design system's `.plate`: a framed sheet for the new exercise. */
function Plate({ children }: { children: ReactNode }) {
  return (
    <Box
      bg="bg.subtle"
      borderWidth="6px"
      borderColor="bg.panel"
      outlineWidth="1px"
      outlineStyle="solid"
      outlineColor="border"
      boxShadow="sm"
      p="lg"
    >
      {children}
    </Box>
  );
}

/** Saves the exercise on the plate to the library, once. */
function SaveToLibraryButton({
  exercise,
  saved,
  onSaved,
}: {
  exercise: MusicInfo | null;
  saved: boolean;
  onSaved: (exercise: MusicInfo) => void;
}) {
  const { user } = useContext(AuthUserContext);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!exercise) return;
    setSaving(true);
    try {
      if (await saveToLibrary(exercise, user)) onSaved(exercise);
    } catch (error) {
      console.error("update library error:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    // The library stores the generation number, so wait until history has given it one.
    <Button disabled={!exercise?.generationNum || saved || saving} onClick={handleSave}>
      {saved ? <BookmarkCheck /> : <Bookmark />}
      {saved ? "Saved to library" : "Save to library"}
    </Button>
  );
}

/** "Clear history", confirmed in a dialog first. */
function ClearHistoryButton({
  disabled,
  keepsPlate,
  onClear,
}: {
  disabled: boolean;
  /** Whether an exercise on the plate survives the clear (as No. 1). */
  keepsPlate: boolean;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root
      role="alertdialog"
      placement="center"
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
    >
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          Clear history
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop bg="bg.backdrop" />
        <Dialog.Positioner>
          <Dialog.Content maxWidth="440px" p="lg" gap="md" borderWidth="1px" borderColor="border">
            <Dialog.Title textStyle="heading.md">Clear history?</Dialog.Title>
            <Dialog.Description fontSize="14px" color="fg.muted">
              {keepsPlate
                ? "Every earlier exercise is removed. The one on the plate stays and becomes No. 1."
                : "Every exercise you've generated is removed."}{" "}
              Exercises saved to your library stay where they are.
            </Dialog.Description>
            <Flex justify="flex-end" gap="sm" mt="sm">
              <Dialog.ActionTrigger asChild>
                <Button>Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                variant="primary"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
              >
                Clear history
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

type SettingsMarginProps = Omit<FlexProps, "onChange"> & {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onGenerate: () => void;
  /** Whether an etude is being written; Generate waits for it. */
  writing: boolean;
  /** Etudes left today, once known. */
  etudeQuota: EtudeQuota | null;
  /** Guests can't generate etudes; they're pointed to sign in instead. */
  isGuest: boolean;
};

/** The right-hand margin: every generator setting, with Generate at its foot. */
function SettingsMargin({
  settings,
  onChange,
  onGenerate,
  writing,
  etudeQuota,
  isGuest,
  ...rest
}: SettingsMarginProps) {
  const [allKeys, setAllKeys] = useState(false);
  // Once a key from the longer list is chosen, keep the list open so it stays visible.
  const rareKey = !isCommonKey(settings.key);
  const keyless = KEYLESS.has(settings.type);
  const keyOptions = keyChoices(allKeys || rareKey).map((k) => ({
    value: k,
    label: <PitchText>{k}</PitchText>,
    disabled: keyless,
  }));
  const [low, high] = RANGE_NOTES[settings.range];
  const ownLength = SETS_OWN_LENGTH.has(settings.type);
  const measureLimits = measureLimitsFor(settings.type);
  const etudes = settings.type === "ETUDES";
  const outOfEtudes = etudes && etudeQuota?.remaining === 0;

  return (
    <Flex
      as="aside"
      aria-label="Exercise settings"
      direction="column"
      minHeight={{ lg: 0 }}
      borderColor="border"
      borderLeftWidth={{ lg: "1px" }}
      borderBottomWidth={{ base: "1px", lg: 0 }}
      // Beside the music it slides in from the page edge; stacked above, the settings'
      // own rise is enough.
      _motionSafe={{
        lg: {
          "--slide-from": "32px",
          animation: `slide-in ${ENTER_MS}ms ${ENTER_EASE} backwards, appear ${ENTER_MS}ms ${ENTER_EASE} backwards`,
        },
      }}
      {...rest}
    >
      <Flex
        direction="column"
        gap="md"
        flex="1"
        minHeight={{ lg: 0 }}
        overflowY={{ lg: "auto" }}
        pt="2xl"
        ps="xl"
        pe="2xl"
        _motionSafe={SETTINGS_ENTRANCE}
      >
        <PageHeader title="Generate" hideFrom="lg" mb="sm" />

        <Field
          label="Exercise type"
          helper={
            isGuest ? (
              <>
                Etudes need an account.{" "}
                <chakra.a asChild color="accent.fg" textDecoration="underline">
                  <RouterLink to="/profile">Sign in from Profile and settings</RouterLink>
                </chakra.a>
                .
              </>
            ) : etudes ? (
              "Claude writes each etude for you, which takes a little while."
            ) : undefined
          }
        >
          <RadioGroup
            aria-label="Exercise type"
            orientation="grid"
            options={typeOptions(isGuest)}
            value={settings.type}
            // A difficulty or length the type doesn't come in moves to the nearest it does.
            onChange={(type) =>
              onChange({
                type,
                difficulty: difficultyFor(type, settings.difficulty),
                measures: measuresFor(type, settings.measures),
              })
            }
          />
        </Field>

        <Field
          label="Key"
          helper={keyless ? "Lip slurs follow each valve combination's own notes." : undefined}
        >
          <ChoiceGrid
            aria-label="Key"
            options={keyOptions}
            value={settings.key}
            onChange={(key) => onChange({ key })}
          />
          {!rareKey && (
            <Button
              variant="ghost"
              size="sm"
              mt="xs"
              disabled={keyless}
              aria-expanded={allKeys}
              onClick={() => setAllKeys((open) => !open)}
            >
              {allKeys ? <ChevronUp /> : <ChevronDown />}
              {allKeys ? "Fewer keys" : "More keys"}
            </Button>
          )}
        </Field>

        <Field label="Time signature">
          <ChoiceGrid
            aria-label="Time signature"
            columns={4}
            options={TIME_OPTIONS}
            value={settings.timeSig}
            onChange={(timeSig) => onChange({ timeSig })}
          />
        </Field>

        <Field
          label="Measures"
          helper={ownLength ? "A scale runs as long as its key and range need." : undefined}
        >
          <Stepper
            aria-label="Measures"
            min={measureLimits.min}
            max={measureLimits.max}
            disabled={ownLength}
            value={settings.measures}
            onChange={(measures) => onChange({ measures })}
          />
        </Field>

        <Field label="Range" helper={<PitchText>{`${low} to ${high}`}</PitchText>}>
          <SegmentedControl
            aria-label="Range"
            options={RANGE_OPTIONS}
            value={settings.range}
            onChange={(range) => onChange({ range })}
          />
        </Field>

        <Field label="Difficulty">
          <SegmentedControl
            aria-label="Difficulty"
            options={TYPE_DIFFICULTIES[settings.type].map((d) => ({
              value: d,
              label: DIFFICULTY_LABELS[d],
            }))}
            value={settings.difficulty}
            onChange={(difficulty) => onChange({ difficulty })}
          />
        </Field>
      </Flex>

      <Box pt="md" pb="xl" ps="xl" pe="2xl" _motionSafe={riseIn(ENTER_ITEMS)}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={writing || outOfEtudes}
          onClick={onGenerate}
        >
          {writing ? "Writing etude…" : "Generate"}
        </Button>
        {etudes && etudeQuota && (
          <Text fontSize="12px" color="fg.muted" mt="sm" textAlign="center">
            <EtudesLeft quota={etudeQuota} />
          </Text>
        )}
      </Box>
    </Flex>
  );
}

/** "7 of 10 etudes left today", or when the next one frees up once they're used. */
function EtudesLeft({ quota }: { quota: EtudeQuota }) {
  if (quota.remaining > 0) {
    return `${quota.remaining} of ${quota.limit} ${quota.limit === 1 ? "etude" : "etudes"} left today`;
  }
  if (!quota.resetsAt) return "No etudes left today.";
  const resets = new Date(quota.resetsAt);
  const at = resets.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  // The window is a rolling 24 hours, so the next one is often tomorrow.
  const day = resets.toDateString() === new Date().toDateString() ? "" : "tomorrow ";
  return `No etudes left today. Another ${day}at ${at}.`;
}

/**
 * A few notes written onto a staff one after another, on a loop, while an etude is on
 * its way. Without motion the notes simply stand there.
 */
function WritingNotes() {
  const notes = [
    { x: 22, y: 26 },
    { x: 46, y: 20 },
    { x: 70, y: 14 },
    { x: 94, y: 20 },
  ];
  return (
    <Box color="fg.subtle" aria-hidden>
      <svg width="168" height="56" viewBox="0 0 120 40">
        {[8, 14, 20, 26, 32].map((y) => (
          <line key={y} x1="4" x2="116" y1={y} y2={y} stroke="currentColor" strokeWidth="0.75" />
        ))}
        {notes.map(({ x, y }, i) => (
          <chakra.g
            key={x}
            color="accent.solid"
            _motionSafe={{ animation: `write-note 2.4s ease-out ${i * 0.3}s infinite backwards` }}
          >
            <ellipse
              cx={x}
              cy={y}
              rx="4.6"
              ry="3.3"
              transform={`rotate(-20 ${x} ${y})`}
              fill="currentColor"
            />
            <line
              x1={x + 4.2}
              x2={x + 4.2}
              y1={y - 1}
              y2={y - 17}
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </chakra.g>
        ))}
      </svg>
    </Box>
  );
}
