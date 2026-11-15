import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Award, ChevronRight, Clock, Crown, Flame, Play, Swords, Target, Zap } from "lucide-react";
import { SOCIAL_LINKS } from "../data/benchmarks";
import {
  computeRankSnapshot,
  getTodayCutoffStatus,
  todayIST,
  XP_PER_LEVEL,
  type StudentProfile,
} from "../lib/quizEngine";
import { deriveYouTubeThumbnail, type LatestVideoConfig } from "../lib/supabase";
import type { RankEntry } from "./RankView";

interface HomeViewProps {
  profile: StudentProfile;
  allTimeEntries: RankEntry[];
  todayEntries: RankEntry[];
  latestVideo: LatestVideoConfig;
  onStartNormalQuiz: () => void;
  onOpenSubjects: () => void;
  onOpenRank: () => void;
  onOpenBadge: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  profile,
  allTimeEntries,
  todayEntries,
  latestVideo,
  onStartNormalQuiz,
  onOpenSubjects,
  onOpenRank,
  onOpenBadge,
}) => {
  const [raceMode, setRaceMode] = useState<"td" | "all">("td");
  const [cutoff, setCutoff] = useState(() => getTodayCutoffStatus());
  const [fillReady, setFillReady] = useState(false);
  const [failedThumbSrc, setFailedThumbSrc] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCutoff(getTodayCutoffStatus());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

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
    const isTiedForFirst = strictlyAhead.length === 0 && tiedAtMyXp.length > 0;

    const nextGroupXp = strictlyAhead.length > 0 ? strictlyAhead[strictlyAhead.length - 1].xp : null;
    const nextGroupPlayers = nextGroupXp !== null ? strictlyAhead.filter((e) => e.xp === nextGroupXp) : [];

    let xpToJump = 0;
    let jumpToRank = snap.myRank;
    let playersPassed = 0;
    let targetLabel = "";

    if (tiedAtMyXp.length > 0 && isTiedForFirst) {
      xpToJump = 1;
      jumpToRank = 1;
      playersPassed = tiedAtMyXp.length;
      targetLabel = `Break the ${tiedAtMyXp.length + 1}-way tie for #1`;
    } else if (tiedAtMyXp.length > 0) {
      xpToJump = 1;
      jumpToRank = snap.myRank;
      playersPassed = tiedAtMyXp.length;
      targetLabel = `Pass ${tiedAtMyXp.length} tied player${tiedAtMyXp.length > 1 ? "s" : ""} at ${myXp.toLocaleString()} XP`;
    } else if (nextGroupXp !== null) {
      xpToJump = Math.max(1, nextGroupXp - myXp + 1);
      const stillStrictlyAhead = strictlyAhead.filter((e) => e.xp > nextGroupXp).length;
      jumpToRank = 1 + stillStrictlyAhead;
      playersPassed = snap.myRank - jumpToRank;
      const leaderName = nextGroupPlayers[0]?.name || "rival";
      targetLabel =
        nextGroupPlayers.length > 1
          ? `Pass ${nextGroupPlayers.length} tied players (${leaderName} & others) → #${jumpToRank}`
          : `Beat ${leaderName} → Jump to #${jumpToRank}`;
    }

    let bigLeapMsg = "";
    if (!isSoleFirst) {
      const boostXp = myXp + 150;
      const rankAfterBoost = 1 + list.filter((e) => !e.isMe && e.xp > boostXp).length;
      const spotsGained = snap.myRank - rankAfterBoost;
      if (spotsGained > Math.max(1, playersPassed)) {
        bigLeapMsg = `Score +150 XP in one quiz to leap ${spotsGained} ranks straight to #${rankAfterBoost}!`;
      } else if (xpToJump > 0) {
        const qNeeded = Math.max(1, Math.ceil(xpToJump / XP_PER_LEVEL[1]));
        bigLeapMsg = `Just ${qNeeded} right answer${qNeeded > 1 ? "s" : ""} on Medium jumps you to #${jumpToRank}`;
      }
    }

    const runnerBehind = list.find((e) => !e.isMe && e.xp <= myXp) || null;
    const leadMargin = isSoleFirst && runnerBehind ? Math.max(0, myXp - runnerBehind.xp) : 0;

    return {
      ...snap,
      isSoleFirst,
      isTiedForFirst,
      xpToJump,
      jumpToRank,
      targetLabel,
      bigLeapMsg,
      runnerBehind,
      leadMargin,
    };
  }, [allTimeEntries, todayEntries, raceMode, profile.xp, myTodayXp]);

  const allRankNum = 1 + allTimeEntries.filter((e) => !e.isMe && e.xp > profile.xp).length;
  const tdRankNum = 1 + todayEntries.filter((e) => !e.isMe && e.xp > myTodayXp).length;

  const [animRank, setAnimRank] = useState<number>(raceData.myRank);
  const [animXp, setAnimXp] = useState<number>(raceData.myXp);
  const [animAllRank, setAnimAllRank] = useState<number>(allRankNum);
  const [animTdRank, setAnimTdRank] = useState<number>(tdRankNum);

  useEffect(() => {
    setFillReady(false);
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setFillReady(true);
      setAnimRank(raceData.myRank);
      setAnimXp(raceData.myXp);
      setAnimAllRank(allRankNum);
      setAnimTdRank(tdRankNum);
      return;
    }

    const startRank = Math.max(raceData.myRank, raceData.totalPlayers);
    const startAllRank = Math.max(allRankNum, allTimeEntries.length);
    const startTdRank = Math.max(tdRankNum, todayEntries.length);
    const duration = 700;
    let rafId = 0;
    let startTime = 0;

    setAnimRank(startRank);
    setAnimXp(0);
    setAnimAllRank(startAllRank);
    setAnimTdRank(startTdRank);

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
      setAnimAllRank(Math.round(startAllRank + (allRankNum - startAllRank) * eased));
      setAnimTdRank(Math.round(startTdRank + (tdRankNum - startTdRank) * eased));

      if (t < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    raceMode,
    raceData.myRank,
    raceData.myXp,
    raceData.totalPlayers,
    allRankNum,
    tdRankNum,
    allTimeEntries.length,
    todayEntries.length,
  ]);

  return (
    <div className="space-y-3">
      {/* Greeting */}
      <div className="pt-1 pb-0.5 px-1">
        <h1 className="text-[30px] sm:text-[36px] leading-[1.1] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF] break-words">
          Hey, <span className="text-[#1457E0] dark:text-[#5AA2FF]">{profile.name}</span>{" "}
          <i className="animate-wave not-italic" aria-hidden="true">
            👋
          </i>
        </h1>
        <p className="text-[15px] text-[#5A6A92] dark:text-[#93A3CC] mt-1">
          Let&apos;s test your knowledge today
        </p>
      </div>

      {/* Creative Rank Race & Daily Badge Competition Card */}
      <section className="amay-card rounded-[28px] p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0B1B4D] dark:text-[#EAF0FF] whitespace-nowrap">
            {raceData.isSoleFirst ? (
              <>
                <Crown className="w-4 h-4 text-[#D98A00] dark:text-[#FFC24D] shrink-0" />
                <span>#1 Leader · Defend Crown</span>
              </>
            ) : (
              <>
                <Swords className="w-4 h-4 text-[#1457E0] dark:text-[#5AA2FF] shrink-0" />
                <span>
                  {raceMode === "td" ? "Today's Standing" : "Overall Standing"} · Top {raceData.topPercentile}%
                </span>
              </>
            )}
          </div>

          <div className="inline-flex p-0.5 rounded-full bg-[#1457E0]/10 dark:bg-white/10 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setRaceMode("td")}
              className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer whitespace-nowrap ${
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
              className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                raceMode === "all"
                  ? "bg-[#1457E0] text-white"
                  : "text-[#5A6A92] dark:text-[#93A3CC]"
              }`}
            >
              Overall
            </button>
          </div>
        </div>

        {/* Eye-Catchy Hero Split: Your Rank & Your XP */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 divide-x divide-[#1846AA]/12 dark:divide-white/12 rounded-2xl bg-[#1457E0]/[0.05] dark:bg-white/[0.04] border border-[#1846AA]/10 dark:border-white/10 py-3 px-2">
            <div className="px-2 sm:px-3 min-w-0">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#5A6A92] dark:text-[#93A3CC]">
                Your Rank
              </div>
              <div className="flex items-baseline gap-1 mt-1 whitespace-nowrap">
                <strong className="text-[30px] sm:text-[36px] leading-none font-extrabold tracking-tight font-mono-nums bg-gradient-to-br from-[#2B9BF6] via-[#1457E0] to-[#0A3A9C] dark:from-[#7DC6FF] dark:via-[#4A9EFF] dark:to-[#1D6FE8] bg-clip-text text-transparent">
                  #{animRank}
                </strong>
                <span className="text-xs sm:text-sm font-bold text-[#5A6A92] dark:text-[#93A3CC] font-mono-nums">
                  /{raceData.totalPlayers}
                </span>
              </div>
            </div>

            <div className="pl-3.5 sm:pl-4 pr-2 min-w-0">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#5A6A92] dark:text-[#93A3CC]">
                Your XP
              </div>
              <div
                className="flex items-baseline gap-1 mt-1 whitespace-nowrap"
                title={`${raceData.myXp.toLocaleString()} XP`}
              >
                <strong className="text-[30px] sm:text-[36px] leading-none font-extrabold tracking-tight font-mono-nums bg-gradient-to-br from-[#2B9BF6] via-[#1457E0] to-[#0A3A9C] dark:from-[#7DC6FF] dark:via-[#4A9EFF] dark:to-[#1D6FE8] bg-clip-text text-transparent">
                  {animXp >= 1000
                    ? `${(Math.floor(animXp / 100) / 10).toString().replace(/\.0$/, "")}k`
                    : animXp}
                </strong>
                <span className="text-xs sm:text-sm font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
                  XP
                </span>
              </div>
            </div>
          </div>

          {raceData.isSoleFirst ? (
            <p className="text-xs sm:text-[13px] font-semibold text-[#5A6A92] dark:text-[#93A3CC] px-0.5">
              <strong className="text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
                +{raceData.leadMargin.toLocaleString()} XP
              </strong>{" "}
              ahead of #2
              {raceData.runnerBehind ? ` (${raceData.runnerBehind.name})` : ""}
            </p>
          ) : (
            <p className="text-xs sm:text-[13px] font-semibold text-[#5A6A92] dark:text-[#93A3CC] px-0.5">
              <strong className="text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
                +{raceData.xpToJump.toLocaleString()} XP
              </strong>{" "}
              to hit #{raceData.jumpToRank} · {raceData.targetLabel}
            </p>
          )}
        </div>

        {/* Simple Bluish Fill-Up Bar toward Next Rank */}
        <div className="space-y-1.5">
          {(() => {
            const targetPlayer = raceData.nextAhead[0];
            const barPct = raceData.isSoleFirst
              ? 100
              : targetPlayer && targetPlayer.xp > 0
                ? Math.max(6, Math.min(98, Math.round((raceData.myXp / targetPlayer.xp) * 100)))
                : 100;
            const barScale = fillReady ? barPct / 100 : 0;

            return (
              <>
                <div className="flex items-center justify-between text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC]">
                  <span>
                    You:{" "}
                    <strong className="font-mono-nums text-[#0B1B4D] dark:text-white">
                      {raceData.myXp.toLocaleString()} XP
                    </strong>
                  </span>
                  <span className="font-mono-nums font-bold text-[#1457E0] dark:text-[#5AA2FF]">
                    {raceData.isSoleFirst
                      ? "#1 Leader"
                      : targetPlayer
                        ? `#${targetPlayer.rank} ${targetPlayer.name}: ${targetPlayer.xp.toLocaleString()} XP`
                        : "Top Rank"}
                  </span>
                </div>

                <div className="relative h-3 rounded-full bg-[#1457E0]/12 dark:bg-white/10 overflow-hidden">
                  <div
                    className="amay-fill-bar relative h-full w-full rounded-full bg-gradient-to-r from-[#38B0FF] via-[#1B74F5] to-[#0B57DD] overflow-hidden"
                    style={{ transform: `scaleX(${barScale})` }}
                  >
                    <span className="amay-shimmer-beam" aria-hidden="true" />
                  </div>
                </div>
              </>
            );
          })()}

          {raceData.bigLeapMsg && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF]">
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span>{raceData.bigLeapMsg}</span>
            </div>
          )}
        </div>

        {/* Today (left) & Overall (right) Ranks */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenRank}
            className="amay-card rounded-[20px] py-2.5 px-2.5 flex items-center justify-center gap-1 text-[13px] cursor-pointer whitespace-nowrap"
          >
            <span className="font-semibold text-[#0B1B4D] dark:text-[#EAF0FF]">⚡ Today</span>
            <strong className="text-[15px] text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
              #{animTdRank}
            </strong>
            <small className="text-[#5A6A92] dark:text-[#93A3CC] text-[11px] font-mono-nums">
              /{todayEntries.length}
            </small>
          </button>

          <button
            type="button"
            onClick={onOpenRank}
            className="amay-card rounded-[20px] py-2.5 px-2.5 flex items-center justify-center gap-1 text-[13px] cursor-pointer whitespace-nowrap"
          >
            <span className="font-semibold text-[#0B1B4D] dark:text-[#EAF0FF]">🏆 Overall</span>
            <strong className="text-[15px] text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
              #{animAllRank}
            </strong>
            <small className="text-[#5A6A92] dark:text-[#93A3CC] text-[11px] font-mono-nums">
              /{allTimeEntries.length}
            </small>
          </button>
        </div>

        {/* Glowing Play Now CTA — primary focal action */}
        <button
          type="button"
          onClick={onStartNormalQuiz}
          className="w-full h-14 rounded-[30px] amay-play-btn text-white font-bold text-[19px] flex items-center justify-center gap-2.5 relative cursor-pointer active:scale-[0.98] transition-transform"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>Play now</span>
          <ChevronRight className="w-5 h-5 absolute right-5" />
        </button>

        {/* Daily 11:00 PM Competition Strip + Who's Immediately Next */}
        <div className="pt-2 border-t border-[#1846AA]/10 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-extrabold text-[#0B1B4D] dark:text-white">
              <Target className="w-3.5 h-3.5 text-[#1457E0] dark:text-[#5AA2FF]" />
              <span>
                {raceData.nextAhead.length === 0
                  ? "Leading the Board"
                  : raceMode === "all"
                    ? "Next Ahead in Overall"
                    : "Next Ahead Today"}
              </span>
            </span>
            <button
              type="button"
              onClick={onOpenRank}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1457E0] dark:text-[#5AA2FF] hover:underline cursor-pointer"
            >
              <Award className="w-3 h-3 text-amber-500" />
              <span>Full Ladder</span>
            </button>
          </div>

          <div className="rounded-2xl bg-[#1457E0]/[0.04] dark:bg-white/[0.04] border border-[#1846AA]/10 dark:border-white/10 divide-y divide-[#1846AA]/10 dark:divide-white/10">
            {raceData.nextAhead[0] && (
              <div className="px-3.5 py-2 flex items-center justify-between gap-2 text-[13px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono-nums w-7 text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC]">
                    #{raceData.nextAhead[0].rank}
                  </span>
                  <span className="truncate font-semibold text-[#0B1B4D] dark:text-[#EAF0FF]">
                    {raceData.nextAhead[0].name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono-nums">
                  <span className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                    {raceData.nextAhead[0].xp.toLocaleString()} XP
                  </span>
                  <span className="inline-flex items-center text-xs font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
                    <ArrowUpRight className="w-3 h-3" />+{raceData.nextAhead[0].xpToPass.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Your Current Row */}
            <div className="px-3.5 py-2 flex items-center justify-between gap-2 text-[13px] bg-[#1457E0]/12 dark:bg-[#5AA2FF]/20 font-extrabold text-[#0B1B4D] dark:text-white">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono-nums w-7 text-xs">#{raceData.myRank}</span>
                <span className="truncate">{profile.name} (You)</span>
              </div>
              <span className="font-mono-nums font-bold text-[#1457E0] dark:text-[#5AA2FF] shrink-0">
                {raceData.myXp.toLocaleString()} XP
              </span>
            </div>

            {/* Nearest Chaser Behind (One Down) */}
            {raceData.chaserBehind && (
              <div className="px-3.5 py-1.5 flex items-center justify-between gap-2 text-[12px] font-medium text-[#5A6A92] dark:text-[#93A3CC]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono-nums w-7 text-xs">#{raceData.chaserBehind.rank}</span>
                  <span className="truncate">{raceData.chaserBehind.name} (chasing)</span>
                </div>
                <span className="font-mono-nums shrink-0">
                  −{raceData.chaserBehind.gapBelow.toLocaleString()} XP
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Live 11:00 PM Daily Badge Cutoff Timer & Quiz Rule */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-[#5A6A92] dark:text-[#93A3CC]">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#1457E0] dark:text-[#5AA2FF] shrink-0" />
            {cutoff.isLocked ? (
              <span>
                11:00 PM cutoff done · Resets in{" "}
                <strong className="font-mono-nums text-[#0B1B4D] dark:text-white">
                  {cutoff.resetLabel}
                </strong>
              </span>
            ) : (
              <span>
                Today badge cutoff (11 PM):{" "}
                <strong className="font-mono-nums text-[#0B1B4D] dark:text-white">
                  {cutoff.countdownLabel}
                </strong>{" "}
                · Top 3 win
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              1/4 negative
              {profile.streak > 0 ? ` · ${profile.streak}d streak` : ""}
            </span>
          </span>
        </div>

        {(profile.xp >= 100 || (profile.earnedDailyBadges?.length ?? 0) > 0) && (
          <button
            type="button"
            onClick={onOpenBadge}
            className="w-full py-3 rounded-[20px] amay-card text-[#1457E0] dark:text-[#5AA2FF] font-bold text-[15px] text-center cursor-pointer"
          >
            🏅 Share my badge
          </button>
        )}
      </section>

      {/* Choose a subject */}
      <button
        type="button"
        onClick={onOpenSubjects}
        className="w-full amay-card rounded-[30px] p-5 flex items-center gap-3.5 text-left cursor-pointer hover:-translate-y-0.5 transition-transform"
      >
        <span className="text-[30px]" aria-hidden="true">
          🎯
        </span>
        <strong className="flex-1 text-[19px] font-bold text-[#0B1B4D] dark:text-[#EAF0FF]">
          Choose a subject
        </strong>
        <ChevronRight className="w-6 h-6 text-[#0B1B4D] dark:text-[#EAF0FF]" />
      </button>

      {/* Latest Video */}
      <a
        href={latestVideo.url || SOCIAL_LINKS.youtubeShort}
        target="_blank"
        rel="noopener noreferrer"
        className="amay-card rounded-[30px] p-3.5 sm:p-4 flex items-center gap-3.5 sm:gap-4 hover:-translate-y-0.5 transition-transform"
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
          <strong className="block text-[17px] font-bold text-[#0B1B4D] dark:text-[#EAF0FF] truncate">
            {latestVideo.title || "Latest video"}
          </strong>
          <span className="block text-sm text-[#5A6A92] dark:text-[#93A3CC] line-clamp-2">
            {latestVideo.subtitle || "Watch my latest Short · opens on YouTube"}
          </span>
        </div>
        <ChevronRight className="w-5 h-5 text-[#5A6A92] dark:text-[#93A3CC] shrink-0" />
      </a>

      {/* Socials */}
      <div className="pt-2 pb-2 text-center space-y-2.5">
        <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC]">Follow AmaySST</p>
        <div className="grid grid-cols-2 gap-3">
          <a
            href={SOCIAL_LINKS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="amay-card rounded-[22px] py-3 font-bold text-[#0B1B4D] dark:text-[#EAF0FF] hover:-translate-y-0.5 transition-transform"
          >
            Instagram
          </a>
          <a
            href={SOCIAL_LINKS.youtubeChannel}
            target="_blank"
            rel="noopener noreferrer"
            className="amay-card rounded-[22px] py-3 font-bold text-[#0B1B4D] dark:text-[#EAF0FF] hover:-translate-y-0.5 transition-transform"
          >
            YouTube
          </a>
        </div>
      </div>
    </div>
  );
};
