import { Box, Heading } from "@chakra-ui/react";
import type { MusicInfo } from "./Generate";
import { SheetMusic } from "./SheetMusic";

export default function HistoryCard({ musicInfo, ...props }: { musicInfo: MusicInfo }) {
  return (
    <Box width={150} flexShrink={0} height={150}>
      <Heading size="md" color="gray.700">
        GEN #{musicInfo.generationNum}
      </Heading>
      <SheetMusic
        notes={musicInfo.notes}
        timeSig={musicInfo.timeSig}
        musicKey={musicInfo.musicKey}
        minW="0"
        width="400"
        overflowX="auto"
        cursor="pointer"
      />
    </Box>
  );
}
