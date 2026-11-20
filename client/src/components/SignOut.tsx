import { useAuth } from "@/auth/useAuth";
import { signOut } from "@/auth/auth";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/primitives";

/** Sign out and go back to the landing page. */
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
    <Button variant="ghost" size="sm" onClick={handleClick}>
      <LogOut />
      Sign out
    </Button>
  );
}
