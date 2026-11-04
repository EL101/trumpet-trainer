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
} from "@chakra-ui/react";
import { Search, Trash2, X } from "lucide-react";
import {
  Fragment,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthUserContext } from "@/auth/AuthUserContext";
import { AppShell, PageHeader } from "@/components/layout";
import { ExerciseMeta, PitchText, PracticeButton, Staff } from "@/components/music";
import {
  Button,
  Card,
  IconButton,
  Input,
  notify,
  SegmentedControl,
  type ChoiceOption,
} from "@/components/primitives";
import { usePersistedState } from "@/hooks/usePersistedState";
import {
  DIFFICULTY_LABELS,
  EXERCISE_TYPE_LABELS,
  KEYLESS,
  RANGE_LABELS,
} from "@/lib/generatorOptions";
import {
  countLabel,
  filterLibrary,
  formatSavedDate,
  incipit,
  isLibraryFilter,
  rowEnd,
  type LibraryFilter,
} from "@/lib/library";
import { prefersReducedMotion } from "@/lib/motion";
import { readPracticed } from "@/lib/practice";
import { EXERCISE_TYPES, type LibraryEntry } from "@/schema";
import { getHistoryEntry } from "@/utils/history";
import { listLibrary, removeFromLibrary } from "@/utils/library";
import { splitNotes } from "@/utils/splitNotes";

const FILTER_OPTIONS: ChoiceOption<LibraryFilter>[] = [
  { value: "ALL", label: "All" },
  ...EXERCISE_TYPES.map((t) => ({ value: t, label: EXERCISE_TYPE_LABELS[t] })),
];

/** The open card's panel unfolding under its row, timed and eased like the player's drawer. */
const PANEL_MS = 300;
const PANEL_EASE = "cubic-bezier(0.2, 0, 0, 1)";
/**
 * The space between cards, as a CSS variable the panel's caret uses too. Rows are spaced
 * by margins rather than a row gap, so the gap under a panel opens with it.
 */
const GAP = "var(--library-gap)";

/** The library's state: loading, loaded, or a load that failed. */
type Load =
  | { status: "loading" }
  | { status: "ready"; entries: LibraryEntry[] }
  | { status: "failed" };

/**
 * The library (mockup 1i): every saved exercise as a card with its opening bar, filtered
 * by type and searchable. Clicking a card opens a panel under its row (mockup 6a) with
 * the whole exercise, a Practice button (whose back link comes back here with the same
 * card open) and a way to remove it from the library.
 */
