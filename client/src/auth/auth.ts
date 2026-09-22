import { auth } from "../firebase.ts";
import { GoogleAuthProvider, linkWithPopup, signInWithCredential, type User } from "firebase/auth";
import { FirebaseError } from "firebase/app";

export type LinkResult =
  /** The popup was dismissed; nothing changed. */
  | { status: "cancelled" }
  /** The guest uid was upgraded in place, so its rows already belong to it. */
  | { status: "linked"; user: User }
  /** Signed in as a pre-existing Google account; the guest's rows must follow. */
  | { status: "merged"; user: User; guestToken: string };

/**
 * Turn a guest into a real account without losing their exercises.
 *
 * linkWithPopup keeps the same uid, so every history and library row follows
 * automatically. That fails when the Google account is already a Firebase user,
 * since a uid can't absorb another -- then the only option is to sign in as the
 * real account and hand the server the guest's token so it can move the rows.
 */
export async function linkGoogleAccount(user: User): Promise<LinkResult> {
  // Read this before anything can swap the current user out. On the merge path
  // it is the caller's only remaining proof that they controlled the guest.
  const guestToken = await user.getIdToken();
  const provider = new GoogleAuthProvider();

  try {
    const result = await linkWithPopup(user, provider);
    // Force a fresh token so the linked identity reaches onIdTokenChanged and
    // the rest of the app stops treating this session as a guest.
    await result.user.getIdToken(true);
    return { status: "linked", user: result.user };
  } catch (err) {
    if (!(err instanceof FirebaseError)) throw err;

    if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
      return { status: "cancelled" };
    }

    if (err.code === "auth/credential-already-in-use" || err.code === "auth/email-already-in-use") {
      const credential = GoogleAuthProvider.credentialFromError(err);
      if (!credential) throw err;
      const result = await signInWithCredential(auth, credential);
      return { status: "merged", user: result.user, guestToken };
    }

    throw err;
  }
}

export const signOut = async () => {
  await auth.signOut();
};
