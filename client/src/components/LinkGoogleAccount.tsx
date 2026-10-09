import { useState } from "react";
import { Button, Dialog, Flex, Icon, Portal, Text, chakra } from "@chakra-ui/react";
import { FcGoogle } from "react-icons/fc";
import { FirebaseError } from "firebase/app";
import type { OAuthCredential, User } from "firebase/auth";
import { linkGoogleAccount, switchToExistingAccount } from "@/auth/auth";
import { countExercises, discardGuestData, mergeGuestData, syncProfile } from "@/utils/profile";

/** A Google account that already exists, waiting on the user's choice. */
type Conflict = {
  credential: OAuthCredential;
  counts: { history: number; library: number };
};

type Choice = "merge" | "discard";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Offers a guest a permanent account. Shown only while `user.isAnonymous`;
 * once linked, onIdTokenChanged re-renders the page without it.
 *
 * A brand-new Google account simply takes over the guest's exercises. An
 * existing one already has its own, so the user chooses whether to bring the
 * guest's along or discard them.
 */
export default function LinkGoogleAccount({ user }: { readonly user: User }) {
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [choosing, setChoosing] = useState<Choice | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLink = async () => {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const result = await linkGoogleAccount(user);
      if (result.status === "cancelled") return;

      if (result.status === "linked") {
        // Same uid, so the rows never moved -- only the profile fields changed.
        await syncProfile(result.user);
        setMessage("Account linked. Your practice history came with you.");
        return;
      }

      // Nothing to lose, so there's nothing to ask: switch and retire the guest.
      const counts = await countExercises(user);
      if (counts.history + counts.library === 0) {
        await switchAndResolve(result.credential, "discard");
        setMessage("Signed in to your existing account.");
        return;
      }
      setConflict({ credential: result.credential, counts });
    } catch (err) {
      console.error("Link account error:", err);
      setError(
        err instanceof FirebaseError && err.code === "auth/popup-blocked"
          ? "Your browser blocked the popup. Allow popups for this site and try again."
          : "Couldn't link your account. Please try again.",
      );
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
    return moved;
  };

  const handleChoice = async (choice: Choice) => {
    if (!conflict) return;
    setBusy(true);
    setChoosing(choice);
    setError(null);

    try {
      const moved = await switchAndResolve(conflict.credential, choice);
      setConflict(null);
      setMessage(
        moved
          ? `Signed in. Moved ${plural(moved.history, "generated exercise")} and ${plural(moved.library, "saved exercise")} across.`
          : "Signed in. Your guest exercises were discarded.",
      );
    } catch (err) {
      console.error("Resolve guest data error:", err);
      setConflict(null);
      setError("Something went wrong switching accounts. Please try again.");
    } finally {
      setBusy(false);
      setChoosing(null);
    }
  };

  return (
    <Flex direction="column" gap={2} align="flex-start">
      <Text color="gray.600">
        You're practicing as a guest. Link a Google account to keep your history.
      </Text>
      <Button
        onClick={handleLink}
        loading={busy && !conflict}
        _hover={{ bgColor: "gray.200" }}
        border="1px solid black"
        p="1rem 3rem"
      >
        <Icon as={FcGoogle} boxSize={5} />
        <chakra.span>Link Google account</chakra.span>
      </Button>
      {message && <Text color="green.700">{message}</Text>}
      {error && <Text color="red.600">{error}</Text>}

      <Dialog.Root
        open={conflict !== null}
        // Dismissing is the same as Cancel: stay a guest. Not mid-switch, though.
        onOpenChange={(e) => {
          if (!e.open && !busy) setConflict(null);
        }}
        closeOnInteractOutside={!busy}
        closeOnEscape={!busy}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content py={3} px={4} mt={2}>
              <Dialog.Header>
                <Dialog.Title>This Google account already exists</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                {conflict && (
                  <Text>
                    As a guest you have {plural(conflict.counts.history, "generated exercise")} and{" "}
                    {plural(conflict.counts.library, "saved exercise")}. Bring them into your Google
                    account, or discard them? Discarded exercises can't be recovered.
                  </Text>
                )}
              </Dialog.Body>
              <Dialog.Footer mt={2} flexWrap="wrap">
                <Button
                  variant="outline"
                  onClick={() => setConflict(null)}
                  disabled={busy}
                  px={4}
                  height="auto"
                  py={2}
                >
                  Cancel
                </Button>
                <Button
                  bg="red.500"
                  color="white"
                  onClick={() => handleChoice("discard")}
                  loading={choosing === "discard"}
                  disabled={busy}
                  px={4}
                  height="auto"
                  py={2}
                >
                  Discard them
                </Button>
                <Button
                  colorPalette="blue"
                  onClick={() => handleChoice("merge")}
                  loading={choosing === "merge"}
                  disabled={busy}
                  px={4}
                  height="auto"
                  py={2}
                  fontWeight="bold"
                >
                  Bring them with me
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Flex>
  );
}
