import { Box, Heading, Text } from "@chakra-ui/react";
import { SheetMusic } from "./SheetMusic";
import type { Key, MusicInfo } from "@/schema";
import type { Dispatch, SetStateAction } from "react";

type HistoryCardProps = {
  musicInfo: MusicInfo;
  generated: MusicInfo;
  setGenerated: Dispatch<SetStateAction<MusicInfo>>;
  history: Record<number, MusicInfo>;
  setHistory: Dispatch<SetStateAction<Record<number, MusicInfo>>>;
};

function keyToShorthand(key: Key) {
  if (key.includes("major")) return key.split(" ")[0];
  return key.split(" ")[0] + "m";
}
export default function HistoryCard({
  musicInfo,
  generated,
  setGenerated,
  history,
  setHistory,
}: HistoryCardProps) {
  const handleClick = () => {
    if (!history[generated.generationNum]) {
      setHistory({ ...history, [generated.generationNum]: generated });
    }
    setGenerated(musicInfo);
  };

  return (
    <Box
      width={150}
      flexShrink={0}
      height={150}
      transform="auto"
      _hover={{ translateY: "-10px" }}
      transition="transform"
    >
      <Heading size="md" color="gray.700">
        GEN #{musicInfo.generationNum}
      </Heading>
      <SheetMusic
        notes={musicInfo.notes}
        timeSig={musicInfo.timeSig}
        musicKey={musicInfo.musicKey}
        minW="0"
        height="100px"
        width="auto"
        overflowX="auto"
        cursor="pointer"
        onClick={handleClick}
      />
      <Text fontSize="0.7rem" color="gray.500" fontWeight="500">
        {keyToShorthand(musicInfo.musicKey)} • {musicInfo.noteRange[0]} Range •{" "}
        {musicInfo.difficulty[0]} Diff
      </Text>
    </Box>
  );
}
