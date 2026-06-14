import { PitchDetector } from "pitchy";
import { useState, useEffect } from "react";

export default function usePitch() {
  const [pitch, setPitch] = useState<number>(0);
  const [clarity, setClarity] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    let audioContext: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;

    const start = async (): Promise<void> => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        const detector = PitchDetector.forFloat32Array(analyser.fftSize);
        const input = new Float32Array(detector.inputLength);

        const update = (): void => {
          if (cancelled || !audioContext) return;
          analyser.getFloatTimeDomainData(input);
          const [hz, clar] = detector.findPitch(input, audioContext.sampleRate);
          if (clar > 0.9) {
            setPitch(Math.round(hz));
            setClarity(clar);
          }
          rafId = requestAnimationFrame(update);
        };
        update();
      } catch (err) {
        console.error("Mic error:", err);
      }
    };

    start();

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close();
      }
    };
  }, []);

  return [pitch, clarity];
}
