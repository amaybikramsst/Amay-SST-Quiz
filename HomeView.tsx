import React, { useMemo, useState } from "react";
import { ChevronRight, Play, Crown, Flame, Swords, Zap } from "lucide-react";
import { SOCIAL_LINKS } from "../data/benchmarks";
import { todayUTC, XP_PER_LEVEL, type StudentProfile } from "../lib/quizEngine";
import type { RankEntry } from "./RankView";

interface HomeViewProps {
  profile: StudentProfile;
  allTimeEntries: RankEntry[];
  todayEntries: RankEntry[];
  onStartNormalQuiz: () => void;
  onOpenSubjects: () => void;
  onOpenRank: () => void;
  onOpenBadge: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  profile,
  allTimeEntries,
  todayEntries,
  onStartNormalQuiz,
  onOpenSubjects,
  onOpenRank,
  onOpenBadge,
}) => {
  const [raceMode, setRaceMode] = useState<"all" | "td">("all");

  const myTodayXp = profile.td?.d === todayUTC(0) ? profile.td.xp : 0;

  const raceData = useMemo(() => {
    const list = raceMode === "all" ? allTimeEntries : todayEntries;
    const myXp = raceMode === "all" ? profile.xp : myTodayXp;
    const totalPlayers = list.length;

    // Standard competition rank: 1 + count of players strictly ahead of myXp
    const strictlyAhead = list.filter((e) => !e.isMe && e.xp > myXp);
    const tiedAtMyXp = list.filter((e) => !e.isMe && e.xp === myXp);
    const myRank = 1 + strictlyAhead.length;
    const myIdx = list.findIndex((e) => e.isMe);

    const isSoleFirst = strictlyAhead.length === 0 && tiedAtMyXp.length === 0;
    const isTiedForFirst = strictlyAhead.length === 0 && tiedAtMyXp.length > 0;

    // Nearest player strictly ahead (last element of strictlyAhead since list is sorted desc)
    const nextGroupXp = strictlyAhead.length > 0 ? strictlyAhead[strictlyAhead.length - 1].xp : null;
    const nextGroupPlayers = nextGroupXp !== null ? strictlyAhead.filter((e) => e.xp === nextGroupXp) : [];

    // Rank you jump straight to if you beat nextGroupXp (or break your current tie!)
    let xpToJump = 0;
    let jumpToRank = myRank;
    let playersPassed = 0;
    let targetLabel = "";

    if (tiedAtMyXp.length > 0 && isTiedForFirst) {
      xpToJump = 1;
      jumpToRank = 1;
      playersPassed = tiedAtMyXp.length;
      targetLabel = `Break the ${tiedAtMyXp.length + 1}-way tie for #1`;
    } else if (tiedAtMyXp.length > 0) {
      // Score +1 to immediately pass everyone tied at your XP, OR show passing the next tier ahead
      xpToJump = 1;
      jumpToRank = myRank;
      playersPassed = tiedAtMyXp.length;
      targetLabel = `Pass ${tiedAtMyXp.length} tied player${tiedAtMyXp.length > 1 ? "s" : ""} at ${myXp.toLocaleString()} XP`;
    } else if (nextGroupXp !== null) {
      xpToJump = Math.max(1, nextGroupXp - myXp + 1);
      // Passing nextGroupXp puts you ahead of everyone at nextGroupXp
      const stillStrictlyAhead = strictlyAhead.filter((e) => e.xp > nextGroupXp).length;
      jumpToRank = 1 + stillStrictlyAhead;
      playersPassed = myRank - jumpToRank;
      const leaderName = nextGroupPlayers[0]?.name || "rival";
      targetLabel =
        nextGroupPlayers.length > 1
          ? `Pass ${nextGroupPlayers.length} tied players (${leaderName} & others) → Jump to #${jumpToRank}`
          : `Beat ${leaderName} → Jump to #${jumpToRank}`;
    }

    // Also calculate a "One Good Quiz (+150 XP)" multi-rank jump preview
    let bigLeapMsg = "";
    if (!isSoleFirst) {
      const boostXp = myXp + 150;
      const rankAfterBoost = 1 + list.filter((e) => !e.isMe && e.xp > boostXp).length;
      const spotsGained = myRank - rankAfterBoost;
      if (spotsGained > Math.max(1, playersPassed)) {
        bigLeapMsg = `Score +150 XP in one quiz to leap ${spotsGained} ranks straight to #${rankAfterBoost}!`;
      } else if (xpToJump > 0) {
        const qNeeded = Math.max(1, Math.ceil(xpToJump / XP_PER_LEVEL[1]));
        bigLeapMsg = `Just ${qNeeded} right answer${qNeeded > 1 ? "s" : ""} on Medium jumps you to #${jumpToRank}`;
      }
    }

    // Runner behind (for #1 lead margin)
    const runnerBehind = list.find((e) => !e.isMe && e.xp <= myXp) || null;
    const leadMargin = isSoleFirst && runnerBehind ? Math.max(0, myXp - runnerBehind.xp) : 0;

    // Progress bar calculation
    let raceProgress = 100;
    if (isSoleFirst && runnerBehind) {
      raceProgress = Math.min(100, Math.max(16, (leadMargin / Math.max(100, myXp * 0.2)) * 100));
    } else if (nextGroupXp !== null) {
      const floorXp = runnerBehind ? runnerBehind.xp : 0;
      const span = Math.max(1, nextGroupXp + 1 - floorXp);
      raceProgress = Math.min(96, Math.max(8, ((myXp - floorXp) / span) * 100));
    } else if (tiedAtMyXp.length > 0) {
      raceProgress = 85;
    }

    // Build 3-player neighborhood slice
    const startIdx = Math.max(0, Math.min(list.length - 3, (myIdx >= 0 ? myIdx : 0) - 1));
    const nearby = list.slice(startIdx, startIdx + 3).map((entry, offset) => ({
      ...entry,
      rank: startIdx + offset + 1,
    }));

    return {
      myRank,
      totalPlayers,
      isSoleFirst,
      isTiedForFirst,
      tiedCount: tiedAtMyXp.length,
      xpToJump,
      jumpToRank,
      playersPassed,
      targetLabel,
      bigLeapMsg,
      runnerBehind,
      leadMargin,
      raceProgress,
      nearby,
      nextGroupXp,
    };
  }, [allTimeEntries, todayEntries, raceMode, profile.xp, myTodayXp]);

  const allRankNum = 1 + allTimeEntries.filter((e) => !e.isMe && e.xp > profile.xp).length;
  const tdRankNum = 1 + todayEntries.filter((e) => !e.isMe && e.xp > myTodayXp).length;

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="pt-4 pb-1 px-1">
        <h1 className="text-[36px] sm:text-[42px] leading-[1.1] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF] break-words">
          Hey, <span className="text-[#1457E0] dark:text-[#5AA2FF]">{profile.name}</span>{" "}
          <i className="animate-wave not-italic" aria-hidden="true">
            👋
          </i>
        </h1>
        <p className="text-[18px] text-[#5A6A92] dark:text-[#93A3CC] mt-1.5">
          Let&apos;s test your knowledge today
        </p>
      </div>

      {/* Thrilling Rank Race Card */}
      <section className="amay-card rounded-[30px] p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[22px] bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 border border-[#1846AA]/12 dark:border-white/10 text-xs sm:text-sm font-bold text-[#0B1B4D] dark:text-[#EAF0FF]">
            {raceData.isSoleFirst ? (
              <>
                <Crown className="w-4 h-4 text-[#D98A00] dark:text-[#FFC24D]" />
                <span>#1 Leader · Defend the Crown</span>
              </>
            ) : (
              <>
                <Swords className="w-4 h-4 text-[#1457E0] dark:text-[#5AA2FF]" />
                <span>
                  Rank #{raceData.myRank} → Jump to #{raceData.jumpToRank}
                </span>
              </>
            )}
          </div>

          <div className="inline-flex p-1 rounded-full bg-[#1457E0]/10 dark:bg-white/10 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setRaceMode("all")}
              className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
                raceMode === "all"
                  ? "bg-[#1457E0] text-white"
                  : "text-[#5A6A92] dark:text-[#93A3CC]"
              }`}
            >
              Overall
            </button>
            <button
              type="button"
              onClick={() => setRaceMode("td")}
              className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
                raceMode === "td"
                  ? "bg-[#1457E0] text-white"
                  : "text-[#5A6A92] dark:text-[#93A3CC]"
              }`}
            >
              Today
            </button>
          </div>
        </div>

        {/* Hero Big Number */}
        {raceData.isSoleFirst ? (
          <div>
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <strong className="text-[56px] sm:text-[66px] leading-none font-extrabold tracking-tight text-[#0B1B4D] dark:text-white font-mono-nums">
                +{raceData.leadMargin.toLocaleString()}
              </strong>
              <span className="text-[20px] font-bold text-[#12A150] dark:text-[#3DD17F]">
                XP ahead of #2
              </span>
            </div>
            <p className="text-sm font-semibold text-[#5A6A92] dark:text-[#93A3CC] mt-1.5">
              {raceData.runnerBehind
                ? `${raceData.runnerBehind.name} (${raceData.runnerBehind.xp.toLocaleString()} XP) is chasing you — widen the gap!`
                : "You hold #1 outright! Keep playing to lock your lead."}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <strong className="text-[56px] sm:text-[66px] leading-none font-extrabold tracking-tight text-[#0B1B4D] dark:text-white font-mono-nums">
                +{raceData.xpToJump.toLocaleString()}
              </strong>
              <span className="text-[20px] font-bold text-[#0B1B4D] dark:text-[#EAF0FF]">
                XP to hit <span className="text-[#1457E0] dark:text-[#5AA2FF]">#{raceData.jumpToRank}</span>
              </span>
            </div>
            <p className="text-sm font-semibold text-[#5A6A92] dark:text-[#93A3CC]">
              {raceData.targetLabel}
            </p>
          </div>
        )}

        {/* Race Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-3 rounded-lg bg-[#1457E0]/10 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-lg bg-gradient-to-r from-[#38B0FF] to-[#0B57DD] transition-all duration-500"
              style={{ width: `${raceData.raceProgress}%` }}
            />
          </div>
          {raceData.bigLeapMsg && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF]">
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span>{raceData.bigLeapMsg}</span>
            </div>
          )}
        </div>

        {/* Live 3-Player Neighborhood Strip */}
        <div className="rounded-2xl bg-[#1457E0]/[0.05] dark:bg-white/[0.04] border border-[#1846AA]/10 dark:border-white/10 divide-y divide-[#1846AA]/10 dark:divide-white/10">
          {raceData.nearby.map((row) => (
            <div
              key={`${row.rank}-${row.name}`}
              className={`px-3.5 py-2 flex items-center justify-between text-sm ${
                row.isMe
                  ? "bg-[#1457E0]/12 dark:bg-[#5AA2FF]/20 font-extrabold text-[#0B1B4D] dark:text-white"
                  : "font-semibold text-[#5A6A92] dark:text-[#93A3CC]"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono-nums w-8 text-xs">#{row.rank}</span>
                <span className="truncate">
                  {row.name}
                  {row.isMe ? " (You)" : ""}
                </span>
              </div>
              <span className="font-mono-nums font-bold text-[#1457E0] dark:text-[#5AA2FF] shrink-0">
                {row.xp.toLocaleString()} XP
              </span>
            </div>
          ))}
        </div>

        {/* Overall & Today Ranks */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onOpenRank}
            className="amay-card rounded-[22px] py-2.5 px-3 flex items-center justify-center gap-1.5 text-[15px] cursor-pointer"
          >
            <span>🏆 Rank</span>
            <strong className="text-[18px] text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
              #{allRankNum}
            </strong>
            <small className="text-[#5A6A92] dark:text-[#93A3CC] text-[13px]">
              of {allTimeEntries.length}
            </small>
          </button>

          <button
            type="button"
            onClick={onOpenRank}
            className="amay-card rounded-[22px] py-2.5 px-3 flex items-center justify-center gap-1.5 text-[15px] cursor-pointer"
          >
            <span>⚡ Today</span>
            <strong className="text-[18px] text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
              #{tdRankNum}
            </strong>
            <small className="text-[#5A6A92] dark:text-[#93A3CC] text-[13px]">
              of {todayEntries.length}
            </small>
          </button>
        </div>

        <hr className="border-t border-[#1846AA]/12 dark:border-white/10" />

        <div className="flex items-start gap-3">
          <Flame className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[15px] text-[#5A6A92] dark:text-[#93A3CC] leading-snug">
            1/4 negative marking is active — skip questions you&apos;re unsure about to protect your rank!
            {profile.streak > 0 ? ` · ${profile.streak}-day streak` : ""}
          </p>
        </div>

        {/* Glowing Play Now CTA */}
        <button
          type="button"
          onClick={onStartNormalQuiz}
          className="w-full h-16 rounded-[34px] amay-play-btn text-white font-bold text-[21px] flex items-center justify-center gap-3 relative cursor-pointer active:scale-[0.98] transition-transform"
        >
          <Play className="w-6 h-6 fill-current" />
          <span>Play now</span>
          <ChevronRight className="w-6 h-6 absolute right-5" />
        </button>

        {profile.xp >= 500 && (
          <button
            type="button"
            onClick={onOpenBadge}
            className="w-full py-3.5 rounded-[22px] amay-card text-[#1457E0] dark:text-[#5AA2FF] font-bold text-base text-center cursor-pointer"
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
        href={SOCIAL_LINKS.youtubeShort}
        target="_blank"
        rel="noopener noreferrer"
        className="amay-card rounded-[30px] p-4 flex items-center gap-4 hover:-translate-y-0.5 transition-transform"
      >
        <div className="w-16 h-16 rounded-[18px] bg-gradient-to-br from-[#2B9BF6] to-[#0B57DD] flex items-center justify-center text-white shrink-0">
          <span className="text-xl ml-0.5">▶</span>
        </div>
        <div className="min-w-0">
          <strong className="block text-[17px] font-bold text-[#0B1B4D] dark:text-[#EAF0FF]">
            Latest video
          </strong>
          <span className="text-sm text-[#5A6A92] dark:text-[#93A3CC]">
            Watch my latest Short · opens on YouTube
          </span>
        </div>
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
