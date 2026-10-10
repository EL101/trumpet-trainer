import { createContext } from "react";
import type { User } from "firebase/auth";
import type { Profile } from "@/schema";

export type ProfileData = {
  profile: Profile | null;
  loading: boolean;
  /**
   * Refetch from the server. Pass `user` when the caller holds a newer user
   * than the one this provider last rendered with (e.g. right after linking).
   */
  refresh: (user?: User | null) => Promise<void>;
  /** Apply a known avatar locally, so the sidebar updates without a round trip. */
  applyAvatar: (avatarUrl: string | null, hasUpload: boolean) => void;
};

export const ProfileContext = createContext<ProfileData>({
  profile: null,
  loading: true,
  refresh: async () => {},
  applyAvatar: () => {},
});
