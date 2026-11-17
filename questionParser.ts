import * as pdfjsLib from "pdfjs-dist";
import type { AdminSubjectKey } from "../data/questions";

// Configure pdf.js worker via bundled URL
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export interface ParsedBulkQuestion {
  subject: AdminSubjectKey;
  level: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_index: number;
  explanation: string;
}

const VALID_SUBJECTS: AdminSubjectKey[] = ["math", "sci", "sst", "eng", "hin", "ca", "msd"];

function normalizeSubject(raw: string | undefined, fallback: AdminSubjectKey): AdminSubjectKey {
  const s = (raw || "").trim().toLowerCase();
  if (VALID_SUBJECTS.includes(s as AdminSubjectKey)) return s as AdminSubjectKey;
  if (s.includes("msd") || s.includes("dhoni") || s.includes("csk") || s.includes("captain")) return "msd";
  if (s.includes("math")) return "math";
  if (s.includes("sci")) return "sci";
  if (s.includes("soc") || s === "sst" || s.includes("hist") || s.includes("geo") || s.includes("pol")) return "sst";
  if (s.includes("eng")) return "eng";
  if (s.includes("hin")) return "hin";
  if (s.includes("curr") || s === "ca" || s.includes("gk")) return "ca";
  return fallback;
}

function normalizeLevel(raw: string | number | undefined, fallback: number): number {
  if (typeof raw === "number" && raw >= 0 && raw <= 3) return raw;
  const s = String(raw || "").trim().toLowerCase();
  if (s === "0" || s.includes("easy")) return 0;
  if (s === "1" || s.includes("med")) return 1;
  if (s === "2" || s.includes("hard")) return 2;
  if (s === "3" || s.includes("amay") || s.includes("spec")) return 3;
  return fallback;
}

function normalizeAnswerIndex(raw: string | number | undefined): number {
  if (typeof raw === "number" && raw >= 0 && raw <= 3) return raw;
  const s = String(raw || "").trim().toUpperCase();
  if (s === "A" || s === "1" || s === "0") return s === "1" ? 0 : 0;
  if (s === "B" || s === "2") return 1;
  if (s === "C" || s === "3") return 2;
  if (s === "D" || s === "4") return 3;
  const letter = s.match(/^[ABCD]/);
  if (letter) return "ABCD".indexOf(letter[0]);
  return 0;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

export function parseCsvQuestions(
  text: string,
  defaultSubject: AdminSubjectKey,
  defaultLevel: number
): ParsedBulkQuestion[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const firstCols = parseCsvLine(lines[0]).map((c) => c.toLowerCase());
  const hasHeader =
    firstCols.some((c) => c.includes("question") || c.includes("option") || c === "a");

  const startIdx = hasHeader ? 1 : 0;
  const out: ParsedBulkQuestion[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 6) continue;

    // Support both:
    // 8-9 cols: subject, level, question, optA, optB, optC, optD, answer, explanation
    // 6-7 cols: question, optA, optB, optC, optD, answer, explanation
    if (cols.length >= 8) {
      const [subj, lvl, q, a, b, c, d, ans, exp] = cols;
      if (!q || !a || !b || !c || !d) continue;
      out.push({
        subject: normalizeSubject(subj, defaultSubject),
        level: normalizeLevel(lvl, defaultLevel),
        question_text: q,
        option_a: a,
        option_b: b,
        option_c: c,
        option_d: d,
        correct_index: normalizeAnswerIndex(ans),
        explanation: exp || "",
      });
    } else {
      const [q, a, b, c, d, ans, exp] = cols;
      if (!q || !a || !b || !c || !d) continue;
      out.push({
        subject: defaultSubject,
        level: defaultLevel,
        question_text: q,
        option_a: a,
        option_b: b,
        option_c: c,
        option_d: d,
        correct_index: normalizeAnswerIndex(ans),
        explanation: exp || "",
      });
    }
  }

  return out;
}

