import { generateMusic, PITCH_CLASSES } from "@/utils/generateMusic";
import { useMemo } from "react";
import DashboardTemplate from "./DashBoardTemplate";
import SheetMusic from "./SheetMusic";
import { Box, createListCollection, Flex, Heading } from "@chakra-ui/react";
import { DASHBOARD_PADDING } from "./constants/layout";
import { Select } from "@chakra-ui/react"
import Dropdown from "./Dropdown";

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

  const keySelect = createListCollection({
    items: 
      PITCH_CLASSES.reduce<string[]>((acc, curr) => [...acc, `${curr} major`, `${curr} minor`], [])
      .map(k => ({label: k, value: k}))
  });

  return (
    <DashboardTemplate>
      <Box height="100%" width="100%" p={DASHBOARD_PADDING}>
        <Flex width="100%" height="100%">
          <Flex flex="1" height="100%" borderRightWidth={2} direction="column">
            <Heading size="2xl">
              Generate An Exercise
            </Heading>
            <Dropdown collection={keySelect} label="Select key"/>
          </Flex>
          <SheetMusic notes={notes} timeSig={timeSig} border="1px solid red" flex="1"/>
        </Flex>
      </Box>
    </DashboardTemplate>
  );
}
