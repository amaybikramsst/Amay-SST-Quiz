import { STATIC_QUESTIONS, type QuizKey, type RawQuestion, type SubjectKey } from "../data/questions";
import type { DynamicQuestionRow } from "./supabase";

export const LEVELS = ["Easy", "Medium", "Hard", "Amay Special"] as const;
export const XP_PER_LEVEL = [10, 15, 20, 30] as const;
export const NEGATIVE_RATIO = 0.25; // 1/4 negative marking per wrong answer

// Strictly 2 minutes (10 questions) and 5 minutes (20 questions)
export const QUIZ_LENGTHS: Record<number, number> = {
  10: 2,
  20: 5,
};

export interface StudentProfile {
  name: string;
  xp: number;
  streak: number;
  last: string;
  quizzes: number;
  perfect: number;
  theme: "" | "light" | "dark";
  nameAt?: number;
  td?: { d: string; xp: number };
  lastCloudXp?: number;
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

export function todayUTC(offsetDays = 0): string {
  return new Date(Date.now() - offsetDays * 864e5).toISOString().slice(0, 10);
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function getGuestUUID(): string {
  let id = localStorage.getItem("amaysst_uuid");
  if (!id) {
    id =
      "guest_" +
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now());
    localStorage.setItem("amaysst_uuid", id);
  }
  return id;
}

export function loadProfile(): StudentProfile {
  try {
    const raw = localStorage.getItem("r10");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        name: parsed.name || "",
        xp: Math.max(0, Number(parsed.xp) || 0),
        streak: Number(parsed.streak) || 0,
        last: parsed.last || "",
        quizzes: Number(parsed.quizzes) || 0,
        perfect: Number(parsed.perfect) || 0,
        theme: parsed.theme || "",
        nameAt: parsed.nameAt,
        td: parsed.td,
        lastCloudXp: typeof parsed.lastCloudXp === "number" ? parsed.lastCloudXp : undefined,
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

  const poolFns = level < 2 ? (level ? medFns : easyFns) : hardFns;
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
    const subj = row.subject;
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

export function buildQuizSet(
  k: QuizKey,
  level: number,
  count: number,
  mergedBank: Record<SubjectKey, RawQuestion[]>
): RawQuestion[] {
  const poolForSubject = (subj: SubjectKey): RawQuestion[] => {
    let items = [...mergedBank[subj]];
    if (subj === "math") {
      items = items.concat(generateMathQuestions(level, 100));
    }
    return shuffle(items).sort((x, y) => Math.abs(x[4] - level) - Math.abs(y[4] - level));
  };

  let picked: RawQuestion[] = [];

  if (k === "mix") {
    const pools = SUBJECT_ORDER.map((subj) => poolForSubject(subj));
    let idx = 0;
    while (picked.length < count && pools.some((p) => p.length > 0)) {
      const p = pools[idx++ % pools.length];
      const next = p.shift();
      if (next) picked.push(next);
    }
    picked = shuffle(picked);
  } else {
    picked = shuffle(poolForSubject(k).slice(0, count));
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

export function getMilestones(xp: number): number[] {
  const arr = [10, 50, 100, 150, 200];
  for (let m = 300; m <= xp + 300; m += 100) arr.push(m);
  return arr;
}

export interface BadgeItem {
  icon: string;
  label: string;
  unlocked: boolean;
}

export function getBadges(profile: StudentProfile): BadgeItem[] {
  const milestones = getMilestones(profile.xp);
  const icons = ["🌱", "🥉", "🥈", "🥇", "🏅", "💎", "👑", "🚀"];
  const upcoming = milestones.filter((m) => m > profile.xp).slice(0, 3);
  return [
    { icon: "🎯", label: "First quiz", unlocked: profile.quizzes >= 1 },
    { icon: "🔥", label: "3-day streak", unlocked: profile.streak >= 3 },
    { icon: "💯", label: "Perfect score", unlocked: profile.perfect >= 1 },
    ...milestones
      .filter((m) => m <= profile.xp)
      .map((m, i) => ({ icon: icons[i % icons.length], label: `${m} XP`, unlocked: true })),
    ...upcoming.map((m) => ({ icon: "🔒", label: `${m} XP`, unlocked: false })),
  ];
}
