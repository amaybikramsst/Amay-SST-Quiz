import React, { useRef, useState } from "react";

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
  const [period, setPeriod] = useState<"all" | "td">("all");
  const myRowRef = useRef<HTMLDivElement | null>(null);

  const list = period === "all" ? allTimeEntries : todayEntries;
  const myRank = list.findIndex((e) => e.isMe) + 1;

  const jumpToMe = (e: React.MouseEvent) => {
    e.preventDefault();
    myRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF] px-1">
        Leaderboard
      </h1>

      {/* All time / Today segmented pill */}
      <div className="amay-card rounded-[30px] p-1.5 flex gap-1">
        <button
          type="button"
          onClick={() => setPeriod("all")}
          className={`flex-1 py-2.5 rounded-[24px] text-sm font-bold transition-all cursor-pointer ${
            period === "all"
              ? "bg-gradient-to-r from-[#2B9BF6] to-[#0B57DD] text-white shadow-[0_8px_16px_-10px_rgba(11,87,221,0.8)]"
              : "text-[#5A6A92] dark:text-[#93A3CC]"
          }`}
        >
          All time
        </button>
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
      </div>

      <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC] px-1">
        You are #{myRank} of {list.length} ·{" "}
        <a
          href="#mine"
          onClick={jumpToMe}
          className="font-semibold text-[#1457E0] dark:text-[#5AA2FF] hover:underline"
        >
          Jump to me
        </a>
      </p>

      {/* Unified Leaderboard — zero visual difference between any players */}
      <div className="amay-card rounded-[30px] px-4 py-2 divide-y divide-[#1846AA]/10 dark:divide-white/10">
        {list.map((entry, idx) => {
          const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : String(idx + 1);
          return (
            <div
              key={`${entry.name}-${idx}-${entry.isMe ? "me" : "p"}`}
              ref={entry.isMe ? myRowRef : undefined}
              className={`py-3 px-2 -mx-2 rounded-2xl flex items-center justify-between gap-3 ${
                entry.isMe ? "bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 font-bold" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <strong className="w-8 text-center text-base font-extrabold text-[#0B1B4D] dark:text-white font-mono-nums shrink-0">
                  {medal}
                </strong>
                <span className="text-base text-[#0B1B4D] dark:text-[#EAF0FF] truncate">
                  {entry.name}
                </span>
              </div>
              <strong className="font-mono-nums text-base font-extrabold text-[#1457E0] dark:text-[#5AA2FF] shrink-0">
                {entry.xp} XP
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
};
