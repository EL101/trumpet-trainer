import { useRef, useState } from "react";
import { Box, Button, Dialog, Flex, Portal, Spinner, Text, chakra } from "@chakra-ui/react";
import { LuTrash2, LuUpload } from "react-icons/lu";
import type { User } from "firebase/auth";
import UserAvatar from "./UserAvatar";
import { useProfile } from "@/profile/useProfile";
import { AvatarImageError, fileToAvatarDataUrl } from "@/utils/image";
import { removeAvatar, uploadAvatar } from "@/utils/profile";

const ACCEPT = "image/png,image/jpeg,image/webp";

/** The profile picture; clicking it opens a dialog to upload or remove one. */
export default function AvatarUpload({ user }: { readonly user: User }) {
  const { profile, applyAvatar, refresh } = useProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
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
      setOpen(false);
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
      setOpen(false);
    } catch (err) {
      console.error("avatar remove error:", err);
      setError("Couldn't remove that picture. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (profile?.isAnonymous) {
    return <UserAvatar size={120} isGuest />;
  }

  return (
    <Box>
      {/* The overlay is positioned against the button, not the Box: the button
          is inline by default, so the Box's line box adds a few pixels of
          descender space below it and an `inset: 0` overlay spills out there. */}
      <chakra.button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={busy}
        position="relative"
        display="block"
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

      <Dialog.Root
        open={open}
        onOpenChange={(e) => {
          if (!busy) setOpen(e.open);
        }}
        placement="center"
        size="xs"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content py={3} px={4}>
              <Dialog.Header>
                <Dialog.Title>Profile picture</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Flex direction="column" align="center" gap={3} mt={2}>
                  <UserAvatar size={96} src={profile?.avatarUrl} name={profile?.displayName} />
                  <Button
                    width="full"
                    colorPalette="blue"
                    onClick={() => inputRef.current?.click()}
                    loading={busy}
                  >
                    <LuUpload />
                    Upload new picture
                  </Button>
                  {profile?.hasUpload && (
                    <Button
                      width="full"
                      variant="outline"
                      colorPalette="red"
                      onClick={handleRemove}
                      disabled={busy}
                    >
                      <LuTrash2 />
                      Remove picture
                    </Button>
                  )}
                  {error && (
                    <Text color="red.600" fontSize="sm" textAlign="center">
                      {error}
                    </Text>
                  )}
                </Flex>
              </Dialog.Body>
              <Dialog.Footer mt={3}>
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                  Cancel
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
}
