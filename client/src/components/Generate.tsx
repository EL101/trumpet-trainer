import { generateMusic } from "@/utils/generateMusic";
import { useMemo } from "react";
import DashboardTemplate from "./DashBoardTemplate";
import SheetMusic from "./SheetMusic";
import { Box, Heading } from "@chakra-ui/react";
import { DASHBOARD_PADDING } from "./constants/layout";

export default function Generate() {
  const timeSig = "4/4";
  const measures = 2;
  const key = "C major";
  const range = "LOW";
  const difficulty = "LOW";
  const notes = useMemo(
    () => generateMusic(measures, timeSig, key, range, difficulty),
    [timeSig, measures, key, range, difficulty],
  );

  return (
    <DashboardTemplate>
      <Box height="100%" p={DASHBOARD_PADDING}>
        <Heading size="2xl">
          Generate An Exercise
        </Heading>
        <SheetMusic notes={notes} timeSig={timeSig} border="1px solid red" />
      </Box>
    </DashboardTemplate>
  );
}
