import React from "react";
import { Download, ExternalLink, Share, Smartphone, X, Zap, CheckCircle2 } from "lucide-react";

interface PWAInstallModalProps {
  canNativeInstall: boolean;
  isIOS: boolean;
  isInAppBrowser?: boolean;
  externalBrowserUrl?: string;
  onInstall: () => void;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  canNativeInstall,
  isIOS,
  isInAppBrowser = false,
  externalBrowserUrl = "",
  onInstall,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
    >
      <div className="w-full max-w-[420px] rounded-[28px] bg-white dark:bg-[#111936] border border-white/80 dark:border-white/10 shadow-[0_24px_60px_rgba(11,27,77,0.3)] p-6 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close install prompt"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3.5 pr-8">
          <img
            src="./icon-192.png?v=2"
            alt="AmaySST Quiz app icon"
            className="w-14 h-14 rounded-2xl shadow-md border border-[#1457E0]/15 shrink-0 object-cover"
          />
          <div>
            <h2
              id="pwa-install-title"
              className="text-[19px] font-extrabold text-[#0B1B4D] dark:text-[#EAF0FF] leading-tight"
            >
              Install AmaySST Quiz
            </h2>
            <p className="text-[13px] font-medium text-[#5A6B94] dark:text-[#9AAAD2] mt-0.5">
              Add to your home screen for 1-tap launch
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-[#EEF4FF] dark:bg-[#162247] p-3.5 space-y-2">
          <div className="flex items-center gap-2.5 text-[13px] font-semibold text-[#172B5E] dark:text-[#DCE6FF]">
            <Zap className="w-4 h-4 text-[#1457E0] dark:text-[#5AA2FF] shrink-0" />
            <span>Opens instantly like a native app — full screen</span>
          </div>
          <div className="flex items-center gap-2.5 text-[13px] font-semibold text-[#172B5E] dark:text-[#DCE6FF]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Keeps your XP, Rank Race & quizzes offline-ready</span>
          </div>
        </div>

        {isInAppBrowser && externalBrowserUrl ? (
          <div className="mt-5 space-y-3">
            <a
              href={externalBrowserUrl}
              className="w-full py-3.5 px-5 rounded-full bg-gradient-to-b from-[#2B7BFF] to-[#1457E0] text-white font-bold text-[15px] shadow-[0_10px_24px_rgba(20,87,224,0.32)] flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Chrome / Default Browser
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-full text-[13px] font-bold text-[#5A6B94] dark:text-[#9AAAD2] hover:bg-slate-100 dark:hover:bg-slate-800/60 transition cursor-pointer"
            >
              Continue here
            </button>
          </div>
        ) : canNativeInstall ? (
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onInstall}
              className="w-full py-3.5 px-5 rounded-full bg-gradient-to-b from-[#2B7BFF] to-[#1457E0] text-white font-bold text-[15px] shadow-[0_10px_24px_rgba(20,87,224,0.32)] flex items-center justify-center gap-2 active:scale-[0.98] transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Install App Now
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-full text-[13px] font-bold text-[#5A6B94] dark:text-[#9AAAD2] hover:bg-slate-100 dark:hover:bg-slate-800/60 transition cursor-pointer"
            >
              Maybe later
            </button>
          </div>
        ) : isIOS ? (
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-[#1457E0]/15 bg-slate-50 dark:bg-slate-900/60 p-3.5 text-[13px] text-[#0B1B4D] dark:text-[#DCE6FF] space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-[#1457E0] dark:text-[#5AA2FF]">
                <Smartphone className="w-4 h-4" />
                How to install on iPhone / iPad:
              </div>
              <p className="leading-relaxed">
                1. Tap the{" "}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold">
                  <Share className="w-3.5 h-3.5 text-[#1457E0]" /> Share
                </span>{" "}
                button in Safari&apos;s toolbar.
              </p>
              <p className="leading-relaxed">
                2. Scroll down and tap <strong>Add to Home Screen</strong> → <strong>Add</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-full bg-[#1457E0] text-white font-bold text-[14px] cursor-pointer active:scale-[0.98] transition"
            >
              Got it
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-[#1457E0]/15 bg-slate-50 dark:bg-slate-900/60 p-3.5 text-[13px] text-[#0B1B4D] dark:text-[#DCE6FF] space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-[#1457E0] dark:text-[#5AA2FF]">
                <Smartphone className="w-4 h-4" />
                Quick Add to Home Screen:
              </div>
              <p className="leading-relaxed">
                1. Open your browser menu (<strong>⋮</strong> or <strong>⋯</strong>) in the top corner.
              </p>
              <p className="leading-relaxed">
                2. Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-full bg-[#1457E0] text-white font-bold text-[14px] cursor-pointer active:scale-[0.98] transition"
            >
              Got it
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
