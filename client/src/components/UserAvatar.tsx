import { useState } from "react";
import { Box, Image, Text } from "@chakra-ui/react";

type UserAvatarProps = {
  readonly size: number;
  readonly src?: string | null;
  readonly name?: string | null;
  readonly isGuest?: boolean;
};

/** Up to two initials, or "G" for a guest, or "?" when there's no name yet. */
function initials(name?: string | null, isGuest?: boolean) {
  if (isGuest) return "G";
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

/** A circular avatar: the image if there is one, initials otherwise. */
export default function UserAvatar({ size, src, name, isGuest }: UserAvatarProps) {
  // A provider photo URL can 404 or be blocked; fall back rather than show a
  // broken image. Remembering which src failed rather than a bare flag means a
  // new upload is retried automatically -- no effect needed to reset it.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = src !== undefined && src !== null && src === failedSrc;

  return (
    <Box
      width={`${size}px`}
      height={`${size}px`}
      borderRadius="100%"
      borderWidth="1px"
      borderColor="border.strong"
      bg="bg.subtle"
      overflow="hidden"
      flexShrink={0}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      {src && !failed ? (
        <Image
          src={src}
          alt=""
          width="100%"
          height="100%"
          objectFit="cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <Text fontFamily="heading" fontSize={`${Math.round(size * 0.44)}px`} color="fg">
          {initials(name, isGuest)}
        </Text>
      )}
    </Box>
  );
}
