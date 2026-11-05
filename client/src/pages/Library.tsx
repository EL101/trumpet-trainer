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
} from "@chakra-ui/react";
import { Search, Trash2, X } from "lucide-react";
import {
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
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
  appendUnique,
  cardLabel,
  chunkDelay,
  countLabel,
  formatSavedDate,
  incipit,
  isLibraryFilter,
  LIBRARY_PAGE_SIZE,
  placeholderCount,
  rowEnd,
  type LibraryFilter,
} from "@/lib/library";
import { prefersReducedMotion } from "@/lib/motion";
import { readPracticed } from "@/lib/practice";
import { EXERCISE_TYPES, type LibraryEntry } from "@/schema";
import { listHistory } from "@/utils/history";
import { listLibraryPage, removeFromLibrary } from "@/utils/library";
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

/** Placeholder cards shown while the library's first chunk loads. */
const FIRST_PLACEHOLDERS = 6;
/** The height of a card's one-bar staff, which a placeholder's blank staff matches. */
const STAFF_HEIGHT = "60px";

/** The library as loaded so far, a chunk at a time. */
type Feed = {
  /** The first chunk: loading, loaded, or failed. */
  status: "loading" | "ready" | "failed";
  /** The type and search the entries were found by: the controls' until another search loads. */
  filter: LibraryFilter;
  search: string;
  entries: LibraryEntry[];
  /** How many entries the type and search match in all. */
  total: number;
  hasMore: boolean;
  /** The next chunk: not asked for, loading, or failed. */
  more: "idle" | "loading" | "failed";
  /** Where the newest chunk starts, so its cards come in one after another. */
  chunkStart: number;
  /** Counts chunks loaded, so each wait for the next has its own placeholders. */
  chunks: number;
};

/**
 * The library (mockup 1i): every saved exercise as a card with its opening bar, filtered
 * by type and searchable, loaded a chunk at a time as the page scrolls down to it.
 * Clicking a card opens a panel under its row (mockup 6a) with the whole exercise, a
 * Practice button (whose back link comes back here with the same card open) and a way to
 * remove it from the library.
 */