export function parseJsonQuestions(
  text: string,
  defaultSubject: AdminSubjectKey,
  defaultLevel: number
): ParsedBulkQuestion[] {
  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : [];
    const out: ParsedBulkQuestion[] = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const qText = item.question_text || item.question || item.q || "";
      const opts = Array.isArray(item.options) ? item.options : [];
      const a = item.option_a ?? item.a ?? opts[0] ?? "";
      const b = item.option_b ?? item.b ?? opts[1] ?? "";
      const c = item.option_c ?? item.c ?? opts[2] ?? "";
      const d = item.option_d ?? item.d ?? opts[3] ?? "";
      if (!qText || !a || !b || !c || !d) continue;
      out.push({
        subject: normalizeSubject(item.subject, defaultSubject),
        level: normalizeLevel(item.level, defaultLevel),
        question_text: String(qText).trim(),
        option_a: String(a).trim(),
        option_b: String(b).trim(),
        option_c: String(c).trim(),
        option_d: String(d).trim(),
        correct_index: normalizeAnswerIndex(item.correct_index ?? item.correct ?? item.answer),
        explanation: String(item.explanation ?? item.exp ?? "").trim(),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function parseTextMcqQuestions(
  rawText: string,
  defaultSubject: AdminSubjectKey,
  defaultLevel: number
): ParsedBulkQuestion[] {
  // Normalize common PDF spacing so options on same line get split cleanly
  const normalized = rawText
    .replace(/\r/g, "\n")
    .replace(/\s+(?=\(?[A-Da-d][\).]\s)/g, "\n")
    .replace(/\s+(?=(?:Answer|Ans|Correct|Key|Explanation|Sol|Solution)\s*[:.\-])/gi, "\n");

  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const out: ParsedBulkQuestion[] = [];
  let curQ: string[] = [];
  let opts: Partial<Record<"A" | "B" | "C" | "D", string>> = {};
  let ans: number | null = null;
  let exp: string[] = [];
  let stage: "q" | "opt" | "exp" = "q";

  const flush = () => {
    const qText = curQ.join(" ").replace(/^(?:Q\.?\s*\d+[\).:\-]?\s*|\d+[\).:\-]\s*|\(\d+\)\s*)/i, "").trim();
    if (qText && opts.A && opts.B && opts.C && opts.D) {
      out.push({
        subject: defaultSubject,
        level: defaultLevel,
        question_text: qText,
        option_a: opts.A.trim(),
        option_b: opts.B.trim(),
        option_c: opts.C.trim(),
        option_d: opts.D.trim(),
        correct_index: ans ?? 0,
        explanation: exp.join(" ").trim(),
      });
    }
    curQ = [];
    opts = {};
    ans = null;
    exp = [];
    stage = "q";
  };

  for (const line of lines) {
    // Check if new question starts (e.g., "1. ..." or "Q2) ...")
    const qStart = line.match(/^(?:Q\.?\s*\d+[\).:\-]|\d+[\).:]|\(\d+\))\s+(.+)/i);
    if (qStart && (opts.A || curQ.length > 0)) {
      if (opts.A && opts.B && opts.C && opts.D) {
        flush();
      } else if (opts.D || ans !== null) {
        flush();
      }
      curQ.push(qStart[1]);
      stage = "q";
      continue;
    }

    // Check option A/B/C/D
    const optMatch = line.match(/^\(?([A-Da-d])[\).:\-]\s*(.+)$/);
    if (optMatch) {
      const letter = optMatch[1].toUpperCase() as "A" | "B" | "C" | "D";
      opts[letter] = optMatch[2];
      stage = "opt";
      continue;
    }

    // Check Answer line
    const ansMatch = line.match(/^(?:Answer|Ans|Correct(?:\s*Option)?|Key)\s*[:.\-]?\s*\(?([A-Da-d1-4])\)?/i);
    if (ansMatch) {
      ans = normalizeAnswerIndex(ansMatch[1]);
      continue;
    }

    // Check Explanation line
    const expMatch = line.match(/^(?:Explanation|Sol|Solution|Hint)\s*[:.\-]?\s*(.+)$/i);
    if (expMatch) {
      exp.push(expMatch[1]);
      stage = "exp";
      continue;
    }

    if (stage === "exp") {
      exp.push(line);
    } else if (stage === "q") {
      curQ.push(line);
    }
  }

  flush();
  return out;
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = Array.isArray(item.transform) ? item.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
        if (line.trim()) lines.push(line.trim());
        line = item.str;
      } else {
        line += (line ? " " : "") + item.str;
      }
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    pageTexts.push(lines.join("\n"));
  }

  return pageTexts.join("\n");
}

