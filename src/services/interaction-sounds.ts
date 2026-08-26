type HydraSound = "tap" | "success" | "nfc" | "error";

let audioContext: AudioContext | null = null;
let lastTapAt = 0;
let tapSoundsInstalled = false;

function context() {
  if (typeof window === "undefined") return null;
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  audioContext ??= new AudioCtor();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

function tone(frequency: number, duration: number, volume: number, delay = 0, type: OscillatorType = "sine") {
  const ctx = context();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function playHydraSound(sound: HydraSound) {
  try {
    if (sound === "tap") {
      const now = Date.now();
      if (now - lastTapAt < 70) return;
      lastTapAt = now;
      tone(520, 0.05, 0.021);
      return;
    }
    if (sound === "success") {
      tone(620, 0.08, 0.029);
      tone(820, 0.095, 0.027, 0.065);
      return;
    }
    if (sound === "nfc") {
      tone(740, 0.075, 0.036);
      tone(980, 0.095, 0.034, 0.07);
      tone(1240, 0.115, 0.029, 0.14);
      return;
    }
    tone(260, 0.125, 0.024, 0, "triangle");
  } catch {
    // O feedback sonoro nunca deve bloquear uma ação do app.
  }
}

export function installHydraTapSounds() {
  if (typeof document === "undefined" || tapSoundsInstalled) return () => {};
  tapSoundsInstalled = true;
  const handlePointer = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const target = event.target instanceof Element ? event.target.closest("button,[role='button']") : null;
    if (!target || target.getAttribute("aria-disabled") === "true" || (target instanceof HTMLButtonElement && target.disabled)) return;
    playHydraSound("tap");
  };
  document.addEventListener("pointerdown", handlePointer, { passive: true });
  return () => {
    document.removeEventListener("pointerdown", handlePointer);
    tapSoundsInstalled = false;
  };
}
