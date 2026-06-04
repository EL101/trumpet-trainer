import { Button } from "@chakra-ui/react";
import { AuthUserContext } from "@/auth/AuthUserContext";
import { useContext, useEffect, useState, type ReactNode } from "react";
import type { MusicInfo } from "@/pages/Generate";
import { getInitialLibrary } from "@/utils/library";

type SaveButtonProps = {
  disabled: boolean;
  generated: MusicInfo;
  props?: ReactNode | undefined;
};
export default function SaveButton({ disabled, generated, ...props }: SaveButtonProps) {
  const { user } = useContext(AuthUserContext);
  if (!user) console.log("no user");
  if (!generated) console.log("no generated");
  const [saved, setSaved] = useState<MusicInfo[]>([]);
  const newDisabled = disabled || saved.some(item => item.generationNum === generated.generationNum);

  const handleSaveClick = async () => {
    try {
      if (!user) return;
      const token = await user?.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/library`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          notes: generated.notes,
          timeSig: generated.timeSig,
          musicKey: generated.musicKey,
          noteRange: generated.range,
          difficulty: generated.difficulty,
          generationNum: generated.generationNum,
        }),
      });
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      setSaved([...saved, generated]);
    } catch (error) {
      console.log("update library error: ", error);
    }
  };

  useEffect(() => {
    getInitialLibrary(user, setSaved);
  }, [user]);

  return (
    <Button
      bgColor="gray.300"
      color="black"
      fontWeight="600"
      width="8rem"
      disabled={newDisabled}
      _hover={{ bgColor: "gray.400" }}
      transition="backgrounds"
      onClick={handleSaveClick}
      {...props}
    >
      Save to Library
    </Button>
  );
}
