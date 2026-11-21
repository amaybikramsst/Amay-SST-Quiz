import React from "react";
import { BookOpen, Home, MessageCircle, Trophy, User } from "lucide-react";
import type { AppRoute } from "./Header";

interface BottomNavProps {
  activeView: AppRoute;
  onNavigate: (view: AppRoute) => void;
  unreadChatCount?: number;
}

const NAV_ITEMS: ReadonlyArray<{
  id: AppRoute;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "home", label: "Home", Icon: Home },
  { id: "subs", label: "Subjects", Icon: BookOpen },
  { id: "chat", label: "Chat", Icon: MessageCircle },
  { id: "rank", label: "Ranks", Icon: Trophy },
  { id: "me", label: "Me", Icon: User },
];

export const BottomNav: React.FC<BottomNavProps> = ({
  activeView,
  onNavigate,
  unreadChatCount = 0,
}) => {
  const normalizedActive: AppRoute = activeView === "sub" ? "subs" : activeView;

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-24px)] max-w-[440px]"
    >
      <div className="rounded-full p-1.5 bg-white/80 dark:bg-[#0B142C]/82 backdrop-blur-xl border border-[#1846AA]/15 dark:border-white/12 shadow-[0_18px_40px_-14px_rgba(11,27,77,0.38)] dark:shadow-[0_20px_44px_-12px_rgba(0,0,0,0.75)] flex items-center justify-between gap-1">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = normalizedActive === id;
          const showBadge = id === "chat" && unreadChatCount > 0;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex-1 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all duration-200 cursor-pointer active:scale-95 ${
                isActive
                  ? "bg-gradient-to-b from-[#2B7BFF] to-[#1457E0] text-white shadow-[0_8px_18px_-6px_rgba(20,87,224,0.85)]"
                  : "text-[#5A6A92] dark:text-[#93A3CC] hover:text-[#0B1B4D] dark:hover:text-white hover:bg-[#1457E0]/[0.06] dark:hover:bg-white/[0.06]"
              }`}
            >
              <div className="relative">
                <Icon className={`w-[18px] h-[18px] ${isActive ? "stroke-[2.4]" : "stroke-[2]"}`} />
                {showBadge && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center shadow-sm ${
                      isActive
                        ? "bg-white text-[#1457E0]"
                        : "bg-[#E5091E] text-white"
                    }`}
                  >
                    {unreadChatCount > 9 ? "9+" : unreadChatCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] leading-none tracking-tight ${
                  isActive ? "font-extrabold" : "font-semibold"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
