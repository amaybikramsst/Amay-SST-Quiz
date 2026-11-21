import React, { useState } from "react";
import { Check, ChevronLeft, Volume2, VolumeX, X } from "lucide-react";
import {
  formatTime,
  formatXpValue,
  getNegativePenalty,
  LEVELS,
  XP_PER_LEVEL,
  type ActiveQuizState,
  type StudentProfile,
} from "../lib/quizEngine";
import { launchMilestoneConfetti } from "../lib/confetti";
import {
  isSoundEnabled,
  playCorrectSound,
  playIncorrectSound,
  playSelectTapSound,
  setSoundEnabled,
} from "../lib/soundEffects";

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
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playSelectTapSound();
  };

  if (quiz.done && quiz.res) {
    const { c, w, sk, n, posXp, negXp, bonusXp, xp, up, milestoneXp } = quiz.res;
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
            <button
              type="button"
              data-custom-sound="1"
              onClick={() => playCorrectSound()}
              className="rounded-2xl bg-[#12A150]/10 dark:bg-[#3DD17F]/15 p-2.5 cursor-pointer active:scale-[0.98] transition"
            >
              <strong className="block text-base font-extrabold text-[#12A150] dark:text-[#3DD17F] font-mono-nums">
                {c} (+{formatXpValue(posXp)})
              </strong>
              <span className="text-[#5A6A92] dark:text-[#93A3CC]">Correct</span>
            </button>
            <button
              type="button"
              data-custom-sound="1"
              onClick={() => playIncorrectSound()}
              className="rounded-2xl bg-[#D92D3A]/10 dark:bg-[#FF6B76]/15 p-2.5 cursor-pointer active:scale-[0.98] transition"
            >
              <strong className="block text-base font-extrabold text-[#D92D3A] dark:text-[#FF6B76] font-mono-nums">
                {w} (−{formatXpValue(negXp)})
              </strong>
              <span className="text-[#5A6A92] dark:text-[#93A3CC]">Wrong (1/4)</span>
            </button>
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

        {milestoneXp && milestoneXp >= 100 && (
          <div className="amay-card rounded-[28px] p-5 bg-gradient-to-r from-[#1457E0]/10 via-[#38B0FF]/10 to-[#F5B82E]/12 border border-[#1457E0]/20 dark:border-[#5AA2FF]/30 flex items-center justify-between gap-3">
            <div>
              <strong className="text-base font-extrabold text-[#0B1B4D] dark:text-white">
                🏆 {milestoneXp.toLocaleString()} XP Milestone!
              </strong>
              <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC] mt-0.5">
                Amazing progress! Keep climbing the leaderboard.
              </p>
            </div>
            <button
              type="button"
              onClick={() => launchMilestoneConfetti(milestoneXp)}
              className="shrink-0 px-3.5 py-2 rounded-[16px] bg-white/85 dark:bg-white/10 text-xs font-extrabold text-[#1457E0] dark:text-[#5AA2FF] shadow-sm cursor-pointer active:scale-95 transition"
            >
              🎉 Celebrate
            </button>
          </div>
        )}

        {(profile.xp >= 100 || (profile.earnedDailyBadges?.length ?? 0) > 0) && (
          <div className="amay-card rounded-[28px] p-5 space-y-3">
            <div>
              <strong className="text-base font-extrabold text-[#0B1B4D] dark:text-white">
                {up ? "🎉 Badge unlocked!" : "🏅 Your badge"}
              </strong>
              <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC] mt-1">
                {up ? "You reached 100 Overall XP! " : ""}Share your achievement with friends.
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

        <div className="amay-card rounded-[28px] p-5 sm:p-6 space-y-3.5">
          <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">Review</h2>
          <div className="space-y-3">
            {quiz.qs.map((q, idx) => {
              const sel = quiz.sel[idx];
              const ok = sel === q[2];
              const skipped = sel === undefined;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (skipped) playSelectTapSound();
                    else if (ok) playCorrectSound();
                    else playIncorrectSound();
                  }}
                  className={`rounded-2xl p-3.5 border-l-4 space-y-1.5 text-sm cursor-pointer transition hover:brightness-[0.99] ${
                    ok
                      ? "border-l-[#12A150] bg-[#12A150]/[0.05] dark:bg-[#3DD17F]/[0.06]"
                      : skipped
                        ? "border-l-[#5A6A92]/40 bg-[#1457E0]/[0.03] dark:bg-white/[0.03]"
                        : "border-l-[#D92D3A] bg-[#D92D3A]/[0.05] dark:bg-[#FF6B76]/[0.06]"
                  }`}
                >
                  <p className="font-bold text-[#0B1B4D] dark:text-white leading-snug">
                    {idx + 1}. {q[0]}
                  </p>
                  <p
                    className={`font-semibold text-xs ${
                      ok
                        ? "text-[#12A150] dark:text-[#3DD17F]"
                        : skipped
                          ? "text-[#5A6A92] dark:text-[#93A3CC]"
                          : "text-[#D92D3A] dark:text-[#FF6B76]"
                    }`}
                  >
                    You:{" "}
                    {skipped
                      ? "Skipped (0 XP)"
                      : `${q[1][sel]} ${
                          ok ? "✅" : `❌ (−${formatXpValue(getNegativePenalty(quiz.L))} XP)`
                        }`}
                  </p>
                  {!ok && (
                    <p className="text-xs font-bold text-[#12A150] dark:text-[#3DD17F]">
                      Correct: {q[1][q[2]]}
                    </p>
                  )}
                  {q[3] && (
                    <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] pt-0.5 leading-relaxed">
                      💡 {q[3]}
                    </p>
                  )}
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
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setConfirmQuit(true)}
          aria-label="Quit quiz"
          className="amay-card rounded-[16px] px-3 py-2 text-[#1457E0] dark:text-[#5AA2FF] font-bold cursor-pointer active:scale-95 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div
          className={`px-3.5 py-1 rounded-full amay-card font-mono-nums text-lg font-extrabold tracking-tight ${
            quiz.t <= 30
              ? "text-[#D92D3A] dark:text-[#FF6B76] ring-2 ring-[#D92D3A]/35 animate-pulse"
              : "text-[#0B1B4D] dark:text-white"
          }`}
        >
          {formatTime(quiz.t)}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[13px] sm:text-[14px] font-bold text-[#5A6A92] dark:text-[#93A3CC] tabular-nums">
            {LEVELS[quiz.L]} · {quiz.i + 1}/{total}
          </span>
          <button
            type="button"
            data-custom-sound="1"
            onClick={toggleSound}
            aria-label={soundOn ? "Mute sound effects" : "Enable sound effects"}
            title={soundOn ? "Sound On" : "Sound Off"}
            className="amay-card rounded-[14px] p-2 text-[#1457E0] dark:text-[#5AA2FF] cursor-pointer active:scale-95 transition"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 opacity-60" />}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2.5 rounded-full bg-[#1457E0]/10 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#38B0FF] via-[#2B7BFF] to-[#0B57DD] transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Elevated Question Stage Card */}
      <div className="amay-card rounded-[28px] p-5 space-y-2.5 border border-[#1846AA]/15 dark:border-white/10 shadow-[0_14px_30px_-18px_rgba(20,87,224,0.35)]">
        <div className="flex items-center justify-between gap-2 text-xs font-bold">
          <span className="px-2.5 py-0.5 rounded-full bg-[#1457E0]/12 dark:bg-[#5AA2FF]/15 text-[#1457E0] dark:text-[#5AA2FF]">
            Question {quiz.i + 1} of {total}
          </span>
          <span className="text-[#5A6A92] dark:text-[#93A3CC] font-mono-nums">
            +{XP_PER_LEVEL[quiz.L]} XP · −{penalty} wrong
          </span>
        </div>

        <h2 className="text-[20px] sm:text-[21px] leading-[1.38] font-extrabold text-[#0B1B4D] dark:text-white pt-0.5">
          {q[0]}
        </h2>

        {selected !== undefined && (
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => onSelectOption(undefined)}
              className="text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF] hover:underline cursor-pointer"
            >
              Clear choice (skip)
            </button>
          </div>
        )}
      </div>

      {/* Tactile Option Pills */}
      <div className="space-y-2.5">
        {q[1].map((opt, idx) => {
          const active = selected === idx;
          return (
            <button
              key={idx}
              type="button"
              data-custom-sound="1"
              onClick={() => onSelectOption(active ? undefined : idx)}
              className={`group w-full min-h-[58px] px-4 py-3.5 rounded-[20px] text-left font-semibold text-[15px] sm:text-base flex items-center gap-3.5 transition-all duration-150 cursor-pointer active:scale-[0.985] ${
                active
                  ? "bg-gradient-to-r from-[#1457E0]/16 via-[#2B7BFF]/14 to-[#38B0FF]/12 dark:from-[#1457E0]/35 dark:to-[#38B0FF]/20 border-2 border-[#1457E0] dark:border-[#5AA2FF] text-[#0B1B4D] dark:text-white shadow-[0_10px_24px_-12px_rgba(20,87,224,0.65)]"
                  : "amay-card border border-[#1846AA]/12 dark:border-white/10 text-[#0B1B4D] dark:text-[#EAF0FF] hover:border-[#1457E0]/45 dark:hover:border-[#5AA2FF]/45"
              }`}
            >
              <span
                className={`w-9 h-9 rounded-xl font-extrabold text-sm flex items-center justify-center shrink-0 transition-colors ${
                  active
                    ? "bg-gradient-to-br from-[#2B7BFF] to-[#1457E0] text-white shadow-sm"
                    : "bg-[#1457E0]/10 dark:bg-white/10 text-[#1457E0] dark:text-[#5AA2FF] group-hover:bg-[#1457E0]/18"
                }`}
              >
                {"ABCD"[idx]}
              </span>
              <span className="flex-1 leading-snug">{opt}</span>
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  active
                    ? "bg-[#1457E0] dark:bg-[#5AA2FF] text-white dark:text-[#080D1B] scale-100"
                    : "border border-[#1846AA]/20 dark:border-white/15 opacity-40 scale-90"
                }`}
              >
                {active && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-3 pt-1">
        {quiz.i > 0 && (
          <button
            type="button"
            onClick={() => onGoToQuestion(quiz.i - 1)}
            className="h-13 px-4 rounded-[22px] amay-card text-[#1457E0] dark:text-[#5AA2FF] font-bold text-base inline-flex items-center gap-1 cursor-pointer active:scale-95 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        )}

        <button
          type="button"
          data-custom-sound={quiz.i === total - 1 ? "1" : undefined}
          onClick={() => (quiz.i < total - 1 ? onGoToQuestion(quiz.i + 1) : onFinish())}
          className="flex-1 h-13 rounded-[22px] amay-play-btn text-white font-bold text-base cursor-pointer shadow-[0_12px_24px_-10px_rgba(20,87,224,0.85)] active:scale-[0.99] transition"
        >
          {quiz.i < total - 1 ? "Next" : "Finish"}
        </button>
      </div>

      {confirmQuit && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
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
