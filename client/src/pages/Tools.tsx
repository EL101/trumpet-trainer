import { Flex, Heading } from "@chakra-ui/react";
import { Play, Square } from "lucide-react";
import { AppShell, PageHeader } from "@/components/layout";
import { BeatDots, SubdivisionControl, TempoControl, Tuner } from "@/components/music";
import { Button, Card, ChoiceGrid, Field } from "@/components/primitives";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useMetronome } from "@/hooks/useMetronome";
import { isTimeSignature, TIME_SIGNATURES, type TimeSignature } from "@/lib/generatorOptions";
import { clampTempo, DEFAULT_TEMPO } from "@/lib/meter";

const TIME_OPTIONS = TIME_SIGNATURES.map((t) => ({ value: t, label: t }));

export default function Tools() {
  return (
    <AppShell display="flex" flexDirection="column" gap="xl" px={{ base: "xl", lg: "48px" }}>
      <PageHeader title="Tools" subtitle="A tuner and a metronome, for practice of your own." />
      <Flex gap="xl" wrap="wrap" align="flex-start">
        <Card.Root size="lg" flex="1 1 320px" maxWidth="440px">
          <Tuner />
        </Card.Root>
        <Card.Root size="lg" flex="1 1 320px" maxWidth="440px">
          <Metronome />
        </Card.Root>
      </Flex>
    </AppShell>
  );
}

/** The metronome on its own. It clicks until stopped, or until the page is left. */
function Metronome() {
  const [timeSig, setTimeSig] = usePersistedState<TimeSignature>("metronomeTimeSig", "4/4", {
    accept: isTimeSignature,
  });
  const [storedTempo, setTempo] = usePersistedState("metronomeTempo", DEFAULT_TEMPO);
  const [clicksPerBeat, setClicksPerBeat] = usePersistedState("metronomeSubdivision", 1);
  const tempo = clampTempo(storedTempo);
  const { pulse, subdivision, running, beat, start, stop } = useMetronome({
    timeSig,
    tempo,
    subdivision: clicksPerBeat,
  });

  return (
    <Flex direction="column" gap="md">
      <Heading as="h2" textStyle="heading.md" m={0}>
        Metronome
      </Heading>
      <Flex justify="space-between" align="center" gap="sm" wrap="wrap">
        <BeatDots pulse={pulse} beat={beat} />
        <SubdivisionControl pulse={pulse} value={subdivision} onChange={setClicksPerBeat} />
      </Flex>
      <Field label="Time signature">
        <ChoiceGrid
          aria-label="Time signature"
          columns={4}
          options={TIME_OPTIONS}
          value={timeSig}
          onChange={setTimeSig}
        />
      </Field>
      <TempoControl pulse={pulse} tempo={tempo} onChange={setTempo} />
      <Button size="sm" alignSelf="center" onClick={running ? stop : start}>
        {running ? <Square /> : <Play />}
        {running ? "Stop" : "Start"}
      </Button>
    </Flex>
  );
}
