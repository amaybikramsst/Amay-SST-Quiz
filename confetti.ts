import confetti from "canvas-confetti";

const BRAND_COLORS = ["#1457E0", "#38B0FF", "#F5B82E", "#12A150", "#FF3B4E"];

/**
 * Returns the highest newly crossed celebratory XP milestone (500 XP badge milestone
 * or every 1,000 XP milestone: 1000, 2000, 3000, ...), or null if none crossed.
 */
export function getCrossedXpMilestone(prevXp: number, nextXp: number): number | null {
  if (nextXp <= prevXp) return null;

  const prevThousand = Math.floor(prevXp / 1000);
  const nextThousand = Math.floor(nextXp / 1000);
  if (nextThousand > prevThousand) {
    return nextThousand * 1000;
  }

  if (prevXp < 500 && nextXp >= 500) {
    return 500;
  }

  return null;
}

/**
 * Fires a lightweight canvas-based confetti celebration when a student unlocks
 * a new XP milestone. Respects prefers-reduced-motion.
 */
export function launchMilestoneConfetti(milestoneXp?: number): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const isMajor = (milestoneXp ?? 0) >= 1000;

  try {
    confetti({
      particleCount: isMajor ? 85 : 65,
      spread: 72,
      startVelocity: 42,
      ticks: 180,
      origin: { x: 0.5, y: 0.65 },
      colors: BRAND_COLORS,
      disableForReducedMotion: true,
      zIndex: 9999,
    });

    if (isMajor) {
      window.setTimeout(() => {
        confetti({
          particleCount: 45,
          angle: 60,
          spread: 58,
          origin: { x: 0.12, y: 0.7 },
          colors: BRAND_COLORS,
          disableForReducedMotion: true,
          zIndex: 9999,
        });
        confetti({
          particleCount: 45,
          angle: 120,
          spread: 58,
          origin: { x: 0.88, y: 0.7 },
          colors: BRAND_COLORS,
          disableForReducedMotion: true,
          zIndex: 9999,
        });
      }, 180);
    }
  } catch {
    // Ignore canvas/context errors in restricted webviews
  }
}
