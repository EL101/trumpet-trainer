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
import { Bookmark, BookmarkCheck, ChevronDown, ChevronUp, Play } from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { AuthUserContext } from "@/auth/AuthUserContext";
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
  EXERCISE_TYPE_LABELS,
  isCommonKey,
  keyChoices,
  MEASURE_LIMITS,
  RANGE_LABELS,
  TIME_SIGNATURES,
  type TimeSignature,
} from "@/lib/generatorOptions";
import { generateMusic, RANGE_NOTES } from "@/utils/generateMusic";
import { clearHistory, getInitialHistory, insertToHistory } from "@/utils/history";
import { getInitialLibrary, saveToLibrary } from "@/utils/library";
import { splitNotes } from "@/utils/splitNotes";
import {
  DIFFICULTIES,
  EXERCISE_TYPES,
  HISTORY_LIMIT,
  RANGES,
  type Difficulty,
  type ExerciseType,
  type Key,
  type MusicInfo,
  type Range,
} from "@/schema";

// Only the random generator exists so far, so the other types can't be picked yet.
const TYPE_OPTIONS: readonly ChoiceOption<ExerciseType>[] = EXERCISE_TYPES.map((t) => ({
  value: t,
  label: EXERCISE_TYPE_LABELS[t],
  disabled: t !== "RANDOM",
}));

type Settings = {
  type: ExerciseType;
  key: Key;
  timeSig: TimeSignature;
  measures: number;
  range: Range;
  difficulty: Difficulty;
};

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
const DIFFICULTY_OPTIONS = DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }));

/** The entry grid: a number box in the margin, the exercise beside it. */
const ENTRY_COLUMNS = "40px minmax(0, 1fr)";

