import { STATIC_QUESTIONS, type QuizKey, type RawQuestion, type SubjectKey } from "../data/questions";
import type { DynamicQuestionRow } from "./supabase";

export const LEVELS = ["Easy", "Medium", "Hard", "Amay Special"] as const;
export const XP_PER_LEVEL = [10, 15, 20, 30] as const;
export const NEGATIVE_RATIO = 0.25; // 1/4 negative marking per wrong answer
export const HIGH_LEVEL_TARGET_PER_MODE = 35;

// Strictly 2 minutes (10 questions) and 5 minutes (20 questions)
export const QUIZ_LENGTHS: Record<number, number> = {
  10: 2,
  20: 5,
};

export interface RankDifficultyRule {
  minLevel: number;
  defaultLevel: number;
  tierLabel: string | null;
  lockReason: string | null;
}

export function getRankDifficultyRule(playerRank?: number): RankDifficultyRule {
  if (!playerRank || !Number.isFinite(playerRank) || playerRank <= 0) {
    return { minLevel: 0, defaultLevel: 1, tierLabel: null, lockReason: null };
  }
  if (playerRank <= 10) {
    return {
      minLevel: 2,
      defaultLevel: 3,
      tierLabel: "Top 10 Challenge",
      lockReason: "Top 10 players face Amay Special & Hard questions in Mixed Quiz.",
    };
  }
  if (playerRank <= 20) {
    return {
      minLevel: 2,
      defaultLevel: 2,
      tierLabel: "Top 20 Challenge",
      lockReason: "Top 20 players must play Hard or Amay Special in Mixed Quiz.",
    };
  }
  if (playerRank <= 50) {
    return {
      minLevel: 2,
      defaultLevel: 2,
      tierLabel: "Top 50 Challenge",
      lockReason: "Top 50 players must play Hard or Amay Special in Mixed Quiz.",
    };
  }
  if (playerRank <= 100) {
    return {
      minLevel: 1,
      defaultLevel: 1,
      tierLabel: "Top 100 Challenge",
      lockReason: "Top 100 players start from Medium difficulty or higher in Mixed Quiz.",
    };
  }
  return { minLevel: 0, defaultLevel: 1, tierLabel: null, lockReason: null };
}

export const OVERALL_BADGE_MILESTONES = [100, 1000, 10000, 100000] as const;
export type OverallBadgeMilestone = (typeof OVERALL_BADGE_MILESTONES)[number];

export interface DailyBadgeRecord {
  date: string; // YYYY-MM-DD IST
  rank: 1 | 2 | 3;
  xp: number;
}

export interface StudentProfile {
  name: string;
  username?: string;
  password?: string;
  xp: number;
  streak: number;
  last: string;
  quizzes: number;
  perfect: number;
  theme: "" | "light" | "dark";
  nameAt?: number;
  td?: { d: string; xp: number };
  lastCloudXp?: number;
  lastAdminTodayDate?: string;
  lastAdminTodayDelta?: number;
  earnedDailyBadges?: DailyBadgeRecord[];
}

export interface QueuedAttempt {
  k: string;
  L: number;
  t: number;
  c: number;
}

export interface QuizResultSummary {
  c: number;
  w: number;
  sk: number;
  n: number;
  posXp: number;
  negXp: number;
  bonusXp: number;
  xp: number;
  up: boolean;
  milestoneXp?: number | null;
}

export interface ActiveQuizState {
  k: QuizKey;
  L: number;
  N: number;
  qs: RawQuestion[];
  i: number;
  sel: (number | undefined)[];
  t: number;
  done: boolean;
  res?: QuizResultSummary;
}

export const SUBJECT_ORDER: SubjectKey[] = ["math", "sci", "sst", "eng", "hin", "ca"];

export function getNegativePenalty(level: number): number {
  return (XP_PER_LEVEL[level] ?? 10) * NEGATIVE_RATIO;
}

export function formatXpValue(val: number): string {
  return Number.isInteger(val) ? String(val) : val.toFixed(2).replace(/\.?0+$/, "");
}

