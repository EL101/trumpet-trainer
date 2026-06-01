import { Button } from "@chakra-ui/react";
import { AuthUserContext } from "@/auth/AuthUserContext";
import { useContext, type ReactNode } from "react";
import type { MusicInfo } from "@/pages/Generate";

type SaveButtonProps = {
  disabled: boolean,
  generated: MusicInfo,
  props?: ReactNode | undefined
}
export default function SaveButton({
  disabled,
  generated,
  ...props
}: SaveButtonProps) {
  const { user } = useContext(AuthUserContext);
  if (!user) console.log("no user");
  if (!generated) console.log("no generated");
  const handleSaveClick = async () => {
    
  };

  return (
    <Button
      bgColor="gray.300"
      color="black"
      fontWeight="600"
      width="8rem"
      disabled={disabled}
      _hover={{ bgColor: "gray.400" }}
      transition="backgrounds"
      onClick={handleSaveClick}
      {...props}
    >
      Save to Library
    </Button>
  );
}
