import React, { useMemo } from "react";
import { ArrowUpRight, ChevronRight, Lock, Play } from "lucide-react";
import { STATIC_QUESTIONS, type QuizKey, type RawQuestion, type SubjectKey } from "../data/questions";
import {
  formatXpValue,
  getAvailableCount,
  getNegativePenalty,
  getRankDifficultyRule,
  getSubjectMeta,
  LEVELS,
  QUIZ_LENGTHS,
  SUBJECT_ORDER,
  XP_PER_LEVEL,
} from "../lib/quizEngine";

interface SubjectVisualMeta {
  tagline: string;
  accentGradient: string;
  iconBoxClass: string;
  countPillClass: string;
  watermarkClass: string;
  cardBorderClass: string;
}

const SUBJECT_VISUALS: Record<SubjectKey, SubjectVisualMeta> = {
  math: {
    tagline: "Algebra · Geometry · Logic",
    accentGradient:
      "from-indigo-500/20 via-blue-500/10 to-transparent dark:from-indigo-400/25 dark:via-blue-500/12",
    iconBoxClass:
      "bg-gradient-to-br from-indigo-500/15 to-blue-600/20 text-indigo-600 dark:text-indigo-300 group-hover:from-indigo-600 group-hover:to-blue-600 group-hover:text-white",
    countPillClass:
      "bg-indigo-500/12 text-indigo-700 dark:bg-indigo-400/18 dark:text-indigo-300",
    watermarkClass: "text-indigo-600 dark:text-indigo-400",
    cardBorderClass: "hover:border-indigo-500/40 dark:hover:border-indigo-400/40",
  },
  sci: {
    tagline: "Physics · Chem · Biology",
    accentGradient:
      "from-emerald-500/20 via-teal-500/10 to-transparent dark:from-emerald-400/24 dark:via-teal-500/12",
    iconBoxClass:
      "bg-gradient-to-br from-emerald-500/15 to-teal-600/20 text-emerald-600 dark:text-emerald-300 group-hover:from-emerald-600 group-hover:to-teal-600 group-hover:text-white",
    countPillClass:
      "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/18 dark:text-emerald-300",
    watermarkClass: "text-emerald-600 dark:text-emerald-400",
    cardBorderClass: "hover:border-emerald-500/40 dark:hover:border-emerald-400/40",
  },
  sst: {
    tagline: "History · Civics · Geo",
    accentGradient:
      "from-amber-500/22 via-orange-500/10 to-transparent dark:from-amber-400/24 dark:via-orange-500/12",
    iconBoxClass:
      "bg-gradient-to-br from-amber-500/18 to-orange-600/20 text-amber-700 dark:text-amber-300 group-hover:from-amber-500 group-hover:to-orange-600 group-hover:text-white",
    countPillClass:
      "bg-amber-500/14 text-amber-800 dark:bg-amber-400/18 dark:text-amber-300",
    watermarkClass: "text-amber-600 dark:text-amber-400",
    cardBorderClass: "hover:border-amber-500/45 dark:hover:border-amber-400/40",
  },
  eng: {
    tagline: "Grammar · Vocab · Usage",
    accentGradient:
      "from-sky-500/20 via-blue-500/10 to-transparent dark:from-sky-400/25 dark:via-blue-500/12",
    iconBoxClass:
      "bg-gradient-to-br from-sky-500/15 to-blue-600/20 text-sky-600 dark:text-sky-300 group-hover:from-sky-500 group-hover:to-blue-600 group-hover:text-white",
    countPillClass:
      "bg-sky-500/12 text-sky-700 dark:bg-sky-400/18 dark:text-sky-300",
    watermarkClass: "text-sky-600 dark:text-sky-400",
    cardBorderClass: "hover:border-sky-500/40 dark:hover:border-sky-400/40",
  },
  hin: {
    tagline: "व्याकरण · शब्द · साहित्य",
    accentGradient:
      "from-rose-500/20 via-pink-500/10 to-transparent dark:from-rose-400/24 dark:via-pink-500/12",
    iconBoxClass:
      "bg-gradient-to-br from-rose-500/15 to-pink-600/20 text-rose-600 dark:text-rose-300 group-hover:from-rose-600 group-hover:to-pink-600 group-hover:text-white",
    countPillClass:
      "bg-rose-500/12 text-rose-700 dark:bg-rose-400/18 dark:text-rose-300",
    watermarkClass: "text-rose-600 dark:text-rose-400",
    cardBorderClass: "hover:border-rose-500/40 dark:hover:border-rose-400/40",
  },
  ca: {
    tagline: "India · World · Events",
    accentGradient:
      "from-cyan-500/20 via-[#1457E0]/12 to-transparent dark:from-cyan-400/24 dark:via-[#1457E0]/14",
    iconBoxClass:
      "bg-gradient-to-br from-cyan-500/15 to-[#1457E0]/20 text-cyan-700 dark:text-cyan-300 group-hover:from-cyan-500 group-hover:to-[#1457E0] group-hover:text-white",
    countPillClass:
      "bg-cyan-500/12 text-cyan-800 dark:bg-cyan-400/18 dark:text-cyan-300",
    watermarkClass: "text-cyan-600 dark:text-cyan-400",
    cardBorderClass: "hover:border-cyan-500/40 dark:hover:border-cyan-400/40",
  },
};