export function calculateQuizScore(
  qs: RawQuestion[],
  sel: (number | undefined)[],
  level: number
): Omit<QuizResultSummary, "up"> {
  const n = qs.length;
  let c = 0;
  let w = 0;
  let sk = 0;

  qs.forEach((q, idx) => {
    const picked = sel[idx];
    if (picked === undefined) sk++;
    else if (picked === q[2]) c++;
    else w++;
  });

  const unit = XP_PER_LEVEL[level] ?? 10;
  const penaltyUnit = unit * NEGATIVE_RATIO;
  const posXp = c * unit;
  const negXp = w * penaltyUnit;
  const bonusXp = c === n && n > 0 ? 20 : 0;
  const xp = Math.round(posXp - negXp + bonusXp);

  return { c, w, sk, n, posXp, negXp, bonusXp, xp };
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function todayIST(offsetDays = 0): string {
  return new Date(Date.now() + IST_OFFSET_MS - offsetDays * 864e5).toISOString().slice(0, 10);
}

export function todayUTC(offsetDays = 0): string {
  return new Date(Date.now() - offsetDays * 864e5).toISOString().slice(0, 10);
}

export interface TodayCutoffStatus {
  dateKey: string;
  isLocked: boolean;
  remainingSeconds: number;
  resetSeconds: number;
  countdownLabel: string;
  resetLabel: string;
}

function formatHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
}

export function getTodayCutoffStatus(nowMs = Date.now()): TodayCutoffStatus {
  const ist = new Date(nowMs + IST_OFFSET_MS);
  const dateKey = ist.toISOString().slice(0, 10);
  const secsSinceMidnight =
    ist.getUTCHours() * 3600 + ist.getUTCMinutes() * 60 + ist.getUTCSeconds();
  const cutoffSec = 23 * 3600; // 11:00 PM IST everyday
  const midnightSec = 24 * 3600;

  const isLocked = secsSinceMidnight >= cutoffSec;
  const remainingSeconds = isLocked ? 0 : cutoffSec - secsSinceMidnight;
  const resetSeconds = midnightSec - secsSinceMidnight;

  return {
    dateKey,
    isLocked,
    remainingSeconds,
    resetSeconds,
    countdownLabel: formatHms(remainingSeconds),
    resetLabel: formatHms(resetSeconds),
  };
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function generateFreshGuestUUID(): string {
  const id =
    "guest_" +
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now());
  try {
    localStorage.setItem("amaysst_uuid", id);
  } catch {
    // ignore storage errors
  }
  return id;
}

export function setGuestUUID(id: string): void {
  try {
    localStorage.setItem("amaysst_uuid", id);
  } catch {
    // ignore storage errors
  }
}

export function getGuestUUID(): string {
  let id = localStorage.getItem("amaysst_uuid");
  if (!id) {
    id = generateFreshGuestUUID();
  }
  return id;
}

export function clearProfileSession(): string {
  try {
    localStorage.removeItem("r10");
    localStorage.removeItem("amaysst_queue");
    localStorage.removeItem("amaysst_seen_notifs");
    localStorage.removeItem("amaysst_reported_install");
    localStorage.removeItem("amaysst_chat_read_at");
  } catch {
    // ignore storage errors
  }
  return generateFreshGuestUUID();
}

