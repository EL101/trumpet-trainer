let audioCtx: AudioContext | null = null;

export function getCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

export function scheduleClick(when: number, accent = false, ctx: AudioContext) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = accent ? 800 : 600;

  gainNode.gain.setValueAtTime(0.001, when);
  gainNode.gain.setValueAtTime(0.5, when + 0.001);
  gainNode.gain.setValueAtTime(0.001, when + 0.05);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  const oscillator2 = ctx.createOscillator();
  const gainNode2 = ctx.createGain();
  oscillator2.type = "triangle";
  oscillator2.frequency.value = accent ? 500 : 300;

  gainNode2.gain.setValueAtTime(0.0005, when);
  gainNode2.gain.setValueAtTime(0.005, when + 0.001);
  gainNode2.gain.setValueAtTime(0.0005, when + 0.05);

  oscillator2.connect(gainNode);
  gainNode2.connect(ctx.destination);

  oscillator.start(when);
  oscillator.stop(when + 0.05);

  oscillator2.start(when);
  oscillator2.stop(when + 0.05);
}
