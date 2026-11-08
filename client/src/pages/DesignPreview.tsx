import { Box, Flex, Grid, Heading, Text } from "@chakra-ui/react";
import { BookmarkPlus, Pause, Play, RotateCcw, SkipBack, SkipForward, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppShell, FocusShell, PageHeader, Sidebar } from "@/components/layout";
import {
  BeatDots,
  ExerciseMeta,
  IntonationLegend,
  NoteValue,
  PitchReadout,
  PitchText,
  PracticeButton,
  ScoreCard,
  ScoreFigure,
  Staff,
  SubdivisionControl,
  TempoControl,
  TempoMark,
  Tuner,
  TunerGauge,
} from "@/components/music";
import {
  ActivityGrid,
  Bookplate,
  Button,
  Card,
  ChoiceGrid,
  Field,
  IconButton,
  Input,
  Kicker,
  NativeSelect,
  notify,
  RadioGroup,
  RangeAxis,
  RangeSlider,
  Rule,
  SectionHeading,
  SegmentedControl,
  Slider,
  Stat,
  Stepper,
  Tag,
  Textarea,
} from "@/components/primitives";
import { MAX_TEMPO, MIN_TEMPO, pulseOf } from "@/lib/meter";
import { formatDay, pastYear } from "@/lib/activity";
import { formatPitch } from "@/lib/format";
import { DEFAULT_NOTE_RANGES, HORN_SPAN, moveEnd, noteName, type NoteSpan } from "@/lib/noteRanges";
import type { RunScore } from "@/lib/scoring";
import { buildTimeline } from "@/lib/timeline";
import type { PlayedMark } from "@/lib/transcribe";
import type { MusicInfo } from "@/schema";

/** Dev-only gallery of the design-system building blocks (route: /design). */
/** An exercise for PracticeButton to open. It rides in the router state, so it needn't be in history. */
/** A made-up year for the activity grid: busier lately, with gaps, every shade used. */
const PREVIEW_TODAY = "2026-11-08";
const PREVIEW_ACTIVITY = new Map(
  Array.from({ length: 371 }, (_, i) => {
    const date = new Date(Date.UTC(2026, 10, 8) - i * 86_400_000).toISOString().slice(0, 10);
    const h = ((i * 9301 + 49297) % 233280) / 233280;
    const count = h < (i < 60 ? 0.25 : 0.6) ? 0 : Math.round(h * (i < 60 ? 10 : 5));
    return [date, count] as const;
  }),
);

const PREVIEW_EXERCISE: MusicInfo = {
  id: "design-preview",
  exerciseId: "design-preview",
  exerciseType: "RANDOM",
  notes: "G4/8, A4, B4, C5, D5, C5, B4, A4, G4/q, D5, G4/h",
  timeSig: "4/4",
  musicKey: "G major",
  noteRange: "MED",
  difficulty: "LOW",
  generationNum: 1,
};

/** A scale in F, and a run of it for the score card: two wrong notes, rushed, a wobble. */
const SCORED_EXERCISE: MusicInfo = {
  ...PREVIEW_EXERCISE,
  exerciseType: "SCALES",
  notes:
    "F4/q, G4, A4, Bb4, C5, D5, E5, F5, F5, E5, D5, C5, Bb4, A4, G4/h, A4/q, C5, F5, C5, C5, A4, F4, A4, G4, Bb4, D5, E5, F4/w",
  musicKey: "F major",
  generationNum: 43,
};

/** The run's intonation per written note, in cents (rests counted). */
const PREVIEW_CENTS = [
  4,
  -3,
  7,
  2,
  12,
  -6,
  18,
  6,
  9,
  null,
  -2,
  3,
  0,
  5,
  -8,
  14,
  2,
  6,
  -4,
  9,
  null,
  -5,
  11,
  3,
  -24,
  6,
  null,
  null,
];
/**
 * Where the run went wrong, by written note: what was played there instead, and for how
 * long if not the note's length. The B♭4 on beat 4 was played as a D4 held over the
 * barline, through the C5 after it.
 */
