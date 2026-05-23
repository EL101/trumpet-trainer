import { Box, Container, Flex, Heading } from "@chakra-ui/react";
import DashboardTemplate from "./DashBoardTemplate";
import SheetMusic from "./SheetMusic";

export default function Today() {  
  const dateToday = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <DashboardTemplate>
      <Box flex="1" height="100%" p="1rem 2rem">
        <Heading size="2xl">{dateToday}</Heading>
        <SheetMusic/>
      </Box>
    </DashboardTemplate>
  );
}
