import React from "react";

export type AppRoute = "gate" | "home" | "subs" | "sub" | "quiz" | "rank" | "me" | "admin";

interface HeaderProps {
  onNavigateHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavigateHome }) => {
  return (
    <header className="w-[calc(100%-28px)] max-w-[532px] mx-auto mt-3 px-3 py-2.5 rounded-[40px] amay-card flex items-center gap-3">
      <button
        type="button"
        onClick={onNavigateHome}
        className="flex items-center gap-3 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1457E0] rounded-full pr-2"
      >
        <div className="w-[52px] h-[52px] rounded-full overflow-hidden border-[3px] border-[#1457E0] dark:border-[#5AA2FF] shrink-0 bg-white">
          <img
            src="./amay-avatar.jpg"
            alt="AmaySST logo"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center scale-105 block"
          />
        </div>
        <span className="text-[20px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF] whitespace-nowrap">
          AmaySST <span className="text-[#1457E0] dark:text-[#5AA2FF]">Quiz</span>
        </span>
      </button>
    </header>
  );
};
