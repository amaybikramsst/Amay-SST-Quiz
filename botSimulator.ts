import { BENCHMARK_PLAYERS } from "../data/benchmarks";
import type { BotOverride } from "./supabase";

// IST (UTC+05:30) keeps midnight resets (12:00 AM) and daily earning hours (2:00 AM - 11:00 PM)
// synchronized across every student device and the Admin Console.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const BOT_SIM_START_DATE_IST = "2026-11-16";
export const BOT_ACTIVE_START_MINUTE = 2 * 60; // 2:00 AM IST
export const BOT_ACTIVE_END_MINUTE = 23 * 60; // 11:00 PM IST
const DAY_MS = 24 * 60 * 60 * 1000;

export interface IstClockInfo {
  dateKey: string;
  minuteOfDay: number;
  timeLabel: string;
  phase: "reset_wait" | "active" | "finished";
}

export interface ResolvedBotPlayer {
  originalName: string;
  name: string;
  xp: number;
  todayXp: number;
  dailyTarget: number;
  baseXp: number;
  unadjustedOverallXp: number;
  unadjustedTodayXp: number;
}

export function getIstClock(nowMs = Date.now()): IstClockInfo {
  const ist = new Date(nowMs + IST_OFFSET_MS);
  const dateKey = ist.toISOString().slice(0, 10);
  const hours = ist.getUTCHours();
  const mins = ist.getUTCMinutes();
  const minuteOfDay = hours * 60 + mins;

  const h12 = hours % 12 || 12;
  const ampm = hours >= 12 ? "PM" : "AM";
  const timeLabel = `${h12}:${String(mins).padStart(2, "0")} ${ampm} IST`;

  let phase: IstClockInfo["phase"] = "active";
  if (minuteOfDay < BOT_ACTIVE_START_MINUTE) {
    phase = "reset_wait";
  } else if (minuteOfDay >= BOT_ACTIVE_END_MINUTE) {
    phase = "finished";
  }

  return { dateKey, minuteOfDay, timeLabel, phase };
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed: string): () => number {
  let a = hashString(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const ms = Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

function daysBetween(startKey: string, endKey: string): number {
  const startMs = Date.parse(`${startKey}T00:00:00Z`);
  const endMs = Date.parse(`${endKey}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return Math.min(730, Math.floor((endMs - startMs) / DAY_MS));
}

function snap5(val: number, minVal = 0): number {
  return Math.max(minVal, Math.round(val / 5) * 5);
}

// Deterministic full-day gain for any completed past date so Overall XP stays permanent & stable
function computePastDayGain(dateKey: string, originalName: string, tierScore: number): number {
  const rng = createRng(`past::${dateKey}::${originalName}`);
  const luck = rng();
  const isToughGrinder = tierScore >= 0.88 || luck > 0.9;
  const strength = isToughGrinder
    ? 0.72 + rng() * 0.28
    : Math.min(0.9, Math.max(0, tierScore * 0.62 + luck * 0.38));
  const raw = 500 + 2100 * Math.pow(strength, 1.45);
  return snap5(raw, 500);
}

let cachedPastKey = "";
let cachedPastMap: Map<string, number> = new Map();

function getPastAccumulatedMap(todayKey: string): Map<string, number> {
  if (cachedPastKey === todayKey) {
    return cachedPastMap;
  }

  const totalPastDays = daysBetween(BOT_SIM_START_DATE_IST, todayKey);
  const map = new Map<string, number>();
  const totalBots = BENCHMARK_PLAYERS.length;

  for (let i = 0; i < totalBots; i++) {
    map.set(BENCHMARK_PLAYERS[i].name, 0);
  }

  for (let d = 0; d < totalPastDays; d++) {
    const dayKey = addDaysToDateKey(BOT_SIM_START_DATE_IST, d);
    for (let i = 0; i < totalBots; i++) {
      const name = BENCHMARK_PLAYERS[i].name;
      const tierScore = 1 - i / Math.max(1, totalBots - 1);
      const gain = computePastDayGain(dayKey, name, tierScore);
      map.set(name, (map.get(name) || 0) + gain);
    }
  }

  cachedPastKey = todayKey;
  cachedPastMap = map;
  return map;
}

function computeTodayTargetAndEarned(
  todayKey: string,
  minuteOfDay: number,
  originalName: string,
  rankIdx: number,
  totalBots: number,
  competitionCeiling: number
): { dailyTarget: number; earnedToday: number } {
  const rng = createRng(`today::${todayKey}::${originalName}`);
  const tierScore = 1 - rankIdx / Math.max(1, totalBots - 1);
  const luck = rng();

  // Keep a strong group of ~20 tough competitors near top real scores while others span 500..ceiling
  const isToughCompetitor = rankIdx < 14 || luck > 0.9;
  const strength = isToughCompetitor
    ? 0.78 + rng() * 0.22
    : Math.min(0.92, Math.max(0, tierScore * 0.55 + luck * 0.45));

  const dailyTarget = snap5(
    500 + (competitionCeiling - 500) * Math.pow(strength, 1.35),
    500
  );

  // 12:00 AM - 1:59 AM IST: freshly reset to 0
  if (minuteOfDay < BOT_ACTIVE_START_MINUTE) {
    return { dailyTarget, earnedToday: 0 };
  }

  // 11:00 PM - 11:59 PM IST: full daily XP earned
  if (minuteOfDay >= BOT_ACTIVE_END_MINUTE) {
    return { dailyTarget, earnedToday: dailyTarget };
  }

  // 2:00 AM - 10:59 PM IST: random staggered quiz sessions at different times per bot
  const sessionCount = 8 + Math.floor(rng() * 9); // 8 to 16 quiz bursts across the day
  const span = BOT_ACTIVE_END_MINUTE - BOT_ACTIVE_START_MINUTE;
  const sessions: Array<{ minute: number; weight: number }> = [];

  for (let s = 0; s < sessionCount; s++) {
    const sessionMinute = BOT_ACTIVE_START_MINUTE + Math.floor(rng() * span);
    const weight = 0.45 + rng() * 1.55;
    sessions.push({ minute: sessionMinute, weight });
  }

  let totalWeight = 0;
  let passedWeight = 0;
  for (const s of sessions) {
    totalWeight += s.weight;
    if (s.minute <= minuteOfDay) {
      passedWeight += s.weight;
    }
  }

  if (passedWeight <= 0 || totalWeight <= 0) {
    return { dailyTarget, earnedToday: 0 };
  }

  const earnedToday = Math.min(
    dailyTarget,
    snap5((dailyTarget * passedWeight) / totalWeight, 0)
  );
  return { dailyTarget, earnedToday };
}

export function getCompetitionCeiling(realTodayScores: number[]): number {
  const maxReal = realTodayScores.reduce((mx, v) => Math.max(mx, Number(v) || 0), 0);
  return Math.max(1600, snap5(maxReal * 1.08, 1600));
}

export function resolveBotRoster(
  botOverrides: Record<string, BotOverride>,
  realTodayScores: number[],
  nowMs = Date.now()
): {
  clock: IstClockInfo;
  maxRealTodayXp: number;
  competitionCeiling: number;
  bots: ResolvedBotPlayer[];
} {
  const clock = getIstClock(nowMs);
  const maxRealTodayXp = realTodayScores.reduce((mx, v) => Math.max(mx, Number(v) || 0), 0);
  const competitionCeiling = getCompetitionCeiling(realTodayScores);
  const pastMap = getPastAccumulatedMap(clock.dateKey);
  const totalBots = BENCHMARK_PLAYERS.length;

  const bots: ResolvedBotPlayer[] = BENCHMARK_PLAYERS.map((b, idx) => {
    const ov = botOverrides[b.name];
    const baseXp = ov?.baseXp ?? ov?.xp ?? b.xp;
    const pastXp = pastMap.get(b.name) || 0;

    const { dailyTarget, earnedToday } = computeTodayTargetAndEarned(
      clock.dateKey,
      clock.minuteOfDay,
      b.name,
      idx,
      totalBots,
      competitionCeiling
    );

    const unadjustedTodayXp = earnedToday;
    const unadjustedOverallXp = baseXp + pastXp + unadjustedTodayXp;

    const xpOffset = ov?.xpOffset ?? 0;
    const manualTodayOffset =
      ov?.manualTodayDate === clock.dateKey ? ov.manualTodayOffset ?? 0 : 0;

    const todayXp = Math.max(0, unadjustedTodayXp + manualTodayOffset);
    const xp = Math.max(0, unadjustedOverallXp + xpOffset);

    return {
      originalName: b.name,
      name: ov?.name ?? b.name,
      xp,
      todayXp,
      dailyTarget,
      baseXp,
      unadjustedOverallXp,
      unadjustedTodayXp,
    };
  });

  return {
    clock,
    maxRealTodayXp,
    competitionCeiling,
    bots,
  };
}
