import { Button } from "@chakra-ui/react";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { AuthUserContext } from "@/auth/AuthUserContext";
import { useContext, useEffect, useState } from "react";
import type { MusicInfo } from "@/pages/Generate";
import { useLibrary } from "@/hooks/useLibrary";

export default function SaveButton({
  disabled,
  generated,
  ...props
}: {
  disabled: boolean;
  generated: MusicInfo;
}) {
  const { user } = useContext(AuthUserContext);
  const { library, loading } = useLibrary(user.uid);
  const newDisabled = disabled || library.some((e) => e.id === generated.id);

  const handleSaveClick = async () => {
    if (newDisabled) return;
    const ref = collection(db, "users", user.uid, "library");
    const newDocRef = doc(ref); // generates an ID without creating the doc
    // const snapshot = await getDocs(ref);
    // const deletes = snapshot.docs.map(doc => deleteDoc(doc.ref));
    // await Promise.all(deletes);
    await setDoc(newDocRef, {
      ...generated,
      docId: generated.id,
      createdAt: new Date().toISOString(),
    });
  };

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