export function loadProfile(): StudentProfile {
  try {
    const raw = localStorage.getItem("r10");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        name: parsed.name || "",
        username: typeof parsed.username === "string" ? parsed.username : undefined,
        password: typeof parsed.password === "string" ? parsed.password : undefined,
        xp: Math.max(0, Number(parsed.xp) || 0),
        streak: Number(parsed.streak) || 0,
        last: parsed.last || "",
        quizzes: Number(parsed.quizzes) || 0,
        perfect: Number(parsed.perfect) || 0,
        theme: parsed.theme || "",
        nameAt: parsed.nameAt,
        td: parsed.td,
        lastCloudXp: typeof parsed.lastCloudXp === "number" ? parsed.lastCloudXp : undefined,
        lastAdminTodayDate:
          typeof parsed.lastAdminTodayDate === "string" ? parsed.lastAdminTodayDate : undefined,
        lastAdminTodayDelta:
          typeof parsed.lastAdminTodayDelta === "number" ? parsed.lastAdminTodayDelta : undefined,
        earnedDailyBadges: Array.isArray(parsed.earnedDailyBadges)
          ? (parsed.earnedDailyBadges as DailyBadgeRecord[])
          : [],
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return {
    name: "",
    xp: 0,
    streak: 0,
    last: "",
    quizzes: 0,
    perfect: 0,
    theme: "",
  };
}

export function saveProfile(profile: StudentProfile): void {
  try {
    localStorage.setItem("r10", JSON.stringify(profile));
  } catch {
    // ignore quota errors
  }
}

export function loadQueue(): QueuedAttempt[] {
  try {
    return JSON.parse(localStorage.getItem("amaysst_queue") || "[]") || [];
  } catch {
    return [];
  }
}

export function saveQueue(q: QueuedAttempt[]): void {
  try {
    localStorage.setItem("amaysst_queue", JSON.stringify(q));
  } catch {
    // ignore
  }
}

const SEEN_QUESTIONS_KEY = "amaysst_seen_q_v1";
const MAX_SEEN_HISTORY = 500;

function normalizeQuestionKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function loadSeenQuestionKeys(guestId = "default"): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_QUESTIONS_KEY) || "{}");
    const list = raw?.[guestId];
    return Array.isArray(list) ? (list as string[]) : [];
  } catch {
    return [];
  }
}

