import { useState } from "react";
import { Dialog, Flex, Portal } from "@chakra-ui/react";
import { LogIn } from "lucide-react";
import { FirebaseError } from "firebase/app";
import type { OAuthCredential, User } from "firebase/auth";
import { linkGoogleAccount, switchToExistingAccount } from "@/auth/auth";
import { Button, notify } from "@/components/primitives";
import { useProfile } from "@/profile/useProfile";
import { countExercises, discardGuestData, mergeGuestData, syncProfile } from "@/utils/profile";

/** A Google account that already exists, waiting on the user's choice. */
type Conflict = {
  credential: OAuthCredential;
  counts: { history: number; library: number };
};

type Choice = "merge" | "discard";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * "Continue with Google": offers a guest a permanent account. Shown only while
 * `user.isAnonymous`; once linked, onIdTokenChanged re-renders the page without it.
 * How it went is said in a notice.
 *
 * A brand-new Google account simply takes over the guest's exercises. An
 * existing one already has its own, so the user chooses whether to bring the
 * guest's along or discard them.
 */
export default function LinkGoogleAccount({ user }: { readonly user: User }) {
  const { refresh } = useProfile();
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [choosing, setChoosing] = useState<Choice | null>(null);

  const handleLink = async () => {
    setBusy(true);

    try {
      const result = await linkGoogleAccount(user);
      if (result.status === "cancelled") return;

      if (result.status === "linked") {
        // Same uid, so the rows never moved -- only the profile fields changed.
        await syncProfile(result.user);
        // linkWithPopup keeps the same User object, so the provider won't
        // refetch on its own -- and its fetch would race the sync anyway.
        await refresh(result.user);
        notify({
          tone: "success",
          title: "Account linked",
          description: "Your practice history came with you.",
        });
        return;
      }

      // Nothing to lose, so there's nothing to ask: switch and retire the guest.
      const counts = await countExercises(user);
      if (counts.history + counts.library === 0) {
        await switchAndResolve(result.credential, "discard");
        notify({ tone: "success", title: "Signed in to your existing account" });
        return;
      }
      setConflict({ credential: result.credential, counts });
    } catch (err) {
      console.error("Link account error:", err);
      notify({
        tone: "error",
        title: "Couldn't link your account",
        description:
          err instanceof FirebaseError && err.code === "auth/popup-blocked"
            ? "Your browser blocked the popup. Allow popups for this site and try again."
            : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const switchAndResolve = async (credential: OAuthCredential, choice: Choice) => {
    const { user: next, guestToken } = await switchToExistingAccount(user, credential);
    const moved =
      choice === "merge"
        ? await mergeGuestData(next, guestToken)
        : await discardGuestData(next, guestToken);
    await syncProfile(next);
    // Pass `next` explicitly: `refresh` still closes over the guest user.
    await refresh(next);
    return moved;
  };

  const handleChoice = async (choice: Choice) => {
    if (!conflict) return;
    setBusy(true);
    setChoosing(choice);

    try {
      const moved = await switchAndResolve(conflict.credential, choice);
      setConflict(null);
      notify({
        tone: "success",
        title: "Signed in",
        description: moved
          ? `Moved ${plural(moved.history, "generated exercise")} and ${plural(moved.library, "saved exercise")} across.`
          : "Your guest exercises were discarded.",
      });
    } catch (err) {
      console.error("Resolve guest data error:", err);
      setConflict(null);
      notify({
        tone: "error",
        title: "Couldn't switch accounts",
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setBusy(false);
      setChoosing(null);
    }
  };

  return (
    <>
      <Button variant="primary" size="sm" onClick={handleLink} disabled={busy && !conflict}>
        <LogIn />
        {busy && !conflict ? "Signing in…" : "Continue with Google"}
      </Button>

      <Dialog.Root
        role="alertdialog"
        placement="center"
        open={conflict !== null}
        // Dismissing is the same as Cancel: stay a guest. Not mid-switch, though.
        onOpenChange={(e) => {
          if (!e.open && !busy) setConflict(null);
        }}
        closeOnInteractOutside={!busy}
        closeOnEscape={!busy}
      >
        <Portal>
          <Dialog.Backdrop bg="bg.backdrop" />
          <Dialog.Positioner px="md">
            <Dialog.Content maxWidth="460px" p="lg" gap="md" borderWidth="1px" borderColor="border">
              <Dialog.Title textStyle="heading.md">This Google account already exists</Dialog.Title>
              {conflict && (
                <Dialog.Description textStyle="body" color="fg.muted">
                  As a guest you have {plural(conflict.counts.history, "generated exercise")} and{" "}
                  {plural(conflict.counts.library, "saved exercise")}. Bring them into your Google
                  account, or discard them? Discarded exercises can't be recovered.
                </Dialog.Description>
              )}
              <Flex justify="flex-end" gap="sm" mt="sm" wrap="wrap">
                <Button onClick={() => setConflict(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => handleChoice("discard")} disabled={busy}>
                  {choosing === "discard" ? "Discarding…" : "Discard them"}
                </Button>
                <Button variant="primary" onClick={() => handleChoice("merge")} disabled={busy}>
                  {choosing === "merge" ? "Bringing them…" : "Bring them with me"}
                </Button>
              </Flex>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