const SubjectEmblem: React.FC<{ subjectKey: QuizKey }> = ({ subjectKey }) => {
  switch (subjectKey) {
    case "math":
      return (
        <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r="15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            className="amay-orbit-cw opacity-55"
          />
          <g className="amay-gentle-bob">
            <path d="M12 20H28" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="20" cy="13" r="2.2" fill="currentColor" />
            <circle cx="20" cy="27" r="2.2" fill="currentColor" />
          </g>
        </svg>
      );

    case "sci":
      return (
        <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none" aria-hidden="true">
          <g className="amay-orbit-cw">
            <ellipse
              cx="20"
              cy="20"
              rx="15"
              ry="6"
              transform="rotate(32 20 20)"
              stroke="currentColor"
              strokeWidth="1.8"
              className="opacity-85"
            />
          </g>
          <g className="amay-orbit-ccw">
            <ellipse
              cx="20"
              cy="20"
              rx="15"
              ry="6"
              transform="rotate(-32 20 20)"
              stroke="currentColor"
              strokeWidth="1.8"
              className="opacity-65"
            />
          </g>
          <circle cx="20" cy="20" r="3.4" fill="currentColor" />
        </svg>
      );

    case "sst":
      return (
        <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none" aria-hidden="true">
          <circle cx="20" cy="20" r="13.5" stroke="currentColor" strokeWidth="2" />
          <path d="M7.5 20H32.5" stroke="currentColor" strokeWidth="1.6" className="opacity-70" />
          <path
            d="M20 6.5C24.2 10.6 24.2 29.4 20 33.5C15.8 29.4 15.8 10.6 20 6.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <g className="amay-compass-sway">
            <path d="M29.5 8.5L31 12L27.5 10.5L29.5 8.5Z" fill="currentColor" />
          </g>
        </svg>
      );

    case "eng":
      return (
        <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none" aria-hidden="true">
          <g className="amay-gentle-bob">
            <path
              d="M20 12.5C17.2 10.2 12.6 9.8 8.5 11V28.5C12.6 27.3 17.2 27.7 20 30C22.8 27.7 27.4 27.3 31.5 28.5V11C27.4 9.8 22.8 10.2 20 12.5Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M20 12.5V30" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path
              d="M12 16H16.5M12 20.5H16.5M23.5 16H28M23.5 20.5H28"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="opacity-75"
            />
          </g>
        </svg>
      );

    case "hin":
      return (
        <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r="15.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeDasharray="6 4"
            className="amay-orbit-ccw opacity-50"
          />
          <text
            x="20"
            y="26.5"
            textAnchor="middle"
            fill="currentColor"
            fontSize="20"
            fontWeight="800"
            fontFamily="'Plus Jakarta Sans', 'Noto Sans Devanagari', sans-serif"
            className="amay-gentle-bob"
          >
            अ
          </text>
        </svg>
      );

    case "ca":
      return (
        <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r="14"
            stroke="currentColor"
            strokeWidth="1.5"
            className="amay-broadcast-wave"
          />
          <circle
            cx="20"
            cy="20"
            r="10"
            stroke="currentColor"
            strokeWidth="1.6"
            className="amay-broadcast-wave"
            style={{ animationDelay: "0.7s" }}
          />
          <rect
            x="11"
            y="12"
            width="18"
            height="16"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.9"
            fill="currentColor"
            fillOpacity="0.08"
          />
          <path
            d="M14.5 17H25.5M14.5 21H22M14.5 24.5H19"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r="15"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeDasharray="5 3"
            className="amay-orbit-cw opacity-70"
          />
          <path
            d="M20 9L22.8 17.2L31 20L22.8 22.8L20 31L17.2 22.8L9 20L17.2 17.2L20 9Z"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
            className="amay-compass-sway"
          />
        </svg>
      );
  }
};

