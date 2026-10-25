import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { notify } from "@/components/primitives";
import { etudeNotice } from "@/lib/etudeNotice";
import {
  ETUDE_LOST_MESSAGE,
  ETUDE_WAIT_LIMIT_MS,
  etudeCheckDelay,
  fetchEtude,
  fetchEtudeStatus,
  startEtude,
  type EtudeJob,
  type EtudeQuota,
  type EtudeRequest,
} from "@/utils/etudes";
import { EtudesContext, type EtudesData } from "./EtudesContext";

/**
 * Waits on the player's etude wherever they are in the app. Claude writes each one
 * on the server, which saves it to history itself, so leaving the Generate page
 * loses nothing; this keeps asking after it and, once it's done, says so in the
 * corner of whatever page is open.
 */
export default function EtudesProvider({ children }: { readonly children: ReactNode }) {
  const { user } = useAuth();
  const [job, setJob] = useState<string | null>(null);
  // Between asking for an etude and the server answering, before there's a job.
  const [starting, setStarting] = useState(false);
  const [quota, setQuota] = useState<EtudeQuota | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [refreshes, setRefreshes] = useState(0);
  const listeners = useRef(new Set<(job: EtudeJob) => void>());
  // Etudes already announced. A status fetched just before one finished can still
  // say it's pending; without this it would be waited for, and announced, again.
  const announced = useRef(new Set<string>());

  // Everything here belongs to one account. On switching (signing out, or into
  // another account), drop the last one's etude and quota before anything uses them.
  const uid = user?.uid ?? null;
  const [owner, setOwner] = useState(uid);
  if (uid !== owner) {
    setOwner(uid);
    setJob(null);
    setStarting(false);
    setQuota(null);
    setAvailable(null);
  }

  // The account signed in now, for a start() that answers after a switch.
  const latestUid = useRef(uid);
  useEffect(() => {
    latestUid.current = uid;
  }, [uid]);

  // The page that's open, read when an etude finishes after later renders.
  const { pathname } = useLocation();
  const page = useRef(pathname);
  useEffect(() => {
    page.current = pathname;
  }, [pathname]);

  // On signing in, and on each refresh: the quota, whether etudes can be written
  // here, and an etude still being written from before a reload, to wait for again.
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    const controller = new AbortController();
    fetchEtudeStatus(user, controller.signal).then((status) => {
      if (!status) return;
      const { pending, enabled, ...left } = status;
      setQuota(left);
      setAvailable(enabled);
      if (pending && !announced.current.has(pending.id)) setJob(pending.id);
    });
    return () => controller.abort();
  }, [user, refreshes]);

  const finished = useCallback((done: EtudeJob) => {
    announced.current.add(done.id);
    setJob(null);
    // On Generate it lands on the plate or in the list; elsewhere, offer the way there.
    const ready = done.status === "SUCCEEDED" && done.exercise !== null;
    notify({
      ...etudeNotice(done),
      link:
        ready && page.current !== "/generate"
          ? { to: "/generate", label: "Open Generate" }
          : undefined,
    });
    listeners.current.forEach((listener) => listener(done));
  }, []);

  useEffect(() => {
    if (!job || !user) return;
    const controller = new AbortController();
    // Asks that fail back off, and past the wait limit this stops waiting, so a
    // server that can't be reached doesn't leave the etude writing for ever.
    const giveUpAt = Date.now() + ETUDE_WAIT_LIMIT_MS;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      const result = await fetchEtude(user, job, controller.signal);
      if (controller.signal.aborted) return;
      if (result?.quota) setQuota(result.quota);
      if (result && result.etude.status !== "PENDING") {
        finished(result.etude);
        return;
      }
      if (Date.now() >= giveUpAt) {
        finished({ id: job, status: "FAILED", error: ETUDE_LOST_MESSAGE, exercise: null });
        return;
      }
      failures = result ? 0 : failures + 1;
      timer = setTimeout(check, etudeCheckDelay(failures));
    };
    timer = setTimeout(check, etudeCheckDelay(0));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [job, user, finished]);

  const start = useCallback(
    async (request: EtudeRequest) => {
      const startedFor = user?.uid ?? null;
      setStarting(true);
      const result = await startEtude(user, request);
      // Answered after switching accounts: that etude belongs to the last account.
      if (latestUid.current !== startedFor) return result;
      setStarting(false);
      if (result.quota) setQuota(result.quota);
      // Refused because one is already being written: wait for that one instead.
      if (result.job) setJob(result.job.id);
      return result;
    },
    [user],
  );

  const refresh = useCallback(() => setRefreshes((n) => n + 1), []);

  const onFinished = useCallback((listener: (job: EtudeJob) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<EtudesData>(
    () => ({ writing: starting || job !== null, quota, available, start, refresh, onFinished }),
    [starting, job, quota, available, start, refresh, onFinished],
  );

  return <EtudesContext.Provider value={value}>{children}</EtudesContext.Provider>;
}
