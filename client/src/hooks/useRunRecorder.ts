import { PitchDetector } from "pitchy";
import { useCallback, useEffect, useRef } from "react";
import { firstFrom, type PitchSample } from "@/lib/hearing";

const FRAME = 2048;

/**
 * Listens through the microphone while a scored run plays, and keeps what it hears as
 * pitch samples placed in the music, for `scoreRun`.
 *
 * `open` asks for the microphone, resolving to whether it got it, or to null if the page
 * was left while the browser asked (nothing to start, nothing to report). `close` lets
 * it go. While `recording`, every frame is placed in the music with `positionHeardAt`, on
 * the same audio clock as the playback (`ctx`), allowing for the microphone's own delay.
 * Each take starts at `from`: what was heard from there on in an earlier take is
 * dropped, so going back over a bar records it afresh. Frames from the count-in, before
 * `from`, aren't kept.
 */
export function useRunRecorder({
  ctx,
  positionHeardAt,
  recording,
  from,
}: {
  ctx: AudioContext;
  positionHeardAt: (time: number) => number | null;
  recording: boolean;
  from: number;
}) {
  const samples = useRef<PitchSample[]>([]);
  const mic = useRef<{
    stream: MediaStream;
    source: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
  } | null>(null);
  // The latest position mapper, for the frame loop.
  const heardAt = useRef(positionHeardAt);
  useEffect(() => {
    heardAt.current = positionHeardAt;
  });

  // The request for the microphone still waiting on the browser (its permission prompt),
  // and a count that `close` moves on, so a request it's overtaken knows to let go.
  const asking = useRef<Promise<boolean | null> | null>(null);
  const attempt = useRef(0);

  /**
   * Lets the microphone go, and calls off a request for it that's still waiting (the
   * take was abandoned: switched to Listen, restarted, or the page left).
   */
  const close = useCallback(() => {
    attempt.current++;
    asking.current = null;
    const open = mic.current;
    if (!open) return;
    mic.current = null;
    open.source.disconnect();
    open.stream.getTracks().forEach((t) => t.stop());
  }, []);

  /**
   * Asks for the microphone: true once it's open, false if it was turned down, and null
   * if `close` called the request off meanwhile (nothing to start, and no one to tell).
   * Asking again while a request waits gives that same request.
   */
  const open = useCallback((): Promise<boolean | null> => {
    if (mic.current) return Promise.resolve(true);
    if (asking.current) return asking.current;
    const mine = ++attempt.current;
    const request = (async () => {
      try {
        // Raw sound: the browser's voice-call processing would smooth out the very
        // wobbles and scoops being listened for.
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        // Called off while the browser asked: don't keep the microphone open.
        if (attempt.current !== mine) {
          stream.getTracks().forEach((t) => t.stop());
          return null;
        }
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = FRAME;
        source.connect(analyser);
        mic.current = { stream, source, analyser };
        return true;
      } catch (error) {
        if (attempt.current !== mine) return null;
        console.error("Mic error:", error);
        return false;
      } finally {
        if (attempt.current === mine) asking.current = null;
      }
    })();
    asking.current = request;
    return request;
  }, [ctx]);

  // Leaving the page lets the microphone go, and calls off a request for it.
  useEffect(() => close, [close]);

  // A new take from `from`: forget what an earlier one heard from there on.
  useEffect(() => {
    if (recording) samples.current = samples.current.filter((s) => s.at < from);
  }, [recording, from]);

  useEffect(() => {
    if (!recording) return;
    const detector = PitchDetector.forFloat32Array(FRAME);
    const input = new Float32Array(detector.inputLength);
    let frame = requestAnimationFrame(function listen() {
      const open = mic.current;
      if (open) {
        open.analyser.getFloatTimeDomainData(input);
        const [hz, clarity] = detector.findPitch(input, ctx.sampleRate);
        let sum = 0;
        for (const x of input) sum += x * x;
        // The frame is centred half its length back, and the microphone adds its own delay.
        // (Chrome reports the microphone's latency; elsewhere it's taken as none.)
        const track = open.stream.getAudioTracks()[0];
        const settings = (track?.getSettings() ?? {}) as { latency?: number };
        const latency = settings.latency ?? 0;
        const at = heardAt.current(ctx.currentTime - FRAME / 2 / ctx.sampleRate - latency);
        if (at !== null && at >= from) {
          const sample = { at, hz, clarity, level: Math.sqrt(sum / input.length) };
          // Frames come in order through the music, so this is nearly always the end.
          const heard = samples.current;
          if (!heard.length || heard[heard.length - 1].at <= at) heard.push(sample);
          else heard.splice(firstFrom(heard, at), 0, sample);
        }
      }
      frame = requestAnimationFrame(listen);
    });
    return () => cancelAnimationFrame(frame);
  }, [recording, from, ctx]);

  /**
   * What's been heard, in order through the music: the list itself, not a copy, read
   * on every live update. It grows as frames come in, and a new take replaces it.
   */
  const heard = useCallback((): readonly PitchSample[] => samples.current, []);
  /** Forget everything heard, for a run from the top. */
  const clear = useCallback(() => {
    samples.current = [];
  }, []);

  return { open, close, heard, clear };
}
