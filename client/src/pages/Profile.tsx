import { Heading, Spinner, Text } from "@chakra-ui/react";
import DashboardTemplate from "../components/DashBoardTemplate";
import SignOut from "../components/SignOut";
import LinkGoogleAccount from "../components/LinkGoogleAccount";
import AvatarUpload from "../components/AvatarUpload";
import { useAuth } from "@/auth/useAuth";
import { useProfile } from "@/profile/useProfile";

export default function Profile() {
  const { user } = useAuth();
  const { profile, loading } = useProfile();

  if (!user || loading) return <DashboardTemplate>{<Spinner size="xl" />}</DashboardTemplate>;

  const name = profile?.isAnonymous ? "Guest" : (profile?.displayName ?? "Profile");

  return (
    <DashboardTemplate>
      <AvatarUpload user={user} />
      <Heading size="2xl">{name}</Heading>
      {profile?.email ? (
        <Text color="gray.600">{profile.email}</Text>
      ) : (
        <Text color="gray.600">No email on this account</Text>
      )}
      {profile?.isAnonymous && <LinkGoogleAccount user={user} />}
      <SignOut />
    </DashboardTemplate>
  );
}