export function Generate() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<Record<number, MusicInfo>>({});
  const [generated, setGenerated] = useState<MusicInfo | null>(null);
  const [genCount, setGenCount] = useState(0);
  const plateRef = useRef<HTMLDivElement>(null);
  // Four bars to a line once the page is wide enough to give each bar room.
  const perLine = useBreakpointValue({ base: 2, xl: 4 }, { ssr: false });

  const { user } = useContext(AuthUserContext);
  useEffect(() => getInitialHistory(user, setHistory, setGenCount), [user]);

  const addToHistory = useCallback(
    (exercise: MusicInfo) => {
      insertToHistory(exercise, user, setHistory);
    },
    [user],
  );

  // Flush the exercise on screen into history when the page unmounts. Refs keep the
  // unmount effect at [] while still seeing the latest values.
  const generatedRef = useRef(generated);
  const addToHistoryRef = useRef(addToHistory);

  useEffect(() => {
    generatedRef.current = generated;
  }, [generated]);
  useEffect(() => {
    addToHistoryRef.current = addToHistory;
  }, [addToHistory]);

  useEffect(() => {
    return () => {
      if (generatedRef.current) {
        addToHistoryRef.current(generatedRef.current);
      }
    };
  }, []);

  const showPlate = () => {
    plateRef.current?.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  const handleGenerate = () => {
    const { type, key, timeSig, measures, range, difficulty } = settings;
    const generationNum = genCount + 1;

    const exercise: MusicInfo = {
      id: crypto.randomUUID(),
      exerciseType: type,
      notes: generateMusic(measures, timeSig, key, range, difficulty),
      timeSig,
      musicKey: key,
      noteRange: range,
      difficulty,
      generationNum,
    };

    setGenerated(exercise);
    addToHistory(exercise);
    setGenCount(generationNum);
    showPlate();
  };

  const handleOpen = (exercise: MusicInfo) => {
    // The exercise leaving the plate joins the list below it.
    if (generated && !history[generated.generationNum]) {
      setHistory((prev) => ({ ...prev, [generated.generationNum]: generated }));
    }
    setGenerated(exercise);
    showPlate();
  };

  const handleClear = () => {
    clearHistory(user, setHistory);
    // Numbering starts again, with the exercise on the plate (if any) as No. 1.
    setGenCount(generated ? 1 : 0);
    setGenerated((prev) => prev && { ...prev, generationNum: 1 });
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
          perLine={perLine}
        />

        <Flex
          justify="space-between"
          align="baseline"
          borderTopWidth="1px"
          borderColor="border"
          pt="md"
        >
          <Kicker tone="muted">Earlier</Kicker>
          <ClearHistoryButton disabled={Object.keys(history).length === 0} onClear={handleClear} />
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
            {earlier.map((exercise) => (
              <EarlierExercise
                key={exercise.generationNum}
                exercise={exercise}
                perLine={perLine}
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
        order={{ base: -1, lg: 0 }}
      />
    </AppShell>
  );
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The exercise just generated (or brought back), on a plate, with what to do with it. */
function CurrentExercise({
  exercise,
  pendingType,
  perLine,
  ref,
}: {
  exercise: MusicInfo | null;
  /** The type Generate will make, titling the plate while it's empty. */
  pendingType: ExerciseType;
  perLine?: number;
  ref: Ref<HTMLDivElement>;
}) {
  return (
    <Grid ref={ref} templateColumns={ENTRY_COLUMNS} gap="md" scrollMarginTop="2xl">
      <Box>{exercise && <NumberMark n={exercise.generationNum} current />}</Box>
      <Flex direction="column" gap="md" minWidth={0}>
        <Flex justify="space-between" align="baseline" gap="md" wrap="wrap">
          <Heading as="h2" textStyle="heading.md" m={0}>
            {EXERCISE_TYPE_LABELS[exercise?.exerciseType ?? pendingType]}
          </Heading>
          {exercise && <ExerciseDetails exercise={exercise} long />}
        </Flex>

        <Plate>
          {exercise ? (
            <Staff
              key={exercise.id}
              notes={exercise.notes}
              timeSig={exercise.timeSig}
              musicKey={exercise.musicKey}
              scale={0.95}
              measuresPerLine={perLine}
              role="img"
              aria-label={`Score of No. ${exercise.generationNum}`}
              _motionSafe={{ animation: "appear 400ms ease-out backwards" }}
            />
          ) : (
            <Text textStyle="epigraph" color="fg.muted" textAlign="center" py="xl">
              Choose your settings, then press Generate.
            </Text>
          )}
        </Plate>

        <Flex gap="sm" wrap="wrap">
          {/* The practice view isn't built yet. */}
          <Button variant="primary" disabled={!exercise}>
            <Play />
            Practice with feedback
          </Button>
          <SaveToLibraryButton exercise={exercise} />
        </Flex>
      </Flex>
    </Grid>
  );
}

/** A past exercise as a full staff. Choosing it brings it back up to the plate. */
function EarlierExercise({
  exercise,
  perLine,
  onOpen,
}: {
  exercise: MusicInfo;
  perLine?: number;
  onOpen: () => void;
}) {
  const title = EXERCISE_TYPE_LABELS[exercise.exerciseType];
  return (
    <Grid as="li" className="group" position="relative" templateColumns={ENTRY_COLUMNS} gap="md">
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
          <ExerciseDetails exercise={exercise} />
        </Flex>
        <Staff
          notes={exercise.notes}
          timeSig={exercise.timeSig}
          musicKey={exercise.musicKey}
          scale={0.7}
          measuresPerLine={perLine}
          aria-hidden
        />
      </Flex>
    </Grid>
  );
}

/** "C major · 4/4 · 8 bars · Medium range · Low difficulty" (short form drops the nouns). */
function ExerciseDetails({ exercise, long }: { exercise: MusicInfo; long?: boolean }) {
  const range = RANGE_LABELS[exercise.noteRange];
  const difficulty = DIFFICULTY_LABELS[exercise.difficulty];
  return (
    <ExerciseMeta
      keyLabel={exercise.musicKey}
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
function SaveToLibraryButton({ exercise }: { exercise: MusicInfo | null }) {
  const { user } = useContext(AuthUserContext);
  const [saved, setSaved] = useState<MusicInfo[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => getInitialLibrary(user, setSaved), [user]);

  const isSaved =
    !!exercise &&
    saved.some(
      (item) => item.generationNum === exercise.generationNum && item.notes === exercise.notes,
    );

  const handleSave = async () => {
    if (!exercise) return;
    setSaving(true);
    try {
      if (await saveToLibrary(exercise, user)) {
        setSaved((prev) => [...prev, exercise]);
      }
    } catch (error) {
      console.error("update library error:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button disabled={!exercise || isSaved || saving} onClick={handleSave}>
      {isSaved ? <BookmarkCheck /> : <Bookmark />}
      {isSaved ? "Saved to library" : "Save to library"}
    </Button>
  );
}

/** "Clear history", confirmed in a dialog first. */
function ClearHistoryButton({ disabled, onClear }: { disabled: boolean; onClear: () => void }) {
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
              This removes every exercise you've generated. Exercises saved to your library stay
              where they are.
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
};

/** The right-hand margin: every generator setting, with Generate at its foot. */
function SettingsMargin({ settings, onChange, onGenerate, ...rest }: SettingsMarginProps) {
  const [allKeys, setAllKeys] = useState(false);
  // Once a key from the longer list is chosen, keep the list open so it stays visible.
  const rareKey = !isCommonKey(settings.key);
  const keyOptions = keyChoices(allKeys || rareKey).map((k) => ({
    value: k,
    label: <PitchText>{k}</PitchText>,
  }));
  const [low, high] = RANGE_NOTES[settings.range];

  return (
    <Flex
      as="aside"
      aria-label="Exercise settings"
      direction="column"
      minHeight={{ lg: 0 }}
      borderColor="border"
      borderLeftWidth={{ lg: "1px" }}
      borderBottomWidth={{ base: "1px", lg: 0 }}
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
      >
        <PageHeader title="Generate" hideFrom="lg" mb="sm" />

        <Field label="Exercise type" helper="Only random exercises can be generated so far.">
          <RadioGroup
            aria-label="Exercise type"
            orientation="grid"
            options={TYPE_OPTIONS}
            value={settings.type}
            onChange={(type) => onChange({ type })}
          />
        </Field>

        <Field label="Key">
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

        <Field label="Measures">
          <Stepper
            aria-label="Measures"
            min={MEASURE_LIMITS.min}
            max={MEASURE_LIMITS.max}
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
            options={DIFFICULTY_OPTIONS}
            value={settings.difficulty}
            onChange={(difficulty) => onChange({ difficulty })}
          />
        </Field>
      </Flex>

      <Box pt="md" pb="xl" ps="xl" pe="2xl">
        <Button variant="primary" size="lg" fullWidth onClick={onGenerate}>
          Generate
        </Button>
      </Box>
    </Flex>
  );
}
