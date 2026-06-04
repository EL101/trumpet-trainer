import { AuthUserContext } from "@/auth/AuthUserContext";
import DashboardTemplate from "../components/DashBoardTemplate";
import SignOut from "../components/SignOut";
import { useContext } from "react";
import { DASHBOARD_PADDING } from "@/constants/layout";
import { Box, Flex, Heading } from "@chakra-ui/react";

export default function Profile() {
  const { user } = useContext(AuthUserContext);

  return (
    <DashboardTemplate>
      <Box height="100%" minW="0" flex="1" p={DASHBOARD_PADDING}>
        <Flex height="100%" direction="column" gap={5}>
          <Heading size="2xl">{user ? user.displayName : "Guest"}</Heading>
          <SignOut />
        </Flex>
      </Box>
    </DashboardTemplate>
  );
}
