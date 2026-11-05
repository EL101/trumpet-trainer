import { AppShell, PageHeader } from "@/components/layout";
import { Tuner as TunerTool } from "@/components/music";
import { Card } from "@/components/primitives";

export default function Tuner() {
  return (
    <AppShell display="flex" flexDirection="column" gap="xl" px={{ base: "xl", lg: "48px" }}>
      <PageHeader title="Tuner" subtitle="Play a note to see how close it is to pitch." />
      <Card.Root size="lg" width="100%" maxWidth="420px">
        <TunerTool title={null} />
      </Card.Root>
    </AppShell>
  );
}
