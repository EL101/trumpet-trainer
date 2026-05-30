import { Flex, Heading, Separator, type FlexProps } from "@chakra-ui/react";
import SidebarTab from "./SidebarTab";
import { SidebarFooter } from "./SidebarFooter";
import { DASHBOARD_PADDING } from "../constants/layout";

export default function Sidebar(props: FlexProps) {
  return (
    <Flex
      height="100%"
      borderRightWidth={2}
      borderRightColor="black"
      direction="column"
      gap={2}
      p={DASHBOARD_PADDING}
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
