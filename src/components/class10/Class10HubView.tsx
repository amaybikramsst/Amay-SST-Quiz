import React from "react";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Compass,
  GraduationCap,
  Scale,
} from "lucide-react";

interface Class10HubViewProps {
  onBack: () => void;
  onOpenMap: () => void;
  onOpenTimeline: () => void;
  onOpenAssertionReason: () => void;
}

export const Class10HubView: React.FC<Class10HubViewProps> = ({
  onBack,
  onOpenMap,
  onOpenTimeline,
  onOpenAssertionReason,
}) => {
  return (
    <div className="w-full max-w-[532px] mx-auto px-3.5 py-4 space-y-4 pb-24">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full amay-card text-xs font-bold text-[#0B1B4D] dark:text-[#EAF0FF] hover:brightness-105 active:scale-95 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-extrabold">
          <GraduationCap className="w-3.5 h-3.5" />
          <span>CBSE Class 10 Board 2026</span>
        </div>
      </div>

      {/* Hero Welcome Card */}
      <div className="amay-card rounded-[28px] p-5 relative overflow-hidden space-y-3">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#2B7BFF] to-[#1457E0] text-white text-[11px] font-black uppercase tracking-wider shadow-sm">
            NEW
          </span>
          <span className="text-xs font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
            100% NCERT Syllabus Aligned
          </span>
        </div>

        <h1 className="text-[23px] sm:text-[25px] font-extrabold text-[#0B1B4D] dark:text-white leading-tight">
          Class 10 Board Special
        </h1>

        <p className="text-[13px] text-[#5A6A92] dark:text-[#93A3CC] leading-relaxed">
          High-yield interactive practice modules engineered specifically for Class 10 Social Science board exam mastery.
        </p>

        {/* 3 Metrics Badges */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="p-2 rounded-2xl bg-[#1457E0]/[0.06] dark:bg-white/[0.04] border border-[#1846AA]/10 dark:border-white/10">
            <strong className="block text-base font-extrabold text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
              25
            </strong>
            <span className="text-[10px] font-bold text-[#5A6A92] dark:text-[#93A3CC]">
              Board Map Pins
            </span>
          </div>

          <div className="p-2 rounded-2xl bg-[#1457E0]/[0.06] dark:bg-white/[0.04] border border-[#1846AA]/10 dark:border-white/10">
            <strong className="block text-base font-extrabold text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
              5
            </strong>
            <span className="text-[10px] font-bold text-[#5A6A92] dark:text-[#93A3CC]">
              Timeline Eras
            </span>
          </div>

          <div className="p-2 rounded-2xl bg-[#1457E0]/[0.06] dark:bg-white/[0.04] border border-[#1846AA]/10 dark:border-white/10">
            <strong className="block text-base font-extrabold text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
              16
            </strong>
            <span className="text-[10px] font-bold text-[#5A6A92] dark:text-[#93A3CC]">
              Logic Lab Qs
            </span>
          </div>
        </div>
      </div>

      {/* 3 Game Mode Action Cards */}
      <div className="space-y-3">
        {/* Game Mode 1: Interactive India Map-Work */}
        <div
          onClick={onOpenMap}
          className="amay-card rounded-[26px] p-4.5 flex items-center gap-4 hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer border border-[#1846AA]/12 dark:border-white/10 group"
        >
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#0288D1] to-[#01579B] flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform">
            <Compass className="w-7 h-7" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
                Vector SVG Map
              </span>
            </div>
            <h2 className="text-[16px] font-extrabold text-[#0B1B4D] dark:text-white mt-0.5">
              Interactive India Map-Work
            </h2>
            <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] line-clamp-2 mt-0.5">
              Pinpoint Congress sessions, Satyagraha centers, major dams, ports & airports with instant feedback & zoom controls.
            </p>
          </div>

          <ChevronRight className="w-5 h-5 text-[#5A6A92] dark:text-[#93A3CC] group-hover:translate-x-0.5 transition-transform shrink-0" />
        </div>

        {/* Game Mode 2: History Timeline Sorter */}
        <div
          onClick={onOpenTimeline}
          className="amay-card rounded-[26px] p-4.5 flex items-center gap-4 hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer border border-[#1846AA]/12 dark:border-white/10 group"
        >
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#E65100] to-[#BF360C] flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform">
            <Clock className="w-7 h-7" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                Drag & Tap Reorder
              </span>
            </div>
            <h2 className="text-[16px] font-extrabold text-[#0B1B4D] dark:text-white mt-0.5">
              History Timeline Sorter
            </h2>
            <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] line-clamp-2 mt-0.5">
              Order shuffled NCERT historical events chronologically without seeing dates, then reveal full dates & scores.
            </p>
          </div>

          <ChevronRight className="w-5 h-5 text-[#5A6A92] dark:text-[#93A3CC] group-hover:translate-x-0.5 transition-transform shrink-0" />
        </div>

        {/* Game Mode 3: Assertion & Reason Logic Lab */}
        <div
          onClick={onOpenAssertionReason}
          className="amay-card rounded-[26px] p-4.5 flex items-center gap-4 hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer border border-[#1846AA]/12 dark:border-white/10 group"
        >
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#1457E0] to-[#0A3CAD] flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform">
            <Scale className="w-7 h-7" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                3-Step Toggles
              </span>
            </div>
            <h2 className="text-[16px] font-extrabold text-[#0B1B4D] dark:text-white mt-0.5">
              Assertion & Reason Logic Lab
            </h2>
            <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] line-clamp-2 mt-0.5">
              Break down CBSE board A&R questions step-by-step with interactive true/false switches and automatic option mapping.
            </p>
          </div>

          <ChevronRight className="w-5 h-5 text-[#5A6A92] dark:text-[#93A3CC] group-hover:translate-x-0.5 transition-transform shrink-0" />
        </div>
      </div>
    </div>
  );
};
