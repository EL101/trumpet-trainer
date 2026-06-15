import { PitchDetector } from "pitchy";
import { useState, useEffect, useRef, useCallback } from "react";

export default function usePitch() {
  const [pitch, setPitch] = useState<number>(0);
  const [clarity, setClarity] = useState<number>(0);

  const cancelledRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const start = useCallback(async (): Promise<void> => {
    cancelledRef.current = false;

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (cancelledRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        return;
      }

      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      const input = new Float32Array(detector.inputLength);

      const update = (): void => {
        if (cancelledRef.current || !audioContextRef.current) return;
        analyser.getFloatTimeDomainData(input);
        const [hz, clar] = detector.findPitch(input, audioContextRef.current.sampleRate);
        if (clar > 0.9) {
          setPitch(Math.round(hz));
          setClarity(clar);
        }
        rafIdRef.current = requestAnimationFrame(update);
      };
      update();
    } catch (err) {
      console.error("Mic error:", err);
    }
  }, []);

  const stop = useCallback(() => {
    cancelledRef.current = true;
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

  useEffect(() => {
    start();
    return () => {
      stop();
    };
  }, [start, stop]);

  return { pitch, clarity, start, stop };
}
