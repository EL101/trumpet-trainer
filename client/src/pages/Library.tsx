import { DASHBOARD_PADDING } from "@/constants/layout";
import DashboardTemplate from "../components/DashBoardTemplate";
import SignOut from "../components/SignOut";
import { Box, Flex, Grid, GridItem, Heading } from "@chakra-ui/react";
import { db } from "@/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { useState, useEffect, useContext } from "react";
import type { MusicInfo } from "./Generate";
import { AuthUserContext } from "@/auth/AuthUserContext";
import { SheetMusic } from "@/components/SheetMusic";
import { useLibrary } from "@/hooks/useLibrary";

export type LibraryEntry = MusicInfo & {
  createdAt: string;
};

export function Library() {
  const { user } = useContext(AuthUserContext);
  const { library, loading } = useLibrary(user.uid);

  console.log(library);
  return (
    <DashboardTemplate>
      <Box height="100%" minW="0" flex="1" p={DASHBOARD_PADDING}>
        <Flex height="100%" direction="column" gap={5}>
          <Heading size="2xl">Library</Heading>
          <Flex>Filter Panel.......</Flex>
          <Grid>
            {library.map(({ createdAt, ...musicInfo }) => {
              return (
                <SheetMusic
                  key={musicInfo.id}
                  notes={musicInfo.notes}
                  timeSig={musicInfo.timeSig}
                  musicKey={musicInfo.musicKey}
                  minW="0"
                  width="400px"
                  overflowX="auto"
                  cursor="pointer"
                />
              );
            })}
          </Grid>
        </Flex>
      </Box>
    </DashboardTemplate>
  );
}
