import { AuthUserContext } from "@/auth/AuthUserContext";
import { Box, Flex, Heading, Separator, type FlexProps } from "@chakra-ui/react";
import { useContext } from "react";
import { NavLink } from "react-router-dom";

export function SidebarFooter(props: FlexProps) {
  const { user } = useContext(AuthUserContext);
  const displayName = user?.isAnonymous ? "Guest" : user?.displayName;

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
          <Box borderRadius="100%" borderWidth={2} borderColor="gray.700" width={35} height={35} />
          <Flex direction="column" gap={2}>
            <Heading size="md">{displayName}</Heading>
          </Flex>
        </Flex>
      </NavLink>
    </Flex>
  );
}