export function markQuestionsSeen(guestId: string | undefined, qs: RawQuestion[]): void {
  if (!qs.length) return;
  const scope = guestId || "default";
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_QUESTIONS_KEY) || "{}");
    const prev: string[] = Array.isArray(raw?.[scope]) ? raw[scope] : [];
    const newKeys = qs.map((q) => normalizeQuestionKey(q[0]));
    const newSet = new Set(newKeys);
    const filtered = prev.filter((k) => !newSet.has(k));
    const updated = [...filtered, ...newKeys].slice(-MAX_SEEN_HISTORY);
    raw[scope] = updated;
    localStorage.setItem(SEEN_QUESTIONS_KEY, JSON.stringify(raw));
  } catch {
    // ignore storage errors
  }
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateMathQuestions(level: number, count: number): RawQuestion[] {
  const R = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
  const gc = (a: number, b: number): number => (b ? gc(b, a % b) : a);
  const M = 1 + level * 2;
  const seen = new Set<string>();
  const out: RawQuestion[] = [];

  const hardFns: Array<() => [string, number, string]> = [
    () => {
      const g = R(2, 4 + M);
      const A = g * R(2, 6 + M);
      const B = g * R(2, 6 + M);
      return [`The HCF of ${A} and ${B} is`, gc(A, B), "Use prime factors or Euclid's division method."];
    },
    () => {
      const x = R(4, 12 + 3 * M);
      const y = R(4, 12 + 3 * M);
      return [`The LCM of ${x} and ${y} is`, (x * y) / gc(x, y), "LCM = (x × y) ÷ HCF."];
    },
    () => {
      const a = R(1, 9);
      const d = R(2, 5 + M);
      const k = R(8, 12 + 3 * M);
      return [`In the AP ${a}, ${a + d}, ${a + 2 * d}, … the term number ${k} is`, a + (k - 1) * d, "aₙ = a + (n − 1)d."];
    },
    () => {
      const a = R(1, 6);
      const d = R(1, 4 + M);
      const k = 2 * R(3, 5 + 2 * M);
      return [
        `The sum of the first ${k} terms of the AP ${a}, ${a + d}, ${a + 2 * d}, … is`,
        (k * (2 * a + (k - 1) * d)) / 2,
        "Sₙ = n/2 [2a + (n − 1)d].",
      ];
    },
    () => {
      const triples = [
        [3, 4, 5],
        [5, 12, 13],
        [8, 15, 17],
        [7, 24, 25],
      ];
      const t = triples[R(0, Math.min(level, 3))];
      const k = R(1, 1 + M);
      const x = R(-5, 5);
      const y = R(-5, 5);
      return [
        `The distance between (${x}, ${y}) and (${x + t[0] * k}, ${y + t[1] * k}) is`,
        t[2] * k,
        "Distance = √[(x₂ − x₁)² + (y₂ − y₁)²].",
      ];
    },
    () => {
      const p = R(1, 3 + M);
      const q = R(p + 1, 6 + 2 * M);
      return [`The larger root of x² − ${p + q}x + ${p * q} = 0 is`, q, `Factorise: (x − ${p})(x − ${q}) = 0.`];
    },
    () => {
      const r = 7 * R(1, 1 + Math.ceil(level / 2));
      const h = R(2, 6 + M);
      return [
        `The volume of a cylinder of radius ${r} cm and height ${h} cm (π = 22/7), in cm³, is`,
        (22 * r * r * h) / 7,
        "V = πr²h.",
      ];
    },
    () => {
      const k = R(5, 12 + 4 * M);
      return [`The sum of the first ${k} odd natural numbers is`, k * k, "The sum of the first n odd numbers is n²."];
    },
  ];

  const easyFns: Array<() => [string, number, string]> = [
    () => {
      const a = R(6, 15);
      const b = R(3, 12);
      return [`What is ${a} × ${b}?`, a * b, `Multiply ${a} by ${b}.`];
    },
    () => {
      const a = R(20, 99);
      const b = R(11, 60);
      return [`What is ${a} + ${b}?`, a + b, "Add the two numbers."];
    },
    () => {
      const a = R(40, 99);
      const b = R(11, 39);
      return [`What is ${a} − ${b}?`, a - b, "Subtract the smaller number."];
    },
    () => {
      const l = R(6, 20);
      const b = R(3, l - 1);
      return [`The perimeter of a rectangle of length ${l} cm and breadth ${b} cm is, in cm,`, 2 * (l + b), "Perimeter = 2 × (l + b)."];
    },
    () => {
      const l = R(5, 15);
      const b = R(3, 12);
      return [`The area of a rectangle of length ${l} cm and breadth ${b} cm is, in cm²,`, l * b, "Area = length × breadth."];
    },
    () => {
      const x = R(5, 30);
      const y = R(5, 30) + x;
      return [`Find x: x + ${x} = ${y}`, y - x, `Subtract ${x} from both sides.`];
    },
    () => {
      const n = 10 * R(2, 30);
      return [`What is 10% of ${n}?`, n / 10, "10% means one-tenth."];
    },
    () => {
      const n = R(4, 15);
      return [`What is ${n}²?`, n * n, `Multiply ${n} by itself.`];
    },
  ];

  const medFns: Array<() => [string, number, string]> = [
    () => {
      const a = R(2, 9);
      const x = R(2, 15);
      const c = R(1, 20);
      return [`Solve for x: ${a}x + ${c} = ${a * x + c}`, x, `Subtract ${c}, then divide by ${a}.`];
    },
    () => {
      const n = R(11, 30);
      return [`What is √${n * n}?`, n, `The square root of ${n}² is ${n}.`];
    },
    () => {
      const p = 100 * R(2, 40);
      const r = R(2, 10);
      const t = R(2, 5);
      return [`The simple interest on ₹${p} at ${r}% per year for ${t} years is, in ₹,`, (p * r * t) / 100, "SI = P × R × T ÷ 100."];
    },
    () => {
      const a = R(2, 9);
      const b = R(2, 9);
      return [`The value of (${a} + ${b})² − ${a * a} − ${b * b} is`, 2 * a * b, "(a + b)² = a² + 2ab + b²."];
    },
    () => {
      const triples = [
        [3, 4, 5],
        [5, 12, 13],
        [8, 15, 17],
      ];
      const t = triples[R(0, 2)];
      const k = R(1, 4);
      return [
        `The hypotenuse of a right triangle with sides ${t[0] * k} cm and ${t[1] * k} cm is, in cm,`,
        t[2] * k,
        "Use Pythagoras: a² + b² = c².",
      ];
    },
    () => {
      const b = 2 * R(3, 15);
      const h = R(4, 16);
      return [`The area of a triangle with base ${b} cm and height ${h} cm is, in cm²,`, (b * h) / 2, "Area = ½ × base × height."];
    },
    () => {
      const p = 5 * R(2, 18);
      const n = 20 * R(2, 30);
      return [`What is ${p}% of ${n}?`, (p * n) / 100, "Percent × number ÷ 100."];
    },
  ];

  const amaySpecialFns: Array<() => [string, number, string]> = [
    () => {
      const alpha = R(2, 9);
      const beta = R(alpha + 1, 13);
      return [
        `If α and β are the roots of x² − ${alpha + beta}x + ${alpha * beta} = 0, what is α² + β²?`,
        alpha * alpha + beta * beta,
        "α² + β² = (α + β)² − 2αβ.",
      ];
    },
    () => {
      const a = R(2, 5);
      const r = R(2, 6);
      const b = 2 * a * r;
      return [
        `For what positive value of k does ${a}x² − ${b}x + k = 0 have real and equal roots?`,
        a * r * r,
        "For equal roots, discriminant b² − 4ac = 0 ⇒ k = b² ÷ (4a).",
      ];
    },
    () => {
      const k = R(3, 8);
      const ans = k * k * k;
      return [
        `A sphere of radius ${k * 2} cm is melted into small spheres of radius 2 cm. How many small spheres are formed?`,
        ans,
        "Number of spheres = (R ÷ r)³.",
      ];
    },
    () => {
      const x1 = R(-4, 4);
      const y1 = R(-4, 4);
      const dx = 2 * R(2, 7);
      const dy = 2 * R(2, 7);
      return [
        `The sum of coordinates (x + y) of the midpoint between (${x1}, ${y1}) and (${x1 + dx}, ${y1 + dy}) is`,
        x1 + dx / 2 + (y1 + dy / 2),
        "Midpoint = ((x₁+x₂)/2, (y₁+y₂)/2).",
      ];
    },
    () => {
      const mean = R(18, 36);
      const median = mean + R(2, 6);
      return [
        `If the mean is ${mean} and the median is ${median}, what is the empirical mode?`,
        3 * median - 2 * mean,
        "Empirical formula: Mode = 3(Median) − 2(Mean).",
      ];
    },
    () => {
      const a = R(3, 9);
      const d = R(4, 11);
      const n = R(14, 24);
      const nth = a + (n - 1) * d;
      return [
        `Which term number of the AP ${a}, ${a + d}, ${a + 2 * d}, … equals ${nth}?`,
        n,
        "Use aₙ = a + (n − 1)d and solve for n.",
      ];
    },
    () => {
      const r = 7 * R(1, 3);
      const l = R(8, 20);
      return [
        `The curved surface area of a cone of radius ${r} cm and slant height ${l} cm (π = 22/7), in cm², is`,
        (22 * r * l) / 7,
        "CSA of a cone = πrl.",
      ];
    },
    () => {
      const a = R(2, 6);
      const b = R(2, 6);
      return [
        `The value of (${a}sec²θ − ${a}tan²θ) + (${b}sin²θ + ${b}cos²θ) is`,
        a + b,
        "sec²θ − tan²θ = 1 and sin²θ + cos²θ = 1.",
      ];
    },
  ];

  const poolFns =
    level >= 3 ? amaySpecialFns : level === 2 ? hardFns : level === 1 ? medFns : easyFns;
  let guard = 0;
  while (out.length < count && guard++ < count * 20) {
    const [q, a, e] = poolFns[R(0, poolFns.length - 1)]();
    if (seen.has(q)) continue;
    seen.add(q);
    const wrong = new Set<number>();
    const offsets = [1, -1, 2, -2, 3, -3, 10, -10];
    while (wrong.size < 3) {
      const v = a + offsets[R(0, offsets.length - 1)];
      if (v > 0 && v !== a) wrong.add(v);
    }
    const opts = shuffle([a, ...wrong]).map(String) as [string, string, string, string];
    out.push([q, opts, opts.indexOf(String(a)), e, level]);
  }
  return out;
}

