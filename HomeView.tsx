import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  Crown,
  Flame,
  Play,
  ShieldCheck,
  Swords,
  Zap,
} from "lucide-react";
import { SOCIAL_LINKS } from "../data/benchmarks";
import {
  computeRankSnapshot,
  formatCompactXp,
  loadBlitzBest,
  todayIST,
  type BattleChallengePayload,
  type StudentProfile,
} from "../lib/quizEngine";
import {
  deriveYouTubeThumbnail,
  type LatestVideoConfig,
} from "../lib/supabase";
import type { RankEntry } from "./RankView";

interface HomeViewProps {
  profile: StudentProfile;
  allTimeEntries: RankEntry[];
  todayEntries: RankEntry[];
  latestVideo: LatestVideoConfig;
  pendingBattle?: BattleChallengePayload | null;
  onAcceptBattle?: () => void;
  onDismissBattle?: () => void;
  onStartNormalQuiz: () => void;
  onStartBlitz?: () => void;
  onOpenSubjects: () => void;
  onOpenRank?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  profile,
  allTimeEntries,
  todayEntries,
  latestVideo,
  pendingBattle = null,
  onAcceptBattle,
  onDismissBattle,
  onStartNormalQuiz,
  onStartBlitz,
  onOpenSubjects,
}) => {
  const [raceMode, setRaceMode] = useState<"td" | "all">("td");
  const [fillReady, setFillReady] = useState(false);
  const [failedThumbSrc, setFailedThumbSrc] = useState<string | null>(null);
  const blitzBest = useMemo(() => loadBlitzBest(), [profile.xp, profile.quizzes]);

  const candidateThumb = latestVideo.thumbnailUrl || deriveYouTubeThumbnail(latestVideo.url);
  const resolvedThumb = failedThumbSrc !== candidateThumb ? candidateThumb : "";
  const myTodayXp = profile.td?.d === todayIST(0) ? profile.td.xp : 0;

  const raceData = useMemo(() => {
    const list = raceMode === "all" ? allTimeEntries : todayEntries;
    const myXp = raceMode === "all" ? profile.xp : myTodayXp;
    const snap = computeRankSnapshot(list, myXp);

    const strictlyAhead = list.filter((e) => !e.isMe && e.xp > myXp);
    const tiedAtMyXp = list.filter((e) => !e.isMe && e.xp === myXp);
    const isSoleFirst = strictlyAhead.length === 0 && tiedAtMyXp.length === 0;

    const nextGroupXp = strictlyAhead.length > 0 ? strictlyAhead[strictlyAhead.length - 1].xp : null;
    const nextGroupPlayers = nextGroupXp !== null ? strictlyAhead.filter((e) => e.xp === nextGroupXp) : [];

    let xpToJump = 0;
    let jumpToRank = snap.myRank;
    let nextLabel = "";

    if (tiedAtMyXp.length > 0 && strictlyAhead.length === 0) {
      xpToJump = 1;
      jumpToRank = 1;
      nextLabel = `Break tie for #1`;
    } else if (tiedAtMyXp.length > 0) {
      xpToJump = 1;
      jumpToRank = snap.myRank;
      nextLabel = `Pass tied player${tiedAtMyXp.length > 1 ? "s" : ""} → #${jumpToRank}`;
    } else if (nextGroupXp !== null) {
      xpToJump = Math.max(1, nextGroupXp - myXp + 1);
      const stillStrictlyAhead = strictlyAhead.filter((e) => e.xp > nextGroupXp).length;
      jumpToRank = 1 + stillStrictlyAhead;
      const leaderName = nextGroupPlayers[0]?.name || "rival";
      nextLabel =
        nextGroupPlayers.length > 1
          ? `Next: #${jumpToRank} (${nextGroupPlayers.length} tied)`
          : `Next: #${jumpToRank} ${leaderName}`;
    }

    const runnerBehind = list.find((e) => !e.isMe && e.xp <= myXp) || null;
    const leadMargin = isSoleFirst && runnerBehind ? Math.max(0, myXp - runnerBehind.xp) : 0;

    return {
      ...snap,
      isSoleFirst,
      xpToJump,
      jumpToRank,
      nextLabel,
      leadMargin,
    };
  }, [allTimeEntries, todayEntries, raceMode, profile.xp, myTodayXp]);

  const [animRank, setAnimRank] = useState<number>(raceData.myRank);
  const [animXp, setAnimXp] = useState<number>(raceData.myXp);
  const [animBarPct, setAnimBarPct] = useState<number>(0);

  const barTargetXp = useMemo(() => {
    let target = 1000;
    while (raceData.myXp >= target) {
      target *= 10;
    }
    return target;
  }, [raceData.myXp]);

  const targetBarPct = useMemo(() => {
    if (raceData.myXp <= 0) return 0;
    return Math.max(2.5, Math.min(100, (raceData.myXp / barTargetXp) * 100));
  }, [raceData.myXp, barTargetXp]);

  useEffect(() => {
    setFillReady(false);
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setFillReady(true);
      setAnimRank(raceData.myRank);
      setAnimXp(raceData.myXp);
      setAnimBarPct(targetBarPct);
      return;
    }

    const startRank = Math.max(raceData.myRank, raceData.totalPlayers);
    const duration = 900;
    let rafId = 0;
    let startTime = 0;

    setAnimRank(startRank);
    setAnimXp(0);
    setAnimBarPct(0);

    const step = (ts: number) => {
      if (!startTime) {
        startTime = ts;
        setFillReady(true);
      }
      const elapsed = ts - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);

      setAnimRank(Math.round(startRank + (raceData.myRank - startRank) * eased));
      setAnimXp(Math.round(raceData.myXp * eased));
      setAnimBarPct(targetBarPct * eased);

      if (t < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [raceMode, raceData.myRank, raceData.myXp, raceData.totalPlayers, targetBarPct]);

  const barScale = fillReady ? animBarPct / 100 : 0;
  const immediateRival = raceData.nextAhead[0];

  return (
    <div className="space-y-3.5">
      {/* Greeting */}
      <div className="pt-1 pb-0.5 px-1">
        <h1 className="text-[28px] sm:text-[34px] leading-[1.12] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF] break-words">
          Hey, <span className="text-[#1457E0] dark:text-[#5AA2FF]">{profile.name}</span>{" "}
          <i className="animate-wave not-italic" aria-hidden="true">
            👋
          </i>
        </h1>
        <p className="text-[14px] sm:text-[15px] text-[#5A6A92] dark:text-[#93A3CC] mt-1">
          Let&apos;s test your knowledge today
        </p>
      </div>

      {/* #1: Incoming 1v1 Direct Challenge Banner */}
      {pendingBattle && onAcceptBattle && (
        <div className="amay-card rounded-[28px] p-4 sm:p-5 bg-gradient-to-r from-[#1457E0]/16 via-[#2B7BFF]/12 to-amber-400/14 border-2 border-[#1457E0]/40 dark:border-[#5AA2FF]/45 space-y-3 shadow-[0_14px_30px_-14px_rgba(20,87,224,0.45)]">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#2B7BFF] to-[#1457E0] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Swords className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1457E0]/15 text-[#1457E0] dark:text-[#5AA2FF]">
                1v1 Battle Challenge
              </span>
              <h2 className="text-base font-extrabold text-[#0B1B4D] dark:text-white mt-1 leading-snug">
                {pendingBattle.challengerName} challenged you!
              </h2>
              <p className="text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mt-0.5">
                Target to beat:{" "}
                <strong className="text-[#0B1B4D] dark:text-white font-mono-nums">
                  {pendingBattle.challengerCorrect}/{pendingBattle.challengerTotal}
                </strong>{" "}
                in{" "}
                <strong className="text-[#0B1B4D] dark:text-white font-mono-nums">
                  {pendingBattle.challengerSecondsTaken}s
                </strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAcceptBattle}
              className="flex-1 h-11 rounded-[18px] amay-play-btn text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition"
            >
              <Swords className="w-4 h-4" />
              <span>Accept 1v1 Battle</span>
            </button>
            {onDismissBattle && (
              <button
                type="button"
                onClick={onDismissBattle}
                className="h-11 px-4 rounded-[18px] amay-card text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC] cursor-pointer"
              >
                Later
              </button>
            )}
          </div>
        </div>
      )}

      {/* Minimalistic Standing + Play Card */}
      <section className="amay-card rounded-[28px] p-4 sm:p-5 space-y-4 overflow-hidden">
        {/* Top Row: Clean Title + Today / Overall Switch */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1 flex items-center gap-1.5 text-xs sm:text-[13px] font-extrabold text-[#0B1B4D] dark:text-[#EAF0FF]">
            {raceData.isSoleFirst && (
              <Crown className="w-4 h-4 text-[#D98A00] dark:text-[#FFC24D] shrink-0" />
            )}
            <span className="truncate">
              {raceData.isSoleFirst
                ? `#1 Leader · Top ${raceData.topPercentile}%`
                : `${raceMode === "td" ? "Today's Rank" : "Overall Rank"} · Top ${raceData.topPercentile}%`}
            </span>
          </div>

          <div className="inline-flex p-0.5 rounded-full bg-[#1457E0]/10 dark:bg-white/10 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setRaceMode("td")}
              className={`px-3 py-1 rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                raceMode === "td"
                  ? "bg-[#1457E0] text-white"
                  : "text-[#5A6A92] dark:text-[#93A3CC]"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setRaceMode("all")}
              className={`px-3 py-1 rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                raceMode === "all"
                  ? "bg-[#1457E0] text-white"
                  : "text-[#5A6A92] dark:text-[#93A3CC]"
              }`}
            >
              Overall
            </button>
          </div>
        </div>

        {/* Clean 2-Stat Summary */}
        <div className="grid grid-cols-2 divide-x divide-[#1846AA]/12 dark:divide-white/12 rounded-2xl bg-[#1457E0]/[0.05] dark:bg-white/[0.04] border border-[#1846AA]/10 dark:border-white/10 py-3 px-2 overflow-hidden">
          <div className="px-2.5 sm:px-3 min-w-0">
            <div className="text-[11px] font-bold text-[#5A6A92] dark:text-[#93A3CC]">
              {raceMode === "td" ? "Today Rank" : "Overall Rank"}
            </div>
            <div className="flex items-baseline gap-1 mt-0.5 whitespace-nowrap">
              <strong className="text-[30px] sm:text-[34px] leading-none font-extrabold tracking-tight font-mono-nums text-[#1457E0] dark:text-[#5AA2FF]">
                #{animRank}
              </strong>
              <span className="text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC] font-mono-nums">
                /{raceData.totalPlayers}
              </span>
            </div>
          </div>

          <div className="pl-3.5 sm:pl-4 pr-2 min-w-0">
            <div className="text-[11px] font-bold text-[#5A6A92] dark:text-[#93A3CC]">
              {raceMode === "td" ? "Today XP" : "Total XP"}
            </div>
            <div
              className="flex items-baseline gap-1 mt-0.5 whitespace-nowrap"
              title={`${raceData.myXp.toLocaleString()} XP`}
            >
              <strong className="text-[30px] sm:text-[34px] leading-none font-extrabold tracking-tight font-mono-nums text-[#1457E0] dark:text-[#5AA2FF]">
                {formatCompactXp(animXp)}
              </strong>
              <span className="text-xs font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">XP</span>
            </div>
          </div>
        </div>

        {/* Live Rival Alert Pill */}
        {immediateRival ? (
          <div className="rounded-2xl p-3 bg-gradient-to-r from-[#1457E0]/12 via-[#2B7BFF]/10 to-[#38B0FF]/12 dark:from-[#1457E0]/25 dark:to-[#38B0FF]/15 border border-[#1457E0]/25 dark:border-[#5AA2FF]/30 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-xl bg-[#1457E0] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Flame className="w-4 h-4 fill-current" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#0B1B4D] dark:text-white truncate">
                  Only{" "}
                  <span className="text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
                    {raceMode === "all"
                      ? formatCompactXp(immediateRival.xpToPass)
                      : immediateRival.xpToPass.toLocaleString()}{" "}
                    XP
                  </span>{" "}
                  behind {immediateRival.name}
                </p>
                <span className="block text-[11px] font-semibold text-[#5A6A92] dark:text-[#93A3CC] truncate">
                  {immediateRival.questionsNeeded} right answer
                  {immediateRival.questionsNeeded === 1 ? "" : "s"} to overtake #{immediateRival.rank}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onStartNormalQuiz}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-[#1457E0] hover:brightness-110 text-white text-xs font-extrabold cursor-pointer active:scale-95 transition shadow-xs"
            >
              Overtake
            </button>
          </div>
        ) : (
          raceData.isSoleFirst &&
          raceData.leadMargin > 0 && (
            <div className="rounded-2xl p-3 bg-gradient-to-r from-amber-400/18 via-yellow-300/12 to-amber-500/12 border border-amber-400/35 flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#0B1B4D] dark:text-white truncate">
                  Holding #1 with a +
                  <span className="font-mono-nums">
                    {raceMode === "all"
                      ? formatCompactXp(raceData.leadMargin)
                      : raceData.leadMargin.toLocaleString()}{" "}
                    XP
                  </span>{" "}
                  lead!
                </p>
                <span className="block text-[11px] font-semibold text-[#5A6A92] dark:text-[#93A3CC] truncate">
                  Play a quick quiz to extend your cushion
                </span>
              </div>
            </div>
          )
        )}

        {/* Milestone XP Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[#5A6A92] dark:text-[#93A3CC] truncate min-w-0">
              Filled:{" "}
              <strong className="font-mono-nums font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
                {raceMode === "all" ? formatCompactXp(animXp) : animXp.toLocaleString()} XP
              </strong>
            </span>
            <span className="font-mono-nums font-extrabold text-[#0B1B4D] dark:text-[#EAF0FF] shrink-0">
              {raceMode === "all" ? formatCompactXp(barTargetXp) : barTargetXp.toLocaleString()} XP
            </span>
          </div>

          <div className="relative h-3.5 rounded-full bg-[#1457E0]/12 dark:bg-white/10 overflow-hidden shadow-inner">
            <span
              className="absolute inset-y-0 left-1/4 w-px bg-[#1457E0]/12 dark:bg-white/10 pointer-events-none z-10"
              aria-hidden="true"
            />
            <span
              className="absolute inset-y-0 left-1/2 w-px bg-[#1457E0]/12 dark:bg-white/10 pointer-events-none z-10"
              aria-hidden="true"
            />
            <span
              className="absolute inset-y-0 left-3/4 w-px bg-[#1457E0]/12 dark:bg-white/10 pointer-events-none z-10"
              aria-hidden="true"
            />

            <div
              className="amay-xp-flow relative h-full w-full rounded-full overflow-hidden origin-left"
              style={{ transform: `scaleX(${barScale})` }}
            >
              <div
                className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/35 to-transparent pointer-events-none"
                aria-hidden="true"
              />
              <span className="amay-shimmer-beam" aria-hidden="true" />
            </div>

            {animBarPct > 1.5 && (
              <span
                className="amay-tip-orb absolute top-1/2 w-2.5 h-2.5 rounded-full bg-white pointer-events-none z-20"
                style={{ left: `clamp(6px, ${animBarPct}%, calc(100% - 6px))` }}
                aria-hidden="true"
              />
            )}
          </div>
        </div>

        {/* Primary Focal CTA */}
        <button
          type="button"
          onClick={onStartNormalQuiz}
          className="w-full h-14 rounded-[28px] amay-play-btn text-white font-bold text-[18px] flex items-center justify-center gap-2.5 relative cursor-pointer active:scale-[0.98] transition-transform"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>Play now</span>
          <ChevronRight className="w-5 h-5 absolute right-5" />
        </button>

        {/* 3-Row Mini Rank Table: One Up, My Rank, One Down */}
        <div className="rounded-2xl bg-[#1457E0]/[0.04] dark:bg-white/[0.04] border border-[#1846AA]/10 dark:border-white/10 divide-y divide-[#1846AA]/10 dark:divide-white/10 overflow-hidden">
          {raceData.nextAhead[0] && (
            <div className="px-3.5 py-2 flex items-center justify-between gap-2 text-[13px]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono-nums w-9 text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC] shrink-0">
                  #{raceData.nextAhead[0].rank}
                </span>
                <span className="truncate font-semibold text-[#0B1B4D] dark:text-[#EAF0FF]">
                  {raceData.nextAhead[0].name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono-nums">
                <span className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                  {raceMode === "all"
                    ? formatCompactXp(raceData.nextAhead[0].xp)
                    : raceData.nextAhead[0].xp.toLocaleString()}{" "}
                  XP
                </span>
                <span className="inline-flex items-center text-xs font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
                  <ArrowUpRight className="w-3 h-3" />+
                  {raceMode === "all"
                    ? formatCompactXp(raceData.nextAhead[0].xpToPass)
                    : raceData.nextAhead[0].xpToPass.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div className="px-3.5 py-2 flex items-center justify-between gap-2 text-[13px] bg-[#1457E0]/12 dark:bg-[#5AA2FF]/20 font-extrabold text-[#0B1B4D] dark:text-white">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono-nums w-9 text-xs shrink-0">#{raceData.myRank}</span>
              <span className="truncate">{profile.name} (You)</span>
            </div>
            <span className="font-mono-nums font-bold text-[#1457E0] dark:text-[#5AA2FF] shrink-0">
              {raceMode === "all" ? formatCompactXp(raceData.myXp) : raceData.myXp.toLocaleString()} XP
            </span>
          </div>

          {raceData.chaserBehind && (
            <div className="px-3.5 py-2 flex items-center justify-between gap-2 text-[12px] font-medium text-[#5A6A92] dark:text-[#93A3CC]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono-nums w-9 text-xs shrink-0">
                  #{raceData.chaserBehind.rank}
                </span>
                <span className="truncate">{raceData.chaserBehind.name}</span>
              </div>
              <span className="font-mono-nums shrink-0">
                −
                {raceMode === "all"
                  ? formatCompactXp(raceData.chaserBehind.gapBelow)
                  : raceData.chaserBehind.gapBelow.toLocaleString()}{" "}
                XP
              </span>
            </div>
          )}
        </div>
      </section>

      {/* #4: 20-Second Rapid Fire Blitz Card (Science, SST, English & GK only) */}
      {onStartBlitz && (
        <button
          type="button"
          onClick={onStartBlitz}
          className="w-full amay-card rounded-[28px] p-4 sm:p-5 flex items-center gap-3.5 text-left cursor-pointer hover:-translate-y-0.5 active:scale-[0.99] transition-all overflow-hidden border border-amber-400/35 bg-gradient-to-r from-amber-500/[0.08] via-orange-500/[0.05] to-transparent"
        >
          <span className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
            <Zap className="w-6 h-6 fill-current" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <strong className="text-[17px] font-extrabold text-[#0B1B4D] dark:text-[#EAF0FF] truncate">
                20s Rapid Fire Blitz
              </strong>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold shrink-0">
                +3s Streak
              </span>
            </div>
            <span className="block text-xs font-medium text-[#5A6A92] dark:text-[#93A3CC] truncate mt-0.5">
              Science · SST · English · GK{" "}
              {blitzBest.correct > 0 ? `· Best: ${blitzBest.correct} right` : "· Tap fast!"}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
        </button>
      )}

      {/* Choose a subject */}
      <button
        type="button"
        onClick={onOpenSubjects}
        className="w-full amay-card rounded-[28px] p-4 sm:p-5 flex items-center gap-3.5 text-left cursor-pointer hover:-translate-y-0.5 transition-transform overflow-hidden"
      >
        <span className="text-[28px]" aria-hidden="true">
          🎯
        </span>
        <strong className="flex-1 text-[18px] font-bold text-[#0B1B4D] dark:text-[#EAF0FF]">
          Choose a subject
        </strong>
        <ChevronRight className="w-5 h-5 text-[#5A6A92] dark:text-[#93A3CC]" />
      </button>

      {/* Latest Video */}
      <a
        href={latestVideo.url || SOCIAL_LINKS.youtubeShort}
        target="_blank"
        rel="noopener noreferrer"
        className="amay-card rounded-[28px] p-3.5 sm:p-4 flex items-center gap-3.5 hover:-translate-y-0.5 transition-transform overflow-hidden"
      >
        <div className="w-24 h-16 rounded-[16px] bg-gradient-to-br from-[#2B9BF6] to-[#0B57DD] flex items-center justify-center text-white shrink-0 relative overflow-hidden shadow-sm">
          {resolvedThumb ? (
            <>
              <img
                src={resolvedThumb}
                alt={latestVideo.title || "Latest video thumbnail"}
                referrerPolicy="no-referrer"
                onError={() => setFailedThumbSrc(candidateThumb)}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                <span className="w-8 h-8 rounded-full bg-black/65 backdrop-blur-xs flex items-center justify-center text-white text-xs pl-0.5 shadow">
                  ▶
                </span>
              </div>
            </>
          ) : (
            <span className="text-xl ml-0.5">▶</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <strong className="block text-[16px] font-bold text-[#0B1B4D] dark:text-[#EAF0FF] truncate">
            {latestVideo.title || "Latest video"}
          </strong>
          <span className="block text-sm text-[#5A6A92] dark:text-[#93A3CC] line-clamp-2">
            {latestVideo.subtitle || "Watch my latest Short · opens on YouTube"}
          </span>
        </div>
        <ChevronRight className="w-5 h-5 text-[#5A6A92] dark:text-[#93A3CC] shrink-0" />
      </a>

      {/* Socials */}
      <div className="pt-1 pb-2 text-center space-y-2">
        <p className="text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC]">Follow AmaySST</p>
        <div className="grid grid-cols-2 gap-3">
          <a
            href={SOCIAL_LINKS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="amay-card rounded-[20px] py-3 font-bold text-sm text-[#0B1B4D] dark:text-[#EAF0FF] hover:-translate-y-0.5 transition-transform"
          >
            Instagram
          </a>
          <a
            href={SOCIAL_LINKS.youtubeChannel}
            target="_blank"
            rel="noopener noreferrer"
            className="amay-card rounded-[20px] py-3 font-bold text-sm text-[#0B1B4D] dark:text-[#EAF0FF] hover:-translate-y-0.5 transition-transform"
          >
            YouTube
          </a>
        </div>
      </div>
    </div>
  );
};
