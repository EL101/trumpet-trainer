import { useRef, useState } from "react";
import { Box, Button, Flex, Spinner, Text, chakra } from "@chakra-ui/react";
import type { User } from "firebase/auth";
import UserAvatar from "./UserAvatar";
import { useProfile } from "@/profile/useProfile";
import { AvatarImageError, fileToAvatarDataUrl } from "@/utils/image";
import { removeAvatar, uploadAvatar } from "@/utils/profile";

const ACCEPT = "image/png,image/jpeg,image/webp";

/** The profile picture, click-to-change. */
export default function AvatarUpload({ user }: { readonly user: User }) {
  const { profile, applyAvatar, refresh } = useProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear immediately, or picking the same file twice won't fire onChange.
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const result = await uploadAvatar(user, await fileToAvatarDataUrl(file));
      if (result) applyAvatar(result.avatarUrl, result.hasUpload);
    } catch (err) {
      console.error("avatar upload error:", err);
      setError(
        err instanceof AvatarImageError ? err.message : "Couldn't save that picture. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeAvatar(user);
      // Refetch rather than clearing locally: dropping an upload reveals the
      // provider photo underneath, which only the server knows about.
      await refresh();
    } catch (err) {
      console.error("avatar remove error:", err);
      setError("Couldn't remove that picture. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Flex direction="column" gap={2} align="flex-start">
      <Box position="relative">
        <chakra.button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          borderRadius="100%"
          cursor={busy ? "default" : "pointer"}
          aria-label="Change profile picture"
          _hover={{ "& .avatar-overlay": { opacity: 1 } }}
          _focusVisible={{ outline: "2px solid", outlineColor: "blue.500", outlineOffset: "2px" }}
        >
          <UserAvatar
            size={120}
            src={profile?.avatarUrl}
            name={profile?.displayName}
            isGuest={profile?.isAnonymous}
          />
          <Flex
            className="avatar-overlay"
            position="absolute"
            inset={0}
            borderRadius="100%"
            bg="blackAlpha.600"
            color="white"
            align="center"
            justify="center"
            opacity={busy ? 1 : 0}
            transition="opacity 0.15s"
            pointerEvents="none"
          >
            {busy ? <Spinner size="sm" /> : <Text fontSize="sm">Change</Text>}
          </Flex>
        </chakra.button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFile}
          style={{ display: "none" }}
        />
      </Box>

      {profile?.hasUpload && (
        <Button
          variant="plain"
          size="sm"
          onClick={handleRemove}
          disabled={busy}
          p={0}
          height="auto"
        >
          Remove picture
        </Button>
      )}
      {error && <Text color="red.600">{error}</Text>}
    </Flex>
  );
}