export function mergeDynamicQuestions(dynamicRows: DynamicQuestionRow[]): Record<SubjectKey, RawQuestion[]> {
  const merged = {} as Record<SubjectKey, RawQuestion[]>;
  for (const k of SUBJECT_ORDER) {
    merged[k] = [...STATIC_QUESTIONS[k].q];
  }
  for (const row of dynamicRows) {
    if (row.subject === "msd") continue;
    const subj = row.subject as SubjectKey;
    if (!merged[subj]) continue;
    const raw: RawQuestion = [
      row.question_text,
      [row.option_a, row.option_b, row.option_c, row.option_d],
      Math.max(0, Math.min(3, Number(row.correct_index) || 0)),
      row.explanation || "",
      Math.max(0, Math.min(3, Number(row.level) || 0)),
    ];
    merged[subj].push(raw);
  }
  return merged;
}

export function getSubjectMeta(k: QuizKey) {
  if (k === "mix") return { name: "Normal quiz", emoji: "🎯" };
  return {
    name: STATIC_QUESTIONS[k].n,
    emoji: STATIC_QUESTIONS[k].e,
  };
}

export function getAvailableCount(k: QuizKey, mergedBank: Record<SubjectKey, RawQuestion[]>): number {
  if (k === "mix") return 999;
  return mergedBank[k].length + (k === "math" ? 100 : 0);
}

