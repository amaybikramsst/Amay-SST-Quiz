const SOUND_PREF_KEY = "amaysst_sound_enabled";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;

  if (!audioCtx) {
    try {
      audioCtx = new Ctx();
    } catch {
      return null;
    }
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SOUND_PREF_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_PREF_KEY, enabled ? "1" : "0");
  } catch {
    // ignore storage errors
  }
}

function playTone(
  ctx: AudioContext,
  freqStart: number,
  freqEnd: number,
  startOffsetSec: number,
  durationSec: number,
  peakGain: number,
  type: OscillatorType = "sine"
) {
  const now = ctx.currentTime + startOffsetSec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, now);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + durationSec);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

/** Subtle neutral tactile click when selecting or clearing an option during timed quiz */
export function playSelectTapSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 480, 560, 0, 0.045, 0.03, "sine");
}

/** Subtle pleasant two-note chime for correct answers */
export function playCorrectSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  // Soft C5 -> E5 warm chime
  playTone(ctx, 523.25, 523.25, 0, 0.14, 0.075, "sine");
  playTone(ctx, 659.25, 659.25, 0.085, 0.22, 0.085, "sine");
}

/** Subtle muted descending tone for incorrect answers */
export function playIncorrectSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  // Gentle low A3 -> F3 soft thud (non-jarring)
  playTone(ctx, 270, 220, 0, 0.14, 0.06, "triangle");
  playTone(ctx, 220, 175, 0.09, 0.2, 0.055, "sine");
}

/** Subtle celebratory triad or gentle retry tone upon completing a quiz */
export function playQuizCompleteSound(correct: number, wrong: number): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (correct > 0 && correct >= wrong) {
    // Ascending C5 -> E5 -> G5 soft major arpeggio
    playTone(ctx, 523.25, 523.25, 0, 0.13, 0.07, "sine");
    playTone(ctx, 659.25, 659.25, 0.08, 0.15, 0.075, "sine");
    playTone(ctx, 783.99, 783.99, 0.16, 0.28, 0.085, "sine");
  } else {
    playIncorrectSound();
  }
}

/** Celebratory four-note ascending chime when unlocking a major XP milestone */
export function playMilestoneSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 523.25, 523.25, 0, 0.12, 0.07, "sine");
  playTone(ctx, 659.25, 659.25, 0.075, 0.12, 0.075, "sine");
  playTone(ctx, 783.99, 783.99, 0.15, 0.14, 0.08, "sine");
  playTone(ctx, 1046.5, 1046.5, 0.23, 0.34, 0.09, "sine");
}
