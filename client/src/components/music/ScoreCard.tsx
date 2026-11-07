import { Box, Dialog, Flex, Grid, Heading, Portal, Text } from "@chakra-ui/react";
import { CircleAlert, X } from "lucide-react";
import { Fragment, useMemo, type ReactNode } from "react";
import { IconButton, Kicker } from "@/components/primitives";
import { EXERCISE_TYPE_LABELS, KEYLESS } from "@/lib/generatorOptions";
import { scoreColorToken } from "@/lib/intonation";
import { formatSavedDate } from "@/lib/library";
import { pulseOf } from "@/lib/meter";
import { barExcerpt } from "@/lib/notation";
import { notePlace, SCORE_PARTS, type RunScore, type ScoreNote } from "@/lib/scoring";
import { buildTimeline } from "@/lib/timeline";
import { toGhost, type PlayedMark } from "@/lib/transcribe";
import type { MusicInfo } from "@/schema";
import { PitchText } from "./PitchText";
import { Staff } from "./Staff";
import { TempoMark } from "./TempoMark";

type ScoreCardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: MusicInfo;
  score: RunScore;
  /** Beats per minute it was played at. */
  tempo: number;
  /** When it was played (ISO); omit for a run just played. */
  playedAt?: string;
  /**
   * Why a run just played wasn't saved, if it wasn't: said on the card, where it stays,
   * as the run won't be under Last feedback.
   */
  unsaved?: string;
  /** The buttons along the bottom. The close button in the corner is always there. */
  actions: ReactNode;
};

/**
 * A scored run (mockup B, "ledger"): the overall score and the weights in a side column,
 * then a row for each part with its score and the feedback under it. A wrong note's
 * line shows its bar, with what was played drawn as a red ghost note.
 */
