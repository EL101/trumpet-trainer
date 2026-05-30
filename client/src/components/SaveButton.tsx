import { Button } from "@chakra-ui/react";
import { AuthUserContext } from "@/auth/AuthUserContext";
import { useContext } from "react";
import type { MusicInfo } from "@/pages/Generate";

export default function SaveButton({
  disabled,
  generated,
  ...props
}: {
  disabled: boolean;
  generated: MusicInfo;
}) {
  const { user } = useContext(AuthUserContext);

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
