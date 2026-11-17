import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Crown,
  Lock,
  Play,
  RefreshCw,
  Share2,
  ShieldCheck,
  Trophy,
  XCircle,
} from "lucide-react";
import type { BadgeDesignSpec } from "../lib/badgeCanvas";
import { launchMilestoneConfetti } from "../lib/confetti";
import { formatTime, shuffle } from "../lib/quizEngine";
import { playMilestoneSound, playQuizCompleteSound, playSelectTapSound } from "../lib/soundEffects";
import {
  MSD_QUESTION_TARGET,
  resolveMsdEventPhase,
  submitMsdAttempt,
  type DynamicQuestionRow,
  type MsdEventConfig,
  type MsdSubmissionRow,
} from "../lib/supabase";

interface PreparedMsdQuestion {
  text: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

interface MsdViewProps {
  profileName: string;
  guestId: string;
  eventConfig: MsdEventConfig;
  msdQuestions: DynamicQuestionRow[];
  myAttempt: MsdSubmissionRow | null;
  leaderboard: MsdSubmissionRow[];
  initialTab?: "overview" | "board";
  onAttemptSubmitted: (row: MsdSubmissionRow) => void;
  onOpenMsdBadge: (spec: Extract<BadgeDesignSpec, { kind: "msd" }>) => void;
  onRefreshLeaderboard: () => void;
  onPlayingChange?: (playing: boolean) => void;
  onBackHome: () => void;
}

const MSD_QUIZ_DURATION_SEC = 7 * 60; // 7 minutes for 20 questions

function formatDurationSec(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

export const MsdView: React.FC<MsdViewProps> = ({
  profileName,
  guestId,
  eventConfig,
  msdQuestions,
  myAttempt,
  leaderboard,
  initialTab = "overview",
  onAttemptSubmitted,
  onOpenMsdBadge,
  onRefreshLeaderboard,
  onPlayingChange,
  onBackHome,
}) => {
  const [subTab, setSubTab] = useState<"overview" | "board">(initialTab);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Quiz session state (strictly single-attempt)
  const [activeQs, setActiveQs] = useState<PreparedMsdQuestion[] | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<(number | undefined)[]>([]);
  const [timeLeft, setTimeLeft] = useState(MSD_QUIZ_DURATION_SEC);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [reviewQs, setReviewQs] = useState<{
    qs: PreparedMsdQuestion[];
    sel: (number | undefined)[];
  } | null>(null);

  const submittedOnceRef = useRef(false);

  useEffect(() => {
    setSubTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const isPlaying = activeQs !== null;

  useEffect(() => {
    onPlayingChange?.(isPlaying);
    return () => onPlayingChange?.(false);
  }, [isPlaying, onPlayingChange]);

  const eventStatus = useMemo(
    () => resolveMsdEventPhase(eventConfig, nowMs),
    [eventConfig, nowMs]
  );

  const sortedBoard = useMemo(() => {
    const map = new Map<string, MsdSubmissionRow>();
    for (const row of leaderboard) {
      map.set(row.guest_uuid, row);
    }
    if (myAttempt) {
      map.set(myAttempt.guest_uuid, {
        ...myAttempt,
        candidate_name: profileName || myAttempt.candidate_name,
      });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.time_taken_sec !== b.time_taken_sec) return a.time_taken_sec - b.time_taken_sec;
      return Date.parse(a.created_at) - Date.parse(b.created_at);
    });
  }, [leaderboard, myAttempt, profileName]);

  const myBoardRank = useMemo(() => {
    if (!myAttempt) return undefined;
    const idx = sortedBoard.findIndex((r) => r.guest_uuid === myAttempt.guest_uuid);
    return idx >= 0 ? idx + 1 : undefined;
  }, [myAttempt, sortedBoard]);

  const finalizeAndSubmit = async (
    qs: PreparedMsdQuestion[],
    sel: (number | undefined)[],
    remainingSec: number
  ) => {
    if (submittedOnceRef.current) return;
    submittedOnceRef.current = true;
    setSubmitting(true);
    setSubmitError("");

    let right = 0;
    let wrong = 0;
    qs.forEach((q, idx) => {
      const pick = sel[idx];
      if (pick === undefined) return;
      if (pick === q.correctIndex) right += 1;
      else wrong += 1;
    });

    const elapsedSec = Math.max(1, MSD_QUIZ_DURATION_SEC - remainingSec);
    const res = await submitMsdAttempt(guestId, profileName, right, qs.length, elapsedSec);

    setSubmitting(false);
    setActiveQs(null);
    setReviewQs({ qs, sel });
    onAttemptSubmitted(res.row);

    if (res.row.score >= Math.ceil(res.row.total * 0.7)) {
      playMilestoneSound();
      launchMilestoneConfetti(1000);
    } else {
      playQuizCompleteSound(right, wrong);
    }

    if (res.error) {
      setSubmitError(res.error);
    }
    setSubTab("overview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!activeQs) return;
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          finalizeAndSubmit(activeQs, selected, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeQs, selected]);

  const handleStartQuiz = () => {
    if (myAttempt || eventStatus.phase !== "live") return;
    const maxQs = Math.min(MSD_QUESTION_TARGET, eventConfig.questionCount || MSD_QUESTION_TARGET);
    const pool = [...msdQuestions].slice(0, maxQs);
    if (pool.length === 0) return;

    const prepared: PreparedMsdQuestion[] = shuffle(pool).map((row) => {
      const rawOpts = [row.option_a, row.option_b, row.option_c, row.option_d];
      const tagged = shuffle(
        rawOpts.map((optText, idx) => ({
          optText,
          isCorrect: idx === Math.max(0, Math.min(3, Number(row.correct_index) || 0)),
        }))
      );
      return {
        text: row.question_text,
        options: tagged.map((t) => t.optText) as [string, string, string, string],
        correctIndex: Math.max(0, tagged.findIndex((t) => t.isCorrect)),
        explanation: row.explanation || "",
      };
    });

    submittedOnceRef.current = false;
    setReviewQs(null);
    setActiveQs(prepared);
    setQIndex(0);
    setSelected(Array(prepared.length).fill(undefined));
    setTimeLeft(MSD_QUIZ_DURATION_SEC);
    setSubmitError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ACTIVE QUIZ SCREEN (CSK YELLOW THEME)
  if (activeQs) {
    const q = activeQs[qIndex];
    const picked = selected[qIndex];
    const progressPct = Math.round(((qIndex + 1) / activeQs.length) * 100);
    const letters = ["A", "B", "C", "D"];

    return (
      <div className="space-y-4 pb-8">
        {/* Top bar */}
        <div className="amay-msd-card rounded-[24px] px-4 py-3 flex items-center justify-between gap-2 text-[#0B1B4D] dark:text-[#FEF08A]">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="./msd-badge.jpg"
              alt="MS Dhoni #7"
              className="w-9 h-9 rounded-full object-cover border-2 border-[#0B1B4D] dark:border-[#FACC15] shrink-0"
            />
            <div className="min-w-0">
              <strong className="block text-sm font-extrabold truncate">
                MS Dhoni #7 Special
              </strong>
              <span className="block text-[11px] font-bold opacity-80">
                1 Attempt Only · Score Separate
              </span>
            </div>
          </div>

          <div
            className={`px-3 py-1.5 rounded-full text-xs font-extrabold font-mono-nums shrink-0 ${
              timeLeft <= 60
                ? "bg-[#D92D3A] text-white"
                : "bg-[#0B1B4D] text-[#FACC15] dark:bg-[#FACC15] dark:text-[#0B1B4D]"
            }`}
          >
            ⏱ {formatTime(timeLeft)}
          </div>
        </div>

        {/* Question card */}
        <div className="amay-card rounded-[28px] p-5 space-y-4 border-2 border-[#FACC15]/70 dark:border-[#FACC15]/45">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold text-[#B45309] dark:text-[#FACC15]">
              <span>
                Question {qIndex + 1} of {activeQs.length}
              </span>
              <span className="font-mono-nums">{progressPct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-[#FACC15]/25 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FACC15] to-[#D97706] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <h2 className="text-[18px] sm:text-[20px] font-extrabold leading-snug text-[#0B1B4D] dark:text-white">
            {q.text}
          </h2>

          <div className="space-y-2.5">
            {q.options.map((opt, idx) => {
              const isPicked = picked === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  data-custom-sound="1"
                  onClick={() => {
                    playSelectTapSound();
                    setSelected((prev) => {
                      const next = [...prev];
                      next[qIndex] = idx;
                      return next;
                    });
                  }}
                  className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 flex items-center gap-3 transition-all cursor-pointer active:scale-[0.99] ${
                    isPicked
                      ? "bg-[#FEF08A] dark:bg-[#FACC15]/20 border-[#CA8A04] dark:border-[#FACC15] text-[#0B1B4D] dark:text-white shadow-sm"
                      : "bg-white/80 dark:bg-[#0B1224]/70 border-[#1846AA]/12 dark:border-white/10 text-[#0B1B4D] dark:text-[#EAF0FF] hover:border-[#FACC15]"
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full text-xs font-extrabold grid place-items-center shrink-0 ${
                      isPicked
                        ? "bg-[#0B1B4D] text-[#FACC15] dark:bg-[#FACC15] dark:text-[#0B1B4D]"
                        : "bg-[#FACC15]/25 text-[#92400E] dark:text-[#FACC15]"
                    }`}
                  >
                    {letters[idx]}
                  </span>
                  <span className="font-semibold text-[15px] leading-snug">{opt}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between gap-2.5">
            <button
              type="button"
              disabled={qIndex === 0}
              onClick={() => setQIndex((i) => Math.max(0, i - 1))}
              className="h-12 px-5 rounded-2xl amay-card text-sm font-bold text-[#0B1B4D] dark:text-white disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>

            {qIndex < activeQs.length - 1 ? (
              <button
                type="button"
                onClick={() => setQIndex((i) => Math.min(activeQs.length - 1, i + 1))}
                className="flex-1 h-12 rounded-2xl amay-msd-btn text-[#FACC15] dark:text-[#0B1B4D] font-extrabold text-sm cursor-pointer"
              >
                Next Question ›
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => finalizeAndSubmit(activeQs, selected, timeLeft)}
                className="flex-1 h-12 rounded-2xl bg-[#12A150] hover:bg-[#0F8A44] text-white font-extrabold text-sm cursor-pointer disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Finish & Unlock Badge 🏆"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // OVERVIEW / COMPLETED RESULT / SEPARATE RANK BOARD
  const badgeSpec: Extract<BadgeDesignSpec, { kind: "msd" }> | null = myAttempt
    ? {
        kind: "msd",
        score: myAttempt.score,
        total: myAttempt.total,
        rank: myBoardRank,
        dateLabel: new Date(myAttempt.created_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      }
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBackHome}
          className="amay-card rounded-[18px] px-3.5 py-2 text-xs font-extrabold text-[#0B1B4D] dark:text-[#EAF0FF] inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="inline-flex p-0.5 rounded-full bg-[#FACC15]/25 dark:bg-white/10 text-xs font-extrabold border border-[#CA8A04]/25">
          <button
            type="button"
            onClick={() => setSubTab("overview")}
            className={`px-3.5 py-1.5 rounded-full transition-colors cursor-pointer ${
              subTab === "overview"
                ? "bg-[#0B1B4D] text-[#FACC15] dark:bg-[#FACC15] dark:text-[#0B1B4D]"
                : "text-[#78350F] dark:text-[#FDE047]"
            }`}
          >
            #7 Tribute
          </button>
          <button
            type="button"
            onClick={() => {
              setSubTab("board");
              onRefreshLeaderboard();
            }}
            className={`px-3.5 py-1.5 rounded-full transition-colors cursor-pointer ${
              subTab === "board"
                ? "bg-[#0B1B4D] text-[#FACC15] dark:bg-[#FACC15] dark:text-[#0B1B4D]"
                : "text-[#78350F] dark:text-[#FDE047]"
            }`}
          >
            Dhoni Ranks ({sortedBoard.length})
          </button>
        </div>
      </div>

      {/* CSK Hero Banner */}
      <section className="amay-msd-card rounded-[28px] p-5 text-[#0B1B4D] dark:text-[#FEF08A] space-y-4 relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border-[3px] border-[#0B1B4D] dark:border-[#FACC15] shadow-md shrink-0 bg-[#071230]">
            <img
              src="./msd-badge.jpg"
              alt="MS Dhoni #7 Tribute"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0B1B4D] text-[#FACC15] text-[10px] font-extrabold uppercase tracking-wider">
              <Crown className="w-3 h-3" />
              <span>
                {eventStatus.phase === "coming_soon"
                  ? "Coming Soon"
                  : eventStatus.phase === "live"
                    ? `Live · ${eventStatus.remainingLabel} left`
                    : "24h Special Ended"}
              </span>
            </div>
            <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-[#0B1B4D] dark:text-white">
              MS Dhoni #7 Tribute
            </h1>
            <p className="text-xs font-bold text-[#422006] dark:text-[#FDE047]/90">
              20 Questions · 1 Attempt Per Candidate · Separate Trophy Board
            </p>
          </div>
        </div>
      </section>

      {submitError && (
        <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs font-bold text-[#D92D3A] dark:text-[#FF8A93]">
          {submitError}
        </div>
      )}

      {subTab === "overview" ? (
        <div className="space-y-4">
          {myAttempt && badgeSpec ? (
            <>
              {/* Completed / Locked Card */}
              <div className="amay-card rounded-[28px] p-5 space-y-4 border-2 border-[#FACC15]/70 dark:border-[#FACC15]/45">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#12A150] dark:text-emerald-400">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Attempt Recorded (1/1 Used · Locked)</span>
                  </div>
                  {myBoardRank && (
                    <span className="px-2.5 py-1 rounded-full bg-[#FACC15] text-[#0B1B4D] text-xs font-extrabold font-mono-nums">
                      Dhoni Rank #{myBoardRank}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-[#FACC15]/20 dark:bg-[#FACC15]/10 p-3">
                    <strong className="block text-2xl font-extrabold font-mono-nums text-[#0B1B4D] dark:text-[#FACC15]">
                      {myAttempt.score}/{myAttempt.total}
                    </strong>
                    <span className="text-[11px] font-bold text-[#78350F] dark:text-[#FDE047]/80">
                      Score
                    </span>
                  </div>
                  <div className="rounded-2xl bg-[#FACC15]/20 dark:bg-[#FACC15]/10 p-3">
                    <strong className="block text-2xl font-extrabold font-mono-nums text-[#0B1B4D] dark:text-[#FACC15]">
                      {Math.round((myAttempt.score / Math.max(1, myAttempt.total)) * 100)}%
                    </strong>
                    <span className="text-[11px] font-bold text-[#78350F] dark:text-[#FDE047]/80">
                      Accuracy
                    </span>
                  </div>
                  <div className="rounded-2xl bg-[#FACC15]/20 dark:bg-[#FACC15]/10 p-3">
                    <strong className="block text-2xl font-extrabold font-mono-nums text-[#0B1B4D] dark:text-[#FACC15]">
                      {formatDurationSec(myAttempt.time_taken_sec)}
                    </strong>
                    <span className="text-[11px] font-bold text-[#78350F] dark:text-[#FDE047]/80">
                      Time
                    </span>
                  </div>
                </div>

                <p className="text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC]">
                  Your MS Dhoni #7 score stays on the separate CSK Yellow Tribute Board and is not added to normal Daily or Overall XP.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenMsdBadge(badgeSpec)}
                    className="h-12 px-4 rounded-2xl bg-[#FACC15] hover:bg-[#EAB308] text-[#0B1B4D] font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share #7 Badge</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSubTab("board");
                      onRefreshLeaderboard();
                    }}
                    className="h-12 px-4 rounded-2xl amay-msd-btn text-[#FACC15] dark:text-[#0B1B4D] font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Dhoni Rank Board</span>
                  </button>
                </div>
              </div>

              {reviewQs && (
                <div className="amay-card rounded-[26px] p-5 space-y-3">
                  <h2 className="text-base font-extrabold text-[#0B1B4D] dark:text-white">
                    Answer Review
                  </h2>
                  <div className="divide-y divide-[#1846AA]/10 dark:divide-white/10">
                    {reviewQs.qs.map((rq, idx) => {
                      const picked = reviewQs.sel[idx];
                      const right = picked === rq.correctIndex;
                      return (
                        <div key={idx} className="py-3 space-y-1">
                          <div className="flex items-start gap-2">
                            {right ? (
                              <CheckCircle2 className="w-4 h-4 text-[#12A150] shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 text-[#D92D3A] shrink-0 mt-0.5" />
                            )}
                            <p className="text-sm font-bold text-[#0B1B4D] dark:text-white">
                              Q{idx + 1}. {rq.text}
                            </p>
                          </div>
                          <p className="text-xs pl-6 text-[#5A6A92] dark:text-[#93A3CC]">
                            Correct: <strong className="text-[#12A150]">{rq.options[rq.correctIndex]}</strong>
                            {picked !== undefined && !right && (
                              <> · Your answer: <strong className="text-[#D92D3A]">{rq.options[picked]}</strong></>
                            )}
                          </p>
                          {rq.explanation && (
                            <p className="text-xs pl-6 text-[#5A6A92] dark:text-[#93A3CC]">
                              {rq.explanation}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : eventStatus.phase === "coming_soon" ? (
            <div className="amay-card rounded-[28px] p-6 text-center space-y-3 border-2 border-[#FACC15]/60">
              <div className="w-12 h-12 rounded-2xl bg-[#FACC15]/25 text-[#B45309] dark:text-[#FACC15] grid place-items-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-extrabold text-[#0B1B4D] dark:text-white">
                Coming Soon
              </h2>
              <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC] max-w-sm mx-auto">
                The 24-hour MS Dhoni Retirement Special (20 Questions) is being prepared right now. Check back shortly when it goes live!
              </p>
            </div>
          ) : eventStatus.phase === "ended" ? (
            <div className="amay-card rounded-[28px] p-6 text-center space-y-3 border-2 border-[#FACC15]/60">
              <div className="w-12 h-12 rounded-2xl bg-[#FACC15]/25 text-[#B45309] dark:text-[#FACC15] grid place-items-center mx-auto">
                <Trophy className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-extrabold text-[#0B1B4D] dark:text-white">
                24-Hour Special Ended
              </h2>
              <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC]">
                The competition window has closed. Open the Dhoni Rank Board to see the final champions.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubTab("board");
                  onRefreshLeaderboard();
                }}
                className="h-11 px-6 rounded-2xl amay-msd-btn text-[#FACC15] dark:text-[#0B1B4D] font-extrabold text-sm cursor-pointer"
              >
                View Final Standings
              </button>
            </div>
          ) : (
            <div className="amay-card rounded-[28px] p-5 space-y-4 border-2 border-[#FACC15]/70 dark:border-[#FACC15]/45">
              <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">
                Competition Rules
              </h2>
              <ul className="space-y-2 text-sm text-[#0B1B4D] dark:text-[#EAF0FF]">
                <li className="flex items-start gap-2">
                  <span className="font-extrabold text-[#CA8A04] dark:text-[#FACC15]">1.</span>
                  <span>
                    <strong>{Math.min(20, msdQuestions.length)} Questions</strong> in this special MS Dhoni retirement quiz (7 minutes).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-extrabold text-[#CA8A04] dark:text-[#FACC15]">2.</span>
                  <span>
                    <strong>One attempt per member only.</strong> Once you start and submit, you cannot retake it.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-extrabold text-[#CA8A04] dark:text-[#FACC15]">3.</span>
                  <span>
                    <strong>Separate Rank Board:</strong> Scores do not affect your normal Daily or Overall XP.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-extrabold text-[#CA8A04] dark:text-[#FACC15]">4.</span>
                  <span>
                    <strong>Special Badge:</strong> Unlock a shareable MS Dhoni #7 photo badge with your score for Instagram &amp; WhatsApp!
                  </span>
                </li>
              </ul>

              {msdQuestions.length === 0 ? (
                <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Questions are currently being uploaded. Please try again in a moment!</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartQuiz}
                  className="w-full h-14 rounded-[22px] amay-msd-btn text-[#FACC15] dark:text-[#0B1B4D] font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-transform"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Start Quiz ({Math.min(20, msdQuestions.length)} Questions)</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* SEPARATE MS DHONI RANK BOARD */
        <div className="amay-card rounded-[28px] p-4 sm:p-5 space-y-3 border-2 border-[#FACC15]/60 dark:border-[#FACC15]/40">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-[#CA8A04] dark:text-[#FACC15]" />
                <span>MS Dhoni Trophy Board</span>
              </h2>
              <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                Ranked by Score / {eventConfig.questionCount || 20} · Fastest time breaks ties
              </p>
            </div>
            <button
              type="button"
              onClick={onRefreshLeaderboard}
              className="w-9 h-9 rounded-xl amay-card flex items-center justify-center text-[#0B1B4D] dark:text-[#FACC15] cursor-pointer"
              aria-label="Refresh leaderboard"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {sortedBoard.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-bold text-[#0B1B4D] dark:text-white">
                No submissions yet
              </p>
              <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                Be the first on the MS Dhoni Trophy Board!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#CA8A04]/15 dark:divide-white/10">
              {sortedBoard.map((row, idx) => {
                const rank = idx + 1;
                const isMe = row.guest_uuid === guestId;
                const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
                return (
                  <div
                    key={row.guest_uuid}
                    className={`py-3 px-2.5 rounded-xl flex items-center justify-between gap-2 ${
                      isMe ? "bg-[#FACC15]/25 dark:bg-[#FACC15]/15 font-extrabold" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-9 text-center font-mono-nums text-sm font-extrabold text-[#0B1B4D] dark:text-[#FACC15] shrink-0">
                        {medal}
                      </span>
                      <div className="min-w-0">
                        <strong className="block text-sm text-[#0B1B4D] dark:text-white truncate">
                          {row.candidate_name}
                          {isMe ? " (You)" : ""}
                        </strong>
                        <span className="block text-[11px] font-mono-nums text-[#5A6A92] dark:text-[#93A3CC]">
                          {formatDurationSec(row.time_taken_sec)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <strong className="font-mono-nums text-base font-extrabold text-[#B45309] dark:text-[#FACC15]">
                        {row.score} / {row.total}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
