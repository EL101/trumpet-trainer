import { Box, Heading } from "@chakra-ui/react"
import { AuthUserContext } from "../auth/AuthUserContext" 
import { useContext } from "react";
import SignOut from "./SignOut";

export default function Dashboard() {
  const {user} = useContext(AuthUserContext);
  const displayName = user.isAnonymous ? "Guest" : user.displayName;

  return (
    <Box height="100%">
      <Heading bgColor = "white" color="black">Hello {displayName}</Heading>
      <SignOut/>
    </Box>
  );
}