export function Library() {
  const { user } = useContext(AuthUserContext);
  const location = useLocation();
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
  const search = useSettled(query.trim(), 250);
  // Back from the player, the exercise practised is open again, once its chunk loads.
  const [openId, setOpenId] = useState<string | null>(
    () => readPracticed(location.state)?.exerciseId ?? null,
  );
  const seek = useRef(openId);
  const { feed, refreshing, loadMore, retry, remove } = useLibraryFeed(filter, search, seek);
  // A panel folding away while another opens in a different row.
  const [closing, setClosing] = useState<LibraryEntry | null>(null);
  const [grid, setGrid] = useState<HTMLDivElement | null>(null);
  const columns = useGridColumns(grid);
  const perLine = useBreakpointValue({ base: 1, sm: 2, xl: 4 }, { ssr: false });
  const panelId = useId();
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  // Where a removed exercise's card was, so focus can go to the card that takes its place.
  const focusAfterRemove = useRef<number | null>(null);
  // A card was just chosen, so focus goes to its panel's heading once it's there. Only
  // then: a panel opened again by a search or a new chunk leaves focus where it is.
  const focusPanel = useRef(false);
  const panelTitle = useRef<HTMLHeadingElement>(null);

  const entries = feed.entries;
  const openIndex = entries.findIndex((e) => e.exerciseId === openId);
  const open = openIndex >= 0 ? entries[openIndex] : null;
  const openEnd = open ? rowEnd(openIndex, columns, entries.length) : -1;
  const closingIndex = closing ? entries.findIndex((e) => e.exerciseId === closing.exerciseId) : -1;
  const closingEnd = closingIndex >= 0 ? rowEnd(closingIndex, columns, entries.length) : -1;
  // A search, a removal or a new type can take the folding card out of the list mid-fold.
  // Its panel is gone then, without calling `onDone`, so let it go here. Otherwise the
  // fold would play again out of nowhere if the card came back.
  if (closing && closingIndex < 0) setClosing(null);
  const showMore = feed.status === "ready" && feed.hasMore && feed.more !== "failed";

  // The next chunk loads as its placeholders come within half a screen of view. They're
  // all watched, not just the first: a jump to the end can scroll that one right past.
  const onNearNextChunk = useEffectEvent(() => {
    if (!refreshing) loadMore();
  });
  useEffect(() => {
    if (!grid || !showMore) return;
    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((record) => record.isIntersecting)) onNearNextChunk();
      },
      // The page scrolls inside <main>, so that's what "in view" means.
      { root: grid.closest("main"), rootMargin: "0px 0px 50% 0px" },
    );
    grid.querySelectorAll("[data-next-chunk]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // A new chunk's placeholders are new elements to watch.
  }, [grid, showMore, feed.chunks]);

  /** Opens `id`'s panel (null closes it). One open in another row lets the old one fold away. */
  const choose = (id: string | null) => {
    seek.current = null;
    if (open && !prefersReducedMotion()) {
      const nextIndex = entries.findIndex((e) => e.exerciseId === id);
      const sameRow = nextIndex >= 0 && rowEnd(nextIndex, columns, entries.length) === openEnd;
      if (!sameRow) setClosing(open);
    }
    focusPanel.current = id !== null;
    setOpenId(id);
  };

  const close = () => {
    if (!open) return;
    cardRefs.current.get(open.exerciseId)?.focus();
    choose(null);
  };

  /** Takes a removed exercise off the page, and focus to the card now in its place. */
  const removed = (entry: LibraryEntry) => {
    focusAfterRemove.current = entries.findIndex((e) => e.exerciseId === entry.exerciseId);
    setOpenId(null);
    remove(entry.exerciseId);
    notify({ tone: "success", title: "Removed from your library" });
  };

  useEffect(() => {
    const index = focusAfterRemove.current;
    if (index === null) return;
    focusAfterRemove.current = null;
    const next = entries[Math.min(index, entries.length - 1)];
    if (next) cardRefs.current.get(next.exerciseId)?.focus();
  });

  // The panel is placed after the last card in its row, so without this, Tab would
  // pass the rest of the row before reaching it. The panel scrolls itself into view
  // once it has unfolded, so focusing it doesn't scroll as well.
  useEffect(() => {
    if (!focusPanel.current || !open) return;
    focusPanel.current = false;
    panelTitle.current?.focus({ preventScroll: true });
  });

  const onKeyDown = (e: KeyboardEvent) => {
    // Keys in the remove dialog reach here through its portal; it handles its own Escape.
    if (!e.currentTarget.contains(e.target as Node)) return;
    if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  };

  const changeFilter = (next: LibraryFilter) => {
    seek.current = null;
    setFilter(next);
  };
  const changeQuery = (next: string) => {
    seek.current = null;
    setQuery(next);
  };
  const clearSearch = () => {
    changeFilter("ALL");
    changeQuery("");
  };

  // One flat list, so the open panel keeps its place (and doesn't unfold again) when a
  // chunk arriving fills out its row and it moves along after the new cards.
  const items: ReactNode[] = [];
  entries.forEach((entry, i) => {
    items.push(
      <LibraryCard
        key={entry.exerciseId}
        entry={entry}
        open={entry.exerciseId === openId}
        panelId={panelId}
        delay={chunkDelay(i, feed.chunkStart)}
        onClick={() => choose(entry.exerciseId === openId ? null : entry.exerciseId)}
        ref={(el) => {
          if (el) cardRefs.current.set(entry.exerciseId, el);
          else cardRefs.current.delete(entry.exerciseId);
        }}
      />,
    );
    if (i === closingEnd && closingEnd !== openEnd && closing) {
      items.push(
        <ExercisePanel
          key={`closing-${Math.floor(closingIndex / columns)}`}
          entry={closing}
          column={closingIndex % columns}
          columns={columns}
          perLine={perLine}
          closing
          onDone={() => setClosing(null)}
        />,
      );
    }
    if (i === openEnd && open) {
      items.push(
        <ExercisePanel
          // Kept while the open card moves along its row; a new row unfolds a new one.
          key={`open-${Math.floor(openIndex / columns)}`}
          id={panelId}
          titleRef={panelTitle}
          entry={open}
          column={openIndex % columns}
          columns={columns}
          perLine={perLine}
          onClose={close}
          onRemoved={() => removed(open)}
        />,
      );
    }
  });
  if (showMore) {
    const count = placeholderCount(entries.length, feed.total);
    for (let i = 0; i < count; i++) {
      items.push(<PlaceholderCard key={`next-${feed.chunks}-${i}`} next />);
    }
  }

  const emptyLibrary = feed.total === 0 && feed.filter === "ALL" && feed.search === "";

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
              onChange={(e) => changeQuery(e.target.value)}
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
            onChange={changeFilter}
            aria-label="Exercise type"
          />
        </Box>
        {feed.status === "ready" && (
          <Text textStyle="meta" color="fg.muted" aria-live="polite">
            {countLabel(feed.total)}
          </Text>
        )}
      </Flex>

      {feed.status === "loading" ? (
        <Grid
          role="status"
          templateColumns={GRID_COLUMNS}
          columnGap={GAP}
          css={{ "--library-gap": "{spacing.lg}" }}
        >
          <VisuallyHidden>Opening your library…</VisuallyHidden>
          {Array.from({ length: FIRST_PLACEHOLDERS }, (_, i) => (
            <PlaceholderCard key={i} />
          ))}
        </Grid>
      ) : feed.status === "failed" ? (
        <Flex role="alert" direction="column" align="flex-start" gap="md" py="xl">
          <Text textStyle="body" color="fg.error">
            Couldn't load your library. Check your connection and try again.
          </Text>
          <Button onClick={retry}>Try again</Button>
        </Flex>
      ) : emptyLibrary ? (
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
      ) : entries.length === 0 && !feed.hasMore ? (
        <Flex direction="column" align="flex-start" gap="md" py="xl">
          <Text textStyle="epigraph" color="fg.muted">
            No exercises match.
          </Text>
          <Button variant="ghost" onClick={clearSearch}>
            Show every exercise
          </Button>
        </Flex>
      ) : (
        <Box>
          <Grid
            ref={setGrid}
            templateColumns={GRID_COLUMNS}
            columnGap={GAP}
            css={{ "--library-gap": "{spacing.lg}" }}
            onKeyDown={onKeyDown}
            aria-busy={refreshing || feed.more === "loading"}
            // A new search's results load over the old ones, which fade back meanwhile.
            opacity={refreshing ? 0.55 : 1}
            _motionSafe={{ transition: "opacity 150ms ease-out" }}
          >
            {items}
          </Grid>
          {feed.more === "failed" && (
            <Flex role="alert" direction="column" align="flex-start" gap="md" pb="md">
              <Text textStyle="body" color="fg.error">
                Couldn't load more of your library. Check your connection and try again.
              </Text>
              <Button onClick={loadMore}>Try again</Button>
            </Flex>
          )}
        </Box>
      )}
    </AppShell>
  );
}