export interface BuildQuizOptions {
  guestId?: string;
  playerRank?: number;
}

export function buildQuizSet(
  k: QuizKey,
  level: number,
  count: number,
  mergedBank: Record<SubjectKey, RawQuestion[]>,
  options: BuildQuizOptions = {}
): RawQuestion[] {
  const rankRule = getRankDifficultyRule(options.playerRank);
  const effectiveLevel = k === "mix" ? Math.max(level, rankRule.minLevel) : level;
  const isTop20 = Boolean(options.playerRank && options.playerRank <= 20);
  const isTop50 = Boolean(options.playerRank && options.playerRank <= 50);

  const seenList = loadSeenQuestionKeys(options.guestId);
  const seenOrder = new Map<string, number>();
  seenList.forEach((key, idx) => seenOrder.set(key, idx));

  const poolForSubject = (subj: SubjectKey, targetLvl: number): RawQuestion[] => {
    let items = [...mergedBank[subj]];
    if (subj === "math") {
      items = items.concat(generateMathQuestions(targetLvl, 50));
      if (isTop20 && targetLvl === 2) {
        items = items.concat(generateMathQuestions(3, 25));
      }
    }

    // Never serve Easy (0) in Mixed Quiz for Top 50 when higher-tier items exist
    if (k === "mix" && isTop50) {
      const nonEasy = items.filter((q) => q[4] >= 1);
      if (nonEasy.length >= 6) {
        items = nonEasy;
      }
    }

    // Shuffle first for random ordering within equal priority tiers
    const randomized = shuffle(items);

    const priorityScore = (q: RawQuestion): number => {
      const qKey = normalizeQuestionKey(q[0]);
      const seenIdx = seenOrder.get(qKey);
      const isSeen = seenIdx !== undefined;
      const lvlDiff = Math.abs(q[4] - targetLvl);

      // Exact level match first (for Top 20 on Hard, allow Amay Special closely alongside Hard)
      let levelBucket = lvlDiff * 10000;
      if (isTop20 && targetLvl === 2 && q[4] === 3) {
        levelBucket = 1500;
      }

      // Unseen questions strictly beat seen questions; oldest-seen beats recently-seen
      const seenPenalty = isSeen ? 500 + (seenIdx as number) : 0;
      return levelBucket + seenPenalty;
    };

    return randomized.sort((a, b) => priorityScore(a) - priorityScore(b));
  };

  let picked: RawQuestion[] = [];

  if (k === "mix") {
    const rotatedSubjects = shuffle(SUBJECT_ORDER);
    const pools = rotatedSubjects.map((subj, idx) => {
      // Top 20 players playing Hard get ~40% Amay Special questions mixed in automatically
      const slotTarget =
        isTop20 && effectiveLevel === 2 && idx % 2 === 1 ? 3 : effectiveLevel;
      return poolForSubject(subj, slotTarget);
    });
    const usedText = new Set<string>();
    let idx = 0;
    let guard = 0;
    while (picked.length < count && pools.some((p) => p.length > 0) && guard++ < count * 20) {
      const p = pools[idx++ % pools.length];
      const next = p.shift();
      if (!next) continue;
      const norm = normalizeQuestionKey(next[0]);
      if (usedText.has(norm)) continue;
      usedText.add(norm);
      picked.push(next);
    }
    picked = shuffle(picked);
  } else {
    const pool = poolForSubject(k, effectiveLevel);
    const usedText = new Set<string>();
    for (const q of pool) {
      if (picked.length >= count) break;
      const norm = normalizeQuestionKey(q[0]);
      if (usedText.has(norm)) continue;
      usedText.add(norm);
      picked.push(q);
    }
    picked = shuffle(picked);
  }

  return picked.map(([text, opts, correctIdx, expl, lvl]) => {
    const tagged = shuffle(opts.map((optText, idx) => ({ optText, isCorrect: idx === correctIdx })));
    return [
      text,
      tagged.map((t) => t.optText) as [string, string, string, string],
      tagged.findIndex((t) => t.isCorrect),
      expl,
      lvl,
    ];
  });
}

