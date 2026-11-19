import React, { useEffect, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { generateBadgePng } from "../lib/badgeCanvas";

interface BadgeModalProps {
  xp: number;
  name: string;
  onClose: () => void;
}

export const BadgeModal: React.FC<BadgeModalProps> = ({ xp, name, onClose }) => {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string>("");
  const [status, setStatus] = useState("Creating your badge…");

  useEffect(() => {
    let active = true;
    let objUrl = "";
    generateBadgePng(xp, name)
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

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      active = false;
      window.removeEventListener("keydown", onKey);
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [xp, name, onClose]);

  const handleShare = async () => {
    if (!blob) return;
    const file = new File([blob], "amaysst-quiz-badge.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "AmaySST Quiz",
          text: `I reached ${Math.floor(xp / 100) * 100} XP on AmaySST Quiz!`,
        });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    setStatus("Direct sharing isn't supported in this browser. Save the image and post it manually.");
  };

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "amaysst-quiz-badge.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
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
        className="w-full max-w-md bg-white dark:bg-[#111A32] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">Achievement Badge</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#5A6A92] hover:text-[#0B1B4D] dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#5A6A92] dark:text-slate-400">{status}</p>

        {url && (
          <img
            src={url}
            alt={`AmaySST Quiz badge for ${name}`}
            className="w-full max-h-[55vh] object-contain rounded-2xl border border-slate-200 dark:border-slate-700"
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {url && (
            <>
              <button
                type="button"
                onClick={handleShare}
                className="h-11 px-4 rounded-xl bg-[#1457E0] hover:bg-[#0F46BA] text-white font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-[#0B1B4D] dark:text-white font-bold text-sm inline-flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Save PNG</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
