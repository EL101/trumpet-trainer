import { signInAnonymously } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { Button } from "@chakra-ui/react";

export default function SignInAsGuest() {
  const navigate = useNavigate();

  const handleGuest = async () => {
    try {
      await signInAnonymously(auth);
      navigate("/dashboard");
    } catch (error) {
      console.error("Guest sign-in failed:", error);
    }
  };

  return <Button onClick={handleGuest} _hover={{ bgColor: "gray.200" }} border="1px solid black" p="1rem 3rem" >Continue as Guest</Button>;
}