export function Library() {
  const { user } = useContext(AuthUserContext);
  const location = useLocation();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // Kept per tab, so the page looks the same on the way back from the player.
  const [filter, setFilter] = usePersistedState<LibraryFilter>(
    `libraryFilter:${user?.uid}`,
    "ALL",
    {
      session: true,
      accept: isLibraryFilter,
    },
  );
  const [query, setQuery] = usePersistedState(`librarySearch:${user?.uid}`, "", {
    session: true,
    accept: (value): value is string => typeof value === "string",
  });
  // Back from the player, the exercise practised is open again.
  const [openId, setOpenId] = useState<string | null>(
    () => readPracticed(location.state)?.exerciseId ?? null,
  );
  // A panel folding away while another opens in a different row.
  const [closing, setClosing] = useState<LibraryEntry | null>(null);
  const [grid, setGrid] = useState<HTMLDivElement | null>(null);
  const columns = useGridColumns(grid);
  const perLine = useBreakpointValue({ base: 1, sm: 2, xl: 4 }, { ssr: false });
  const panelId = useId();
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  // Where a removed exercise's card was, so focus can go to the card that takes its place.
  const focusAfterRemove = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listLibrary(user, controller.signal)
      .then((entries) => {
        if (!controller.signal.aborted) setLoad({ status: "ready", entries });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("load library error:", error);
        setLoad({ status: "failed" });
      });
    return () => controller.abort();
  }, [user, attempt]);

  const entries = load.status === "ready" ? load.entries : [];
  const visible = filterLibrary(entries, filter, query);
  const openIndex = visible.findIndex((e) => e.exerciseId === openId);
  const open = openIndex >= 0 ? visible[openIndex] : null;
  const openEnd = open ? rowEnd(openIndex, columns, visible.length) : -1;
  const closingIndex = closing ? visible.findIndex((e) => e.exerciseId === closing.exerciseId) : -1;
  const closingEnd = closingIndex >= 0 ? rowEnd(closingIndex, columns, visible.length) : -1;

  /** Opens `id`'s panel (null closes it). One open in another row lets the old one fold away. */
  const choose = (id: string | null) => {
    if (open && !prefersReducedMotion()) {
      const nextIndex = visible.findIndex((e) => e.exerciseId === id);
      const sameRow = nextIndex >= 0 && rowEnd(nextIndex, columns, visible.length) === openEnd;
      if (!sameRow) setClosing(open);
    }
    setOpenId(id);
  };

  const close = () => {
    if (!open) return;
    cardRefs.current.get(open.exerciseId)?.focus();
    choose(null);
  };

  /** Takes a removed exercise off the page, and focus to the card now in its place. */
  const removed = (entry: LibraryEntry) => {
    focusAfterRemove.current = visible.findIndex((e) => e.exerciseId === entry.exerciseId);
    setOpenId(null);
    setLoad((prev) =>
      prev.status === "ready"
        ? { ...prev, entries: prev.entries.filter((e) => e.exerciseId !== entry.exerciseId) }
        : prev,
    );
    notify({ tone: "success", title: "Removed from your library" });
  };

  useEffect(() => {
    const index = focusAfterRemove.current;
    if (index === null) return;
    focusAfterRemove.current = null;
    const next = visible[Math.min(index, visible.length - 1)];
    if (next) cardRefs.current.get(next.exerciseId)?.focus();
  });

  const onKeyDown = (e: KeyboardEvent) => {
    // Keys in the remove dialog reach here through its portal; it handles its own Escape.
    if (!e.currentTarget.contains(e.target as Node)) return;
    if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  };

  const clearSearch = () => {
    setFilter("ALL");
    setQuery("");
  };

  return (
    <AppShell
      display="flex"
      flexDirection="column"
      gap="lg"
      pt="2xl"
      pb="2xl"
      px={{ base: "xl", lg: "48px" }}
    >
      <PageHeader
        title="Library"
        flexWrap="wrap"
        actions={
          <Box position="relative" width={{ base: "100%", sm: "260px" }}>
            <Box
              as={Search}
              position="absolute"
              left="10px"
              top="50%"
              transform="translateY(-50%)"
              boxSize="15px"
              color="fg.subtle"
              pointerEvents="none"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Search exercises"
              aria-label="Search exercises"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              ps="32px"
            />
          </Box>
        }
        css={{ "& > :last-child": { flexGrow: { base: 1, sm: 0 } } }}
      />

      <Flex align="center" justify="space-between" gap="md" wrap="wrap">
        {/* Six types don't fit a phone: the row scrolls rather than wrapping. */}
        <Box overflowX="auto" maxWidth="100%" p="2px" m="-2px">
          <SegmentedControl
            options={FILTER_OPTIONS}
            value={filter}
            onChange={setFilter}
            aria-label="Exercise type"
          />
        </Box>
        {load.status === "ready" && (
          <Text textStyle="meta" color="fg.muted" aria-live="polite">
            {countLabel(visible.length)}
          </Text>
        )}
      </Flex>

      {load.status === "loading" ? (
        <Text role="status" textStyle="epigraph" color="fg.muted" py="xl">
          Opening your library…
        </Text>
      ) : load.status === "failed" ? (
        <Flex role="alert" direction="column" align="flex-start" gap="md" py="xl">
          <Text textStyle="body" color="fg.error">
            Couldn't load your library. Check your connection and try again.
          </Text>
          <Button
            onClick={() => {
              setLoad({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </Flex>
      ) : entries.length === 0 ? (
        <Flex direction="column" align="flex-start" gap="md" py="xl">
          <Text textStyle="epigraph" color="fg.muted">
            Nothing saved yet.
          </Text>
          <Text textStyle="body" color="fg.muted">
            Exercises you save to your library from Generate appear here.
          </Text>
          <Button asChild>
            <Link to="/generate">Go to Generate</Link>
          </Button>
        </Flex>
      ) : visible.length === 0 ? (
        <Flex direction="column" align="flex-start" gap="md" py="xl">
          <Text textStyle="epigraph" color="fg.muted">
            No exercises match.
          </Text>
          <Button variant="ghost" onClick={clearSearch}>
            Show every exercise
          </Button>
        </Flex>
      ) : (
        <Grid
          ref={setGrid}
          templateColumns="repeat(auto-fill, minmax(min(260px, 100%), 1fr))"
          columnGap={GAP}
          css={{ "--library-gap": "{spacing.lg}" }}
          onKeyDown={onKeyDown}
        >
          {visible.map((entry, i) => (
            <Fragment key={entry.exerciseId}>
              <LibraryCard
                entry={entry}
                open={entry.exerciseId === openId}
                panelId={panelId}
                onClick={() => choose(entry.exerciseId === openId ? null : entry.exerciseId)}
                ref={(el) => {
                  if (el) cardRefs.current.set(entry.exerciseId, el);
                  else cardRefs.current.delete(entry.exerciseId);
                }}
              />
              {i === closingEnd && closingEnd !== openEnd && closing && (
                <ExercisePanel
                  key={`closing-${closingEnd}`}
                  entry={closing}
                  column={closingIndex % columns}
                  columns={columns}
                  perLine={perLine}
                  closing
                  onDone={() => setClosing(null)}
                />
              )}
              {i === openEnd && open && (
                <ExercisePanel
                  // Kept while the open card moves along its row; a new row unfolds a new one.
                  key={`open-${openEnd}`}
                  id={panelId}
                  entry={open}
                  column={openIndex % columns}
                  columns={columns}
                  perLine={perLine}
                  onClose={close}
                  onRemoved={() => removed(open)}
                />
              )}
            </Fragment>
          ))}
        </Grid>
      )}
    </AppShell>
  );
}

/**
 * The number of columns `grid` lays its cards out in now. It's `auto-fill`, so this is
 * read back from the browser, and again whenever the grid is resized.
 */
function useGridColumns(grid: HTMLElement | null) {
  const [columns, setColumns] = useState(1);
  useLayoutEffect(() => {
    if (!grid) return;
    const measure = () => {
      const tracks = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean);
      setColumns(Math.max(1, tracks.length));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [grid]);
  return columns;
}

/** One exercise in the grid: its type, number, opening bar and details. */
function LibraryCard({
  entry,
  open,
  panelId,
  onClick,
  ref,
}: {
  entry: LibraryEntry;
  open: boolean;
  /** The panel the card opens, for `aria-controls`. */
  panelId: string;
  onClick: () => void;
  ref: (el: HTMLButtonElement | null) => void;
}) {
  const type = EXERCISE_TYPE_LABELS[entry.exerciseType];
  return (
    <Card.Root asChild size="md" interactive selected={open}>
      <chakra.button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${type} No. ${entry.generationNum}`}
        textAlign="start"
        mb={GAP}
        _focusVisible={{ outline: "2px solid {colors.accent.solid}", outlineOffset: "2px" }}
      >
        <Card.Kicker>{type}</Card.Kicker>
        <Card.Title fontSize="19px">No. {entry.generationNum}</Card.Title>
        <Staff
          notes={incipit(entry.notes, entry.timeSig)}
          timeSig={entry.timeSig}
          musicKey={entry.musicKey}
          scale={0.5}
          aria-hidden
        />
        <Card.Meta justifyContent="space-between" gap="sm">
          <ExerciseMeta
            fontSize="inherit"
            keyLabel={KEYLESS.has(entry.exerciseType) ? undefined : entry.musicKey}
            timeSig={entry.timeSig}
            bars={splitNotes(entry.notes, entry.timeSig).length}
          />
          <Text as="span" flex="none">
            {formatSavedDate(entry.createdAt)}
          </Text>
        </Card.Meta>
      </chakra.button>
    </Card.Root>
  );
}

/**
 * The open card's exercise in full, across the grid under the card's row, with a caret
 * pointing up at the card. It unfolds when it opens and folds away when `closing`.
 */
function ExercisePanel({
  id,
  entry,
  column,
  columns,
  perLine,
  closing,
  onClose,
  onRemoved,
  onDone,
}: {
  id?: string;
  entry: LibraryEntry;
  /** The open card's column, which the caret points at. */
  column: number;
  columns: number;
  perLine?: number;
  /** Folding away: it can't be used, and calls `onDone` once it's gone. */
  closing?: boolean;
  onClose?: () => void;
  /** Called once the exercise has been removed from the library. */
  onRemoved?: () => void;
  onDone?: () => void;
}) {
  const type = EXERCISE_TYPE_LABELS[entry.exerciseType];
  const title = `${type} No. ${entry.generationNum}`;
  const ref = useRef<HTMLDivElement>(null);
  // The centre of the open card's column: the column widths plus the gaps before it.
  const caretLeft = `calc((100% - ${columns - 1} * ${GAP}) / ${columns} * ${column + 0.5} + ${column} * ${GAP} - 6px)`;

  const reveal = () =>
    ref.current?.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  // Without motion there's no unfolding to wait for.
  useEffect(() => {
    if (!closing && prefersReducedMotion()) reveal();
  }, [closing]);

  // Lip slurs are written without a key, so they don't give one.
  const keyless = KEYLESS.has(entry.exerciseType);
  const keyRow: [string, ReactNode][] = keyless
    ? []
    : [["Key", <PitchText>{entry.musicKey}</PitchText>]];
  const details: [string, ReactNode][] = [
    ...keyRow,
    ["Time", entry.timeSig],
    ["Bars", splitNotes(entry.notes, entry.timeSig).length],
    ["Range", RANGE_LABELS[entry.noteRange]],
    ["Difficulty", DIFFICULTY_LABELS[entry.difficulty]],
    ["Saved", formatSavedDate(entry.createdAt)],
  ];

  return (
    <Grid
      ref={ref}
      id={id}
      role="region"
      aria-label={title}
      gridColumn="1 / -1"
      position="relative"
      templateRows="1fr"
      mb={GAP}
      inert={closing}
      _motionSafe={{
        animation: closing
          ? `fold ${PANEL_MS}ms ${PANEL_EASE} forwards`
          : `unfold ${PANEL_MS}ms ${PANEL_EASE} backwards`,
      }}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        if (closing) onDone?.();
        else reveal();
      }}
    >
      <Box minHeight={0} overflow="hidden">
        <Box position="relative" borderWidth="1px" borderColor="accent.solid" borderRadius="md">
          <Grid
            // A new exercise in the same row fades in where the last one was.
            key={entry.exerciseId}
            templateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 210px" }}
            gap={{ base: "lg", lg: "2xl" }}
            alignItems="start"
            px={{ base: "md", sm: "xl" }}
            pt="lg"
            pb="xl"
            _motionSafe={{ animation: "appear 250ms ease-out backwards" }}
          >
            <Flex direction="column" gap="sm" minWidth={0}>
              <Heading as="h2" textStyle="heading.md" m={0} pe="2xl">
                {title}
              </Heading>
              <Staff
                notes={entry.notes}
                timeSig={entry.timeSig}
                musicKey={entry.musicKey}
                scale={0.8}
                measuresPerLine={perLine}
                role="img"
                aria-label={`Score of ${title}`}
              />
            </Flex>
            <Flex direction="column" gap="md" pt={{ lg: "2xl" }}>
              <Grid as="dl" templateColumns="auto 1fr" columnGap="lg" rowGap="xs" m={0}>
                {details.map(([label, value]) => (
                  <Box key={label} display="contents">
                    <Text as="dt" textStyle="kicker" color="fg.muted" alignSelf="center">
                      {label}
                    </Text>
                    <Text as="dd" textStyle="body" m={0}>
                      {value}
                    </Text>
                  </Box>
                ))}
              </Grid>
              <PracticeButton exercise={entry} originLabel="Library" label="Practice" fullWidth />
              {onRemoved && <RemoveFromLibrary entry={entry} title={title} onRemoved={onRemoved} />}
            </Flex>
          </Grid>
          {onClose && (
            <IconButton
              aria-label="Close"
              variant="ghost"
              size="sm"
              position="absolute"
              top="sm"
              right="sm"
              onClick={onClose}
            >
              <X />
            </IconButton>
          )}
        </Box>
      </Box>
      <Box
        aria-hidden
        position="absolute"
        top="-6px"
        left={caretLeft}
        boxSize="12px"
        bg="bg"
        borderLeftWidth="1px"
        borderTopWidth="1px"
        borderColor="accent.solid"
        transform="rotate(45deg)"
        _motionSafe={{ transition: `left ${PANEL_MS}ms ${PANEL_EASE}` }}
      />
    </Grid>
  );
}

/**
 * "Remove from library", confirmed in a dialog first. The dialog looks the exercise up in
 * history to say whether it can be saved again from Generate, or is gone for good.
 */
function RemoveFromLibrary({
  entry,
  title,
  onRemoved,
}: {
  entry: LibraryEntry;
  /** "Scales No. 6", for the dialog's question. */
  title: string;
  onRemoved: () => void;
}) {
  const { user } = useContext(AuthUserContext);
  const [open, setOpen] = useState(false);
  // Whether history still has it: undefined while asking, null if it couldn't say.
  const [inHistory, setInHistory] = useState<boolean | null | undefined>(undefined);
  const [removing, setRemoving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    getHistoryEntry(entry.exerciseId, user, controller.signal)
      .then((found) => {
        if (!controller.signal.aborted) setInHistory(found !== null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setInHistory(null);
      });
    return () => controller.abort();
  }, [open, entry.exerciseId, user]);

  const onOpenChange = (next: boolean) => {
    if (removing) return;
    if (next) {
      setInHistory(undefined);
      setFailed(false);
    }
    setOpen(next);
  };

  const remove = async () => {
    setRemoving(true);
    setFailed(false);
    try {
      await removeFromLibrary(entry.exerciseId, user);
      setOpen(false);
      onRemoved();
    } catch (error) {
      console.error("remove from library error:", error);
      setFailed(true);
    } finally {
      setRemoving(false);
    }
  };

  const consequence =
    inHistory === undefined
      ? "Checking your Generate history…"
      : inHistory
        ? "It's still in your Generate history, so you can save it again from there."
        : inHistory === false
          ? "It's no longer in your Generate history, so this can't be undone."
          : "If it's no longer in your Generate history, this can't be undone.";

  return (
    <Dialog.Root
      role="alertdialog"
      placement="center"
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
    >
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="sm" alignSelf="flex-start">
          <Trash2 />
          Remove from library
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop bg="bg.backdrop" />
        <Dialog.Positioner>
          <Dialog.Content maxWidth="440px" p="lg" gap="md" borderWidth="1px" borderColor="border">
            <Dialog.Title textStyle="heading.md">Remove {title} from your library?</Dialog.Title>
            <Dialog.Description textStyle="body" color="fg.muted" aria-live="polite">
              {consequence}
            </Dialog.Description>
            {failed && (
              <Text role="alert" textStyle="body" color="fg.error">
                Couldn't remove it. Check your connection and try again.
              </Text>
            )}
            <Flex justify="flex-end" gap="sm" mt="sm">
              <Dialog.ActionTrigger asChild>
                <Button disabled={removing}>Cancel</Button>
              </Dialog.ActionTrigger>
              <Button variant="primary" disabled={removing} onClick={remove}>
                <Trash2 />
                {removing ? "Removing…" : "Remove"}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
