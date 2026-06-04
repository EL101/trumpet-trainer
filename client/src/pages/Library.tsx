import { DASHBOARD_PADDING } from "@/constants/layout";
import DashboardTemplate from "../components/DashBoardTemplate";
import { Box, Flex, Heading } from "@chakra-ui/react";
import { useContext, useState } from "react";
import type { MusicInfo } from "./Generate";
import { AuthUserContext } from "@/auth/AuthUserContext";
import FilterButton from "@/components/FilterButton";
import SavedSection from "@/components/SavedSection";

export type LibraryEntry = MusicInfo & {
  createdAt: string;
};

export function Library() {
  const { user } = useContext(AuthUserContext);
  console.log(user?.displayName);
  const [active, setActive] = useState<string>("saved");
  return (
    <DashboardTemplate>
      <Box height="100%" minW="0" flex="1" p={DASHBOARD_PADDING}>
        <Flex height="100%" direction="column" gap={5}>
          <Heading size="2xl">Library</Heading>
          <Flex gap={2}>
            <FilterButton name="Saved" active={active} setActive={setActive} id="saved" />
            <FilterButton name="Scales" active={active} setActive={setActive} id="scales" />
          </Flex>
          <Box>
            <SavedSection/>
          </Box>
        </Flex>
      </Box>
    </DashboardTemplate>
  );
}
