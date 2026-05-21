import './LandingPage.css'
import { Container, Heading, Flex, Text, Separator, Center, Button } from "@chakra-ui/react"
import { Prose } from "@/components/ui/prose"
import { useNavigate } from 'react-router-dom';

function GuestButton() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate("/test");
  }

  return (
    <Button 
      onClick={handleClick} 
      border="1px solid black" 
      p="1rem 3rem" 
      _hover={{bgColor: "gray.200"}}>
        Continue as Guest
    </Button>
  );
}

function LeftPanel() {
  return (
    <Container bgColor = "white" color = "black" height="100%" p="3rem 4rem 1rem 4rem" borderRight="1px solid black">
      <Heading size="3xl" mb="17rem">Trumpet Trainer</Heading>
      <Heading size="6xl" mb="3rem">Practice with Interactive Exercises and Live Feedback.</Heading>
      <Prose color="gray.500">Generated exercises • Pitch + rhythm scoring • Progress saved across sessions</Prose>
      <Container>EXAMPLE IMAGES GOES HERE</Container>
    </Container>
  );
}

function RightPanel() {
  return (
    <Container bgColor = "white" color = "black" height="100%" p="3rem 4rem 1rem 4rem">
      <Flex direction="column" height="100%">
        <Heading size="4xl" mb="2rem">Sign in</Heading>
        <Flex direction="column" align="center" width="100%" flex="1" justifyContent="center">
          <Heading size="3xl">OAUTH</Heading>
          <Flex align="center" gap={4} opacity="0.5" m="2rem auto">
            <Separator flex="1" borderColor="gray.500" />
            <Text fontSize="sm" fontWeight="semibold" letterSpacing="wider">
              OR
            </Text>
            <Separator flex="1" borderColor="gray.500" />
          </Flex>
          <GuestButton/>
        </Flex>
      </Flex>
    </Container>
  );
}
export default function LandingPage() {

  return (
    <Flex height="100vh">
      <LeftPanel/>
      <RightPanel/>
    </Flex>
  );
}

