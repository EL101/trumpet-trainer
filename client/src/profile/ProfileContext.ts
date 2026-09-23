import { createContext } from "react";
import type { Profile } from "@/schema";

export type ProfileData = {
  profile: Profile | null;
  loading: boolean;
  /** Refetch from the server. */
  refresh: () => Promise<void>;
  /** Apply a known avatar locally, so the sidebar updates without a round trip. */
  applyAvatar: (avatarUrl: string | null, hasUpload: boolean) => void;
};

export const ProfileContext = createContext<ProfileData>({
  profile: null,
  loading: true,
  refresh: async () => {},
  applyAvatar: () => {},
});
