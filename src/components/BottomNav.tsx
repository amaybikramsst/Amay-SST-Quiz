import React from "react";
import { Home, LayoutGrid, BarChart3, User } from "lucide-react";
import type { AppRoute } from "./Header";

interface BottomNavProps {
  activeView: AppRoute;
  onNavigate: (view: AppRoute) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeView, onNavigate }) => {
  const navTab =
    activeView === "subs" || activeView === "sub"
      ? "subs"
      : activeView === "rank"
        ? "rank"
        : activeView === "me"
          ? "me"
          : "home";

  const tabs: Array<{ id: AppRoute; label: string; Icon: React.FC<{ className?: string }> }> = [
    { id: "home", label: "Home", Icon: Home },
    { id: "subs", label: "Subjects", Icon: LayoutGrid },
    { id: "rank", label: "Ranks", Icon: BarChart3 },
    { id: "me", label: "Me", Icon: User },
  ];

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-3.5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-28px)] max-w-[500px] p-2 rounded-[40px] amay-nav-pill"
    >
      <div className="grid grid-cols-4 gap-1">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = navTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 rounded-[32px] text-[13px] transition-all cursor-pointer min-h-[48px] ${
                isActive
                  ? "bg-gradient-to-br from-[#1F7BF3] to-[#0A4FD8] text-white font-extrabold shadow-[0_10px_20px_-10px_rgba(20,110,255,0.9)]"
                  : "text-[#D6E0FA]/75 hover:text-white font-semibold"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
