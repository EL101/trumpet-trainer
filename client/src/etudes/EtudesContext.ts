import { createContext } from "react";
import type { EtudeJob, EtudeQuota, EtudeRequest, EtudeStart } from "@/utils/etudes";

export type EtudesData = {
  /** Whether an etude is being written for the player, or being asked for. */
  writing: boolean;
  /** Etudes left today, once known. */
  quota: EtudeQuota | null;
  /** Whether this server can write etudes; null until known. */
  available: boolean | null;
  /** Ask for an etude. Resolves to how that went; a refusal carries the message to show. */
  start: (request: EtudeRequest) => Promise<EtudeStart>;
  /** Load the quota, and any etude being written, again. */
  refresh: () => void;
  /** Hear about each etude as it finishes. Returns a function that stops listening. */
  onFinished: (listener: (job: EtudeJob) => void) => () => void;
};

export const EtudesContext = createContext<EtudesData>({
  writing: false,
  quota: null,
  available: null,
  start: async () => ({ ok: false, message: "Etudes aren't ready yet." }),
  refresh: () => {},
  onFinished: () => () => {},
});
