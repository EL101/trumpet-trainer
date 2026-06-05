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
      <Heading size="2xl">{user ? user.displayName : "Guest"}</Heading>
      <SignOut />
    </DashboardTemplate>
  );
}
