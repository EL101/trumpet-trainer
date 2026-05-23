import { Box, Container, Flex, Heading } from "@chakra-ui/react";
import { AuthUserContext } from "../auth/AuthUserContext";
import { useContext } from "react";
import SignOut from "./SignOut";
import Sidebar from "./Sidebar";

export default function Dashboard() {
  const { user } = useContext(AuthUserContext);
  const displayName = user.isAnonymous ? "Guest" : user.displayName;

  return (
    <Box height="100vh" bgColor="white" color="black">
      <Flex height="100%" width="100%">
        <Sidebar flex="1"></Sidebar>
        <Container flex="3">
          <Heading>Hello {displayName}</Heading>
          <SignOut />
        </Container>
      </Flex>
    </Box>
  );
}
