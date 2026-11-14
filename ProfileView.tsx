import React, { useState } from "react";
import { getBadges, getMilestones, type StudentProfile } from "../lib/quizEngine";

interface ProfileViewProps {
  profile: StudentProfile;
  isDark: boolean;
  onToggleTheme: () => void;
  onUpdateName: (name: string) => void;
  onOpenBadge: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  isDark,
  onToggleTheme,
  onUpdateName,
  onOpenBadge,
}) => {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const [error, setError] = useState("");

  const msLeft = Math.max(0, (profile.nameAt || 0) + 864e5 - Date.now());
  const formatWait = (ms: number) => {
    const mins = Math.ceil(ms / 6e4);
    const hrs = Math.floor(mins / 60);
    return hrs ? `${hrs}h ${mins % 60}m` : `${mins}m`;
  };

  const milestones = getMilestones(profile.xp);
  const nextMilestone = milestones.find((m) => m > profile.xp) ?? profile.xp + 100;
  const prevMilestone = [...milestones].reverse().find((m) => m <= profile.xp) ?? 0;
  const progressPct =
    nextMilestone > prevMilestone
      ? Math.min(100, Math.max(0, ((profile.xp - prevMilestone) / (nextMilestone - prevMilestone)) * 100))
      : 0;
  const badges = getBadges(profile);
  const initial = (profile.name || "?").trim().charAt(0).toUpperCase();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftName.trim();
    if (cleaned.length < 2) {
      setError("Enter at least 2 characters.");
      return;
    }
    if (msLeft > 0) {
      setEditing(false);
      return;
    }
    if (cleaned !== profile.name) {
      onUpdateName(cleaned);
    }
    setError("");
    setEditing(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF] px-1">
        Me
      </h1>

      {/* 3 Stat Tiles */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="amay-card rounded-[20px] p-3.5 text-center">
          <strong className="block text-[22px] font-extrabold text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
            {profile.xp}
          </strong>
          <span className="text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC]">XP</span>
        </div>
        <div className="amay-card rounded-[20px] p-3.5 text-center">
          <strong className="block text-[22px] font-extrabold text-[#0B1B4D] dark:text-white font-mono-nums">
            {profile.streak}🔥
          </strong>
          <span className="text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC]">day streak</span>
        </div>
        <div className="amay-card rounded-[20px] p-3.5 text-center">
          <strong className="block text-[22px] font-extrabold text-[#0B1B4D] dark:text-white font-mono-nums">
            {profile.quizzes}
          </strong>
          <span className="text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC]">quizzes</span>
        </div>
      </div>

      {/* Profile Card (Name only — zero State, zero Admin link) */}
      <div className="amay-card rounded-[30px] p-5 space-y-3">
        <div className="flex items-center gap-3.5">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#38B0FF] to-[#0B57DD] text-white text-[28px] font-extrabold grid place-items-center shrink-0 shadow-[0_10px_20px_-10px_rgba(11,87,221,0.8)]">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <strong className="block text-[22px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-white truncate">
              {profile.name}
            </strong>
            <small className="block text-sm text-[#5A6A92] dark:text-[#93A3CC]">
              {msLeft > 0
                ? `🔒 You can change your name again in ${formatWait(msLeft)}`
                : "You can change your name once every 24 hours"}
            </small>
          </div>
          {!editing && (
            <button
              type="button"
              disabled={msLeft > 0}
              onClick={() => {
                setDraftName(profile.name);
                setError("");
                setEditing(true);
              }}
              className="amay-card rounded-[16px] px-4 py-2.5 text-sm font-bold text-[#1457E0] dark:text-[#5AA2FF] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              Edit
            </button>
          )}
        </div>

        {editing && (
          <form onSubmit={handleSave} className="space-y-3 pt-2">
            <input
              type="text"
              maxLength={20}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className="w-full h-11 px-4 rounded-2xl bg-white/80 dark:bg-[#0B1224]/80 border border-[#1846AA]/15 dark:border-white/10 text-[#0B1B4D] dark:text-white text-base"
            />
            {error && <p className="text-sm text-[#D92D3A] dark:text-[#FF6B76]">{error}</p>}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="submit"
                className="h-11 rounded-[18px] amay-play-btn text-white font-bold text-sm cursor-pointer"
              >
                Save name
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-11 rounded-[18px] amay-card text-[#1457E0] dark:text-[#5AA2FF] font-bold text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
              After saving, you can&apos;t change it again for 24 hours.
            </p>
          </form>
        )}
      </div>

      {/* Theme Toggle */}
      <div className="amay-card rounded-[30px] p-4">
        <button
          type="button"
          onClick={onToggleTheme}
          className="w-full py-2.5 text-base font-bold text-[#1457E0] dark:text-[#5AA2FF] cursor-pointer text-center"
        >
          {isDark ? "Switch to light mode" : "Switch to dark mode"}
        </button>
      </div>

      {/* Badges */}
      <div className="amay-card rounded-[30px] p-5 space-y-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">Badges</h2>
          <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC]">
            Next badge at {nextMilestone} XP · {nextMilestone - profile.xp} XP to go
          </p>
        </div>

        <div className="h-2.5 rounded-full bg-[#1457E0]/10 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#38B0FF] to-[#0B57DD]"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {badges.map((b, i) => (
            <span
              key={`${b.label}-${i}`}
              className={`px-3 py-1.5 rounded-2xl text-sm font-semibold border border-[#1846AA]/12 dark:border-white/10 ${
                b.unlocked
                  ? "bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 text-[#0B1B4D] dark:text-white"
                  : "opacity-45 text-[#5A6A92] dark:text-[#93A3CC]"
              }`}
            >
              {b.icon} {b.label}
            </span>
          ))}
        </div>

        {profile.xp >= 500 ? (
          <button
            type="button"
            onClick={onOpenBadge}
            className="w-full h-12 rounded-[20px] amay-play-btn text-white font-bold text-sm cursor-pointer"
          >
            🏅 Share my badge
          </button>
        ) : (
          <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC]">
            Reach 500 XP to unlock a shareable badge.
          </p>
        )}
      </div>
    </div>
  );
};