export interface SubjectQuestionCounts {
  subject: SubjectKey;
  name: string;
  emoji: string;
  counts: [number, number, number, number];
  total: number;
  staticTotal: number;
  dynamicTotal: number;
}

export interface QuestionGapAdvice {
  subject: SubjectKey;
  subjectName: string;
  level: 2 | 3;
  levelName: string;
  current: number;
  target: number;
  needed: number;
}

export interface QuestionInventorySummary {
  rows: SubjectQuestionCounts[];
  modeTotals: [number, number, number, number];
  grandTotal: number;
  highLevelTotal: number;
  gaps: QuestionGapAdvice[];
}

export function getQuestionInventory(
  mergedBank: Record<SubjectKey, RawQuestion[]>,
  targetPerHighMode = HIGH_LEVEL_TARGET_PER_MODE
): QuestionInventorySummary {
  const modeTotals: [number, number, number, number] = [0, 0, 0, 0];
  let grandTotal = 0;
  const gaps: QuestionGapAdvice[] = [];

  const rows: SubjectQuestionCounts[] = SUBJECT_ORDER.map((subj) => {
    const list = mergedBank[subj] || [];
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    for (const q of list) {
      const lvl = Math.max(0, Math.min(3, q[4] ?? 0));
      counts[lvl] += 1;
      modeTotals[lvl] += 1;
    }
    const staticTotal = STATIC_QUESTIONS[subj].q.length;
    const total = list.length;
    const dynamicTotal = Math.max(0, total - staticTotal);
    grandTotal += total;

    ([2, 3] as const).forEach((lvl) => {
      if (counts[lvl] < targetPerHighMode) {
        gaps.push({
          subject: subj,
          subjectName: STATIC_QUESTIONS[subj].n,
          level: lvl,
          levelName: LEVELS[lvl],
          current: counts[lvl],
          target: targetPerHighMode,
          needed: targetPerHighMode - counts[lvl],
        });
      }
    });

    return {
      subject: subj,
      name: STATIC_QUESTIONS[subj].n,
      emoji: STATIC_QUESTIONS[subj].e,
      counts,
      total,
      staticTotal,
      dynamicTotal,
    };
  });

  gaps.sort((a, b) => b.needed - a.needed);

  return {
    rows,
    modeTotals,
    grandTotal,
    highLevelTotal: modeTotals[2] + modeTotals[3],
    gaps,
  };
}

export function getUnlockedOverallMilestones(xp: number): OverallBadgeMilestone[] {
  return OVERALL_BADGE_MILESTONES.filter((m) => xp >= m);
}

export function getHighestOverallMilestone(xp: number): OverallBadgeMilestone | null {
  const unlocked = getUnlockedOverallMilestones(xp);
  return unlocked.length > 0 ? unlocked[unlocked.length - 1] : null;
}

export function getNextOverallMilestone(xp: number): OverallBadgeMilestone | null {
  return OVERALL_BADGE_MILESTONES.find((m) => m > xp) ?? null;
}

export function getMilestones(): number[] {
  return [...OVERALL_BADGE_MILESTONES];
}

export interface BadgeItem {
  icon: string;
  label: string;
  milestone?: OverallBadgeMilestone;
  unlocked: boolean;
}

