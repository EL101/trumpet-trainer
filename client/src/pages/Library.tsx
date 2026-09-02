import DashboardTemplate from "../components/DashBoardTemplate";
import { Box, Flex, Heading } from "@chakra-ui/react";
import { useState } from "react";
import FilterButton from "@/components/FilterButton";
import SavedSection from "@/components/SavedSection";

export function Library() {
  const [active, setActive] = useState<string>("saved");
  return (
    <DashboardTemplate>
      <Heading size="2xl">Library</Heading>
      <Flex gap={2}>
        <FilterButton name="Saved" active={active} setActive={setActive} id="saved" />
        <FilterButton name="Scales" active={active} setActive={setActive} id="scales" />
      </Flex>
      <Box>
        <SavedSection />
      </Box>
    </DashboardTemplate>
  );
}
