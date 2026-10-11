import { Heading } from "@chakra-ui/react";
import { AppShell } from "@/components/layout";

export default function Today() {
  const dateToday = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AppShell>
      <Heading size="2xl">{dateToday}</Heading>
    </AppShell>
  );
}