export function getBadges(profile: StudentProfile): BadgeItem[] {
  const meta: Record<OverallBadgeMilestone, { icon: string; name: string }> = {
    100: { icon: "🥉", name: "100 XP" },
    1000: { icon: "🥈", name: "1,000 XP" },
    10000: { icon: "🥇", name: "10,000 XP" },
    100000: { icon: "👑", name: "100,000 XP" },
  };
  return OVERALL_BADGE_MILESTONES.map((m) => ({
    icon: profile.xp >= m ? meta[m].icon : "🔒",
    label: meta[m].name,
    milestone: m,
    unlocked: profile.xp >= m,
  }));
}

export interface RankListEntry {
  name: string;
  xp: number;
  isMe: boolean;
  peerUuid?: string;
}

export interface ImmediateRival {
  rank: number;
  name: string;
  xp: number;
  diffXp: number;
  xpToPass: number;
  questionsNeeded: number;
  peerUuid?: string;
}

export interface ChaserRival {
  rank: number;
  name: string;
  xp: number;
  gapBelow: number;
  peerUuid?: string;
}

export interface RankSnapshot {
  myRank: number;
  myXp: number;
  totalPlayers: number;
  topPercentile: number;
  climbPercent: number;
  nextAhead: ImmediateRival[];
  chaserBehind: ChaserRival | null;
  podium: {
    first: RankListEntry | null;
    second: RankListEntry | null;
    third: RankListEntry | null;
    fourth: RankListEntry | null;
  };
  xpToTop3: number;
  progressToTop3Pct: number;
  podiumCushion: number;
}

export function computeRankSnapshot(
  entries: RankListEntry[],
  fallbackMyXp = 0
): RankSnapshot {
  const myIdx = entries.findIndex((e) => e.isMe);
  const myEntry = myIdx >= 0 ? entries[myIdx] : undefined;
  const myXp = myEntry ? myEntry.xp : fallbackMyXp;
  const totalPlayers = Math.max(1, entries.length);

  const strictlyAhead = entries.filter((e) => !e.isMe && e.xp > myXp);
  const myRank = 1 + strictlyAhead.length;
  const topPercentile = Math.max(1, Math.min(100, Math.round((myRank / totalPlayers) * 100)));
  const climbPercent =
    totalPlayers > 1
      ? Math.max(4, Math.min(100, Math.round(((totalPlayers - myRank) / (totalPlayers - 1)) * 100)))
      : 100;

  const nextAhead: ImmediateRival[] =
    myIdx > 0
      ? entries
          .slice(Math.max(0, myIdx - 3), myIdx)
          .reverse()
          .map((entry, offset) => {
            const rank = myIdx - offset;
            const diffXp = Math.max(0, entry.xp - myXp);
            const xpToPass = Math.max(1, diffXp + 1);
            return {
              rank,
              name: entry.name,
              xp: entry.xp,
              diffXp,
              xpToPass,
              questionsNeeded: Math.max(1, Math.ceil(xpToPass / XP_PER_LEVEL[1])),
              peerUuid: entry.peerUuid,
            };
          })
      : [];

  const chaserEntry = myIdx >= 0 && myIdx + 1 < entries.length ? entries[myIdx + 1] : null;
  const chaserBehind: ChaserRival | null = chaserEntry
    ? {
        rank: myIdx + 2,
        name: chaserEntry.name,
        xp: chaserEntry.xp,
        gapBelow: Math.max(0, myXp - chaserEntry.xp),
        peerUuid: chaserEntry.peerUuid,
      }
    : null;

  const first = entries[0] ?? null;
  const second = entries[1] ?? null;
  const third = entries[2] ?? null;
  const fourth = entries[3] ?? null;

  const xpToTop3 = third && myRank > 3 ? Math.max(1, third.xp - myXp + 1) : 0;
  const progressToTop3Pct =
    myRank <= 3 && myXp > 0
      ? 100
      : third && third.xp > 0
        ? Math.max(4, Math.min(99, Math.round((myXp / third.xp) * 100)))
        : 0;
  const podiumCushion = myRank <= 3 && fourth ? Math.max(0, myXp - fourth.xp) : 0;

  return {
    myRank,
    myXp,
    totalPlayers,
    topPercentile,
    climbPercent,
    nextAhead,
    chaserBehind,
    podium: { first, second, third, fourth },
    xpToTop3,
    progressToTop3Pct,
    podiumCushion,
  };
}
