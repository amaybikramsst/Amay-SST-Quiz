import React from "react";
import { Bell, Download } from "lucide-react";

export type AppRoute = "gate" | "home" | "subs" | "sub" | "quiz" | "chat" | "rank" | "me" | "admin";

interface HeaderProps {
  onNavigateHome: () => void;
  showInstallButton?: boolean;
  onInstallClick?: () => void;
  unreadNotifications?: number;
  onOpenNotifications?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigateHome,
  showInstallButton = false,
  onInstallClick,
  unreadNotifications = 0,
  onOpenNotifications,
}) => {
  return (
    <header className="w-[calc(100%-28px)] max-w-[532px] mx-auto mt-3 px-3 py-2.5 rounded-[40px] amay-card flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onNavigateHome}
        className="flex items-center gap-2 sm:gap-3 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1457E0] rounded-full pr-1 min-w-0"
      >
        <div className="w-[44px] h-[44px] sm:w-[52px] sm:h-[52px] rounded-full overflow-hidden border-[3px] border-[#1457E0] dark:border-[#5AA2FF] shrink-0 bg-white">
          <img
            src="./amay-avatar.jpg"
            alt="AmaySST logo"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center block"
          />
        </div>
        <span className="text-[17px] sm:text-[20px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF] whitespace-nowrap truncate">
          AmaySST <span className="text-[#1457E0] dark:text-[#5AA2FF]">Quiz</span>
        </span>
      </button>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {onOpenNotifications && (
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Open notifications"
            className="relative w-10 h-10 rounded-full amay-card flex items-center justify-center text-[#0B1B4D] dark:text-[#EAF0FF] hover:text-[#1457E0] dark:hover:text-[#5AA2FF] active:scale-95 transition cursor-pointer"
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E5091E] text-white text-[10px] font-extrabold flex items-center justify-center shadow">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </button>
        )}

        {showInstallButton && onInstallClick && (
          <button
            type="button"
            onClick={onInstallClick}
            className="shrink-0 flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#2B7BFF] to-[#1457E0] px-3 sm:px-4 py-2.5 text-[12px] sm:text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(20,87,224,0.28)] hover:brightness-105 active:scale-95 transition cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Install App</span>
          </button>
        )}
      </div>
    </header>
  );
};
