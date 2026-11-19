import React from "react";
import { Download } from "lucide-react";

export type AppRoute =
  | "gate"
  | "home"
  | "subs"
  | "sub"
  | "quiz"
  | "rank"
  | "me"
  | "admin"
  | "class10-hub"
  | "class10-map"
  | "class10-timeline"
  | "class10-ar";

interface HeaderProps {
  onNavigateHome: () => void;
  showInstallButton?: boolean;
  onInstallClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigateHome,
  showInstallButton = false,
  onInstallClick,
}) => {
  return (
    <header className="w-[calc(100%-28px)] max-w-[532px] mx-auto mt-3 px-3 py-2.5 rounded-[40px] amay-card flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onNavigateHome}
        className="flex items-center gap-2.5 sm:gap-3 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1457E0] rounded-full pr-1 min-w-0"
      >
        <div className="w-[48px] h-[48px] sm:w-[52px] sm:h-[52px] rounded-full overflow-hidden border-[3px] border-[#1457E0] dark:border-[#5AA2FF] shrink-0 bg-white">
          <img
            src="./amay-avatar.jpg"
            alt="AmaySST logo"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center scale-105 block"
          />
        </div>
        <span className="text-[18px] sm:text-[20px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF] whitespace-nowrap">
          AmaySST <span className="text-[#1457E0] dark:text-[#5AA2FF]">Quiz</span>
        </span>
      </button>

      {showInstallButton && onInstallClick && (
        <button
          type="button"
          onClick={onInstallClick}
          className="shrink-0 flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#2B7BFF] to-[#1457E0] px-3.5 sm:px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(20,87,224,0.28)] hover:brightness-105 active:scale-95 transition cursor-pointer whitespace-nowrap"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>Install App</span>
        </button>
      )}
    </header>
  );
};
