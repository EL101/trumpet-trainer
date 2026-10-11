import { Box, Flex, Grid, Heading, Text } from "@chakra-ui/react";
import { BookmarkPlus, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PageHeader, Sidebar } from "@/components/layout";
import {
  ExerciseMeta,
  IntonationLegend,
  PitchReadout,
  PitchText,
  ScoreFigure,
  Staff,
} from "@/components/music";
import {
  Bookplate,
  Button,
  Card,
  ChoiceGrid,
  Field,
  IconButton,
  Input,
  Kicker,
  NativeSelect,
  RadioGroup,
  Rule,
  SectionHeading,
  SegmentedControl,
  Stat,
  Stepper,
  Tag,
} from "@/components/primitives";

/** Dev-only gallery of the design-system building blocks (route: /design). */
export default function DesignPreview() {
  const [zone, setZone] = useState<"5" | "10" | "15">("5");
  const [type, setType] = useState<"long" | "scales" | "slurs" | "random">("random");
  const [key, setKey] = useState("Bb major");
  const [time, setTime] = useState("4/4");
  const [bars, setBars] = useState(2);
  const [cursor, setCursor] = useState(3.4);

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
              Chromatic · ♩ = 80{" "}
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
        <Flex gap="2xl" mt="xl" wrap="wrap">
          <SectionHeading number={1} title="Instrument" description="Transposition and tuning" />
          <SectionHeading number={4} title="Data" description="Can't be undone" />
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
        </Flex>
      </Section>

      <Section title="Sidebar">
        <Box height="720px" borderWidth="1px" borderColor="border" width="max-content">
          <Sidebar
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
