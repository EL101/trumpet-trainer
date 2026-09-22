import { useState } from "react";
import { Button, Flex, Icon, Text, chakra } from "@chakra-ui/react";
import { FcGoogle } from "react-icons/fc";
import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import { linkGoogleAccount } from "@/auth/auth";
import { mergeGuestData, syncProfile } from "@/utils/profile";

/**
 * Offers a guest a permanent account. Shown only while `user.isAnonymous`;
 * once linked, onIdTokenChanged re-renders the page without it.
 */
export default function LinkGoogleAccount({ user }: { readonly user: User }) {
  const [busy, setBusy] = useState(false);
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

      // The Google account already existed, so the guest's rows have to be
      // carried across before the guest account is retired.
      const moved = await mergeGuestData(result.user, result.guestToken);
      await syncProfile(result.user);
      setMessage(
        moved
          ? `Signed in. Moved ${moved.history} generated and ${moved.library} saved exercise(s) across.`
          : "Signed in to your existing account.",
      );
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

  return (
    <Flex direction="column" gap={2} align="flex-start">
      <Text color="gray.600">
        You're practising as a guest. Link a Google account to keep your history.
      </Text>
      <Button
        onClick={handleLink}
        loading={busy}
        _hover={{ bgColor: "gray.200" }}
        border="1px solid black"
        p="1rem 3rem"
      >
        <Icon as={FcGoogle} boxSize={5} />
        <chakra.span>Link Google account</chakra.span>
      </Button>
      {message && <Text color="green.700">{message}</Text>}
      {error && <Text color="red.600">{error}</Text>}
    </Flex>
  );
}
