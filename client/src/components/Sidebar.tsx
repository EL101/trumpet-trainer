import { Flex, Heading, Separator } from "@chakra-ui/react";
import SidebarTab from "./SidebarTab";
import { SidebarFooter } from "./SidebarFooter";

export default function Sidebar(props) {
  return (
    <Flex
      height="100%"
      borderRightWidth={2}
      borderRightColor="black"
      p="1rem 0.8rem 1.5rem 0.8rem"
      direction="column"
      gap={2}
      {...props}
    >
      <Heading size="2xl">🎺 Trumpet Trainer</Heading>
      <Separator mt="5px" size="md" borderColor="gray.500"></Separator>
      <SidebarTab to="/today" name="Today" />
      <SidebarTab to="/generate" name="Generate" />
      <SidebarTab to="/library" name="Library" />
      <SidebarTab to="/metronome" name="Metronome" />
      <SidebarTab to="/tuner" name="Tuner" />
      <SidebarTab to="/progress" name="Progress" />
      <SidebarFooter mt="auto"></SidebarFooter>
    </Flex>
  );
}
