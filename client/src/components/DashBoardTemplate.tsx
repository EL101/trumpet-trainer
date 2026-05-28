import { Box, Flex } from "@chakra-ui/react";
import Sidebar from "./Sidebar";

export default function DashboardTemplate({ children }) {
  return (
    <Box height="100vh" bgColor="white" color="black">
      <Flex height="100%" width="100%">
        <Sidebar></Sidebar>

        {children}
      </Flex>
    </Box>
  );
}
