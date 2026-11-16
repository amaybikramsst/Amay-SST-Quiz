import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Clock, Zap } from "lucide-react";
import {
  computeRankSnapshot,
  getNextOverallMilestone,
  getTodayCutoffStatus,
  type RankListEntry,
} from "../lib/quizEngine";
import { RankBadge } from "./RankBadge";

export type RankEntry = RankListEntry;

function formatXpK(xp: number): string {
  const abs = Math.abs(xp);
  if (abs < 1000) return abs.toLocaleString();
  const k = Math.round((abs / 1000) * 10) / 10;
  return `${k.toString().replace(/\.0$/, "")}k`;
}

interface RankViewProps {
  allTimeEntries: RankEntry[];
  todayEntries: RankEntry[];
  onStartQuiz?: () => void;
  onChatWithPlayer?: (peer: { uuid: string; name: string }) => void;
}

export const RankView: React.FC<RankViewProps> = ({
  allTimeEntries,
  todayEntries,
  onStartQuiz,
  onChatWithPlayer,
}) => {
  const [period, setPeriod] = useState<"td" | "all">("td");
  const [cutoff, setCutoff] = useState(() => getTodayCutoffStatus());
  const [fillReady, setFillReady] = useState(false);
  const myRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCutoff(getTodayCutoffStatus());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const list = period === "td" ? todayEntries : allTimeEntries;
  const snapshot = useMemo(() => computeRankSnapshot(list), [list]);

  const { myRank, myXp, totalPlayers, climbPercent, nextAhead, podium } = snapshot;

  const [animRank, setAnimRank] = useState<number>(myRank);
  const [animXp, setAnimXp] = useState<number>(myXp);

  // Smoothly animate the bluish fill-up bar and rank/XP numbers on mount and Today <-> Overall toggle
  useEffect(() => {
    setFillReady(false);
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setFillReady(true);
      setAnimRank(myRank);
      setAnimXp(myXp);
      return;
    }

    const startRank = Math.max(myRank, totalPlayers);
    const duration = 700;
    let rafId = 0;
    let startTime = 0;

    setAnimRank(startRank);
    setAnimXp(0);

    const step = (ts: number) => {
      if (!startTime) {
        startTime = ts;
        setFillReady(true);
      }
      const elapsed = ts - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);

      setAnimRank(Math.round(startRank + (myRank - startRank) * eased));
      setAnimXp(Math.round(myXp * eased));

      if (t < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [period, myRank, myXp, totalPlayers]);

  const myEntry = list.find((e) => e.isMe);
  const top20 = list.slice(0, 20);
  const isMeInTop20 = top20.some((e) => e.isMe);

  const first = top20[0];
  const second = top20[1];
  const third = top20[2];
  const rest = top20.slice(3);

  const jumpToMe = (e: React.MouseEvent) => {
    e.preventDefault();
    myRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Left-to-right podium order: 1st (left, tallest), 2nd (center), 3rd (right)
  const podiumSlots: Array<{
    rank: 1 | 2 | 3;
    entry?: RankEntry;
    badgeSize: "lg" | "md" | "sm";
    cardPadding: string;
  }> = [
    { rank: 1, entry: first, badgeSize: "lg", cardPadding: "pt-3.5 pb-4" },
    { rank: 2, entry: second, badgeSize: "md", cardPadding: "pt-2.5 pb-3" },
    { rank: 3, entry: third, badgeSize: "sm", cardPadding: "pt-2 pb-2.5" },
  ];

  // Today fill-up bar: simple 1-to-1 XP ratio toward Top 3 cutoff (#3), or toward #1 if already in Top 3
  const inDailyPrizeZone = myXp > 0 && myRank <= 3;
  const dailyTargetXp = inDailyPrizeZone ? (podium.first?.xp ?? myXp) : (podium.third?.xp ?? 0);
  const dailyFillPct =
    myRank === 1 && myXp > 0
      ? 100
      : dailyTargetXp > 0
        ? Math.max(4, Math.min(100, Math.round((myXp / dailyTargetXp) * 100)))
        : 0;
  const dailyTrackScale = fillReady ? dailyFillPct / 100 : 0;

  // Overall fill-up bar: simple rank position between #Last and #1
  const overallClimbScale = fillReady ? Math.max(0.04, Math.min(1, climbPercent / 100)) : 0;
  const nextOverallMilestone = getNextOverallMilestone(myXp);

  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF] px-1">
        Leaderboard
      </h1>

      {/* Today (left, default) / Overall (right) segmented control */}
      <div className="amay-card rounded-[30px] p-1.5 flex gap-1 overflow-hidden">
        <button
          type="button"
          onClick={() => setPeriod("td")}
          className={`flex-1 py-2.5 rounded-[24px] text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            period === "td"
              ? "bg-gradient-to-r from-[#2B9BF6] to-[#0B57DD] text-white shadow-[0_8px_16px_-10px_rgba(11,87,221,0.8)]"
              : "text-[#5A6A92] dark:text-[#93A3CC]"
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setPeriod("all")}
          className={`flex-1 py-2.5 rounded-[24px] text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            period === "all"
              ? "bg-gradient-to-r from-[#2B9BF6] to-[#0B57DD] text-white shadow-[0_8px_16px_-10px_rgba(11,87,221,0.8)]"
              : "text-[#5A6A92] dark:text-[#93A3CC]"
          }`}
        >
          Overall
        </button>
      </div>

      {/* Simple Competition Card */}
      {period === "td" ? (
        <section className="amay-card rounded-[28px] p-4 sm:p-5 space-y-3.5 overflow-hidden">
          {/* Candidate Rank + 11:00 PM Countdown */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF] truncate">
                Daily Top 3 · 11:00 PM Cutoff
              </span>
              <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums whitespace-nowrap">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{cutoff.isLocked ? `Resets ${cutoff.resetLabel}` : cutoff.countdownLabel}</span>
              </span>
            </div>

            <div className="flex items-baseline gap-2 min-w-0 whitespace-nowrap">
              <strong className="text-[30px] sm:text-[32px] leading-none font-extrabold text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums shrink-0">
                #{animRank}
              </strong>
              <span className="text-xs sm:text-sm font-semibold text-[#5A6A92] dark:text-[#93A3CC] truncate">
                {cutoff.isLocked
                  ? `of ${totalPlayers} · Cutoff Reached`
                  : inDailyPrizeZone
                    ? `of ${totalPlayers} · Top 3 Zone`
                    : podium.third
                      ? `of ${totalPlayers} · +${formatXpK(snapshot.xpToTop3)} XP to Top 3`
                      : `of ${totalPlayers}`}
              </span>
            </div>
          </div>

          {/* Simple Bluish XP Fill-Up Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC]">
              <span className="whitespace-nowrap">
                Your XP:{" "}
                <strong className="font-mono-nums text-[#0B1B4D] dark:text-white">
                  {formatXpK(animXp)}
                </strong>
              </span>
              <span className="font-mono-nums font-bold text-[#1457E0] dark:text-[#5AA2FF] whitespace-nowrap">
                {inDailyPrizeZone
                  ? myRank === 1
                    ? "#1 Today Leader"
                    : `#1: ${formatXpK(dailyTargetXp)} XP`
                  : `#3 Top 3: ${formatXpK(dailyTargetXp)} XP`}
              </span>
            </div>

            <div className="relative h-3 rounded-full bg-[#1457E0]/12 dark:bg-white/10 overflow-hidden">
              <div
                className="amay-fill-bar relative h-full w-full rounded-full bg-gradient-to-r from-[#38B0FF] via-[#1B74F5] to-[#0B57DD] overflow-hidden"
                style={{ transform: `scaleX(${dailyTrackScale})` }}
              >
                <span className="amay-shimmer-beam" aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* Immediately Next Ahead Today (Top-to-Bottom: e.g. #9, #10, #11) */}
          {nextAhead.length > 0 && (
            <div className="pt-3 border-t border-[#1846AA]/10 dark:border-white/10 space-y-2">
              <h3 className="font-display text-[15px] sm:text-base font-bold tracking-[-0.015em] text-[#0B1B4D] dark:text-[#EAF0FF]">
                Next ahead of you{" "}
                <span className="text-[#1457E0] dark:text-[#5AA2FF]">today</span>
              </h3>
              <div className="divide-y divide-[#1846AA]/10 dark:divide-white/10">
                {[...nextAhead].reverse().map((r) => (
                  <div
                    key={`td-next-${r.rank}-${r.name}`}
                    className="py-1.5 flex items-center justify-between gap-2 text-xs sm:text-[13px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <strong className="font-mono-nums text-[#1457E0] dark:text-[#5AA2FF] w-8 shrink-0">
                        #{r.rank}
                      </strong>
                      {onChatWithPlayer && r.peerUuid ? (
                        <button
                          type="button"
                          onClick={() => onChatWithPlayer({ uuid: r.peerUuid!, name: r.name })}
                          className="font-semibold text-[#0B1B4D] dark:text-[#EAF0FF] truncate text-left cursor-pointer"
                        >
                          {r.name}
                        </button>
                      ) : (
                        <span className="font-semibold text-[#0B1B4D] dark:text-[#EAF0FF] truncate">
                          {r.name}
                        </span>
                      )}
                    </div>
                    <span className="font-mono-nums font-bold text-[#1457E0] dark:text-[#5AA2FF] shrink-0">
                      +{r.xpToPass.toLocaleString()} XP
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!cutoff.isLocked && onStartQuiz && myRank > 1 && (
            <button
              type="button"
              onClick={onStartQuiz}
              className="w-full h-11 rounded-[18px] amay-play-btn text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <Zap className="w-4 h-4" />
              <span>Play Quiz to Climb</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </section>
      ) : (
        /* Simple Overall Rank Fill-Up Bar & Next Ahead List */
        <section className="amay-card rounded-[28px] p-4 sm:p-5 space-y-3.5 overflow-hidden">
          {/* Standing Header */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF] truncate">
                Your Overall Rank
              </span>
              <span className="shrink-0 text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums whitespace-nowrap">
                {nextOverallMilestone !== null
                  ? `Next: ${formatXpK(nextOverallMilestone)} XP (${formatXpK(nextOverallMilestone - myXp)} left)`
                  : "Max Badge · 100k+ XP"}
              </span>
            </div>

            <div className="flex items-baseline gap-2 min-w-0 whitespace-nowrap">
              <strong className="text-[30px] sm:text-[32px] leading-none font-extrabold text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums shrink-0">
                #{animRank}
              </strong>
              <span className="text-xs sm:text-sm font-semibold text-[#5A6A92] dark:text-[#93A3CC] truncate">
                of {totalPlayers} ·{" "}
                <strong className="font-mono-nums text-[#0B1B4D] dark:text-white">
                  {formatXpK(animXp)} XP
                </strong>
              </span>
            </div>
          </div>

          {/* Simple Bluish Rank Position Fill-Up Bar (#Last -> #1) */}
          <div className="space-y-1.5">
            <div className="relative h-3 rounded-full bg-[#1457E0]/12 dark:bg-white/10 overflow-hidden">
              <div
                className="amay-fill-bar relative h-full w-full rounded-full bg-gradient-to-r from-[#38B0FF] via-[#1B74F5] to-[#0B57DD] overflow-hidden"
                style={{ transform: `scaleX(${overallClimbScale})` }}
              >
                <span className="amay-shimmer-beam" aria-hidden="true" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] font-mono-nums">
              <span>#{totalPlayers}</span>
              <span className="text-[#1457E0] dark:text-[#5AA2FF] font-bold">
                You: #{animRank}
              </span>
              <span className="text-[#0B1B4D] dark:text-white font-bold">#1</span>
            </div>
          </div>

          {/* Immediately Next Ahead Overall (Top-to-Bottom: e.g. #9, #10, #11) */}
          {nextAhead.length > 0 ? (
            <div className="pt-3 border-t border-[#1846AA]/10 dark:border-white/10 space-y-2">
              <h3 className="font-display text-[15px] sm:text-base font-bold tracking-[-0.015em] text-[#0B1B4D] dark:text-[#EAF0FF]">
                Next ahead of you{" "}
                <span className="text-[#1457E0] dark:text-[#5AA2FF]">overall</span>
              </h3>
              <div className="divide-y divide-[#1846AA]/10 dark:divide-white/10">
                {[...nextAhead].reverse().map((r) => (
                  <div
                    key={`all-next-${r.rank}-${r.name}`}
                    className="py-1.5 flex items-center justify-between gap-2 text-xs sm:text-[13px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <strong className="font-mono-nums text-[#1457E0] dark:text-[#5AA2FF] w-8 shrink-0">
                        #{r.rank}
                      </strong>
                      {onChatWithPlayer && r.peerUuid ? (
                        <button
                          type="button"
                          onClick={() => onChatWithPlayer({ uuid: r.peerUuid!, name: r.name })}
                          className="font-semibold text-[#0B1B4D] dark:text-[#EAF0FF] truncate text-left cursor-pointer"
                        >
                          {r.name}
                        </button>
                      ) : (
                        <span className="font-semibold text-[#0B1B4D] dark:text-[#EAF0FF] truncate">
                          {r.name}
                        </span>
                      )}
                    </div>
                    <span className="font-mono-nums font-bold text-[#1457E0] dark:text-[#5AA2FF] shrink-0">
                      +{r.xpToPass.toLocaleString()} XP
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF] pt-1">
              You hold #1 Overall across all players!
            </p>
          )}

          {onStartQuiz && nextAhead.length > 0 && (
            <button
              type="button"
              onClick={onStartQuiz}
              className="w-full h-11 rounded-[18px] amay-play-btn text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <Zap className="w-4 h-4" />
              <span>
                Play Quiz to Pass #{nextAhead[0].rank} {nextAhead[0].name}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </section>
      )}

      <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC] px-1">
        Showing Top 20 · You are <strong className="text-[#0B1B4D] dark:text-white">#{myRank}</strong> of {list.length} ·{" "}
        <a
          href="#mine"
          onClick={jumpToMe}
          className="font-semibold text-[#1457E0] dark:text-[#5AA2FF] hover:underline"
        >
          Jump to me
        </a>
      </p>

      {/* Top 3 Crown & Ribbon Podium */}
      {top20.length > 0 && (
        <section className="amay-card rounded-[30px] px-3 pt-4 pb-5">
          <div className="grid grid-cols-3 gap-2 items-end">
            {podiumSlots.map(({ rank, entry, badgeSize, cardPadding }) => {
              if (!entry) {
                return <div key={rank} />;
              }
              const isMe = entry.isMe;
              return (
                <div
                  key={`${period}-podium-${rank}`}
                  ref={isMe ? myRowRef : undefined}
                  className={`flex flex-col items-center text-center rounded-[22px] px-1.5 ${cardPadding} transition-all ${
                    isMe
                      ? "bg-[#1457E0]/12 dark:bg-[#5AA2FF]/20 ring-2 ring-[#1457E0] dark:ring-[#5AA2FF]"
                      : "bg-[#1457E0]/[0.04] dark:bg-white/[0.04]"
                  }`}
                >
                  <RankBadge rank={rank} size={badgeSize} />
                  <div className="mt-1.5 w-full h-[34px] flex items-center justify-center">
                    {!isMe && onChatWithPlayer && entry.peerUuid ? (
                      <button
                        type="button"
                        onClick={() => onChatWithPlayer({ uuid: entry.peerUuid!, name: entry.name })}
                        className="w-full text-[13px] sm:text-[14px] font-extrabold text-[#0B1B4D] dark:text-white leading-tight line-clamp-2 break-words cursor-pointer"
                      >
                        {entry.name}
                      </button>
                    ) : (
                      <strong
                        className="w-full text-[13px] sm:text-[14px] font-extrabold text-[#0B1B4D] dark:text-white leading-tight line-clamp-2 break-words"
                      >
                        {entry.name}
                        {isMe ? " (You)" : ""}
                      </strong>
                    )}
                  </div>
                  <span className="mt-1 text-[11px] sm:text-xs font-extrabold text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
                    {entry.xp.toLocaleString()} XP
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Ranks #4 to #20 */}
      {rest.length > 0 && (
        <div className="amay-card rounded-[30px] px-4 py-2 divide-y divide-[#1846AA]/10 dark:divide-white/10">
          {rest.map((entry, offset) => {
            const actualRank = offset + 4;
            return (
              <div
                key={`${entry.name}-${actualRank}-${entry.isMe ? "me" : "p"}`}
                ref={entry.isMe ? myRowRef : undefined}
                className={`py-3 px-2 -mx-2 rounded-2xl flex items-center justify-between gap-3 ${
                  entry.isMe ? "bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 font-bold" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <strong className="w-9 text-center text-sm font-extrabold text-[#5A6A92] dark:text-[#93A3CC] font-mono-nums shrink-0">
                    #{actualRank}
                  </strong>
                  {!entry.isMe && onChatWithPlayer && entry.peerUuid ? (
                    <button
                      type="button"
                      onClick={() => onChatWithPlayer({ uuid: entry.peerUuid!, name: entry.name })}
                      className="text-base font-semibold text-[#0B1B4D] dark:text-[#EAF0FF] truncate text-left cursor-pointer"
                    >
                      {entry.name}
                    </button>
                  ) : (
                    <span className="text-base text-[#0B1B4D] dark:text-[#EAF0FF] truncate">
                      {entry.name}
                      {entry.isMe ? " (You)" : ""}
                    </span>
                  )}
                </div>
                <strong className="font-mono-nums text-base font-extrabold text-[#1457E0] dark:text-[#5AA2FF] shrink-0">
                  {entry.xp.toLocaleString()} XP
                </strong>
              </div>
            );
          })}
        </div>
      )}

      {/* Pinned Your Rank card at bottom when candidate is below Top 20 */}
      {!isMeInTop20 && myEntry && (
        <div
          ref={myRowRef}
          className="amay-card rounded-[26px] px-4 py-3.5 ring-2 ring-[#1457E0] dark:ring-[#5AA2FF] bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 flex items-center justify-between gap-3 overflow-hidden"
        >
          <div className="flex items-center gap-3 min-w-0">
            <strong className="px-2.5 py-1 rounded-xl bg-[#1457E0] text-white text-sm font-extrabold font-mono-nums shrink-0">
              #{myRank}
            </strong>
            <div className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-[#1457E0] dark:text-[#5AA2FF]">
                Your Rank
              </span>
              <span className="block text-base font-extrabold text-[#0B1B4D] dark:text-white truncate">
                {myEntry.name} (You)
              </span>
            </div>
          </div>
          <strong className="font-mono-nums text-base font-extrabold text-[#1457E0] dark:text-[#5AA2FF] shrink-0">
            {myEntry.xp.toLocaleString()} XP
          </strong>
        </div>
      )}
    </div>
  );
};
