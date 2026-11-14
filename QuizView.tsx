import React, { useState } from "react";
import { X, ChevronLeft } from "lucide-react";
import {
  formatTime,
  formatXpValue,
  getNegativePenalty,
  LEVELS,
  XP_PER_LEVEL,
  type ActiveQuizState,
  type StudentProfile,
} from "../lib/quizEngine";

interface QuizViewProps {
  quiz: ActiveQuizState;
  profile: StudentProfile;
  onSelectOption: (optionIndex: number | undefined) => void;
  onGoToQuestion: (index: number) => void;
  onFinish: () => void;
  onQuit: () => void;
  onRetry: () => void;
  onChangeSetup: () => void;
  onOpenRank: () => void;
  onOpenBadge: () => void;
}

export const QuizView: React.FC<QuizViewProps> = ({
  quiz,
  profile,
  onSelectOption,
  onGoToQuestion,
  onFinish,
  onQuit,
  onRetry,
  onChangeSetup,
  onOpenRank,
  onOpenBadge,
}) => {
  const [confirmQuit, setConfirmQuit] = useState(false);

  if (quiz.done && quiz.res) {
    const { c, w, sk, n, posXp, negXp, bonusXp, xp, up } = quiz.res;
    const accuracy = n > 0 ? Math.round((c / n) * 100) : 0;

    return (
      <div className="space-y-4">
        <h1 className="text-[26px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF] px-1">
          Result
        </h1>

        <div className="amay-card rounded-[28px] p-5 sm:p-6 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[48px] leading-none font-extrabold text-[#0B1B4D] dark:text-white font-mono-nums">
              {c}/{n}
            </div>
            <div
              className={`text-2xl font-extrabold font-mono-nums ${
                xp >= 0 ? "text-[#1457E0] dark:text-[#5AA2FF]" : "text-[#D92D3A] dark:text-[#FF6B76]"
              }`}
            >
              {xp >= 0 ? `+${xp}` : xp} XP
            </div>
          </div>

          <p className="text-sm font-semibold text-[#5A6A92] dark:text-[#93A3CC]">
            Accuracy {accuracy}% · {LEVELS[quiz.L]} · {profile.streak}🔥 day streak
          </p>

          {/* 1/4 Negative Marking Breakdown */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
            <div className="rounded-2xl bg-[#12A150]/10 dark:bg-[#3DD17F]/15 p-2.5">
              <strong className="block text-base font-extrabold text-[#12A150] dark:text-[#3DD17F] font-mono-nums">
                {c} (+{formatXpValue(posXp)})
              </strong>
              <span className="text-[#5A6A92] dark:text-[#93A3CC]">Correct</span>
            </div>
            <div className="rounded-2xl bg-[#D92D3A]/10 dark:bg-[#FF6B76]/15 p-2.5">
              <strong className="block text-base font-extrabold text-[#D92D3A] dark:text-[#FF6B76] font-mono-nums">
                {w} (−{formatXpValue(negXp)})
              </strong>
              <span className="text-[#5A6A92] dark:text-[#93A3CC]">Wrong (1/4)</span>
            </div>
            <div className="rounded-2xl bg-[#1457E0]/10 dark:bg-white/10 p-2.5">
              <strong className="block text-base font-extrabold text-[#0B1B4D] dark:text-white font-mono-nums">
                {sk} (0)
              </strong>
              <span className="text-[#5A6A92] dark:text-[#93A3CC]">Skipped</span>
            </div>
          </div>

          {bonusXp > 0 && (
            <p className="text-sm text-[#12A150] dark:text-[#3DD17F] font-bold">
              Perfect score bonus: +{bonusXp} XP
            </p>
          )}
        </div>

        {profile.xp >= 500 && (
          <div className="amay-card rounded-[28px] p-5 space-y-3">
            <div>
              <strong className="text-base font-extrabold text-[#0B1B4D] dark:text-white">
                {up ? "🎉 Badge unlocked!" : "🏅 Your badge"}
              </strong>
              <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC] mt-1">
                {up ? "You reached 500 XP. " : ""}Share your achievement with friends.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenBadge}
              className="w-full h-12 rounded-[20px] amay-play-btn text-white font-bold text-sm cursor-pointer"
            >
              View and share badge
            </button>
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onRetry}
            className="w-full h-13 rounded-[22px] amay-play-btn text-white font-bold text-base cursor-pointer"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onChangeSetup}
            className="w-full h-12 rounded-[22px] amay-card text-[#1457E0] dark:text-[#5AA2FF] font-bold text-base cursor-pointer"
          >
            Change level or length
          </button>
          <button
            type="button"
            onClick={onOpenRank}
            className="w-full h-12 rounded-[22px] amay-card text-[#1457E0] dark:text-[#5AA2FF] font-bold text-base cursor-pointer"
          >
            See my rank
          </button>
        </div>

        <div className="amay-card rounded-[28px] p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">Review</h2>
          <div className="divide-y divide-[#1846AA]/10 dark:divide-white/10">
            {quiz.qs.map((q, idx) => {
              const sel = quiz.sel[idx];
              const ok = sel === q[2];
              const skipped = sel === undefined;
              return (
                <div key={idx} className="py-3.5 first:pt-0 last:pb-0 space-y-1 text-sm">
                  <p className="font-bold text-[#0B1B4D] dark:text-white">
                    {idx + 1}. {q[0]}
                  </p>
                  <p
                    className={
                      ok
                        ? "text-[#12A150] dark:text-[#3DD17F]"
                        : skipped
                          ? "text-[#5A6A92] dark:text-[#93A3CC]"
                          : "text-[#D92D3A] dark:text-[#FF6B76]"
                    }
                  >
                    You: {skipped ? "skipped (0 XP)" : `${q[1][sel]} ${ok ? "✅" : `❌ (−${formatXpValue(getNegativePenalty(quiz.L))} XP)`}`}
                  </p>
                  <p className="text-[#0B1B4D] dark:text-[#EAF0FF]">Correct: {q[1][q[2]]}</p>
                  {q[3] && <p className="text-[#5A6A92] dark:text-[#93A3CC]">{q[3]}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const q = quiz.qs[quiz.i];
  const selected = quiz.sel[quiz.i];
  const total = quiz.qs.length;
  const progressPct = ((quiz.i + 1) / total) * 100;
  const penalty = formatXpValue(getNegativePenalty(quiz.L));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setConfirmQuit(true)}
          aria-label="Quit quiz"
          className="amay-card rounded-[16px] px-3 py-2 text-[#1457E0] dark:text-[#5AA2FF] font-bold cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <strong
          className={`font-mono-nums text-xl font-extrabold ${
            quiz.t <= 30 ? "text-[#D92D3A] dark:text-[#FF6B76]" : "text-[#0B1B4D] dark:text-white"
          }`}
        >
          {formatTime(quiz.t)}
        </strong>

        <span className="text-[15px] font-semibold text-[#5A6A92] dark:text-[#93A3CC] tabular-nums">
          {LEVELS[quiz.L]} · {quiz.i + 1}/{total}
        </span>
      </div>

      <div className="h-2.5 rounded-full bg-[#1457E0]/10 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#38B0FF] to-[#0B57DD] transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC]">
        <span>
          +{XP_PER_LEVEL[quiz.L]} XP right · −{penalty} XP wrong
        </span>
        {selected !== undefined && (
          <button
            type="button"
            onClick={() => onSelectOption(undefined)}
            className="text-[#1457E0] dark:text-[#5AA2FF] hover:underline cursor-pointer"
          >
            Clear choice (skip)
          </button>
        )}
      </div>

      <h2 className="text-[21px] leading-[1.35] font-extrabold text-[#0B1B4D] dark:text-white">
        {q[0]}
      </h2>

      <div className="space-y-2.5">
        {q[1].map((opt, idx) => {
          const active = selected === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectOption(active ? undefined : idx)}
              className={`w-full min-h-[54px] px-4 py-3.5 rounded-[18px] text-left font-semibold text-base flex items-center gap-3.5 transition-all cursor-pointer active:scale-[0.98] ${
                active
                  ? "bg-[#4DB8F5]/20 border-2 border-[#1457E0] dark:border-[#5AA2FF] text-[#0B1B4D] dark:text-white"
                  : "amay-card text-[#0B1B4D] dark:text-[#EAF0FF]"
              }`}
            >
              <span className="w-8 h-8 rounded-xl bg-[#1457E0]/10 dark:bg-[#5AA2FF]/20 text-[#1457E0] dark:text-[#5AA2FF] font-extrabold text-sm flex items-center justify-center shrink-0">
                {"ABCD"[idx]}
              </span>
              <span className="flex-1">{opt}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-1">
        {quiz.i > 0 && (
          <button
            type="button"
            onClick={() => onGoToQuestion(quiz.i - 1)}
            className="h-13 px-4 rounded-[22px] amay-card text-[#1457E0] dark:text-[#5AA2FF] font-bold text-base inline-flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => (quiz.i < total - 1 ? onGoToQuestion(quiz.i + 1) : onFinish())}
          className="flex-1 h-13 rounded-[22px] amay-play-btn text-white font-bold text-base cursor-pointer"
        >
          {quiz.i < total - 1 ? "Next" : "Finish"}
        </button>
      </div>

      {confirmQuit && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm amay-card rounded-[28px] p-6 space-y-4">
            <h3 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">End quiz now?</h3>
            <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC]">
              Your current answers won&apos;t be saved if you leave before finishing.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmQuit(false)}
                className="h-11 rounded-[16px] amay-card text-[#0B1B4D] dark:text-white font-bold text-sm cursor-pointer"
              >
                Keep playing
              </button>
              <button
                type="button"
                onClick={onQuit}
                className="h-11 rounded-[16px] bg-[#D92D3A] text-white font-bold text-sm cursor-pointer"
              >
                Quit quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
