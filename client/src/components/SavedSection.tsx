import { AuthUserContext } from "@/auth/AuthUserContext";
import type { MusicInfo } from "@/schema";
import { useState, useContext, useEffect } from "react";
import { SheetMusic } from "./SheetMusic";
import { getInitialLibrary } from "@/utils/library";
import { Grid } from "@chakra-ui/react";

export default function SavedSection() {
  const [saved, setSaved] = useState<MusicInfo[]>([]);
  const { user } = useContext(AuthUserContext);

  useEffect(() => getInitialLibrary(user, setSaved), [user]);

  return (
    <Grid templateColumns="repeat(auto-fit, minmax(400px, 1fr))" gap={2}>
      {saved.map((item) => (
        <SheetMusic
          key={item.id}
          notes={item.notes}
          timeSig={item.timeSig}
          musicKey={item.musicKey}
        />
      ))}
    </Grid>
  );
}
