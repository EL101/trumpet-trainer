import { DASHBOARD_PADDING } from "@/constants/layout";
import { Box, Flex } from "@chakra-ui/react";
import type { ReactNode } from "react";
import Sidebar from "./Sidebar";

export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return (
    <Box height="100vh" bgColor="#F5F1E8" color="black">
      <Flex height="100%" width="100%">
        <Sidebar></Sidebar>
        <Box height="100%" minW="0" flex="1" p={DASHBOARD_PADDING}>
          <Flex height="100%" direction="column" gap={5}>
            {children}
          </Flex>
        </Box>
      </Flex>
    </Box>
  );
}
