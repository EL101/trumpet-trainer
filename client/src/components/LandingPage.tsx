import { Container, Heading, Flex, Text, Separator, Box, Spinner } from "@chakra-ui/react";
import { Prose } from "@/components/ui/prose";
import SignInWithGoogle from "./SignInWithGoogle";
import SignInAsGuest from "./SignInAsGuest";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";

function LeftPanel() {
  return (
    <Box
      p={{ base: "2rem 1.5rem", md: "3rem 4rem 1rem 3rem" }}
      flex={{ base: "0 1 auto", md: "1" }}
      bgColor="white"
      color="black"
      height="100%"
      borderRightWidth={{ base: "none", md: "1px" }}
      borderRightColor={{ base: "none", md: "gray.400" }}
    >
      <Flex direction="column" gap={{ base: "2rem", md: "14rem" }} height="100%">
        <Heading size={{ base: "2xl", md: "3xl" }}>🎺 Trumpet Trainer</Heading>
        <Flex direction="column" gap={{ base: "1rem", md: "2rem" }}>
          <Heading size={{ base: "4xl", md: "5xl", lg: "6xl" }}>
            Practice with Interactive Exercises and Live Feedback.
          </Heading>
          <Prose color="gray.500">
            Generated exercises • Pitch + rhythm scoring • Progress saved across sessions
          </Prose>
          <Container display={{ base: "none", md: "block" }}>EXAMPLE IMAGES GOES HERE</Container>
        </Flex>
      </Flex>
    </Box>
  );
}

function RightPanel() {
  return (
    <Box
      flex={{ base: "0 1 auto", md: "1" }}
      bgColor="white"
      color="black"
      height="100%"
      p={{ base: "0 4rem 1rem 3rem", md: "3rem 4rem 1rem 3rem" }}
    >
      <Flex direction="column" height="100%" gap={{ base: "4rem", md: "15rem" }}>
        <Heading size={{ base: "2xl", md: "4xl" }} textAlign={{ base: "center", md: "left" }}>
          Sign in
        </Heading>
        <Flex direction="column" align="center" width="100%">
          <SignInWithGoogle />
          <Flex align="center" gap={4} opacity="0.5" m="2rem auto" width="100%">
            <Separator flex="1" borderColor="gray.500" />
            <Text fontSize="sm" fontWeight="semibold" letterSpacing="wider">
              OR
            </Text>
            <Separator flex="1" borderColor="gray.500" />
          </Flex>
          <SignInAsGuest />
        </Flex>
      </Flex>
    </Box>
  );
}
export default function LandingPage() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <Flex height="100vh" direction={{ base: "column", md: "row" }}>
      <LeftPanel />
      <RightPanel />
    </Flex>
  );
}
