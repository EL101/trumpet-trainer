import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import type { MusicInfo } from "@/pages/Generate";
import type { LibraryEntry } from "@/pages/Library";

export function useLibrary(userId: string) {
  const [library, setLibrary] = useState<MusicInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const libraryRef = collection(db, "users", userId, "library");
    const q = query(libraryRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exercises = snapshot.docs.map((doc) => doc.data());
      setLibrary(exercises as LibraryEntry[]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  return { library, loading };
}