const SubjectBackdropPattern: React.FC<{ subjectKey: SubjectKey }> = ({ subjectKey }) => {
  switch (subjectKey) {
    case "math":
      return (
        <svg viewBox="0 0 80 80" className="w-24 h-24" fill="none" aria-hidden="true">
          <circle cx="48" cy="48" r="24" stroke="currentColor" strokeWidth="1.5" />
          <path d="M22 60L62 20M34 20L66 52" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "sci":
      return (
        <svg viewBox="0 0 80 80" className="w-24 h-24" fill="none" aria-hidden="true">
          <ellipse
            cx="44"
            cy="44"
            rx="28"
            ry="11"
            transform="rotate(35 44 44)"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <ellipse
            cx="44"
            cy="44"
            rx="28"
            ry="11"
            transform="rotate(-35 44 44)"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "sst":
      return (
        <svg viewBox="0 0 80 80" className="w-24 h-24" fill="none" aria-hidden="true">
          <circle cx="46" cy="46" r="26" stroke="currentColor" strokeWidth="1.5" />
          <ellipse cx="46" cy="46" rx="12" ry="26" stroke="currentColor" strokeWidth="1.4" />
          <path d="M20 46H72" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case "eng":
      return (
        <svg viewBox="0 0 80 80" className="w-24 h-24" fill="none" aria-hidden="true">
          <path
            d="M44 26C36 20 26 20 18 23V60C26 57 36 57 44 63C52 57 62 57 70 60V23C62 20 52 20 44 26Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M44 26V63" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "hin":
      return (
        <svg viewBox="0 0 80 80" className="w-24 h-24" fill="none" aria-hidden="true">
          <circle
            cx="46"
            cy="46"
            r="26"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="5 5"
          />
          <circle cx="46" cy="46" r="16" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "ca":
      return (
        <svg viewBox="0 0 80 80" className="w-24 h-24" fill="none" aria-hidden="true">
          <circle cx="52" cy="52" r="12" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="52" cy="52" r="21" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="52" cy="52" r="30" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
  }
};

interface SubjectsGridViewProps {
  onSelectSubject: (k: QuizKey) => void;
  mergedBank?: Record<SubjectKey, RawQuestion[]>;
}

export const SubjectsGridView: React.FC<SubjectsGridViewProps> = ({
  onSelectSubject,
  mergedBank,
}) => {
  const totalQuestions = useMemo(() => {
    return SUBJECT_ORDER.reduce((sum, key) => {
      const count = mergedBank ? mergedBank[key]?.length || 0 : STATIC_QUESTIONS[key].q.length;
      return sum + count;
    }, 0);
  }, [mergedBank]);

  return (
    <div className="space-y-4">
      {/* Editorial Header */}
      <div className="amay-subject-enter px-1 pt-0.5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] sm:text-[32px] font-extrabold tracking-tight leading-none text-[#0B1B4D] dark:text-[#EAF0FF]">
            Subjects
          </h1>
          <p className="text-[13px] font-medium text-[#5A6A92] dark:text-[#93A3CC] mt-1.5">
            {SUBJECT_ORDER.length} subjects ·{" "}
            <span className="font-mono-nums font-bold text-[#1457E0] dark:text-[#5AA2FF]">
              {totalQuestions.toLocaleString()}
            </span>{" "}
            questions ready
          </p>
        </div>
      </div>

      {/* 2x3 Dual-Tone Staggered Subject Cards */}
      <div className="grid grid-cols-2 gap-3.5">
        {SUBJECT_ORDER.map((k, idx) => {
          const bank = STATIC_QUESTIONS[k];
          const visual = SUBJECT_VISUALS[k];
          const qCount = mergedBank ? mergedBank[k]?.length || 0 : bank.q.length;

          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelectSubject(k)}
              style={{ animationDelay: `${(idx + 1) * 50}ms` }}
              className={`amay-subject-enter group relative amay-card border border-[#1846AA]/12 dark:border-white/10 ${visual.cardBorderClass} rounded-[24px] p-4 sm:p-5 text-left cursor-pointer overflow-hidden transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.015] active:scale-[0.965] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1457E0] dark:focus-visible:ring-[#5AA2FF]`}
            >
              {/* Dual-tone signature gradient wash */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${visual.accentGradient} opacity-75 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
                aria-hidden="true"
              />

              {/* Angled glass sheen sweep on hover/focus */}
              <span className="amay-subject-sheen" aria-hidden="true" />

              {/* Signature geometric watermark illustration in corner */}
              <div
                className={`absolute -bottom-3 -right-3 ${visual.watermarkClass} opacity-[0.08] dark:opacity-[0.12] group-hover:opacity-[0.16] group-hover:scale-110 transition-all duration-300 pointer-events-none`}
                aria-hidden="true"
              >
                <SubjectBackdropPattern subjectKey={k} />
              </div>

              {/* Card Content */}
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div className="flex items-start justify-between gap-2 mb-3.5">
                  <div
                    className={`w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 transition-all duration-200 shadow-xs ${visual.iconBoxClass}`}
                  >
                    <SubjectEmblem subjectKey={k} />
                  </div>
                  <ArrowUpRight
                    className="w-4 h-4 text-[#5A6A92]/70 dark:text-[#93A3CC]/70 group-hover:text-[#0B1B4D] dark:group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0 mt-1"
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <h2 className="font-display text-[17px] sm:text-[18px] font-extrabold leading-tight tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF]">
                    {bank.n}
                  </h2>
                  <p className="text-[11.5px] sm:text-[12px] font-medium text-[#5A6A92] dark:text-[#93A3CC] truncate mt-1">
                    {visual.tagline}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#1846AA]/10 dark:border-white/10 flex items-center justify-between gap-1.5 text-[11px] font-bold tabular-nums">
                  <span className={`px-2 py-0.5 rounded-full font-mono-nums ${visual.countPillClass}`}>
                    {qCount.toLocaleString()} Qs
                  </span>
                  <span className="inline-flex items-center gap-0.5" title="4 difficulty levels">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Full-Width Mixed Challenge Spotlight Card */}
      <button
        type="button"
        onClick={() => onSelectSubject("mix")}
        style={{ animationDelay: "360ms" }}
        className="amay-subject-enter group relative w-full amay-card rounded-[24px] p-4 sm:p-5 flex items-center gap-3.5 text-left cursor-pointer overflow-hidden transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.008] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1457E0] dark:focus-visible:ring-[#5AA2FF]"
      >
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#2B9BF6]/16 via-[#1457E0]/10 to-amber-400/10 dark:from-[#5AA2FF]/20 dark:via-[#1457E0]/12 dark:to-amber-400/10 pointer-events-none"
          aria-hidden="true"
        />
        <span className="amay-subject-sheen" aria-hidden="true" />

        <div className="relative z-10 w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#2B9BF6] to-[#0B57DD] text-white flex items-center justify-center shrink-0 shadow-sm">
          <SubjectEmblem subjectKey="mix" />
        </div>

        <div className="relative z-10 min-w-0 flex-1">
          <h2 className="font-display text-[17px] font-extrabold leading-tight text-[#0B1B4D] dark:text-[#EAF0FF] truncate">
            All-Subjects Mixed Quiz
          </h2>
          <p className="text-[12px] font-medium text-[#5A6A92] dark:text-[#93A3CC] truncate mt-0.5">
            Random mix across all 6 subjects · {totalQuestions.toLocaleString()} questions
          </p>
        </div>

        <span className="relative z-10 w-10 h-10 rounded-2xl bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 text-[#1457E0] dark:text-[#5AA2FF] group-hover:bg-[#1457E0] group-hover:text-white dark:group-hover:bg-[#5AA2FF] dark:group-hover:text-[#071230] flex items-center justify-center shrink-0 transition-colors duration-200">
          <Play className="w-4 h-4 fill-current ml-0.5" />
        </span>
      </button>
    </div>
  );
};

interface SubjectConfigViewProps {
  subjectKey: QuizKey;
  level: number;
  length: number;
  playerRank?: number;
  mergedBank: Record<SubjectKey, RawQuestion[]>;
  onChangeLevel: (l: number) => void;
  onChangeLength: (n: number) => void;
  onBack: () => void;
  onStart: () => void;
}

export const SubjectConfigView: React.FC<SubjectConfigViewProps> = ({
  subjectKey,
  level,
  length,
  playerRank,
  mergedBank,
  onChangeLevel,
  onChangeLength,
  onBack,
  onStart,
}) => {
  const meta = getSubjectMeta(subjectKey);
  const maxAvail = getAvailableCount(subjectKey, mergedBank);
  const rankRule =
    subjectKey === "mix"
      ? getRankDifficultyRule(playerRank)
      : { minLevel: 0, defaultLevel: 1, tierLabel: null, lockReason: null };
  const activeLevel = Math.max(level, rankRule.minLevel);

  return (
    <div className="amay-subject-enter space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="amay-card rounded-[20px] px-4 py-2.5 text-sm font-bold text-[#1457E0] dark:text-[#5AA2FF] cursor-pointer hover:-translate-x-0.5 transition-transform"
      >
        ‹ Back
      </button>

      <div className="flex items-center gap-3.5 px-1">
        <div className="w-12 h-12 rounded-[16px] bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 text-[#1457E0] dark:text-[#5AA2FF] flex items-center justify-center shrink-0">
          <SubjectEmblem subjectKey={subjectKey} />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-[24px] sm:text-[26px] font-extrabold tracking-tight leading-tight text-[#0B1B4D] dark:text-[#EAF0FF] truncate">
            {meta.name}
          </h1>
          <p className="text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] tabular-nums">
            {maxAvail.toLocaleString()} questions available
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-base font-bold text-[#0B1B4D] dark:text-[#EAF0FF]">Level</h2>
          {rankRule.tierLabel && (
            <span className="text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF]">
              Rank #{playerRank} · {rankRule.tierLabel}
            </span>
          )}
        </div>

        {rankRule.lockReason && (
          <div className="rounded-2xl border border-[#1457E0]/20 bg-[#1457E0]/[0.06] dark:bg-[#5AA2FF]/10 px-3.5 py-2.5 text-xs font-semibold text-[#0B1B4D] dark:text-[#DCE6FF]">
            {rankRule.lockReason}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {LEVELS.map((lvlName, idx) => {
            const lockedByRank = subjectKey === "mix" && idx < rankRule.minLevel;
            const active = activeLevel === idx;
            const penalty = formatXpValue(getNegativePenalty(idx));
            return (
              <button
                key={lvlName}
                type="button"
                disabled={lockedByRank}
                onClick={() => onChangeLevel(idx)}
                className={`rounded-[18px] p-3.5 text-left transition-all ${
                  lockedByRank
                    ? "amay-card opacity-50 cursor-not-allowed"
                    : active
                      ? "bg-[#1457E0]/15 dark:bg-[#5AA2FF]/20 border-2 border-[#1457E0] dark:border-[#5AA2FF] cursor-pointer"
                      : "amay-card cursor-pointer hover:-translate-y-0.5"
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-base font-bold text-[#0B1B4D] dark:text-[#EAF0FF]">
                    {lvlName}
                  </span>
                  {lockedByRank && <Lock className="w-3.5 h-3.5 text-[#5A6A92] shrink-0" />}
                </div>
                <div className="text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mt-0.5 tabular-nums">
                  {lockedByRank
                    ? `Unlocked below #${playerRank && playerRank <= 50 ? 50 : 100}`
                    : `+${XP_PER_LEVEL[idx]} XP right · −${penalty} XP wrong`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-bold text-[#0B1B4D] dark:text-[#EAF0FF] px-1">
          Questions and time
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {Object.keys(QUIZ_LENGTHS)
            .map(Number)
            .map((n) => {
              const disabled = maxAvail < n;
              const active = length === n;
              const mins = QUIZ_LENGTHS[n];
              return (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChangeLength(n)}
                  className={`rounded-[18px] p-3.5 text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    active
                      ? "bg-[#1457E0]/15 dark:bg-[#5AA2FF]/20 border-2 border-[#1457E0] dark:border-[#5AA2FF]"
                      : "amay-card hover:-translate-y-0.5"
                  }`}
                >
                  <div className="text-base font-bold text-[#0B1B4D] dark:text-[#EAF0FF] tabular-nums">
                    {n} questions
                  </div>
                  <div className="text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mt-0.5 tabular-nums">
                    {disabled ? "Needs more questions" : `${mins} minutes`}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      <p className="text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] px-1">
        1/4 negative marking applies to wrong answers. Unanswered (skipped) questions carry 0 penalty.
      </p>

      <div className="sticky bottom-[92px] z-20 pt-2">
        <button
          type="button"
          onClick={onStart}
          className="w-full h-14 rounded-[22px] amay-play-btn text-white font-bold text-lg flex items-center justify-center gap-2 relative cursor-pointer shadow-[0_14px_28px_-10px_rgba(20,87,224,0.9)] active:scale-[0.98] transition-transform"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>Start quiz</span>
          <ChevronRight className="w-5 h-5 absolute right-5" />
        </button>
      </div>
    </div>
  );
};
