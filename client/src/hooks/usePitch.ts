import { PitchDetector } from "pitchy";
import { useState, useEffect, useRef, useCallback } from "react";

export default function usePitch() {
  const [pitch, setPitch] = useState<number>(0);
  const [clarity, setClarity] = useState<number>(0);
  /** Set when the microphone couldn't be opened (permission refused, none plugged in). */
  const [error, setError] = useState<Error | null>(null);

  // Counts listens. Each start() keeps its own number; once stop() or a later start() has
  // moved it on, that listen is stale and closes whatever it opens.
  const requestRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    requestRef.current++;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const start = useCallback(async (): Promise<void> => {
    // Let go of an earlier listen, including one still waiting on the microphone prompt.
    stop();
    const request = requestRef.current;
    const stale = () => request !== requestRef.current;
    setError(null);
    // Forget what the last listen heard, so nothing shows until something new is.
    setPitch(0);
    setClarity(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stale()) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      const input = new Float32Array(detector.inputLength);

      const update = (): void => {
        if (stale()) return;
        analyser.getFloatTimeDomainData(input);
        const [hz, clar] = detector.findPitch(input, audioContext.sampleRate);
        if (clar > 0.9) {
          setPitch(Math.round(hz));
          setClarity(clar);
        }
        rafIdRef.current = requestAnimationFrame(update);
      };
      update();
    } catch (err) {
      // A stale listen's failure isn't news: a later one has taken over, or none is wanted.
      if (stale()) return;
      console.error("Mic error:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [stop]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [start, stop]);

  return { pitch, clarity, error, start, stop };
}
