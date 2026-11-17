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

// Deterministic daily target for any IST date so past days add the EXACT XP bots earned that day
function computeBotDailyTarget(
  dateKey: string,
  originalName: string,
  rankIdx: number,
  totalBots: number,
  competitionCeiling: number
): number {
  const rng = createRng(`today::${dateKey}::${originalName}`);
  const tierScore = 1 - rankIdx / Math.max(1, totalBots - 1);
  const luck = rng();

  // Keep a strong group of ~20 tough competitors near top real scores while others span 500..ceiling
  const isToughCompetitor = rankIdx < 14 || luck > 0.9;
  const strength = isToughCompetitor
    ? 0.78 + rng() * 0.22
    : Math.min(0.92, Math.max(0, tierScore * 0.55 + luck * 0.45));

  const effectiveCeiling = Math.max(1600, competitionCeiling || 1600);
  return snap5(
    500 + (effectiveCeiling - 500) * Math.pow(strength, 1.35),
    500
  );
}

let cachedPastSignature = "";
let cachedPastMap: Map<string, number> = new Map();

function getPastAccumulatedMap(
  todayKey: string,
  botDailyCeilings: Record<string, number>
): Map<string, number> {
  const totalPastDays = daysBetween(BOT_SIM_START_DATE_IST, todayKey);
  const pastDayCeilings: Array<{ dayKey: string; ceiling: number }> = [];
  for (let d = 0; d < totalPastDays; d++) {
    const dayKey = addDaysToDateKey(BOT_SIM_START_DATE_IST, d);
    const ceiling = Math.max(1600, Number(botDailyCeilings[dayKey]) || 1600);
    pastDayCeilings.push({ dayKey, ceiling });
  }

  const signature = `${todayKey}::${pastDayCeilings.map((p) => `${p.dayKey}=${p.ceiling}`).join(",")}`;
  if (cachedPastSignature === signature) {
    return cachedPastMap;
  }

  const map = new Map<string, number>();
  const totalBots = BENCHMARK_PLAYERS.length;

  for (let i = 0; i < totalBots; i++) {
    map.set(BENCHMARK_PLAYERS[i].name, 0);
  }

  for (const { dayKey, ceiling } of pastDayCeilings) {
    for (let i = 0; i < totalBots; i++) {
      const name = BENCHMARK_PLAYERS[i].name;
      const gain = computeBotDailyTarget(dayKey, name, i, totalBots, ceiling);
      map.set(name, (map.get(name) || 0) + gain);
    }
  }

  cachedPastSignature = signature;
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
  const dailyTarget = computeBotDailyTarget(
    todayKey,
    originalName,
    rankIdx,
    totalBots,
    competitionCeiling
  );

  // 12:00 AM - 1:59 AM IST: freshly reset to 0
  if (minuteOfDay < BOT_ACTIVE_START_MINUTE) {
    return { dailyTarget, earnedToday: 0 };
  }

  // 11:00 PM - 11:59 PM IST: full daily XP earned
  if (minuteOfDay >= BOT_ACTIVE_END_MINUTE) {
    return { dailyTarget, earnedToday: dailyTarget };
  }

  // Advance RNG once so session timing uses a distinct slice after dailyTarget's initial luck draw
  const rng = createRng(`sessions::${todayKey}::${originalName}`);
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

export function reconstructBotDailyCeilingsFromAttempts(
  attempts: Array<{
    guest_uuid?: string;
    candidate_name?: string;
    xp_earned?: number;
    created_at: string;
  }>,
  existingCeilings: Record<string, number> = {}
): Record<string, number> {
  const perDayPlayer = new Map<string, Map<string, number>>();
  for (const a of attempts) {
    const ms = Date.parse(a.created_at);
    if (!Number.isFinite(ms)) continue;
    const dayKey = getIstClock(ms).dateKey;
    const playerKey = a.guest_uuid || a.candidate_name || "";
    if (!playerKey) continue;
    let dayMap = perDayPlayer.get(dayKey);
    if (!dayMap) {
      dayMap = new Map<string, number>();
      perDayPlayer.set(dayKey, dayMap);
    }
    dayMap.set(playerKey, (dayMap.get(playerKey) || 0) + (Number(a.xp_earned) || 0));
  }

  const out: Record<string, number> = { ...existingCeilings };
  for (const [dayKey, dayMap] of perDayPlayer.entries()) {
    const scores = Array.from(dayMap.values()).map((v) => Math.max(0, v));
    const ceil = getCompetitionCeiling(scores);
    if (ceil > (out[dayKey] || 0)) {
      out[dayKey] = ceil;
    }
  }
  return out;
}

export function resolveBotRoster(
  botOverrides: Record<string, BotOverride>,
  realTodayScores: number[],
  nowMs = Date.now(),
  botDailyCeilings: Record<string, number> = {}
): {
  clock: IstClockInfo;
  maxRealTodayXp: number;
  competitionCeiling: number;
  bots: ResolvedBotPlayer[];
} {
  const clock = getIstClock(nowMs);
  const maxRealTodayXp = realTodayScores.reduce((mx, v) => Math.max(mx, Number(v) || 0), 0);
  const liveCeiling = getCompetitionCeiling(realTodayScores);
  const competitionCeiling = Math.max(liveCeiling, Number(botDailyCeilings[clock.dateKey]) || 0);
  const pastMap = getPastAccumulatedMap(clock.dateKey, botDailyCeilings);
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
