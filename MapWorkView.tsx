import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Flame,
  HelpCircle,
  Info,
  RotateCcw,
  Sparkles,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  CLASS_10_MAP_ITEMS,
  type MapCategory,
  type MapItem,
} from "../../data/class10/mapData";
import { IndiaMapSvg } from "./IndiaMapSvg";
import { playCorrectSound, playIncorrectSound } from "../../lib/soundEffects";

interface MapWorkViewProps {
  onBack: () => void;
  onAwardXp: (amount: number, reason: string) => void;
}

export const MapWorkView: React.FC<MapWorkViewProps> = ({ onBack, onAwardXp }) => {
  const [activeCategory, setActiveCategory] = useState<MapCategory>("all");
  const [playMode, setPlayMode] = useState<"challenge" | "explore">("challenge");

  // Zoom & Pan state
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);

  // Challenge game state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffledQueue, setShuffledQueue] = useState<MapItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);
  const [highlightedCorrectId, setHighlightedCorrectId] = useState<string | null>(null);
  const [wrongTappedId, setWrongTappedId] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<"idle" | "correct" | "wrong">("idle");
  const [sessionXp, setSessionXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showHint, setShowHint] = useState(false);

  // Filter items by category
  const filteredItems = useMemo(() => {
    if (activeCategory === "all") return CLASS_10_MAP_ITEMS;
    if (activeCategory === "history-congress" || activeCategory === "history-satyagraha") {
      return CLASS_10_MAP_ITEMS.filter((i) => i.category.startsWith("history"));
    }
    return CLASS_10_MAP_ITEMS.filter((i) => i.category === activeCategory);
  }, [activeCategory]);

  // Shuffle queue for challenge mode
  const initChallenge = useCallback((items: MapItem[]) => {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    setShuffledQueue(shuffled);
    setCurrentIndex(0);
    setFeedbackState("idle");
    setSelectedItem(null);
    setHighlightedCorrectId(null);
    setWrongTappedId(null);
    setShowHint(false);
  }, []);

  useEffect(() => {
    initChallenge(filteredItems);
  }, [filteredItems, initChallenge]);

  const targetItem = shuffledQueue[currentIndex] || null;

  // Zoom controls
  const handleZoomIn = () => setScale((s) => Math.min(2.4, Number((s + 0.25).toFixed(2))));
  const handleZoomOut = () => setScale((s) => Math.max(0.85, Number((s - 0.25).toFixed(2))));
  const handleResetZoom = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  // Pin tap handling
  const handlePinClick = (item: MapItem) => {
    setSelectedItem(item);

    if (playMode === "explore") {
      // Just inspect the item
      return;
    }

    if (!targetItem || feedbackState !== "idle") return;

    if (item.id === targetItem.id) {
      // Correct!
      playCorrectSound();
      setFeedbackState("correct");
      setHighlightedCorrectId(targetItem.id);
      setWrongTappedId(null);
      setStreak((s) => s + 1);
      setSessionXp((x) => x + 10);
      onAwardXp(10, `Class 10 Map: Located ${targetItem.name}`);
    } else {
      // Wrong!
      playIncorrectSound();
      setFeedbackState("wrong");
      setWrongTappedId(item.id);
      setHighlightedCorrectId(targetItem.id); // Highlight correct answer so student learns
      setStreak(0);
    }
  };

  const handleNextChallenge = () => {
    if (currentIndex + 1 >= shuffledQueue.length) {
      // Re-shuffle for continuous practice
      initChallenge(filteredItems);
    } else {
      setCurrentIndex((i) => i + 1);
      setFeedbackState("idle");
      setSelectedItem(null);
      setHighlightedCorrectId(null);
      setWrongTappedId(null);
      setShowHint(false);
    }
  };

  return (
    <div className="w-full max-w-[532px] mx-auto px-3.5 py-4 space-y-3.5 pb-24">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full amay-card text-xs font-bold text-[#0B1B4D] dark:text-[#EAF0FF] hover:brightness-105 active:scale-95 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        {/* Live Session Counters */}
        <div className="flex items-center gap-2">
          {streak > 1 && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-extrabold text-amber-600 dark:text-amber-400">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{streak} Streak</span>
            </div>
          )}

          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 border border-[#1457E0]/20 text-xs font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>+{sessionXp} XP</span>
          </div>
        </div>
      </div>

      {/* Main Title Card */}
      <div className="amay-card rounded-[26px] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-extrabold tracking-wide uppercase">
            <span>CBSE Class 10 Map-Work</span>
          </div>

          {/* Mode Switcher */}
          <div className="inline-flex p-0.5 rounded-full bg-[#1457E0]/10 dark:bg-white/10 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setPlayMode("challenge");
                initChallenge(filteredItems);
              }}
              className={`px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                playMode === "challenge"
                  ? "bg-[#1457E0] text-white"
                  : "text-[#5A6A92] dark:text-[#93A3CC]"
              }`}
            >
              Challenge
            </button>
            <button
              type="button"
              onClick={() => setPlayMode("explore")}
              className={`px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                playMode === "explore"
                  ? "bg-[#1457E0] text-white"
                  : "text-[#5A6A92] dark:text-[#93A3CC]"
              }`}
            >
              Explore Map
            </button>
          </div>
        </div>

        <h1 className="text-[20px] font-extrabold text-[#0B1B4D] dark:text-white leading-tight">
          Interactive India Map-Work
        </h1>
        <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
          Practice all official CBSE Board items: INC Sessions, Satyagraha centers, major dams, ports & airports.
        </p>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
              activeCategory === "all"
                ? "bg-[#1457E0] text-white"
                : "bg-white/60 dark:bg-white/5 text-[#5A6A92] dark:text-[#93A3CC] border border-[#1846AA]/10 dark:border-white/10"
            }`}
          >
            All Items ({CLASS_10_MAP_ITEMS.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("history-satyagraha")}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
              activeCategory === "history-satyagraha"
                ? "bg-[#E65100] text-white"
                : "bg-white/60 dark:bg-white/5 text-[#5A6A92] dark:text-[#93A3CC] border border-[#1846AA]/10 dark:border-white/10"
            }`}
          >
            History (Satyagraha & INC)
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("geography-dams")}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
              activeCategory === "geography-dams"
                ? "bg-[#0288D1] text-white"
                : "bg-white/60 dark:bg-white/5 text-[#5A6A92] dark:text-[#93A3CC] border border-[#1846AA]/10 dark:border-white/10"
            }`}
          >
            Geography (Dams)
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("geography-ports")}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
              activeCategory === "geography-ports"
                ? "bg-[#2E7D32] text-white"
                : "bg-white/60 dark:bg-white/5 text-[#5A6A92] dark:text-[#93A3CC] border border-[#1846AA]/10 dark:border-white/10"
            }`}
          >
            Sea Ports
          </button>
        </div>
      </div>

      {/* Challenge Active Mission Banner (When in Challenge mode) */}
      {playMode === "challenge" && targetItem && (
        <div
          className={`amay-card rounded-[22px] p-3.5 transition-all duration-300 border-2 ${
            feedbackState === "correct"
              ? "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15"
              : feedbackState === "wrong"
              ? "border-red-500 bg-red-500/10 dark:bg-red-500/15"
              : "border-sky-500/30"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC]">
                <span>Question {currentIndex + 1} of {shuffledQueue.length}</span>
                <span>·</span>
                <span className="text-[#1457E0] dark:text-[#5AA2FF]">{targetItem.categoryLabel}</span>
              </div>
              <h2 className="text-[17px] font-extrabold text-[#0B1B4D] dark:text-white mt-0.5">
                {feedbackState === "idle" ? "Tap on the map to locate:" : "Target Location:"}{" "}
                <span className="text-[#1457E0] dark:text-[#5AA2FF]">{targetItem.name}</span>
              </h2>
            </div>

            {feedbackState === "idle" && (
              <button
                type="button"
                onClick={() => setShowHint((h) => !h)}
                className="shrink-0 p-1.5 rounded-full bg-[#1457E0]/10 dark:bg-white/10 text-[#1457E0] dark:text-[#5AA2FF] hover:bg-[#1457E0]/20 transition cursor-pointer"
                title="Toggle CBSE Hint"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Hint Disclosure */}
          {showHint && feedbackState === "idle" && (
            <div className="mt-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>Hint: {targetItem.boardHint} ({targetItem.state})</span>
            </div>
          )}

          {/* Correct / Wrong Result Feedback */}
          {feedbackState === "correct" && (
            <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>Superb! +10 XP awarded · {targetItem.state}</span>
              </div>
              <button
                type="button"
                onClick={handleNextChallenge}
                className="px-3 py-1 rounded-full bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 active:scale-95 transition cursor-pointer shrink-0"
              >
                Next Item →
              </button>
            </div>
          )}

          {feedbackState === "wrong" && (
            <div className="mt-2.5 pt-2 border-t border-red-500/20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-300 min-w-0">
                <XCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span className="truncate">
                  Correct location highlighted in green ({targetItem.state})
                </span>
              </div>
              <button
                type="button"
                onClick={handleNextChallenge}
                className="px-3 py-1 rounded-full bg-[#1457E0] text-white font-bold text-xs hover:brightness-110 active:scale-95 transition cursor-pointer shrink-0"
              >
                Next Item →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Map Interactive Canvas Container */}
      <div className="amay-card rounded-[28px] p-2 relative overflow-hidden flex flex-col items-center">
        {/* Floating Zoom & Reset Toolbar on the Map */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-white/90 dark:bg-[#0B1528]/90 backdrop-blur-md p-1 rounded-2xl shadow-lg border border-[#1846AA]/10 dark:border-white/10">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#0B1B4D] dark:text-[#EAF0FF] hover:bg-[#1457E0]/10 active:scale-95 transition cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#0B1B4D] dark:text-[#EAF0FF] hover:bg-[#1457E0]/10 active:scale-95 transition cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#0B1B4D] dark:text-[#EAF0FF] hover:bg-[#1457E0]/10 active:scale-95 transition cursor-pointer"
            title="Reset Map View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Map Legend Indicator */}
        <div className="absolute bottom-3 left-3 z-20 hidden sm:flex items-center gap-2 bg-white/85 dark:bg-[#0B1528]/85 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold border border-[#1846AA]/10 dark:border-white/10">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#E65100]" />
            <span className="text-[#5A6A92] dark:text-[#93A3CC]">History</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#0288D1]" />
            <span className="text-[#5A6A92] dark:text-[#93A3CC]">Dams</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#2E7D32]" />
            <span className="text-[#5A6A92] dark:text-[#93A3CC]">Ports</span>
          </div>
        </div>

        {/* The Vector SVG Map */}
        <div className="w-full h-[460px] sm:h-[520px] relative overflow-hidden flex items-center justify-center touch-pan-x touch-pan-y">
          <IndiaMapSvg
            items={filteredItems}
            selectedItem={selectedItem}
            targetItem={targetItem}
            highlightedCorrectId={highlightedCorrectId}
            wrongTappedId={wrongTappedId}
            onPinClick={handlePinClick}
            scale={scale}
            translateX={translateX}
            translateY={translateY}
          />
        </div>
      </div>

      {/* Selected Item Detail Card (Explore Mode or when reviewing) */}
      {selectedItem && (
        <div className="amay-card rounded-[24px] p-4 space-y-2 border-l-4 border-l-[#1457E0]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF]">
              {selectedItem.categoryLabel} · {selectedItem.state}
            </span>
            <span className="text-[11px] font-semibold text-[#5A6A92] dark:text-[#93A3CC]">
              {selectedItem.cbseChapter}
            </span>
          </div>
          <h3 className="text-base font-extrabold text-[#0B1B4D] dark:text-white">
            {selectedItem.label}
          </h3>
          <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] leading-relaxed">
            {selectedItem.description}
          </p>
          <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
            📌 CBSE Key Note: {selectedItem.boardHint}
          </div>
        </div>
      )}
    </div>
  );
};
