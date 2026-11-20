import * as pdfjsLib from "pdfjs-dist";
import type { SubjectKey } from "../data/questions";

// Configure pdf.js worker via bundled URL
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export interface ParsedBulkQuestion {
  subject: SubjectKey;
  level: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_index: number;
  explanation: string;
}

const VALID_SUBJECTS: SubjectKey[] = ["math", "sci", "sst", "eng", "hin", "ca"];

function normalizeSubject(raw: string | undefined, fallback: SubjectKey): SubjectKey {
  const s = (raw || "").trim().toLowerCase();
  if (VALID_SUBJECTS.includes(s as SubjectKey)) return s as SubjectKey;
  if (s.includes("math")) return "math";
  if (s.includes("sci")) return "sci";
  if (s.includes("soc") || s === "sst" || s.includes("hist") || s.includes("geo") || s.includes("pol")) return "sst";
  if (s.includes("eng")) return "eng";
  if (s.includes("hin")) return "hin";
  if (s.includes("curr") || s === "ca" || s.includes("gk")) return "ca";
  return fallback;
}

function parseExplicitLevel(raw: string | number | undefined): number | null {
  if (typeof raw === "number" && raw >= 0 && raw <= 3) return raw;
  const s = String(raw || "").trim().toLowerCase();
  if (!s || s === "auto" || s === "ai") return null;
  if (s === "0" || s.includes("easy")) return 0;
  if (s === "1" || s.includes("med")) return 1;
  if (s === "2" || s.includes("hard")) return 2;
  if (s === "3" || s.includes("amay") || s.includes("spec")) return 3;
  return null;
}