/** The grid's columns: as many as fit at 260px or more each, or one on a narrow screen. */
const GRID_COLUMNS = "repeat(auto-fill, minmax(min(260px, 100%), 1fr))";

/** `value` once it has stopped changing for `ms`, for a search typed a letter at a time. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * The library entries of `filter`'s type matching `search`, loaded a chunk at a time.
 * A new type or search loads its first chunk over the old one (`refreshing` meanwhile).
 * While `seek` holds an exercise id, chunks keep loading until it's among them.
 */
function useLibraryFeed(filter: LibraryFilter, search: string, seek: RefObject<string | null>) {
  const { user } = useContext(AuthUserContext);
  const [feed, setFeed] = useState<Feed>({
    status: "loading",
    filter,
    search,
    entries: [],
    total: 0,
    hasMore: false,
    more: "idle",
    chunkStart: 0,
    chunks: 0,
  });
  const [attempt, setAttempt] = useState(0);
  // The chunk being loaded, so there's one at a time and a new search can cancel it.
  const moreRequest = useRef<AbortController | null>(null);
  const refreshing = feed.status === "ready" && (feed.filter !== filter || feed.search !== search);

  /** Keeps loading while the exercise sought hasn't turned up and there's more to load. */
  const keepSeeking = (entries: LibraryEntry[], hasMore: boolean) => {
    const id = seek.current;
    if (!id) return false;
    if (!hasMore || entries.some((e) => e.exerciseId === id)) {
      seek.current = null;
      return false;
    }
    return true;
  };

  /**
   * Loads the chunk after `base`'s last entry, if one isn't loading already. Takes what's
   * loaded as an argument, so seeking can go on before the last chunk has rendered.
   */
  const fetchMore = async (base: Pick<Feed, "filter" | "search" | "entries">) => {
    if (moreRequest.current) return;
    const controller = new AbortController();
    moreRequest.current = controller;
    setFeed((prev) => ({ ...prev, more: "loading" }));

    const type = base.filter === "ALL" ? undefined : base.filter;
    let have = base.entries;
    let next: LibraryEntry[] | null = null;
    let hasMore = false;
    try {
      for (;;) {
        const after = have.at(-1)?.exerciseId;
        const page = await listLibraryPage(
          user,
          { type, query: base.search, after, limit: LIBRARY_PAGE_SIZE },
          controller.signal,
        );
        if (page) {
          next = appendUnique(have, page.entries);
          hasMore = page.hasMore;
          setFeed((prev) => ({
            ...prev,
            entries: appendUnique(prev.entries, page.entries),
            total: page.total,
            hasMore: page.hasMore,
            more: "idle",
            chunkStart: prev.entries.length,
            chunks: prev.chunks + 1,
          }));
          break;
        }
        // The last entry was removed elsewhere, so it's gone: follow on from the one before.
        have = have.slice(0, -1);
        setFeed((prev) => ({
          ...prev,
          entries: prev.entries.filter((e) => e.exerciseId !== after),
          total: Math.max(0, prev.total - 1),
        }));
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("load more library error:", error);
      setFeed((prev) => ({ ...prev, more: "failed" }));
    } finally {
      if (moreRequest.current === controller) moreRequest.current = null;
    }
    if (next && keepSeeking(next, hasMore)) void fetchMore({ ...base, entries: next });
  };

  /** Loads the next chunk, if there is one and it isn't loading already. */
  const loadMore = () => {
    if (feed.status === "ready" && feed.hasMore) void fetchMore(feed);
  };

  useEffect(() => {
    const controller = new AbortController();
    moreRequest.current?.abort();
    moreRequest.current = null;
    listLibraryPage(
      user,
      { type: filter === "ALL" ? undefined : filter, query: search, limit: LIBRARY_PAGE_SIZE },
      controller.signal,
    )
      .then((page) => {
        if (controller.signal.aborted) return;
        const { entries, total, hasMore } = page ?? { entries: [], total: 0, hasMore: false };
        setFeed((prev) => ({
          status: "ready",
          filter,
          search,
          entries,
          total,
          hasMore,
          more: "idle",
          chunkStart: 0,
          chunks: prev.chunks + 1,
        }));
        if (keepSeeking(entries, hasMore)) void fetchMore({ filter, search, entries });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("load library error:", error);
        setFeed((prev) => ({ ...prev, status: "failed" }));
      });
    return () => controller.abort();
    // fetchMore and keepSeeking use nothing that changes but `user` and the seek ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filter, search, attempt]);

  useEffect(() => () => moreRequest.current?.abort(), []);

  const retry = () => {
    setFeed((prev) => ({ ...prev, status: "loading" }));
    setAttempt((n) => n + 1);
  };

  /** Takes a removed exercise out of what's loaded. */
  const remove = (exerciseId: string) =>
    setFeed((prev) => ({
      ...prev,
      entries: prev.entries.filter((e) => e.exerciseId !== exerciseId),
      total: Math.max(0, prev.total - 1),
    }));

  return { feed, refreshing, loadMore, retry, remove };
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
  delay,
  onClick,
  ref,
}: {
  entry: LibraryEntry;
  open: boolean;
  /** The panel the card opens, for `aria-controls`. */
  panelId: string;
  /** How long it waits to come in when it first appears, in ms. */
  delay: number;
  onClick: () => void;
  ref: (el: HTMLButtonElement | null) => void;
}) {
  const type = EXERCISE_TYPE_LABELS[entry.exerciseType];
  // Its wait is fixed when it appears: changed later, it would hide and come in again.
  const [enterDelay] = useState(delay);
  return (
    <Card.Root asChild size="md" interactive selected={open}>
      <chakra.button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={cardLabel(entry)}
        textAlign="start"
        mb={GAP}
        _motionSafe={{ animation: `rise-in 350ms ease-out ${enterDelay}ms backwards` }}
      >
        <Card.Kicker>{type}</Card.Kicker>
        <Card.Title>No. {entry.generationNum}</Card.Title>
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
 * A blank card standing where an exercise is still loading, the same size as one. The
 * next chunk's (`next`) are watched to load it as they come near.
 */
function PlaceholderCard({ next }: { next?: boolean }) {
  const bar = (width: string, height: string) => (
    <Box width={width} height={height} borderRadius="xs" bg="bg.muted" />
  );
  return (
    <Card.Root
      size="md"
      aria-hidden
      data-next-chunk={next ? "" : undefined}
      mb={GAP}
      borderColor="border.subtle"
      _motionSafe={{ animation: "pulse 1.6s ease-in-out infinite" }}
    >
      {bar("30%", "10px")}
      {bar("22%", "19px")}
      <Flex direction="column" justify="space-between" height={STAFF_HEIGHT} py="sm">
        {[0, 1, 2, 3, 4].map((line) => (
          <Box key={line} borderTopWidth="1px" borderColor="border.subtle" />
        ))}
      </Flex>
      {bar("55%", "11px")}
    </Card.Root>
  );
}

/**
 * The open card's exercise in full, across the grid under the card's row, with a caret
 * pointing up at the card. It unfolds when it opens and folds away when `closing`.
 */
function ExercisePanel({
  id,
  titleRef,
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
  /** The heading, which focus moves to when its card is chosen. */
  titleRef?: RefObject<HTMLHeadingElement | null>;
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
              <Heading
                ref={titleRef}
                tabIndex={-1}
                as="h2"
                textStyle="heading.md"
                m={0}
                me="2xl"
                // Hugs its text, so the focus ring does too.
                alignSelf="flex-start"
              >
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
 * "Remove from library", confirmed in a dialog first. The dialog looks for the exercise
 * in the history Generate lists, its newest HISTORY_LIMIT, to say whether it can be saved
 * again from there. Anything else (an older row still waiting for the prune, a lookup
 * that failed) is told it can't, since it may well be gone for good.
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
  // Whether Generate still lists it: undefined while asking, null if it couldn't say.
  const [inHistory, setInHistory] = useState<boolean | null | undefined>(undefined);
  const [removing, setRemoving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    // The list, not GET /api/history/:id: that also finds rows past the newest
    // HISTORY_LIMIT that the prune hasn't deleted yet, which Generate no longer shows.
    listHistory(user, controller.signal)
      .then((history) => {
        if (controller.signal.aborted) return;
        setInHistory(history.some((e) => e.exerciseId === entry.exerciseId));
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

  const cant = <strong>can't</strong>;
  const consequence =
    inHistory === undefined ? (
      "Checking your Generate history…"
    ) : inHistory ? (
      "It's still in your Generate history, so you can save it again from there."
    ) : inHistory === false ? (
      <>It's no longer in your Generate history, so you {cant} save it again.</>
    ) : (
      <>Your Generate history couldn't be checked, so assume you {cant} save it again.</>
    );

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
