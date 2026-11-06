import { createToaster } from "@chakra-ui/react";

/** The queue of notices that `<Toaster />` shows in the bottom-right corner. */
export const toaster = createToaster({ placement: "bottom-end", pauseOnPageIdle: true });

/** Where a notice can send the player, shown as a button under its text. */
export type NoticeLink = { to: string; label: string };

export type Notice = {
  /** Sets the icon. */
  tone: "success" | "error" | "info";
  title: string;
  description?: string;
  link?: NoticeLink;
  /** Showing a notice with the id of one still up replaces it, so repeats don't stack. */
  id?: string;
  /** How long it stays, in ms; NOTICE_MS if not given. For a quick hint, BRIEF_NOTICE_MS. */
  duration?: number;
};

/** How long a notice stays, errors included (hovering over it holds it). */
const NOTICE_MS = 5000;
/** How long a quick hint stays: a sentence read at a glance. */
export const BRIEF_NOTICE_MS = 2500;

/** Show a notice in the bottom-right corner. Needs `<Toaster />` mounted once in the app. */
export function notify({ tone, title, description, link, id, duration = NOTICE_MS }: Notice) {
  return toaster.create({
    id,
    type: tone,
    title,
    description,
    meta: { link },
    duration,
  });
}
