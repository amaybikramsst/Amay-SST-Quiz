import React from "react";
import { Home, LayoutGrid, MessageCircle, BarChart3, User } from "lucide-react";
import type { AppRoute } from "./Header";

interface BottomNavProps {
  activeView: AppRoute;
  onNavigate: (view: AppRoute) => void;
  unreadChatCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeView,
  onNavigate,
  unreadChatCount = 0,
}) => {
  const navTab =
    activeView === "subs" || activeView === "sub"
      ? "subs"
      : activeView === "chat"
        ? "chat"
        : activeView === "rank"
          ? "rank"
          : activeView === "me"
            ? "me"
            : "home";

  const tabs: Array<{ id: AppRoute; label: string; Icon: React.FC<{ className?: string }> }> = [
    { id: "home", label: "Home", Icon: Home },
    { id: "subs", label: "Subjects", Icon: LayoutGrid },
    { id: "chat", label: "Chat", Icon: MessageCircle },
    { id: "rank", label: "Ranks", Icon: BarChart3 },
    { id: "me", label: "Me", Icon: User },
  ];

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-3.5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-24px)] max-w-[520px] p-1.5 sm:p-2 rounded-[40px] amay-nav-pill"
    >
      <div className="grid grid-cols-5 gap-1">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = navTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-[32px] text-[11px] sm:text-[12px] transition-all cursor-pointer min-h-[48px] ${
                isActive
                  ? "bg-gradient-to-br from-[#1F7BF3] to-[#0A4FD8] text-white font-extrabold shadow-[0_10px_20px_-10px_rgba(20,110,255,0.9)]"
                  : "text-[#D6E0FA]/75 hover:text-white font-semibold"
              }`}
            >
              <span className="relative inline-flex">
                <Icon className="w-[18px] h-[18px]" />
                {id === "chat" && unreadChatCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#E5091E] text-white text-[9px] font-extrabold flex items-center justify-center shadow">
                    {unreadChatCount > 9 ? "9+" : unreadChatCount}
                  </span>
                )}
              </span>
              <span className="whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
