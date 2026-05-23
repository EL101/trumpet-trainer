import { Button, chakra } from "@chakra-ui/react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@chakra-ui/react";
import { FcGoogle } from "react-icons/fc";

export default function SignInWithGoogle() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/dashboard";

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("Signed in:", user.displayName, user.email);
      navigate(from, { replace: true });
    } catch (error) {
      if (error.code === "auth/popup-closed-by-user") {
        return;
      }
      console.error("Sign-in error:", error);
    }
  };

  return (
    <Button
      onClick={handleGoogleSignIn}
      _hover={{ bgColor: "gray.200" }}
      border="1px solid black"
      p="1rem 3rem"
    >
      <Icon as={FcGoogle} boxSize={5} />
      <chakra.span>Continue with Google</chakra.span>
    </Button>
  );
}
