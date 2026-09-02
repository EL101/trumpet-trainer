import { Button } from "@chakra-ui/react";
import { useContext, useEffect, useState } from "react";
import { AuthUserContext } from "@/auth/AuthUserContext";
import { getInitialLibrary, saveToLibrary } from "@/utils/library";
import type { MusicInfo } from "@/schema";

type SaveButtonProps = {
  disabled: boolean;
  generated: MusicInfo;
};

export default function SaveButton({ disabled, generated, ...props }: SaveButtonProps) {
  const { user } = useContext(AuthUserContext);
  const [saved, setSaved] = useState<MusicInfo[]>([]);

  const alreadySaved = saved.some((item) => item.generationNum === generated.generationNum);

  useEffect(() => getInitialLibrary(user, setSaved), [user]);

  const handleSaveClick = async () => {
    try {
      if (await saveToLibrary(generated, user)) {
        setSaved((prev) => [...prev, generated]);
      }
    } catch (error) {
      console.error("update library error:", error);
    }
  };

  return (
    <Button
      bgColor="gray.300"
      color="black"
      fontWeight="600"
      width="8rem"
      disabled={disabled || alreadySaved}
      _hover={{ bgColor: "gray.400" }}
      transition="backgrounds"
      onClick={handleSaveClick}
      {...props}
    >
      Save to Library
    </Button>
  );
}
