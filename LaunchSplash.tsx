import React, { useEffect, useRef, useState } from "react";

interface LaunchSplashProps {
  onDone: () => void;
}

export const LaunchSplash: React.FC<LaunchSplashProps> = ({ onDone }) => {
  const [exiting, setExiting] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const earlyDismissTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const holdMs = reduced ? 420 : 1450;
    const exitMs = reduced ? 180 : 480;

    const fadeTimer = window.setTimeout(() => {
      setExiting(true);
    }, holdMs);

    const doneTimer = window.setTimeout(() => {
      onDone();
    }, holdMs + exitMs);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
      if (earlyDismissTimerRef.current !== null) {
        window.clearTimeout(earlyDismissTimerRef.current);
      }
    };
  }, [onDone]);

  const handleDismissEarly = () => {
    if (exiting) return;
    setExiting(true);
    earlyDismissTimerRef.current = window.setTimeout(onDone, 280);
  };

  return (
    <div
      role="status"
      aria-label="Opening AmaySST Quiz"
      onClick={handleDismissEarly}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center px-6 select-none cursor-pointer bg-[#EDF2FB] dark:bg-[#060A16] transition-[opacity,transform] duration-[480ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        exiting ? "opacity-0 scale-[1.03] pointer-events-none" : "opacity-100 scale-100"
      }`}
    >
      <div className="amay-bg-mesh" aria-hidden="true" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-xs w-full">
        {/* Smooth Layered Halo + Portrait Lockup */}
        <div className="relative flex items-center justify-center mb-6">
          <div
            aria-hidden="true"
            className="amay-splash-glow absolute w-40 h-40 rounded-full bg-[#2B9BF6]/20 dark:bg-[#38B0FF]/20 blur-2xl"
          />

          <div
            aria-hidden="true"
            className="amay-splash-ring absolute w-32 h-32 sm:w-36 sm:h-36 rounded-full border-2 border-[#2B9BF6]/55 dark:border-[#5AA2FF]/50"
          />

          <div
            aria-hidden="true"
            className="amay-splash-ring-delayed absolute w-32 h-32 sm:w-36 sm:h-36 rounded-full border border-[#38B0FF]/40 dark:border-[#5AA2FF]/35"
          />

          <div className="amay-splash-photo relative w-28 h-28 sm:w-32 sm:h-32 rounded-full p-[4px] bg-gradient-to-br from-[#4BC0FF] via-[#2B9BF6] to-[#1457E0] shadow-[0_22px_48px_-14px_rgba(20,87,224,0.65)]">
            <div className="w-full h-full rounded-full overflow-hidden bg-[#22262F] ring-2 ring-white/85 dark:ring-[#0B1224]">
              {!imgFailed ? (
                <img
                  src="./amay-avatar.jpg"
                  alt="AmaySST Quiz"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover object-center block"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2B9BF6] to-[#1457E0] text-white text-3xl font-extrabold">
                  A
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Animated Brand Text */}
        <h1 className="amay-splash-title font-display text-[32px] sm:text-[36px] font-extrabold tracking-tight leading-none text-[#0B1B4D] dark:text-[#EAF0FF]">
          AmaySST <span className="text-[#1457E0] dark:text-[#5AA2FF]">Quiz</span>
        </h1>

        <p className="amay-splash-subtitle mt-2.5 text-[13px] sm:text-sm font-semibold text-[#5A6A92] dark:text-[#93A3CC] tracking-wide">
          Practice · Compete · Climb the Ranks
        </p>

        {/* Smooth Progress Sweep */}
        <div className="mt-6 w-32 h-1.5 rounded-full bg-[#1457E0]/15 dark:bg-white/10 overflow-hidden">
          <div className="amay-splash-bar amay-xp-flow h-full w-full rounded-full" />
        </div>
      </div>
    </div>
  );
};
