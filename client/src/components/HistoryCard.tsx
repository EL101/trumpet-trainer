import { Box, Heading } from "@chakra-ui/react";
import type { MusicInfo } from "../pages/Generate";
import { SheetMusic } from "./SheetMusic";

export default function HistoryCard({ musicInfo, generated, setGenerated, history, setHistory }) {
  const handleClick = () => {
    if (!history[generated.generationNum]) {
      setHistory({...history, [generated.generationNum]: generated});
    }
    setGenerated(musicInfo);
  }

  return (
    <Box width={150} flexShrink={0} height={150} transform="auto" _hover={{translateY: "-10px"}} transition="transform">
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
        onClick={handleClick}
      />
    </Box>
  );
}
