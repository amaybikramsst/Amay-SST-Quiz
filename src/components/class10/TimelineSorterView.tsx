import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Clock,
  Trophy,
  XCircle,
} from "lucide-react";
import {
  CLASS_10_TIMELINE_SETS,
  type TimelineEvent,
  type TimelineSet,
} from "../../data/class10/timelineData";
import {
  playCorrectSound,
  playIncorrectSound,
  playQuizCompleteSound,
} from "../../lib/soundEffects";
import { launchMilestoneConfetti } from "../../lib/confetti";

interface TimelineSorterViewProps {
  onBack: () => void;
  onAwardXp: (amount: number, reason: string) => void;
}

export const TimelineSorterView: React.FC<TimelineSorterViewProps> = ({
  onBack,
  onAwardXp,
}) => {
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [scoreResult, setScoreResult] = useState<{
    correctCount: number;
    total: number;
    earnedXp: number;
  } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const currentSet: TimelineSet = CLASS_10_TIMELINE_SETS[currentSetIndex];

  // Correct sorted order by date/yearNum ascending
  const correctOrder = [...currentSet.events].sort((a, b) => a.yearNum - b.yearNum);

  // Initialize and shuffle a new set
  const loadSet = useCallback((setIdx: number) => {
    const targetSet = CLASS_10_TIMELINE_SETS[setIdx];
    // Shuffle cards so they aren't already ordered
    let shuffled: TimelineEvent[] = [];
    let isSameOrder = true;
    let attempts = 0;

    while (isSameOrder && attempts < 10) {
      shuffled = [...targetSet.events].sort(() => Math.random() - 0.5);
      isSameOrder = shuffled.every(
        (ev, i) => ev.id === [...targetSet.events].sort((a, b) => a.yearNum - b.yearNum)[i].id
      );
      attempts++;
    }

    setEvents(shuffled);
    setIsChecked(false);
    setSelectedCardId(null);
    setScoreResult(null);
  }, []);

  useEffect(() => {
    loadSet(currentSetIndex);
  }, [currentSetIndex, loadSet]);

  // Tap-to-swap logic: Tap card A, then tap card B to swap
  const handleCardClick = (id: string, index: number) => {
    if (isChecked) return;

    if (!selectedCardId) {
      setSelectedCardId(id);
    } else if (selectedCardId === id) {
      // Deselect
      setSelectedCardId(null);
    } else {
      // Swap the two cards
      const sourceIndex = events.findIndex((e) => e.id === selectedCardId);
      if (sourceIndex !== -1) {
        const next = [...events];
        const temp = next[sourceIndex];
        next[sourceIndex] = next[index];
        next[index] = temp;
        setEvents(next);
      }
      setSelectedCardId(null);
    }
  };

  // Up/Down button quick shift
  const moveCard = (index: number, direction: "up" | "down") => {
    if (isChecked) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= events.length) return;

    const next = [...events];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setEvents(next);
  };

  // HTML5 Drag and Drop handlers
  const handleDragStart = (index: number) => {
    if (isChecked) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index || isChecked) return;

    const next = [...events];
    const item = next.splice(draggedIndex, 1)[0];
    next.splice(index, 0, item);
    setDraggedIndex(index);
    setEvents(next);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Check Order verification
  const handleCheckOrder = () => {
    if (isChecked) return;

    let correctCount = 0;
    events.forEach((ev, i) => {
      if (ev.id === correctOrder[i].id) {
        correctCount++;
      }
    });

    const isPerfect = correctCount === events.length;
    const earnedXp = correctCount * 10 + (isPerfect ? 20 : 0);

    setIsChecked(true);
    setScoreResult({
      correctCount,
      total: events.length,
      earnedXp,
    });

    if (isPerfect) {
      playQuizCompleteSound(correctCount, 0);
      launchMilestoneConfetti();
    } else if (correctCount > 0) {
      playCorrectSound();
    } else {
      playIncorrectSound();
    }

    if (earnedXp > 0) {
      onAwardXp(earnedXp, `Class 10 Timeline: ${currentSet.title}`);
    }
  };

  const handleNextSet = () => {
    const nextIdx = (currentSetIndex + 1) % CLASS_10_TIMELINE_SETS.length;
    setCurrentSetIndex(nextIdx);
  };

  return (
    <div className="w-full max-w-[532px] mx-auto px-3.5 py-4 space-y-3.5 pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full amay-card text-xs font-bold text-[#0B1B4D] dark:text-[#EAF0FF] hover:brightness-105 active:scale-95 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        {/* Set Selector Dropdown / Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 border border-[#1457E0]/20 text-xs font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            Set {currentSetIndex + 1} of {CLASS_10_TIMELINE_SETS.length}
          </span>
        </div>
      </div>

      {/* Main Title Card */}
      <div className="amay-card rounded-[26px] p-4 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[11px] font-extrabold tracking-wide uppercase">
          <span>CBSE Chronology Sorter</span>
        </div>

        <h1 className="text-[20px] font-extrabold text-[#0B1B4D] dark:text-white leading-tight">
          {currentSet.title}
        </h1>
        <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
          {currentSet.subtitle}
        </p>

        {/* Instructions banner */}
        <div className="p-2.5 rounded-2xl bg-[#1457E0]/[0.06] dark:bg-white/[0.04] border border-[#1846AA]/10 dark:border-white/10 flex items-center gap-2 text-xs font-semibold text-[#0B1B4D] dark:text-[#EAF0FF]">
          <ArrowUpDown className="w-4 h-4 text-[#1457E0] dark:text-[#5AA2FF] shrink-0" />
          <span>
            {isChecked
              ? "Dates revealed below! Compare your order with the official CBSE sequence."
              : "Reorder cards from Earliest (1st) to Latest (Last). Tap a card to swap, use arrows, or drag."}
          </span>
        </div>
      </div>

      {/* Reorderable Events List */}
      <div className="space-y-2.5">
        {events.map((event, index) => {
          const isSelected = selectedCardId === event.id;
          const isCorrectPosition = isChecked && event.id === correctOrder[index].id;
          const isWrongPosition = isChecked && !isCorrectPosition;

          return (
            <div
              key={event.id}
              draggable={!isChecked}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => handleCardClick(event.id, index)}
              className={`amay-card rounded-[22px] p-3.5 transition-all select-none cursor-pointer border-2 relative ${
                isSelected
                  ? "border-[#1457E0] bg-[#1457E0]/10 ring-2 ring-[#1457E0]/40 scale-[1.01]"
                  : isCorrectPosition
                  ? "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15"
                  : isWrongPosition
                  ? "border-red-500/80 bg-red-500/10 dark:bg-red-500/15"
                  : "border-transparent hover:border-[#1457E0]/30"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Position Marker */}
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono-nums text-xs font-extrabold shrink-0 shadow-xs ${
                    isCorrectPosition
                      ? "bg-emerald-500 text-white"
                      : isWrongPosition
                      ? "bg-red-500 text-white"
                      : isSelected
                      ? "bg-[#1457E0] text-white"
                      : "bg-[#1457E0]/15 dark:bg-white/10 text-[#0B1B4D] dark:text-white"
                  }`}
                >
                  {isChecked && isCorrectPosition ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isChecked && isWrongPosition ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Event Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#0B1B4D] dark:text-white leading-snug">
                      {event.title}
                    </h3>

                    {/* Date Badge (Hidden before check, revealed upon check) */}
                    {isChecked ? (
                      <span
                        className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 font-mono-nums ${
                          isCorrectPosition
                            ? "bg-emerald-600 text-white"
                            : "bg-red-600 text-white"
                        }`}
                      >
                        {event.dateDisplay}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-[#5A6A92] dark:text-[#93A3CC] shrink-0">
                        Date hidden
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] line-clamp-2">
                    {event.description}
                  </p>

                  {/* Revealed Significance & Correct placement note */}
                  {isChecked && (
                    <div className="pt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      💡 {event.significance}
                      {isWrongPosition && (
                        <span className="block text-red-600 dark:text-red-400 mt-0.5">
                          Actual position: #{correctOrder.findIndex((c) => c.id === event.id) + 1} ({event.dateDisplay})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Touch Reorder Up / Down Controls (Visible before Check) */}
                {!isChecked && (
                  <div
                    className="flex flex-col items-center gap-1 shrink-0 pl-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveCard(index, "up")}
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#1457E0]/10 dark:bg-white/10 text-[#0B1B4D] dark:text-white disabled:opacity-20 hover:bg-[#1457E0]/20 active:scale-95 transition cursor-pointer"
                      title="Move Earlier"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === events.length - 1}
                      onClick={() => moveCard(index, "down")}
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#1457E0]/10 dark:bg-white/10 text-[#0B1B4D] dark:text-white disabled:opacity-20 hover:bg-[#1457E0]/20 active:scale-95 transition cursor-pointer"
                      title="Move Later"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action / Result Bar */}
      {!isChecked ? (
        <button
          type="button"
          onClick={handleCheckOrder}
          className="w-full h-13 rounded-[26px] amay-play-btn text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-transform shadow-lg"
        >
          <Clock className="w-4 h-4" />
          <span>Check My Order</span>
        </button>
      ) : (
        <div className="amay-card rounded-[24px] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <div>
                <strong className="text-base font-extrabold text-[#0B1B4D] dark:text-white">
                  Score: {scoreResult?.correctCount} / {scoreResult?.total} Correct
                </strong>
                <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                  {scoreResult?.correctCount === scoreResult?.total
                    ? "Flawless Chronology! You mastered this era."
                    : "Great practice! Review the exact dates highlighted above."}
                </p>
              </div>
            </div>
            {scoreResult && scoreResult.earnedXp > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                +{scoreResult.earnedXp} XP
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => loadSet(currentSetIndex)}
              className="flex-1 py-2.5 rounded-full border border-[#1846AA]/15 dark:border-white/15 text-xs font-bold text-[#0B1B4D] dark:text-[#EAF0FF] hover:bg-[#1457E0]/5 transition cursor-pointer"
            >
              Retry This Era
            </button>
            <button
              type="button"
              onClick={handleNextSet}
              className="flex-1 py-2.5 rounded-full bg-[#1457E0] text-white text-xs font-bold hover:brightness-105 active:scale-95 transition cursor-pointer shadow-md"
            >
              Try Next Era →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
