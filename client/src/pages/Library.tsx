import { DASHBOARD_PADDING } from "@/constants/layout";
import DashboardTemplate from "../components/DashBoardTemplate";
import { Box, Flex, Grid, Heading } from "@chakra-ui/react";
import { useContext } from "react";
import type { MusicInfo } from "./Generate";
import { AuthUserContext } from "@/auth/AuthUserContext";

export type LibraryEntry = MusicInfo & {
  createdAt: string;
};

export function Library() {
  const { user } = useContext(AuthUserContext);
  console.log(user?.displayName);
  return (
    <DashboardTemplate>
      <Box height="100%" minW="0" flex="1" p={DASHBOARD_PADDING}>
        <Flex height="100%" direction="column" gap={5}>
          <Heading size="2xl">Library</Heading>
          <Flex>Filter Panel.......</Flex>
          <Grid>
            
          </Grid>
        </Flex>
      </Box>
    </DashboardTemplate>
  );
}
