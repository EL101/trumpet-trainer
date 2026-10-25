import { createToaster } from "@chakra-ui/react";

/** The queue of notices that `<Toaster />` shows in the bottom-right corner. */
export const toaster = createToaster({ placement: "bottom-end", pauseOnPageIdle: true });

/** Where a notice can send the player, shown as a button under its text. */
export type NoticeLink = { to: string; label: string };

export type Notice = {
  /** Sets the icon and how long the notice stays. */
  tone: "success" | "error" | "info";
  title: string;
  description?: string;
  link?: NoticeLink;
};

/** How long a notice stays, unless it's an error: those stay until closed, so they aren't missed. */
const NOTICE_MS = 8000;

/** Show a notice in the bottom-right corner. Needs `<Toaster />` mounted once in the app. */
export function notify({ tone, title, description, link }: Notice) {
  return toaster.create({
    type: tone,
    title,
    description,
    meta: { link },
    duration: tone === "error" ? Infinity : NOTICE_MS,
  });
}
