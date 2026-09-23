import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/auth/useAuth";
import type { Profile } from "@/schema";
import { fetchProfile } from "@/utils/profile";
import { ProfileContext, type ProfileData } from "./ProfileContext";

/**
 * Loads the signed-in user's profile once and shares it.
 *
 * The sidebar shows the avatar on every dashboard page, so this lives above the
 * router rather than being refetched per page -- and an upload on /profile
 * updates the sidebar immediately.
 */
export default function ProfileProvider({ children }: { readonly children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      setProfile(await fetchProfile(user));
    } catch (error) {
      console.error("fetch profile error:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;

    // fetchProfile resolves to null when there is no signed-in user, so signing
    // out clears the profile through the same path as a fetch. Every setState
    // happens in a promise callback: doing it in the effect body synchronously
    // triggers a second render pass before the browser paints.
    const controller = new AbortController();
    fetchProfile(user, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setProfile(next);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("fetch profile error:", error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [user, authLoading]);

  const applyAvatar = useCallback((avatarUrl: string | null, hasUpload: boolean) => {
    setProfile((prev) => (prev ? { ...prev, avatarUrl, hasUpload } : prev));
  }, []);

  const value = useMemo<ProfileData>(
    () => ({ profile, loading, refresh, applyAvatar }),
    [profile, loading, refresh, applyAvatar],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