export function ScoreCard({
  open,
  onOpenChange,
  exercise,
  score,
  tempo,
  playedAt,
  unsaved,
  actions,
}: ScoreCardProps) {
  const pulse = useMemo(() => pulseOf(exercise.timeSig), [exercise.timeSig]);
  const typeLabel = EXERCISE_TYPE_LABELS[exercise.exerciseType];

  return (
    <Dialog.Root
      placement="center"
      size="cover"
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
    >
      <Portal>
        <Dialog.Backdrop bg="bg.backdrop" />
        <Dialog.Positioner px="md">
          <Dialog.Content
            maxWidth="none"
            width="min(900px, 100%)"
            height="auto"
            maxHeight="calc(100dvh - 32px)"
            overflowY="auto"
            p={0}
            borderWidth="1px"
            borderColor="border"
            borderRadius="md"
            boxShadow="sm"
          >
            <Grid templateColumns={{ base: "minmax(0, 1fr)", md: "230px minmax(0, 1fr)" }}>
              <Flex
                as="aside"
                direction="column"
                gap="lg"
                p="xl"
                bg="bg.panel"
                borderColor="border"
                borderRightWidth={{ md: "1px" }}
                borderBottomWidth={{ base: "1px", md: 0 }}
              >
                <Flex direction="column" gap="xs">
                  <Kicker tone="muted">{playedAt ? "Last scored run" : "Scored run"}</Kicker>
                  <Dialog.Title textStyle="heading.lg" m={0}>
                    {typeLabel}
                    {KEYLESS.has(exercise.exerciseType) ? null : (
                      <>
                        {" in "}
                        <PitchText>{exercise.musicKey}</PitchText>
                      </>
                    )}
                  </Dialog.Title>
                  <Flex textStyle="epigraph" color="fg.muted" gap="xs" wrap="wrap" align="baseline">
                    {exercise.generationNum ? <span>No. {exercise.generationNum} ·</span> : null}
                    <TempoMark pulse={pulse} bpm={tempo} />
                    {playedAt ? <span>· {formatSavedDate(playedAt)}</span> : null}
                  </Flex>
                </Flex>

                <Flex
                  direction="column"
                  gap="xs"
                  py="md"
                  borderTopWidth="1px"
                  borderBottomWidth="1px"
                  borderColor="border"
                >
                  <Kicker tone="muted">Overall</Kicker>
                  <Flex align="baseline" gap="xs">
                    <Text
                      as="span"
                      textStyle="display.lg"
                      lineHeight={1}
                      // Cormorant's figures are old-style by default: the 3 would drop
                      // below the line.
                      fontVariantNumeric="lining-nums tabular-nums"
                      color={scoreColorToken(score.overall)}
                    >
                      {score.overall}
                    </Text>
                    <Text as="span" textStyle="heading.md" fontWeight={400} color="fg.muted">
                      / 100
                    </Text>
                  </Flex>
                </Flex>

                {/* An alert, so a save that fails while the card is open is announced. */}
                {unsaved ? (
                  <Flex role="alert" gap="xs" align="flex-start" color="fg.error">
                    <Box as="span" flex="none" pt="2px" aria-hidden>
                      <CircleAlert size={14} />
                    </Box>
                    <Text textStyle="meta">{unsaved}</Text>
                  </Flex>
                ) : null}

                <Grid as="dl" templateColumns="minmax(0, 1fr) auto" rowGap="xs" m={0}>
                  {SCORE_PARTS.map(({ part, label, weight }) => (
                    <Fragment key={part}>
                      <Text as="dt" textStyle="meta" color="fg.muted">
                        {label}
                      </Text>
                      <Text
                        as="dd"
                        textStyle="meta"
                        m={0}
                        textAlign="right"
                        fontVariantNumeric="tabular-nums"
                      >
                        {Math.round(weight * 100)}%
                      </Text>
                    </Fragment>
                  ))}
                </Grid>
              </Flex>

              <Flex direction="column" position="relative" px="xl" pt="xl" pb="lg">
                <Dialog.CloseTrigger asChild>
                  <IconButton
                    aria-label="Close and look over the music"
                    variant="ghost"
                    size="sm"
                    position="absolute"
                    top="xs"
                    right="xs"
                  >
                    <X />
                  </IconButton>
                </Dialog.CloseTrigger>

                {SCORE_PARTS.map(({ part, label }) => {
                  const { score: partScore, notes } = score.parts[part];
                  return (
                    <Grid
                      key={part}
                      as="section"
                      templateColumns={{
                        base: "minmax(0, 1fr) auto",
                        sm: "140px 48px minmax(0, 1fr)",
                      }}
                      columnGap="lg"
                      rowGap="sm"
                      py="md"
                      borderBottomWidth="1px"
                      borderColor="border"
                    >
                      <Heading as="h3" textStyle="subheading" m={0}>
                        {label}
                      </Heading>
                      <Text
                        textStyle="figure.sm"
                        lineHeight={1}
                        fontVariantNumeric="lining-nums tabular-nums"
                        textAlign="right"
                        color={scoreColorToken(partScore)}
                      >
                        {partScore}
                      </Text>
                      <Box gridColumn={{ base: "1 / -1", sm: "auto" }} minWidth={0}>
                        {notes.length ? (
                          <Flex
                            as="ul"
                            direction="column"
                            gap="sm"
                            m={0}
                            ps="md"
                            listStyleType="disc"
                          >
                            {notes.map((note, i) => (
                              <FeedbackLine key={i} note={note} exercise={exercise} />
                            ))}
                          </Flex>
                        ) : (
                          <Text textStyle="small" fontStyle="italic" color="fg.muted">
                            Nothing to work on here.
                          </Text>
                        )}
                      </Box>
                    </Grid>
                  );
                })}

                <Flex justify="flex-end" gap="sm" wrap="wrap" pt="lg">
                  {actions}
                </Flex>
              </Flex>
            </Grid>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

/** One line of feedback: where, what, and for a wrong note, its bar with the ghost drawn. */
function FeedbackLine({ note, exercise }: { note: ScoreNote; exercise: MusicInfo }) {
  const place = notePlace(note);
  const text = (
    <>
      {place ? (
        <Text as="strong" fontWeight={600}>
          {place}:{" "}
        </Text>
      ) : null}
      {note.text}
    </>
  );
  if (note.played === undefined || note.index === undefined || note.bar === undefined) {
    return (
      <Text as="li" textStyle="small">
        {text}
      </Text>
    );
  }
  return (
    <Flex as="li" gap="md" align="center" wrap="wrap" listStyleType="none" ms="-md">
      <WrongNoteBar
        exercise={exercise}
        bar={note.bar - 1}
        index={note.index}
        played={note.played}
        playedLength={note.playedLength}
      />
      <Text textStyle="small" flex="1" minWidth="150px">
        {text}
      </Text>
    </Flex>
  );
}

/**
 * The bar a wrong note is in, small, with the note played drawn over the written one,
 * as long as it was held (or, for a score saved before lengths were, as long as written).
 */
function WrongNoteBar({
  exercise,
  bar,
  index,
  played,
  playedLength,
}: {
  exercise: MusicInfo;
  bar: number;
  index: number;
  played: number;
  playedLength?: number;
}) {
  const { notes } = useMemo(
    () => barExcerpt(exercise.notes, exercise.timeSig, bar),
    [exercise.notes, exercise.timeSig, bar],
  );
  // The wrong note, on the excerpt's played staff.
  const marks = useMemo((): PlayedMark[] => {
    const timeline = buildTimeline(exercise.notes, exercise.timeSig);
    const written = timeline.notes[index];
    if (!written) return [];
    // Where the note falls in its bar, which the excerpt starts at.
    const start = written.start - bar * timeline.bar;
    const ghost = toGhost({ start, end: start + (playedLength ?? written.length), midi: played });
    return [{ ...ghost, status: "wrong", cents: null }];
  }, [exercise.notes, exercise.timeSig, bar, index, played, playedLength]);
  if (!notes) return null;
  return (
    <Staff
      notes={notes}
      timeSig={exercise.timeSig}
      musicKey={KEYLESS.has(exercise.exerciseType) ? undefined : exercise.musicKey}
      barlines={false}
      played={marks}
      width={156}
      scale={0.6}
      aria-hidden
      flex="none"
    />
  );
}
