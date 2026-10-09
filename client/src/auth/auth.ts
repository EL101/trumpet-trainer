import { auth } from "../firebase.ts";
import {
  GoogleAuthProvider,
  linkWithPopup,
  signInWithCredential,
  type OAuthCredential,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";

export type LinkResult =
  /** The popup was dismissed; nothing changed. */
  | { status: "cancelled" }
  /** The guest uid was upgraded in place, so its rows already belong to it. */
  | { status: "linked"; user: User }
  /**
   * The Google account already exists, so the guest can't be upgraded in place.
   * Nothing has changed yet: the guest is still signed in, and the caller decides
   * what happens to their exercises before calling switchToExistingAccount.
   */
  | { status: "conflict"; credential: OAuthCredential };

/**
 * Turn a guest into a real account without losing their exercises.
 *
 * linkWithPopup keeps the same uid, so every history and library row follows
 * automatically. That fails when the Google account is already a Firebase user,
 * since a uid can't absorb another -- then the guest's rows have to be merged or
 * discarded by hand, which is the user's call (see switchToExistingAccount).
 */
export async function linkGoogleAccount(user: User): Promise<LinkResult> {
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
      return { status: "conflict", credential };
    }

    throw err;
  }
}

/**
 * Leave the guest for the existing Google account behind `credential`.
 *
 * Returns the new user plus the guest's ID token, read while the guest is still
 * signed in: after the switch it is the only proof the caller controlled the
 * guest, which the server needs to merge or discard its rows. Reading it here,
 * rather than when the popup closed, keeps it fresh however long the user spent
 * deciding.
 */
export async function switchToExistingAccount(guest: User, credential: OAuthCredential) {
  const guestToken = await guest.getIdToken();
  const result = await signInWithCredential(auth, credential);
  return { user: result.user, guestToken };
}

export const signOut = async () => {
  await auth.signOut();
};