const PREVIEW_WRONG: Record<number, { midi: number; length?: number }> = {
  3: { midi: 62, length: 2 },
  9: { midi: 72 },
  20: { midi: 76 },
  26: { midi: 83 },
  27: { midi: 59 },
};
/** Every note played in the run, as the played staff draws it. */
const PREVIEW_PLAYED: PlayedMark[] = buildTimeline(SCORED_EXERCISE.notes, "4/4").notes.flatMap(
  (n, i): PlayedMark[] => {
    // The C5 swallowed by the held D4, and two notes in bar 5 not played: rests.
    if (n.midi === null || i === 4 || i === 16 || i === 17) return [];
    const wrong = PREVIEW_WRONG[i];
    if (wrong) {
      const length = wrong.length ?? n.length;
      return [{ start: n.start, length, midi: wrong.midi, status: "wrong", cents: null }];
    }
    const cents = PREVIEW_CENTS[i] ?? null;
    return [{ start: n.start, length: n.length, midi: n.midi, status: "right", cents }];
  },
);

/**
 * Played notes that need room and context: in F major, the B♭ played after a B♮ in the
 * same bar shows its flat; one far below the first line and one far above the second
 * push the lines apart. The last is still sounding, so not judged yet.
 */
const OUT_OF_RANGE_NOTES = "B4/q, A4, G4, F4, C5/h, D5";
const OUT_OF_RANGE_PLAYED: PlayedMark[] = [
  { start: 0, length: 1, midi: 71, status: "right", cents: 3 },
  { start: 1, length: 1, midi: 69, status: "right", cents: -6 },
  { start: 2, length: 1, midi: 70, status: "wrong", cents: null },
  { start: 3, length: 1, midi: 55, status: "wrong", cents: null },
  { start: 4, length: 2, midi: 72, status: "right", cents: 22 },
  { start: 6, length: 2, midi: 93, status: "sounding", cents: null },
];

const PREVIEW_SCORE: RunScore = {
  overall: 83,
  parts: {
    rightNotes: {
      score: 88,
      notes: [
        {
          bar: 3,
          beat: 2,
          index: 9,
          written: 76,
          played: 72,
          playedLength: 0.5,
          text: "Played C5 instead of E5, too low.",
        },
        {
          bar: 6,
          beat: 1,
          index: 19,
          written: 72,
          played: 76,
          text: "Played E5 instead of C5, too high.",
        },
      ],
    },
    rhythm: {
      score: 68,
      notes: [
        { bar: 2, endBar: 3, text: "Rushed, coming in early." },
        { bar: 4, beat: 3, text: "Let go of the half note early." },
      ],
    },
    intonation: { score: 94, notes: [] },
    tone: {
      score: 84,
      notes: [
        { bar: 5, beat: 1, text: "Scooped up into the note." },
        { bar: 8, beat: 1, text: "The note wavered." },
      ],
    },
  },
};

