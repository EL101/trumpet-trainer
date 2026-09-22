import DashboardTemplate from "../components/DashBoardTemplate";
import SignOut from "../components/SignOut";
import LinkGoogleAccount from "../components/LinkGoogleAccount";
import { Heading, Text } from "@chakra-ui/react";
import { useAuth } from "@/auth/useAuth";

export default function Profile() {
  const { user } = useAuth();

  return (
    <DashboardTemplate>
      <Heading size="2xl">{user?.isAnonymous ? "Guest" : (user?.displayName ?? "Profile")}</Heading>
      {user?.email && <Text color="gray.600">{user.email}</Text>}
      {user?.isAnonymous && <LinkGoogleAccount user={user} />}
      <SignOut />
    </DashboardTemplate>
  );
}