function normalizeAnswerIndex(raw: string | number | undefined): number {
  if (typeof raw === "number" && raw >= 0 && raw <= 3) return raw;
  const s = String(raw || "").trim().toUpperCase();
  if (s === "A" || s === "1" || s === "0") return 0;
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
  defaultSubject: SubjectKey,
  _defaultLevel: number
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
  const seenInFile = new Set<string>();

  for (let i = startIdx; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 6) continue;

    // Support both:
    // 8-9 cols: subject, level, question, optA, optB, optC, optD, answer, explanation
    // 6-7 cols: question, optA, optB, optC, optD, answer, explanation
    if (cols.length >= 8) {
      const [subj, lvl, q, a, b, c, d, ans, exp] = cols;
      if (!q || !a || !b || !c || !d) continue;
      const dedupKey = q.trim().toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, "");
      if (seenInFile.has(dedupKey)) continue;
      seenInFile.add(dedupKey);

      const resolvedSubject = normalizeSubject(subj, defaultSubject);
      const explicitLevel = parseExplicitLevel(lvl);
      const autoLevel =
        explicitLevel !== null
          ? explicitLevel
          : classifyQuestionDifficulty(resolvedSubject, q, [a, b, c, d], exp || "");

      out.push({
        subject: resolvedSubject,
        level: autoLevel,
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
      const dedupKey = q.trim().toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, "");
      if (seenInFile.has(dedupKey)) continue;
      seenInFile.add(dedupKey);

      const autoLevel = classifyQuestionDifficulty(defaultSubject, q, [a, b, c, d], exp || "");

      out.push({
        subject: defaultSubject,
        level: autoLevel,
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
  defaultSubject: SubjectKey,
  _defaultLevel: number
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

      const resolvedSubject = normalizeSubject(item.subject, defaultSubject);
      const explicitLevel = parseExplicitLevel(item.level ?? item.difficulty);
      const cleanQ = String(qText).trim();
      const cleanA = String(a).trim();
      const cleanB = String(b).trim();
      const cleanC = String(c).trim();
      const cleanD = String(d).trim();
      const cleanExp = String(item.explanation ?? item.exp ?? "").trim();

      out.push({
        subject: resolvedSubject,
        level:
          explicitLevel !== null
            ? explicitLevel
            : classifyQuestionDifficulty(resolvedSubject, cleanQ, [cleanA, cleanB, cleanC, cleanD], cleanExp),
        question_text: cleanQ,
        option_a: cleanA,
        option_b: cleanB,
        option_c: cleanC,
        option_d: cleanD,
        correct_index: normalizeAnswerIndex(item.correct_index ?? item.correct ?? item.answer),
        explanation: cleanExp,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function parseTextMcqQuestions(
  rawText: string,
  defaultSubject: SubjectKey,
  _defaultLevel: number
): ParsedBulkQuestion[] {
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
      const cleanA = opts.A.trim();
      const cleanB = opts.B.trim();
      const cleanC = opts.C.trim();
      const cleanD = opts.D.trim();
      const cleanExp = exp.join(" ").trim();
      out.push({
        subject: defaultSubject,
        level: classifyQuestionDifficulty(defaultSubject, qText, [cleanA, cleanB, cleanC, cleanD], cleanExp),
        question_text: qText,
        option_a: cleanA,
        option_b: cleanB,
        option_c: cleanC,
        option_d: cleanD,
        correct_index: ans ?? 0,
        explanation: cleanExp,
      });
    }
    curQ = [];
    opts = {};
    ans = null;
    exp = [];
    stage = "q";
  };

  for (const line of lines) {
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

    const optMatch = line.match(/^\(?([A-Da-d])[\).:\-]\s*(.+)$/);
    if (optMatch) {
      const letter = optMatch[1].toUpperCase() as "A" | "B" | "C" | "D";
      opts[letter] = optMatch[2];
      stage = "opt";
      continue;
    }

    const ansMatch = line.match(/^(?:Answer|Ans|Correct(?:\s*Option)?|Key)\s*[:.\-]?\s*\(?([A-Da-d1-4])\)?/i);
    if (ansMatch) {
      ans = normalizeAnswerIndex(ansMatch[1]);
      continue;
    }

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
  defaultSubject: SubjectKey,
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

  const txt = await file.text();
  const asCsv = parseCsvQuestions(txt, defaultSubject, defaultLevel);
  if (asCsv.length > 0) return { questions: asCsv };
  const questions = parseTextMcqQuestions(txt, defaultSubject, defaultLevel);
  return { questions, rawTextPreview: txt.slice(0, 800) };
}

/**
 * Smart AI-style heuristic classifier for Easy (0), Medium (1), Hard (2), and Amay Special (3).
 * Analyzes CBSE/NCERT exam formats (Assertion-Reason, Multi-statement, Match-the-Following,
 * Chronology, Negative traps, Multi-step numericals, and conceptual depth).
 */
export function classifyQuestionDifficulty(
  subject: SubjectKey,
  questionText: string,
  options: string[] = [],
  explanation = ""
): 0 | 1 | 2 | 3 {
  const qOnly = questionText.trim();
  const optsJoined = options.join(" ");
  const text = `${qOnly} ${explanation} ${optsJoined}`.toLowerCase();
  const wordCount = qOnly.split(/\s+/).filter(Boolean).length;
  let score = 1; // Baseline: Medium (1)

  // 1. Amay Special (Level 3 - Hardest Exam / Board / Competitive Patterns)
  const isAssertionReason =
    /assertion\s*\(?a\)?.*reason\s*\(?r\)?|both a and r are true|कथन\s*\(?a\)?.*कारण\s*\(?r\)?/i.test(text);
  const isMultiStatement =
    /(statement\s*(i|1|ii|2)|consider the following statements|which of the following statements (is|are) (correct|true|incorrect)|only i and ii|i, ii and iii|निम्नलिखित कथनों पर विचार)/i.test(
      text
    );
  const isMatchOrChronology =
    /(match list|match the following|column\s*i.*column\s*ii|chronological order|arrange the following in (correct|ascending|descending|chronological)|कालानुक्रमिक|सुमेलित कीजिए)/i.test(
      text
    );

  if (isAssertionReason || isMultiStatement || isMatchOrChronology) {
    score += 2;
  }

  // Deep analytical / board-topper / competitive keywords
  if (
    /kesavananda|basic structure|itcz|monetary policy|article\s*(100|148|279a|352|356|360)|schedule|ryotwari|mahalwari|khadar|bangar|zollverein|frankfurt parliament|satyagraha|non-cooperation|civil disobedience|bretton woods|power sharing|federalism|concurrent list|synecdoche|inversion|scarcely|hardly had|lest you|conditional|sec²|cosec|α²|β²|discriminant|empirical mode|melted|recast|equidistant|dihybrid|mendel|isoto|ph of a solution|lactic acid|hypermetropia|myopia|refractive index|homologous series|saponification|esterification|अयादि|विसर्ग|श्लेष|उत्प्रेक्षा|ज्ञानपीठ|चौपाई|दोहा|अतिशयोक्ति|lagrange|bimstec|ramsar|pslv|biosphere/i.test(
      text
    )
  ) {
    score += 2;
  }

  // 2. Hard (Level 2 - Negative Traps, Causes/Consequences, Multi-step Formulas)
  const hasNegativeTrap =
    /\b(not true|not correct|incorrect|except|does not|is not a|which one is false|निम्न में से कौन.*नहीं)\b/i.test(
      qOnly
    );
  if (hasNegativeTrap) {
    score += 1;
  }

  if (
    /constitutional|amendment|treaty|viceroy|governor-general|union list|state list|unemployment|hydroelectric|steel plant|oxidation|reduction|displacement|double displacement|enzyme|pancreatic|allotrope|cathode|anode|capacitor|inductance|radioactivity|oxymoron|extempore|passive|indirect speech|idiom|ephemeral|laconic|pragmatic|बहुव्रीहि|कर्मधारय|तत्सम|यमक|रस का स्थायी|अलंकार|रचयिता|election commission|niti aayog|gst council|curvilinear|curved surface|cone|cylinder|probability|doublet|quadratic|trigonometr|nationalism|industrialisation|globalisation|print culture/i.test(
      text
    )
  ) {
    score += 1;
  }

  // Long or multi-clause questions require higher reading & reasoning effort
  if (wordCount >= 22) score += 1;
  if (wordCount >= 32) score += 1;
  if (/\d+\s*[x²³^√÷×]/.test(qOnly) && wordCount >= 10) score += 1;

  // 3. Easy (Level 0 - Short, direct single-fact recall)
  const isShortRecall =
    wordCount <= 11 &&
    !hasNegativeTrap &&
    !isAssertionReason &&
    !isMultiStatement &&
    /(what is \d+\s*[+\-×]\s*\d+|who wrote|who discovered|who invented|capital of|currency of|opposite of|synonym of|antonym of|past tense of|plural of|national (bird|flower|animal|fruit|tree|anthem|song)|festival of|symbol of|si unit of|chemical formula of|planet (nearest|largest|red|blue)|how many (states|union territories|continents|oceans|bones|planets)|father of|full form of|विलोम|पर्यायवाची)/i.test(
      text
    );

  if (isShortRecall) {
    score -= 1;
  } else if (wordCount <= 7 && !hasNegativeTrap && score === 1) {
    // Very short single-line recall questions default to Easy
    score = 0;
  }

  // Subject-specific floor
  if (subject === "math" && /ratio|melted|roots|section formula|collinear|probability|trigonometr/.test(text)) {
    score = Math.max(score, 2);
  }

  return Math.max(0, Math.min(3, score)) as 0 | 1 | 2 | 3;
}