export default function DesignPreview() {
  const [zone, setZone] = useState<"5" | "10" | "15">("5");
  const [type, setType] = useState<"long" | "scales" | "slurs" | "random">("random");
  const [key, setKey] = useState("Bb major");
  const [time, setTime] = useState("4/4");
  const [bars, setBars] = useState(2);
  const [cursor, setCursor] = useState(3.4);
  const [tempo, setTempo] = useState(96);
  const [span, setSpan] = useState<NoteSpan>([62, 81]);
  const [clicksPerBeat, setClicksPerBeat] = useState(2);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [scoreCardOpen, setScoreCardOpen] = useState<"saved" | "unsaved" | null>(null);

  return (
    <Box bg="bg" color="fg" minHeight="100vh" px="56px" py="52px">
      <PageHeader
        kicker="Classical · Trumpet Trainer"
        title="Design system"
        subtitle="Tokens and shared components"
        size="lg"
      />
      <Rule my="xl" />

      <Section title="Colour roles">
        <Grid templateColumns="repeat(auto-fill, minmax(140px, 1fr))" gap="md">
          {[
            "bg",
            "bg.panel",
            "bg.subtle",
            "fg",
            "fg.muted",
            "fg.subtle",
            "fg.error",
            "border",
            "border.strong",
            "accent.solid",
            "accent.fg",
            "accent.muted",
            "accent.subtle",
            "intonation.good",
            "intonation.fair",
            "intonation.warn",
            "intonation.bad",
          ].map((t) => (
            <Flex key={t} direction="column" gap="xs">
              <Box height="44px" borderRadius="md" borderWidth="1px" borderColor="border" bg={t} />
              <Text fontSize="11px" color="fg.muted">
                {t}
              </Text>
            </Flex>
          ))}
        </Grid>
      </Section>

      <Section title="Type">
        <Flex direction="column" gap="sm">
          <Text textStyle="display.xl">Display extra large — Live Feedback.</Text>
          <Text textStyle="display.lg">Display large — Today's session</Text>
          <Text textStyle="display.md">Display medium — Generate</Text>
          <Text textStyle="heading.lg">Heading large — Clarke Study No. 2 in G</Text>
          <Text textStyle="heading.md">Heading medium — Long Tones, Low Register</Text>
          <Text textStyle="epigraph" color="fg.muted">
            Epigraph — B♭ trumpet · since 2 June 2026
          </Text>
          <Kicker>Kicker — Friday, 9 October</Kicker>
          <Text textStyle="body" maxWidth="620px">
            Body — the app listens through your microphone as you play. Each note is marked by how
            many cents it lands from the pitch, and every run is scored for pitch and rhythm.
          </Text>
        </Flex>
      </Section>

      <Section title="Buttons and tags">
        <Flex gap="md" wrap="wrap" align="center">
          <Button variant="primary">
            <Play />
            Begin
          </Button>
          <Button variant="secondary">Skip for today</Button>
          <Button variant="ghost">
            <RotateCcw />
            Rebuild today's plan
          </Button>
          <Button variant="primary" size="lg">
            Sign in with Google
          </Button>
          <Button variant="secondary" size="sm">
            <BookmarkPlus />
            Save
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="danger" size="sm">
            <Trash2 />
            Reset practice data
          </Button>
          <IconButton aria-label="Previous">
            <SkipBack />
          </IconButton>
          <IconButton aria-label="Next" variant="ghost">
            <SkipForward />
          </IconButton>
          <Tag>Next</Tag>
          <Tag variant="neutral">Long tones</Tag>
          <Tag variant="outline">Saved</Tag>
        </Flex>
      </Section>

      <Section title="Cards">
        <Grid templateColumns="repeat(auto-fill, minmax(260px, 1fr))" gap="lg">
          <Card.Root size="lg">
            <Card.Kicker>Up next · 03</Card.Kicker>
            <Card.Title>Clarke Study No. 2 in G</Card.Title>
            <ExerciseMeta keyLabel="Bb major" tempo={96} bars={8} minutes={6} />
            <Button variant="primary" size="lg" fullWidth mt="md">
              <Play />
              Begin
            </Button>
          </Card.Root>
          <Card.Root size="md" interactive>
            <Card.Kicker>Technical study</Card.Kicker>
            <Card.Title>Clarke Study No. 1</Card.Title>
            <Staff
              notes="C4/8, C#4/8, D4/8, D#4/8, E4/8, F4/8, F#4/8, G4/8"
              timeSig="4/4"
              musicKey="C major"
              scale={0.5}
            />
            <Card.Meta>
              Chromatic · <TempoMark pulse={pulseOf("4/4")} bpm={80} />{" "}
              <Box as="span" ml="auto">
                Best 85
              </Box>
            </Card.Meta>
          </Card.Root>
          <Card.Root size="md" selected elevation="sm">
            <Card.Kicker>Selected</Card.Kicker>
            <Card.Title>Long Tones — Low Register</Card.Title>
            <Card.Body>Hold each note for a full bar, steady air and centred pitch.</Card.Body>
          </Card.Root>
        </Grid>
      </Section>

      <Section title="Forms">
        <Grid templateColumns="repeat(auto-fill, minmax(240px, 1fr))" gap="xl" alignItems="start">
          <Field label="Exercise type">
            <RadioGroup
              aria-label="Exercise type"
              value={type}
              onChange={setType}
              orientation="grid"
              options={[
                { value: "long", label: "Long tones" },
                { value: "scales", label: "Scales" },
                { value: "slurs", label: "Lip slurs", disabled: true },
                { value: "random", label: "Random" },
              ]}
            />
          </Field>
          <Flex direction="column" gap="md">
            <Field label="Key">
              <ChoiceGrid
                aria-label="Key"
                value={key}
                onChange={setKey}
                options={["C major", "A minor", "Bb major", "G minor", "F# major", "D# minor"].map(
                  (k) => ({ value: k, label: <PitchText>{k}</PitchText> }),
                )}
              />
            </Field>
            <Field label="Time signature">
              <ChoiceGrid
                aria-label="Time signature"
                columns={4}
                value={time}
                onChange={setTime}
                options={["4/4", "3/4", "2/4", "6/8"].map((t) => ({ value: t, label: t }))}
              />
            </Field>
          </Flex>
          <Flex direction="column" gap="md">
            <Field label="Key">
              {(id) => (
                <NativeSelect id={id}>
                  <option>C major</option>
                  <option>G major</option>
                  <option>B♭ major</option>
                </NativeSelect>
              )}
            </Field>
            <Field label="Name">{(id) => <Input id={id} placeholder="Generated #43" />}</Field>
            <Field label="Notes">
              {(id) => <Textarea id={id} rows={3} placeholder="Keep the air steady in bar 3" />}
            </Field>
          </Flex>
          <Flex direction="column" gap="md">
            <Field label="Counts as in tune">
              <SegmentedControl
                aria-label="Counts as in tune"
                value={zone}
                onChange={setZone}
                options={[
                  { value: "5", label: "±5¢" },
                  { value: "10", label: "±10¢" },
                  { value: "15", label: "±15¢" },
                ]}
              />
            </Field>
            <Field label="Measures">
              <Stepper aria-label="Measures" value={bars} onChange={setBars} min={1} max={16} />
            </Field>
            <Field
              label={
                <>
                  Slider (<TempoMark pulse={pulseOf("4/4")} bpm={tempo} />)
                </>
              }
            >
              {(id) => (
                <Slider
                  id={id}
                  aria-label="Tempo"
                  value={tempo}
                  onChange={setTempo}
                  min={MIN_TEMPO}
                  max={MAX_TEMPO}
                />
              )}
            </Field>
            <Flex direction="column" gap="xs">
              <Text textStyle="meta" color="fg.muted">
                RangeSlider (<PitchText>{`${noteName(span[0])} – ${noteName(span[1])}`}</PitchText>,
                outlined where it started)
              </Text>
              <RangeSlider
                value={span}
                min={HORN_SPAN[0]}
                max={HORN_SPAN[1]}
                reference={DEFAULT_NOTE_RANGES.MED}
                labels={["Lowest note", "Highest note"]}
                valueText={(midi) => formatPitch(noteName(midi))}
                onChange={(next, end) => setSpan(moveEnd(span, end, next[end]))}
              />
              <RangeAxis
                min={HORN_SPAN[0]}
                max={HORN_SPAN[1]}
                marks={[54, 60, 72, 84, 91].map((m) => ({
                  value: m,
                  label: <PitchText>{noteName(m)}</PitchText>,
                }))}
              />
            </Flex>
          </Flex>
        </Grid>
      </Section>

      <Section title="Figures and headings">
        <Flex gap="2xl" wrap="wrap" align="flex-end">
          <Stat value={12} label="day streak" layout="inline" size="lg" />
          <Stat value={41} label="hours played" />
          <Stat value="D6" label="highest clean note" />
          <ScoreFigure score={93} />
          <ScoreFigure score={81} />
          <ScoreFigure score={64} />
          <ScoreFigure score={42} />
          <PitchReadout note="B4" cents={9} showListening />
          <PitchReadout note="F#5" cents={-22} size="sm" />
        </Flex>
        <Flex gap="2xl" mt="xl" wrap="wrap" align="flex-end">
          <TunerGauge cents={9} width="220px" />
          <TunerGauge cents={-31} width="220px" />
          <TunerGauge cents={null} width="220px" />
          <Card.Root size="lg" width="360px" maxWidth="100%">
            <Tuner />
          </Card.Root>
        </Flex>
        <Flex gap="2xl" mt="xl" wrap="wrap" align="flex-end">
          {["4/4", "2/2", "6/8", "3/8"].map((t) => {
            const pulse = pulseOf(t);
            return (
              <Flex key={t} direction="column" gap="xs">
                <Text textStyle="heading.md">
                  <TempoMark pulse={pulse} bpm={96} />
                </Text>
                <Flex gap="md" textStyle="heading.sm" color="fg.muted">
                  {pulse.subdivisions.map((s) => (
                    <NoteValue key={s.per} symbol={s.symbol} />
                  ))}
                </Flex>
                <Text textStyle="caption" color="fg.muted">
                  {t}: TempoMark, then each NoteValue on offer
                </Text>
              </Flex>
            );
          })}
        </Flex>
        <Flex gap="2xl" mt="xl" wrap="wrap" align="center">
          <BeatDots pulse={pulseOf("4/4")} beat={1} />
          <BeatDots pulse={pulseOf("6/8")} beat={null} />
          <SubdivisionControl
            pulse={pulseOf("4/4")}
            value={clicksPerBeat}
            onChange={setClicksPerBeat}
          />
          <TempoControl pulse={pulseOf("4/4")} tempo={tempo} onChange={setTempo} />
          <TempoControl
            pulse={pulseOf("4/4")}
            tempo={tempo}
            onChange={setTempo}
            locked
            lockedNote="The tempo is set for this take. Restart to change it."
          />
        </Flex>
        <Flex gap="2xl" mt="xl" wrap="wrap">
          <SectionHeading number={1} title="Instrument" description="Transposition and tuning" />
          <SectionHeading number={4} title="Data" description="Can't be undone" />
        </Flex>
        <Flex direction="column" gap="xs" mt="xl">
          <Text textStyle="caption" color="fg.muted">
            ActivityGrid: a year of days, shaded 1, 2–3, 4–6, 7+ (hover a day)
          </Text>
          <ActivityGrid
            counts={PREVIEW_ACTIVITY}
            start={pastYear(PREVIEW_TODAY)[0]}
            end={PREVIEW_TODAY}
            today={PREVIEW_TODAY}
            describe={({ count, date }) => `${count} exercises played on ${formatDay(date)}`}
            aria-label="A year of made-up activity"
          />
        </Flex>
      </Section>

      <Section title="Bookplate">
        <Flex gap="xl" wrap="wrap" align="flex-start">
          <Box width="380px">
            <Bookplate size="lg" display="flex" flexDirection="column" gap="22px">
              <Heading as="h2" textStyle="display.sm" textAlign="center" m={0}>
                Sign in
              </Heading>
              <Rule tone="accent" width="40px" alignSelf="center" />
              <Button variant="primary" size="lg" fullWidth>
                Sign in with Google
              </Button>
              <Button variant="secondary" size="lg" fullWidth>
                Continue as guest
              </Button>
            </Bookplate>
          </Box>
          <Bookplate display="flex" flexDirection="column" gap="6px">
            <Text fontSize="10px" letterSpacing="0.2em" textTransform="uppercase" color="accent.fg">
              Practice record of
            </Text>
            <Text textStyle="display.lg" lineHeight={1}>
              Guest
            </Text>
            <Text textStyle="epigraph" color="fg.muted">
              B♭ trumpet · since 2 June 2026
            </Text>
          </Bookplate>
        </Flex>
      </Section>

      <Section title="Notices">
        <Text color="fg.muted" mb="md">
          Shown in the bottom-right corner by <code>notify()</code>. Each stays 5 seconds, errors
          included; hovering over one holds it.
        </Text>
        <Flex gap="sm" wrap="wrap">
          <Button
            onClick={() =>
              notify({
                tone: "success",
                title: "Your etude is ready",
                description: "B♭ major · 4/4 · Medium difficulty",
                link: { to: "/generate", label: "Open Generate" },
              })
            }
          >
            Success
          </Button>
          <Button
            onClick={() =>
              notify({
                tone: "error",
                title: "Couldn't write your etude",
                description: "The etude writer can't be reached right now. Try again in a minute.",
              })
            }
          >
            Error
          </Button>
          <Button
            onClick={() =>
              notify({
                tone: "info",
                title: "Your etude was cleared",
                description:
                  "History was cleared before your etude arrived, so it wasn't kept. It still counts towards today's etudes.",
              })
            }
          >
            Info
          </Button>
        </Flex>
      </Section>

      <Section title="Staff">
        <Flex direction="column" gap="xl">
          <Box>
            <Flex justify="space-between" align="center" mb="sm">
              <PitchReadout note="B4" cents={9} showListening size="sm" />
              <Flex gap="sm">
                <IconButton aria-label="Back" onClick={() => setCursor((c) => Math.max(0, c - 1))}>
                  <SkipBack />
                </IconButton>
                <Button variant="primary">
                  <Pause />
                  Pause
                </Button>
                <IconButton aria-label="Forward" onClick={() => setCursor((c) => c + 1)}>
                  <SkipForward />
                </IconButton>
              </Flex>
            </Flex>
            <Staff
              notes="G4/8, A4, B4, C5, D5, C5, B4, A4, G4/8, A4, B4, C5, D5, C5, B4, A4, G4/8, B4, D5, G5, F#5, D5, B4, A4, G4/q, D5, G4/h"
              timeSig="4/4"
              musicKey="G major"
              measuresPerLine={2}
              cents={[4, -3, 7, 12, -6, 18, 6, -2, 9, 30, -14]}
              cursor={cursor}
              onNoteClick={setCursor}
            />
            <IntonationLegend mt="sm" />
          </Box>
          <Box>
            <Text fontSize="12px" color="fg.muted" mb="xs">
              Annotated, no barlines (intonation by note)
            </Text>
            <Staff
              notes="G3/w, A3, B3, C4, C#4, D4, E4, F4, G4, A4, B4, C5"
              timeSig="4/4"
              barlines={false}
              annotate
              cents={[6, 3, -4, 2, 21, 17, -5, 3, 1, -2, 4, 0]}
              scale={0.8}
            />
          </Box>
          <Box>
            <Text fontSize="12px" color="fg.muted" mb="xs">
              Compound meter (6/8): eighths beamed in threes
            </Text>
            <Staff
              notes="D4/8, E4, F#4, G4, A4, B4, A4/q., D5/8, C#5, B4"
              timeSig="6/8"
              musicKey="D major"
              scale={0.8}
            />
          </Box>
          <Box>
            <Text fontSize="12px" color="fg.muted" mb="xs">
              Ties (a trailing ~): across a bar line, across a line break, and within a bar
            </Text>
            <Staff
              notes="G4/w~, G4/h, A4/q, B4/q~, B4/h., C5/8~, C5/8, D5/w"
              timeSig="4/4"
              musicKey="G major"
              measuresPerLine={2}
              scale={0.8}
            />
          </Box>
          <Box>
            <Text fontSize="12px" color="fg.muted" mb="xs">
              Slurs ( … ): under stems-up notes, over mixed stems, and across a line break
            </Text>
            <Staff
              notes="(C4/q, G4/q, E4/q, G4/q), (E5/q, C5/q, G4/q, C5/q, G4/q, D5/q, G5/q, D5/q), (C5/8, E5/8, G5/8, E5/8, C5/h)"
              timeSig="4/4"
              musicKey="C major"
              measuresPerLine={2}
              scale={0.8}
            />
          </Box>
          <Box>
            <Text fontSize="12px" color="fg.muted" mb="xs">
              A scored run: every note played (`played`) on a cue-size staff under each line, where
              and as long as it sounded, coloured by intonation, or red where it wasn't the note
              written. A note held across a barline is tied over it, at a line break too, and a
              silence is written as rests (`playedTo`: two quarters in bar 5)
            </Text>
            <Staff
              notes={SCORED_EXERCISE.notes}
              timeSig="4/4"
              musicKey="F major"
              measuresPerLine={4}
              scale={0.8}
              played={PREVIEW_PLAYED}
              playedTo={Infinity}
            />
          </Box>
          <Box>
            <Text fontSize="12px" color="fg.muted" mb="xs">
              Played notes far off the staff get room between the lines, and take in accidentals
              played earlier in the bar: after the B♮, the B♭ on beat 3 shows its flat. The last
              note is still sounding, so it isn't judged yet
            </Text>
            <Staff
              notes={OUT_OF_RANGE_NOTES}
              timeSig="4/4"
              musicKey="F major"
              measuresPerLine={1}
              scale={0.8}
              width={360}
              played={OUT_OF_RANGE_PLAYED}
            />
          </Box>
          <Box>
            <Text fontSize="12px" color="fg.muted" mb="xs">
              PracticeButton opens the player on an exercise; its back link returns here. It waits
              for history to number a new exercise.
            </Text>
            <Flex gap="sm" wrap="wrap">
              <PracticeButton exercise={PREVIEW_EXERCISE} originLabel="Design" />
              <PracticeButton
                exercise={{ ...PREVIEW_EXERCISE, generationNum: 0 }}
                originLabel="Design"
              />
            </Flex>
          </Box>
        </Flex>
      </Section>

      <Section title="Score card">
        <Text textStyle="meta" color="fg.muted" mb="sm">
          A scored run (mockup B): the player opens it when a run in Play mode ends, and
          LastFeedbackButton opens the newest one from Generate and the library.
        </Text>
        <Flex gap="sm" wrap="wrap">
          <Button onClick={() => setScoreCardOpen("saved")}>Open the score card</Button>
          <Button onClick={() => setScoreCardOpen("unsaved")}>Open one that wasn't saved</Button>
        </Flex>
        <ScoreCard
          open={scoreCardOpen !== null}
          onOpenChange={(open) => setScoreCardOpen(open ? "saved" : null)}
          exercise={SCORED_EXERCISE}
          score={PREVIEW_SCORE}
          tempo={92}
          unsaved={
            scoreCardOpen === "unsaved"
              ? "Not saved: the limit is 10 runs a minute, so this one won't be under Last feedback."
              : undefined
          }
          actions={
            <>
              <Button variant="ghost" onClick={() => setScoreCardOpen(null)}>
                See it on the staff
              </Button>
              <Button onClick={() => setScoreCardOpen(null)}>
                <RotateCcw />
                Try again
              </Button>
            </>
          }
        />
      </Section>

      <Section title="Sidebar">
        <Box height="720px" borderWidth="1px" borderColor="border" width="max-content">
          <Sidebar
            expanded={sidebarOpen}
            onToggle={() => setSidebarOpen((open) => !open)}
            streak={{
              days: 12,
              week: [
                { label: "M", state: "done" },
                { label: "T", state: "done" },
                { label: "W", state: "done" },
                { label: "T", state: "done" },
                { label: "F", state: "today" },
                { label: "S", state: "missed" },
                { label: "S", state: "missed" },
              ],
            }}
          />
        </Box>
      </Section>

      <Section title="Page shells">
        <Flex direction="column" gap="xl">
          <Box>
            <Text textStyle="caption" color="fg.muted" mb="xs">
              AppShell: the sidebar and a scrolling page (collapsing it here collapses it app-wide)
            </Text>
            <ShellFrame>
              <AppShell>
                <PageHeader kicker="Friday, 9 October" title="Today" subtitle="Three exercises" />
              </AppShell>
            </ShellFrame>
          </Box>
          <Box>
            <Text textStyle="caption" color="fg.muted" mb="xs">
              FocusShell: the player's frame, with a back link, title, actions and a drawer
            </Text>
            <ShellFrame>
              <FocusShell
                back={{ to: "/design", label: "Back to Design" }}
                title={<Text textStyle="heading.md">Random</Text>}
                actions={<Tag variant="neutral">3 of 6</Tag>}
                aside={
                  <Flex
                    direction="column"
                    gap="md"
                    flex="none"
                    width={{ lg: "300px" }}
                    p="lg"
                    bg="bg.subtle"
                    borderColor="border"
                    borderTopWidth={{ base: "1px", lg: 0 }}
                    borderLeftWidth={{ lg: "1px" }}
                  >
                    <Kicker tone="muted">Tools</Kicker>
                    <TunerGauge cents={4} alignSelf="center" width="220px" />
                  </Flex>
                }
                display="flex"
                flexDirection="column"
                gap="lg"
              >
                <ExerciseMeta
                  keyLabel="G major"
                  extra={[<TempoMark key="tempo" pulse={pulseOf("4/4")} bpm={96} />, "Bar 1 of 2"]}
                />
                <Staff
                  notes="G4/8, A4, B4, C5, D5, C5, B4, A4, G4/q, D5, G4/h"
                  timeSig="4/4"
                  musicKey="G major"
                  cursor={0}
                />
              </FocusShell>
            </ShellFrame>
          </Box>
        </Flex>
      </Section>
    </Box>
  );
}

/**
 * A window onto a page shell. The shells fill the viewport, so here they fill the frame
 * instead (`& > div` outranks the shell's own height class).
 */
function ShellFrame({ children }: { children: ReactNode }) {
  return (
    <Box
      height="480px"
      overflow="hidden"
      borderWidth="1px"
      borderColor="border"
      css={{ "& > div": { height: "100%" } }}
    >
      {children}
    </Box>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box as="section" mb="2xl">
      <Kicker tone="muted" mb="md">
        {title}
      </Kicker>
      {children}
    </Box>
  );
}
