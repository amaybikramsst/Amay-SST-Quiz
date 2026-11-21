import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Clock, Crown, Zap } from "lucide-react";
import {
  computeRankSnapshot,
  formatCompactXp,
  getNextOverallMilestone,
  getTodayCutoffStatus,
  type RankListEntry,
} from "../lib/quizEngine";
import { RankBadge } from "./RankBadge";

export type RankEntry = RankListEntry;

const formatXpK = formatCompactXp;

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

  // Classic 3D Podium order: #2 Silver (left), #1 Gold (center, tallest), #3 Bronze (right)
  const podiumSlots: Array<{
    rank: 1 | 2 | 3;
    entry?: RankEntry;
    badgeSize: "lg" | "md" | "sm";
    surfaceClass: string;
    pedestalClass: string;
    xpPillClass: string;
  }> = [
    {
      rank: 2,
      entry: second,
      badgeSize: "md",
      surfaceClass:
        "pt-3 pb-0 bg-gradient-to-b from-slate-300/30 via-sky-200/15 to-slate-400/10 border border-slate-300/60 dark:border-slate-300/30 shadow-[0_12px_24px_-14px_rgba(148,163,184,0.65)]",
      pedestalClass:
        "h-8 bg-gradient-to-b from-slate-300/55 to-slate-400/35 dark:from-slate-400/25 dark:to-slate-600/20 text-slate-800 dark:text-slate-200 border-t border-slate-300/50",
      xpPillClass:
        "bg-slate-400/20 text-slate-800 dark:text-slate-200",
    },
    {
      rank: 1,
      entry: first,
      badgeSize: "lg",
      surfaceClass:
        "pt-3.5 pb-0 bg-gradient-to-b from-amber-400/32 via-yellow-300/18 to-amber-500/12 border-2 border-amber-400/70 dark:border-amber-300/50 shadow-[0_16px_32px_-12px_rgba(245,158,11,0.65)]",
      pedestalClass:
        "h-11 bg-gradient-to-b from-amber-400/65 to-amber-500/40 dark:from-amber-400/35 dark:to-amber-600/25 text-amber-950 dark:text-amber-200 border-t border-amber-300/60",
      xpPillClass:
        "bg-amber-400/25 text-amber-950 dark:text-amber-200",
    },
    {
      rank: 3,
      entry: third,
      badgeSize: "sm",
      surfaceClass:
        "pt-2.5 pb-0 bg-gradient-to-b from-orange-400/26 via-amber-300/14 to-orange-500/10 border border-orange-400/55 dark:border-orange-300/30 shadow-[0_12px_24px_-14px_rgba(234,88,12,0.55)]",
      pedestalClass:
        "h-6 bg-gradient-to-b from-orange-400/55 to-orange-500/35 dark:from-orange-400/25 dark:to-orange-600/20 text-orange-950 dark:text-orange-200 border-t border-orange-300/50",
      xpPillClass:
        "bg-orange-400/20 text-orange-950 dark:text-orange-200",
    },
  ];

  const inDailyPrizeZone = myXp > 0 && myRank <= 3;
  const dailyTargetXp = inDailyPrizeZone ? (podium.first?.xp ?? myXp) : (podium.third?.xp ?? 0);
  const dailyFillPct =
    myRank === 1 && myXp > 0
      ? 100
      : dailyTargetXp > 0
        ? Math.max(4, Math.min(100, Math.round((myXp / dailyTargetXp) * 100)))
        : 0;
  const dailyTrackScale = fillReady ? dailyFillPct / 100 : 0;

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

      {/* Competition Card */}
      {period === "td" ? (
        <section className="amay-card rounded-[28px] p-4 sm:p-5 space-y-3.5 overflow-hidden">
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
                          className="font-semibold text-[#0B1B4D] dark:text-[#EAF0FF] hover:text-[#1457E0] dark:hover:text-[#5AA2FF] hover:underline truncate text-left cursor-pointer"
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
        <section className="amay-card rounded-[28px] p-4 sm:p-5 space-y-3.5 overflow-hidden">
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
                          className="font-semibold text-[#0B1B4D] dark:text-[#EAF0FF] hover:text-[#1457E0] dark:hover:text-[#5AA2FF] hover:underline truncate text-left cursor-pointer"
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
                      +{formatXpK(r.xpToPass)} XP
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

      {/* 3D Gold, Silver & Bronze Top 3 Podium (#2 Left · #1 Gold Center · #3 Right) */}
      {top20.length > 0 && (
        <section className="amay-card rounded-[30px] px-3 pt-5 pb-4 overflow-hidden">
          <div className="grid grid-cols-3 gap-2 items-end">
            {podiumSlots.map(({ rank, entry, badgeSize, surfaceClass, pedestalClass, xpPillClass }) => {
              if (!entry) {
                return <div key={rank} />;
              }
              const isMe = entry.isMe;
              const canChat = !isMe && Boolean(onChatWithPlayer && entry.peerUuid);

              return (
                <div
                  key={`${period}-podium-${rank}`}
                  ref={isMe ? myRowRef : undefined}
                  className={`relative overflow-hidden flex flex-col items-center text-center rounded-[22px] transition-all ${surfaceClass} ${
                    isMe ? "ring-2 ring-[#1457E0] dark:ring-[#5AA2FF]" : ""
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-6 -right-6 w-16 h-16 rounded-full bg-white/30 dark:bg-white/10 blur-md"
                  />

                  {rank === 1 && (
                    <Crown className="w-4 h-4 text-amber-500 dark:text-amber-300 fill-amber-400/50 mb-1 drop-shadow-xs" />
                  )}

                  <RankBadge rank={rank} size={badgeSize} />

                  <div className="mt-1.5 px-1.5 w-full h-[36px] flex items-center justify-center">
                    {canChat ? (
                      <button
                        type="button"
                        onClick={() => onChatWithPlayer!({ uuid: entry.peerUuid!, name: entry.name })}
                        className="w-full text-[13px] sm:text-[14px] font-extrabold text-[#0B1B4D] dark:text-white hover:text-[#1457E0] dark:hover:text-[#5AA2FF] hover:underline leading-tight line-clamp-2 break-words cursor-pointer"
                      >
                        {entry.name}
                      </button>
                    ) : (
                      <strong className="w-full text-[13px] sm:text-[14px] font-extrabold text-[#0B1B4D] dark:text-white leading-tight line-clamp-2 break-words">
                        {entry.name}
                        {isMe ? " (You)" : ""}
                      </strong>
                    )}
                  </div>

                  <span
                    className={`mt-1 mb-2.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold font-mono-nums ${xpPillClass}`}
                  >
                    {period === "all" ? formatXpK(entry.xp) : entry.xp.toLocaleString()} XP
                  </span>

                  {/* 3D Podium Step Pedestal */}
                  <div
                    className={`w-full flex items-center justify-center font-mono-nums text-xs font-black tracking-tight ${pedestalClass}`}
                  >
                    #{rank}
                  </div>
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
                      className="text-base font-semibold text-[#0B1B4D] dark:text-[#EAF0FF] hover:text-[#1457E0] dark:hover:text-[#5AA2FF] hover:underline truncate text-left cursor-pointer"
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
                  {period === "all" ? formatXpK(entry.xp) : entry.xp.toLocaleString()} XP
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
            {period === "all" ? formatXpK(myEntry.xp) : myEntry.xp.toLocaleString()} XP
          </strong>
        </div>
      )}
    </div>
  );
};
