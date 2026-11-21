import React, { useState } from "react";
import { Check, ChevronLeft, Share2, Volume2, VolumeX, X } from "lucide-react";
import {
  formatTime,
  formatXpValue,
  getNegativePenalty,
  getSubjectMeta,
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

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function generateStoryCardBlob(params: {
  studentName: string;
  subjectLabel: string;
  levelLabel: string;
  correct: number;
  total: number;
  accuracy: number;
  xpEarned: number;
  streak: number;
}): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Deep Navy to Royal Blue 9:16 Backdrop
  const bg = ctx.createLinearGradient(0, 0, 1080, 1920);
  bg.addColorStop(0, "#060B19");
  bg.addColorStop(0.5, "#0B1B4D");
  bg.addColorStop(1, "#1457E0");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1920);

  // Subtle Ambient Glows
  const glowTop = ctx.createRadialGradient(860, 260, 30, 860, 260, 520);
  glowTop.addColorStop(0, "rgba(56, 176, 255, 0.35)");
  glowTop.addColorStop(1, "rgba(56, 176, 255, 0)");
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, 1080, 1920);

  const glowBottom = ctx.createRadialGradient(220, 1620, 30, 220, 1620, 520);
  glowBottom.addColorStop(0, "rgba(245, 184, 46, 0.24)");
  glowBottom.addColorStop(1, "rgba(245, 184, 46, 0)");
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, 0, 1080, 1920);

  // Brand Header Pill
  roundRectPath(ctx, 310, 150, 460, 74, 37);
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#EAF0FF";
  ctx.font = "800 32px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("AMAYSST QUIZ", 540, 198);

  // Main Glass Scorecard
  roundRectPath(ctx, 90, 310, 900, 1220, 56);
  ctx.fillStyle = "rgba(11, 20, 44, 0.78)";
  ctx.fill();
  ctx.strokeStyle = "rgba(90, 162, 255, 0.35)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Student Name & Subject Tag
  ctx.fillStyle = "#93A3CC";
  ctx.font = "700 34px system-ui, -apple-system, sans-serif";
  ctx.fillText("QUIZ SCORECARD", 540, 420);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 58px system-ui, -apple-system, sans-serif";
  const displayName = (params.studentName || "Champion").slice(0, 22);
  ctx.fillText(displayName, 540, 505);

  roundRectPath(ctx, 270, 545, 540, 64, 32);
  ctx.fillStyle = "rgba(56, 176, 255, 0.18)";
  ctx.fill();
  ctx.fillStyle = "#5AA2FF";
  ctx.font = "800 30px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${params.subjectLabel} · ${params.levelLabel}`, 540, 588);

  // Big Score Circle
  ctx.beginPath();
  ctx.arc(540, 860, 195, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(20, 87, 224, 0.28)";
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#38B0FF";
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 124px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${params.correct}/${params.total}`, 540, 885);

  ctx.fillStyle = "#93A3CC";
  ctx.font = "700 32px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${params.accuracy}% ACCURACY`, 540, 955);

  // 3 Stat Boxes Inside Card
  const statBoxes = [
    {
      label: "XP EARNED",
      value: `${params.xpEarned >= 0 ? "+" : ""}${params.xpEarned}`,
      color: "#5AA2FF",
    },
    {
      label: "ACCURACY",
      value: `${params.accuracy}%`,
      color: "#3DD17F",
    },
    {
      label: "STREAK",
      value: `${params.streak}🔥`,
      color: "#F5B82E",
    },
  ];

  statBoxes.forEach((box, idx) => {
    const bx = 145 + idx * 270;
    const by = 1150;
    roundRectPath(ctx, bx, by, 250, 190, 32);
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = box.color;
    ctx.font = "900 54px system-ui, -apple-system, sans-serif";
    ctx.fillText(box.value, bx + 125, by + 102);

    ctx.fillStyle = "#93A3CC";
    ctx.font = "700 22px system-ui, -apple-system, sans-serif";
    ctx.fillText(box.label, bx + 125, by + 148);
  });

  // Challenge Footer Inside Card
  ctx.fillStyle = "#DCE6FF";
  ctx.font = "700 30px system-ui, -apple-system, sans-serif";
  ctx.fillText("Can you beat my score? 🚀", 540, 1445);

  // Bottom App Footer
  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  ctx.font = "700 30px system-ui, -apple-system, sans-serif";
  ctx.fillText("Practice Daily · Climb Live Ranks", 540, 1680);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
  });
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
  const [sharingStory, setSharingStory] = useState(false);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playSelectTapSound();
  };

  if (quiz.done && quiz.res) {
    const { c, w, sk, n, posXp, negXp, bonusXp, xp, up, milestoneXp } = quiz.res;
    const accuracy = n > 0 ? Math.round((c / n) * 100) : 0;
    const subjectMeta = getSubjectMeta(quiz.k);

    const handleShareStoryCard = async () => {
      if (sharingStory) return;
      setSharingStory(true);
      try {
        const blob = await generateStoryCardBlob({
          studentName: profile.name || "Champion",
          subjectLabel: subjectMeta.name,
          levelLabel: LEVELS[quiz.L],
          correct: c,
          total: n,
          accuracy,
          xpEarned: xp,
          streak: profile.streak,
        });
        if (!blob) return;

        const file = new File([blob], "amaysst-quiz-scorecard.png", { type: "image/png" });
        const shareUrl = `${window.location.origin}${window.location.pathname}`;

        if (
          typeof navigator !== "undefined" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] })
        ) {
          await navigator.share({
            files: [file],
            title: "My AmaySST Quiz Score",
            text: `I scored ${c}/${n} (${accuracy}%) on AmaySST Quiz! Try beating my score: ${shareUrl}`,
          });
          return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "amaysst-quiz-story-card.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          // ignore user cancel
        }
      } finally {
        setSharingStory(false);
      }
    };

    return (
      <div className="space-y-4">
        <h1 className="text-[26px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF] px-1">
          Result
        </h1>

        <div className="amay-card rounded-[28px] p-5 sm:p-6 space-y-3.5">
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

          {/* #10: 9:16 Shareable Story Card Button */}
          <button
            type="button"
            disabled={sharingStory}
            onClick={handleShareStoryCard}
            className="w-full h-11 rounded-[18px] bg-gradient-to-r from-[#0B1B4D] to-[#1457E0] text-white font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99] transition disabled:opacity-60"
          >
            <Share2 className="w-4 h-4" />
            <span>{sharingStory ? "Generating 9:16 Story Card…" : "Share 9:16 Story Score Card"}</span>
          </button>
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
    <div className="space-y-3.5">
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
      <div className="h-2 rounded-full bg-[#1457E0]/10 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#38B0FF] via-[#2B7BFF] to-[#0B57DD] transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* #4: Question Navigator Dots Bar */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 no-scrollbar"
        aria-label="Question navigator"
      >
        {quiz.qs.map((_, idx) => {
          const isCurrent = idx === quiz.i;
          const isAnswered = quiz.sel[idx] !== undefined;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onGoToQuestion(idx)}
              aria-label={`Go to question ${idx + 1}${isAnswered ? " (answered)" : " (unanswered)"}`}
              aria-current={isCurrent ? "step" : undefined}
              className={`min-w-[30px] h-[30px] px-1.5 rounded-full font-mono-nums text-xs font-extrabold transition-all shrink-0 cursor-pointer active:scale-90 ${
                isCurrent
                  ? "bg-gradient-to-b from-[#2B7BFF] to-[#1457E0] text-white ring-2 ring-[#38B0FF] ring-offset-2 ring-offset-[#F4F7FC] dark:ring-offset-[#080D1B] shadow-sm"
                  : isAnswered
                    ? "bg-[#1457E0]/18 dark:bg-[#5AA2FF]/22 text-[#1457E0] dark:text-[#5AA2FF] border border-[#1457E0]/35"
                    : "amay-card text-[#5A6A92] dark:text-[#93A3CC] border border-[#1846AA]/12 dark:border-white/10 opacity-75 hover:opacity-100"
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
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