export async function parseBulkQuestionFile(
  file: File,
  defaultSubject: AdminSubjectKey,
  defaultLevel: number
): Promise<{ questions: ParsedBulkQuestion[]; rawTextPreview?: string }> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".json")) {
    const txt = await file.text();
    return { questions: parseJsonQuestions(txt, defaultSubject, defaultLevel) };
  }

  if (name.endsWith(".csv")) {
    const txt = await file.text();
    return { questions: parseCsvQuestions(txt, defaultSubject, defaultLevel) };
  }

  if (name.endsWith(".pdf")) {
    const txt = await extractTextFromPdf(file);
    const questions = parseTextMcqQuestions(txt, defaultSubject, defaultLevel);
    return { questions, rawTextPreview: txt.slice(0, 800) };
  }

  // Fallback .txt or other plain text
  const txt = await file.text();
  const asCsv = parseCsvQuestions(txt, defaultSubject, defaultLevel);
  if (asCsv.length > 0) return { questions: asCsv };
  const questions = parseTextMcqQuestions(txt, defaultSubject, defaultLevel);
  return { questions, rawTextPreview: txt.slice(0, 800) };
}

export function classifyQuestionDifficulty(
  subject: AdminSubjectKey,
  questionText: string,
  options: string[] = [],
  explanation = ""
): 0 | 1 | 2 | 3 {
  const text = `${questionText} ${explanation} ${options.join(" ")}`.toLowerCase();
  const qOnly = questionText.trim();
  const wordCount = qOnly.split(/\s+/).filter(Boolean).length;
  let score = 1; // baseline Medium

  // Clear Amay Special (hardest) competitive/multi-step/analytical markers
  if (
    /kesavananda|basic structure|itcz|monetary policy|article (100|148|279a|352|356|360)|schedule|ryotwari|mahalwari|khadar|bangar|synecdoche|inversion|scarcely|hardly had|lest you|conditional|sec²|cosec|α²|β²|discriminant|empirical mode|melted|recast|equidistant|dihybrid|mendel|isoto|ph of a solution|lactic acid|hypermetropia|refactive|refractive index|अयादि|विसर्ग|श्लेष|उत्प्रेक्षा|ज्ञानपीठ|चौपाई|दोहा|अतिशयोक्ति|lagrange|bimstec|ramsar|pslv|biosphere/i.test(
      text
    )
  ) {
    score += 2;
  }

  // Clear Hard markers
  if (
    /constitutional|amendment|treaty|viceroy|governor-general|concurrent list|union list|state list|unemployment|hydroelectric|dam|steel plant|oxidation|reduction|displacement|enzyme|pancreatic|allotrope|cathode|anode|capacitor|inductance|radioactivity|oxymoron|extempore|passive|indirect speech|idiom|ephemeral|laconic|pragmatic|बहुव्रीहि|कर्मधारय|तत्सम|यमक|रस का स्थायी|अलंकार|रचयिता|election commission|niti aayog|gst council|curvilinear|curved surface|cone|cylinder|probability|doublet|quadratic|trigonometr/i.test(
      text
    )
  ) {
    score += 1;
  }

  // Multi-clause / multi-step numerical complexity
  if (wordCount >= 18) score += 1;
  if (/\d+\s*[x²³^√÷×]/.test(qOnly) && wordCount >= 10) score += 1;

  // Clear Easy basic-recall markers
  if (
    wordCount <= 9 &&
    /(what is \d+\s*[+\-×]\s*\d+|capital of (india|france|germany|russia|italy|japan|nepal|egypt)|opposite of|past tense of|plural of|national (bird|flower|animal|fruit|tree)|festival of|symbol of (carbon|oxygen|gold|iron|sodium|nitrogen|calcium)|planet (nearest|largest|red|blue)|विलोम|पर्यायवाची)/i.test(
      text
    )
  ) {
    score -= 1;
  }

  // Subject-specific nuance
  if (subject === "math" && /ratio|melted|roots|section formula|collinear|probability/.test(text)) {
    score = Math.max(score, 2);
  }

  return Math.max(0, Math.min(3, score)) as 0 | 1 | 2 | 3;
}
