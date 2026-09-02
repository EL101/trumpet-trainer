import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import type { LibraryEntry } from "@/schema";

export function useLibrary(userId: string) {
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const libraryRef = collection(db, "users", userId, "library");
    const q = query(libraryRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLibrary(snapshot.docs.map((doc) => doc.data() as LibraryEntry));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  return { library, loading };
}
