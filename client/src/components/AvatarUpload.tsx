import { useRef, useState } from "react";
import { Box, Dialog, Flex, Portal, Text } from "@chakra-ui/react";
import { Camera, Trash2, Upload } from "lucide-react";
import type { User } from "firebase/auth";
import { Button, IconButton } from "@/components/primitives";
import UserAvatar from "./UserAvatar";
import { useProfile } from "@/profile/useProfile";
import { AvatarImageError, fileToAvatarDataUrl } from "@/utils/image";
import { removeAvatar, uploadAvatar } from "@/utils/profile";

const ACCEPT = "image/png,image/jpeg,image/webp";
/** The portrait's size inside its accent ring. */
const SIZE = 116;

/**
 * The profile picture in an accent ring, as the profile's bookplate frames it. Signed-in
 * users get a button on the ring that opens a dialog to upload or remove one; guests
 * can't upload, so theirs is just the initial.
 */
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

  const guest = profile?.isAnonymous ?? false;
  const avatar = (
    <UserAvatar size={SIZE} src={profile?.avatarUrl} name={profile?.displayName} isGuest={guest} />
  );

  return (
    <Box
      position="relative"
      flexShrink={0}
      borderRadius="full"
      borderWidth="1px"
      borderColor="accent.solid"
      p="5px"
      width="fit-content"
    >
      {avatar}
      {!guest && (
        <>
          <IconButton
            aria-label="Change profile picture"
            variant="primary"
            size="sm"
            position="absolute"
            right="-4px"
            bottom="0"
            borderRadius="full"
            bg="bg"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
          >
            <Camera />
          </IconButton>
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
          >
            <Portal>
              <Dialog.Backdrop bg="bg.backdrop" />
              <Dialog.Positioner px="md">
                <Dialog.Content
                  maxWidth="360px"
                  p="lg"
                  gap="md"
                  borderWidth="1px"
                  borderColor="border"
                >
                  <Dialog.Title textStyle="heading.md">Profile picture</Dialog.Title>
                  <Flex direction="column" align="center" gap="md">
                    <UserAvatar size={96} src={profile?.avatarUrl} name={profile?.displayName} />
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={() => inputRef.current?.click()}
                      disabled={busy}
                    >
                      <Upload />
                      {busy ? "Saving…" : "Upload new picture"}
                    </Button>
                    {profile?.hasUpload && (
                      <Button fullWidth onClick={handleRemove} disabled={busy}>
                        <Trash2 />
                        Remove picture
                      </Button>
                    )}
                    {error && (
                      <Text role="alert" textStyle="small" color="fg.error" textAlign="center">
                        {error}
                      </Text>
                    )}
                  </Flex>
                  <Flex justify="flex-end">
                    <Dialog.ActionTrigger asChild>
                      <Button variant="ghost" disabled={busy}>
                        Cancel
                      </Button>
                    </Dialog.ActionTrigger>
                  </Flex>
                </Dialog.Content>
              </Dialog.Positioner>
            </Portal>
          </Dialog.Root>
        </>
      )}
    </Box>
  );
}
