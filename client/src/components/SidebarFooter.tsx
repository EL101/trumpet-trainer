import { Flex, Heading, Separator, type FlexProps } from "@chakra-ui/react";
import { NavLink } from "react-router-dom";
import { useProfile } from "@/profile/useProfile";
import UserAvatar from "./UserAvatar";

export function SidebarFooter(props: FlexProps) {
  const { profile } = useProfile();
  const displayName = profile?.isAnonymous ? "Guest" : profile?.displayName;

  return (
    <Flex direction="column" gap={1} {...props}>
      <Separator borderColor="gray.500" size="lg" />
      <NavLink to="/profile">
        <Flex
          align="center"
          gap={3}
          borderRadius="4px"
          p="4px"
          transition="backgrounds"
          _hover={{ bg: "gray.200" }}
        >
          <UserAvatar
            size={35}
            src={profile?.avatarUrl}
            name={profile?.displayName}
            isGuest={profile?.isAnonymous}
          />
          <Flex direction="column" gap={2}>
            <Heading size="md">{displayName}</Heading>
          </Flex>
        </Flex>
      </NavLink>
    </Flex>
  );
}
