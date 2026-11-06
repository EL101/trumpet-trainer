import { PitchDetector } from "pitchy";
import { useCallback, useEffect, useRef } from "react";
import type { PitchSample } from "@/lib/scoring";

const FRAME = 2048;

/**
 * Listens through the microphone while a scored run plays, and keeps what it hears as
 * pitch samples placed in the music, for `scoreRun`.
 *
 * `open` asks for the microphone (resolving to whether it got it) and `close` lets it
 * go. While `recording`, every frame is placed in the music with `positionHeardAt`, on
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

  const close = useCallback(() => {
    const open = mic.current;
    if (!open) return;
    mic.current = null;
    open.source.disconnect();
    open.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const open = useCallback(async () => {
    if (mic.current) return true;
    try {
      // Raw sound: the browser's voice-call processing would smooth out the very
      // wobbles and scoops being listened for.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      // Left before the permission prompt was answered: don't keep the microphone open.
      if (!mounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FRAME;
      source.connect(analyser);
      mic.current = { stream, source, analyser };
      return true;
    } catch (error) {
      console.error("Mic error:", error);
      return false;
    }
  }, [ctx]);

  // Whether the page using it is still mounted (`open` may finish after it's gone).
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      close();
    };
  }, [close]);

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
          samples.current.push({ at, hz, clarity, level: Math.sqrt(sum / input.length) });
        }
      }
      frame = requestAnimationFrame(listen);
    });
    return () => cancelAnimationFrame(frame);
  }, [recording, from, ctx]);

  /** What's been heard, in order through the music. */
  const heard = useCallback(() => [...samples.current].sort((a, b) => a.at - b.at), []);
  /** Forget everything heard, for a run from the top. */
  const clear = useCallback(() => {
    samples.current = [];
  }, []);

  return { open, close, heard, clear };
}
