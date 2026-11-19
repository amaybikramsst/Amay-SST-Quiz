import React, { useEffect, useMemo, useState } from "react";
import { Download, MessageCircle, Share2, X } from "lucide-react";
import { generateBadgePng, type BadgeDesignSpec } from "../lib/badgeCanvas";
import {
  getHighestOverallMilestone,
  getUnlockedOverallMilestones,
  type DailyBadgeRecord,
} from "../lib/quizEngine";

interface BadgeModalProps {
  xp: number;
  name: string;
  earnedDailyBadges?: DailyBadgeRecord[];
  initialSpec?: BadgeDesignSpec | null;
  onClose: () => void;
}

interface BadgeChoice {
  key: string;
  label: string;
  shareText: string;
  spec: BadgeDesignSpec;
}

function formatBadgeDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const BadgeModal: React.FC<BadgeModalProps> = ({
  xp,
  name,
  earnedDailyBadges = [],
  initialSpec = null,
  onClose,
}) => {
  const choices = useMemo<BadgeChoice[]>(() => {
    const overallUnlocked = getUnlockedOverallMilestones(xp);
    const overallChoices: BadgeChoice[] = overallUnlocked.map((milestone) => ({
      key: `overall-${milestone}`,
      label: `${milestone.toLocaleString()} XP`,
      shareText: `I reached ${milestone.toLocaleString()} Overall XP on AmaySST Quiz!`,
      spec: { kind: "overall", milestone },
    }));

    const sortedDaily = [...earnedDailyBadges].sort((a, b) => b.date.localeCompare(a.date));
    const dailyChoices: BadgeChoice[] = sortedDaily.map((d) => {
      const dateLabel = formatBadgeDate(d.date);
      return {
        key: `daily-${d.date}-${d.rank}`,
        label: `Today #${d.rank} · ${dateLabel}`,
        shareText: `I ranked #${d.rank} Today (11 PM Cutoff, ${d.xp.toLocaleString()} XP) on AmaySST Quiz!`,
        spec: {
          kind: "daily",
          rank: d.rank,
          dateLabel,
          xpToday: d.xp,
        },
      };
    });

    const combined = [...dailyChoices, ...overallChoices];
    if (combined.length === 0) {
      const fallbackMilestone = getHighestOverallMilestone(xp) ?? 100;
      return [
        {
          key: `overall-${fallbackMilestone}`,
          label: `${fallbackMilestone.toLocaleString()} XP`,
          shareText: `I reached ${fallbackMilestone.toLocaleString()} Overall XP on AmaySST Quiz!`,
          spec: { kind: "overall", milestone: fallbackMilestone },
        },
      ];
    }
    return combined;
  }, [earnedDailyBadges, xp]);

  const initialKey = useMemo(() => {
    if (initialSpec?.kind === "overall") {
      const match = choices.find(
        (c) => c.spec.kind === "overall" && c.spec.milestone === initialSpec.milestone
      );
      if (match) return match.key;
    }
    if (initialSpec?.kind === "daily") {
      const match = choices.find(
        (c) =>
          c.spec.kind === "daily" &&
          c.spec.rank === initialSpec.rank &&
          (!initialSpec.dateLabel ||
            c.spec.dateLabel === initialSpec.dateLabel ||
            c.key === `daily-${initialSpec.dateLabel}-${initialSpec.rank}`)
      );
      if (match) return match.key;
    }
    const highestOverall = getHighestOverallMilestone(xp);
    if (highestOverall) {
      const match = choices.find(
        (c) => c.spec.kind === "overall" && c.spec.milestone === highestOverall
      );
      if (match) return match.key;
    }
    return choices[0].key;
  }, [choices, initialSpec, xp]);

  const [selectedKey, setSelectedKey] = useState<string>(initialKey);

  useEffect(() => {
    setSelectedKey(initialKey);
  }, [initialKey]);

  const activeChoice = useMemo(
    () => choices.find((c) => c.key === selectedKey) ?? choices[0],
    [choices, selectedKey]
  );

  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string>("");
  const [status, setStatus] = useState("Creating your badge…");

  useEffect(() => {
    let active = true;
    let objUrl = "";
    setStatus("Creating your badge…");
    generateBadgePng(xp, name, activeChoice.spec)
      .then((b) => {
        if (!active || !b) {
          if (active) setStatus("Could not generate the badge. Please try again.");
          return;
        }
        objUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objUrl);
        setStatus("Your badge is ready to share or download.");
      })
      .catch(() => {
        if (active) setStatus("Could not generate the badge. Please try again.");
      });

    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [xp, name, activeChoice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleShare = async () => {
    if (!blob) return;
    const file = new File([blob], `amaysst-${activeChoice.key}.png`, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "AmaySST Quiz",
          text: activeChoice.shareText,
        });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    setStatus("Tap Save PNG below, then upload the image to Instagram Story or WhatsApp Status!");
  };

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `amaysst-${activeChoice.key}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleWhatsAppShare = async () => {
    if (!blob) return;
    const file = new File([blob], `amaysst-${activeChoice.key}.png`, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "AmaySST Quiz",
          text: activeChoice.shareText,
        });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    handleDownload();
    const shareUrl = `${window.location.origin}${window.location.pathname}`;
    const waText = encodeURIComponent(`${activeChoice.shareText}\nPlay on AmaySST Quiz: ${shareUrl}`);
    window.location.href = `https://wa.me/?text=${waText}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Share achievement badge"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#0D1528] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-[#0B1B4D] dark:text-white">
              Achievement Badge
            </h2>
            <p className="text-xs text-[#5A6A92] dark:text-slate-400 mt-0.5">{status}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#5A6A92] hover:text-[#0B1B4D] dark:hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {choices.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {choices.map((choice) => {
              const active = choice.key === activeChoice.key;
              return (
                <button
                  key={choice.key}
                  type="button"
                  onClick={() => setSelectedKey(choice.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    active
                      ? "bg-[#1457E0] border-[#1457E0] text-white"
                      : "border-slate-200 dark:border-slate-700 text-[#0B1B4D] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                  }`}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        )}

        {url && (
          <img
            src={url}
            alt={`AmaySST Quiz ${activeChoice.label} badge for ${name}`}
            className="w-full max-h-[54vh] object-contain rounded-2xl shadow-[0_18px_40px_-14px_rgba(6,10,22,0.55)]"
          />
        )}

        <div className="space-y-2">
          {url && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleShare}
                  className="h-11 px-4 rounded-xl bg-[#1457E0] hover:bg-[#0F46BA] text-white font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share (Insta / Apps)</span>
                </button>
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="h-11 px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-[#0B1B4D] dark:text-white font-bold text-xs inline-flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Save PNG for Instagram Story / Status</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
