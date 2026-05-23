import { useAuth } from "@/auth/useAuth";
import { signOut } from "@/auth/auth";
import { Button } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

export default function SignOut() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const handleClick = async () => {
    if (user) {
      await signOut();
      navigate("/");
    }
  };
  return (
    <Button onClick={handleClick} p="1rem 2rem">
      Sign Out
    </Button>
  );
}
