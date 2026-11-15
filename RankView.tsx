import React, { useRef, useState } from "react";
import { RankBadge } from "./RankBadge";

export interface RankEntry {
  name: string;
  xp: number;
  isMe: boolean;
}

interface RankViewProps {
  allTimeEntries: RankEntry[];
  todayEntries: RankEntry[];
}

export const RankView: React.FC<RankViewProps> = ({ allTimeEntries, todayEntries }) => {
  const [period, setPeriod] = useState<"td" | "all">("td");
  const myRowRef = useRef<HTMLDivElement | null>(null);

  const list = period === "td" ? todayEntries : allTimeEntries;
  const myEntry = list.find((e) => e.isMe);
  const myXp = myEntry ? myEntry.xp : 0;
  const myRank = 1 + list.filter((e) => !e.isMe && e.xp > myXp).length;

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

  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF] px-1">
        Leaderboard
      </h1>

      {/* Today (left, default) / Overall (right) segmented pill */}
      <div className="amay-card rounded-[30px] p-1.5 flex gap-1">
        <button
          type="button"
          onClick={() => setPeriod("td")}
          className={`flex-1 py-2.5 rounded-[24px] text-sm font-bold transition-all cursor-pointer ${
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
          className={`flex-1 py-2.5 rounded-[24px] text-sm font-bold transition-all cursor-pointer ${
            period === "all"
              ? "bg-gradient-to-r from-[#2B9BF6] to-[#0B57DD] text-white shadow-[0_8px_16px_-10px_rgba(11,87,221,0.8)]"
              : "text-[#5A6A92] dark:text-[#93A3CC]"
          }`}
        >
          Overall
        </button>
      </div>

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
                    <strong
                      title={entry.name}
                      className="w-full text-[13px] sm:text-[14px] font-extrabold text-[#0B1B4D] dark:text-white leading-tight line-clamp-2 break-words"
                    >
                      {entry.name}
                      {isMe ? " (You)" : ""}
                    </strong>
                  </div>
                  <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-white/80 dark:bg-white/10 text-[11px] sm:text-xs font-extrabold text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
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
                  <span className="text-base text-[#0B1B4D] dark:text-[#EAF0FF] truncate">
                    {entry.name}
                    {entry.isMe ? " (You)" : ""}
                  </span>
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
        <div className="space-y-2">
          <div className="text-center text-xs font-bold tracking-widest text-[#5A6A92] dark:text-[#93A3CC]">
            • • •
          </div>
          <div
            ref={myRowRef}
            className="amay-card rounded-[26px] px-4 py-3.5 ring-2 ring-[#1457E0] dark:ring-[#5AA2FF] bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 flex items-center justify-between gap-3"
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
        </div>
      )}
    </div>
  );
};
