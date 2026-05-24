import { Box, Heading } from "@chakra-ui/react";
import DashboardTemplate from "./DashBoardTemplate";
import SheetMusic from "./SheetMusic";
import { generateMusic } from "@/utils/generateMusic";
import { useEffect, useMemo, useRef } from "react";

export default function Today() {
  const timeSig = "12/4";
  const measures = 2;
  const key = "C major";
  const range = "LOW";
  const difficulty = "LOW";
  const notes = useMemo(() => 
    generateMusic(measures, timeSig, key, range, difficulty), 
    [timeSig, measures, key, range, difficulty]
  );

  const dateToday = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <DashboardTemplate>
      <Box flex="1" height="100%" p="1rem 2rem">
        <Heading size="2xl">{dateToday}</Heading>
        <SheetMusic notes={notes} timeSig={timeSig} border="1px solid red" />
      </Box>
    </DashboardTemplate>
  );
}
