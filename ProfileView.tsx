import React, { useEffect, useState } from "react";
import { Clock, Eye, EyeOff, Lock, LogOut } from "lucide-react";
import type { BadgeDesignSpec } from "../lib/badgeCanvas";
import {
  getBadges,
  getMilestones,
  getNextOverallMilestone,
  getTodayCutoffStatus,
  type DailyBadgeRecord,
  type StudentProfile,
} from "../lib/quizEngine";

interface ProfileViewProps {
  profile: StudentProfile;
  isDark: boolean;
  onToggleTheme: () => void;
  onUpdateName: (name: string) => void;
  onSetCredentials?: (username: string, password: string) => Promise<string | null>;
  onSignOut?: () => void;
  isImpersonating?: boolean;
  onOpenBadge: (spec?: BadgeDesignSpec) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  isDark,
  onToggleTheme,
  onUpdateName,
  onSetCredentials,
  onSignOut,
  isImpersonating = false,
  onOpenBadge,
}) => {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const [error, setError] = useState("");
  const [cutoff, setCutoff] = useState(() => getTodayCutoffStatus());

  // Legacy credential claim state (only shown if profile.username isn't set yet)
  const [claimUser, setClaimUser] = useState("");
  const [claimPass, setClaimPass] = useState("");
  const [showClaimPass, setShowClaimPass] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCutoff(getTodayCutoffStatus());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const msLeft = Math.max(0, (profile.nameAt || 0) + 864e5 - Date.now());
  const formatWait = (ms: number) => {
    const mins = Math.ceil(ms / 6e4);
    const hrs = Math.floor(mins / 60);
    return hrs ? `${hrs}h ${mins % 60}m` : `${mins}m`;
  };

  const milestones = getMilestones();
  const nextMilestone = getNextOverallMilestone(profile.xp);
  const prevMilestone = [...milestones].reverse().find((m) => m <= profile.xp) ?? 0;
  const progressPct =
    nextMilestone === null
      ? 100
      : nextMilestone > prevMilestone
        ? Math.min(100, Math.max(0, ((profile.xp - prevMilestone) / (nextMilestone - prevMilestone)) * 100))
        : 0;
  const badges = getBadges(profile);
  const dailyBadges: DailyBadgeRecord[] = profile.earnedDailyBadges ?? [];
  const hasAnyBadge = profile.xp >= 100 || dailyBadges.length > 0;
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

        {/* Private Username & Password (hidden with xxxxxx until user chooses Show) */}
        <div className="pt-3 border-t border-[#1846AA]/10 dark:border-white/10">
          {profile.username && profile.password ? (
            <div className="rounded-2xl bg-[#1457E0]/[0.05] dark:bg-white/[0.04] px-3.5 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A6A92] dark:text-[#93A3CC]">
                  Private Login Details
                </span>
                <button
                  type="button"
                  onClick={() => setShowClaimPass((s) => !s)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 text-[11px] font-bold text-[#1457E0] dark:text-[#5AA2FF] cursor-pointer"
                >
                  {showClaimPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showClaimPass ? "Hide" : "Show"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/70 dark:bg-[#0B1224]/70 px-3 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase text-[#5A6A92] dark:text-[#93A3CC]">
                      Username
                    </span>
                    <strong className="block text-sm font-extrabold font-mono-nums text-[#0B1B4D] dark:text-white truncate">
                      {showClaimPass ? `@${profile.username}` : "xxxxxx"}
                    </strong>
                  </div>
                  <Lock className="w-3.5 h-3.5 text-[#1457E0] dark:text-[#5AA2FF] shrink-0" />
                </div>

                <div className="rounded-xl bg-white/70 dark:bg-[#0B1224]/70 px-3 py-2 min-w-0">
                  <span className="block text-[10px] font-bold uppercase text-[#5A6A92] dark:text-[#93A3CC]">
                    Password
                  </span>
                  <strong className="block text-sm font-extrabold font-mono-nums text-[#0B1B4D] dark:text-white truncate">
                    {showClaimPass ? profile.password : "xxxxxx"}
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            !isImpersonating &&
            onSetCredentials && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const clean = (profile.username || claimUser).trim().toLowerCase();
                  if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
                    setClaimError("Username must be 3–20 letters, numbers, or underscore.");
                    return;
                  }
                  if (claimPass.length < 4) {
                    setClaimError("Password must be at least 4 characters.");
                    return;
                  }
                  setClaimError("");
                  setClaiming(true);
                  const err = await onSetCredentials(clean, claimPass);
                  setClaiming(false);
                  if (err) setClaimError(err);
                }}
                className="rounded-2xl bg-[#1457E0]/[0.05] dark:bg-white/[0.04] p-3.5 space-y-2.5"
              >
                <div>
                  <strong className="block text-xs font-extrabold text-[#0B1B4D] dark:text-white">
                    Set your permanent Username &amp; Password
                  </strong>
                  <span className="block text-[11px] text-[#5A6A92] dark:text-[#93A3CC]">
                    Set a strong password to keep your account safe. Only visible to you here.
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    maxLength={20}
                    disabled={Boolean(profile.username)}
                    value={profile.username || claimUser}
                    onChange={(e) => {
                      setClaimUser(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                      if (claimError) setClaimError("");
                    }}
                    placeholder="Unique username (e.g. rahul_9)"
                    className="h-10 px-3 rounded-xl bg-white/85 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm font-mono-nums disabled:opacity-65"
                  />
                  <div className="relative">
                    <input
                      type={showClaimPass ? "text" : "password"}
                      maxLength={40}
                      value={claimPass}
                      onChange={(e) => {
                        setClaimPass(e.target.value);
                        if (claimError) setClaimError("");
                      }}
                      placeholder="Strong password (min 4 chars)"
                      className="w-full h-10 pl-3 pr-9 rounded-xl bg-white/85 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClaimPass((s) => !s)}
                      aria-label={showClaimPass ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A6A92] cursor-pointer"
                    >
                      {showClaimPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {claimError && (
                  <p className="text-xs font-semibold text-[#D92D3A] dark:text-[#FF6B76]">{claimError}</p>
                )}
                <button
                  type="submit"
                  disabled={claiming}
                  className="h-9 px-4 rounded-xl amay-play-btn text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {claiming ? "Saving…" : "Save Username & Password"}
                </button>
              </form>
            )
          )}
        </div>
      </div>

      {/* Theme Settings */}
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
      <div className="amay-card rounded-[30px] p-5 space-y-4">
        <div className="space-y-2">
          <div>
            <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">
              Overall Rank Badges
            </h2>
            <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC]">
              {nextMilestone !== null
                ? `Next badge at ${nextMilestone.toLocaleString()} XP · ${(nextMilestone - profile.xp).toLocaleString()} XP to go`
                : "All Overall XP badges unlocked!"}
            </p>
          </div>

          <div className="h-2.5 rounded-full bg-[#1457E0]/10 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#38B0FF] to-[#0B57DD]"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {badges.map((b) =>
              b.unlocked && b.milestone ? (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => onOpenBadge({ kind: "overall", milestone: b.milestone! })}
                  className="px-3 py-2.5 rounded-2xl text-left text-sm font-bold border border-[#1457E0]/25 dark:border-[#5AA2FF]/30 bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 text-[#0B1B4D] dark:text-white hover:bg-[#1457E0]/15 transition-colors cursor-pointer flex items-center justify-between gap-2"
                >
                  <span>
                    {b.icon} {b.label}
                  </span>
                  <span className="text-[11px] font-bold text-[#1457E0] dark:text-[#5AA2FF]">
                    View
                  </span>
                </button>
              ) : (
                <div
                  key={b.label}
                  className="px-3 py-2.5 rounded-2xl text-sm font-semibold border border-[#1846AA]/10 dark:border-white/10 opacity-50 text-[#5A6A92] dark:text-[#93A3CC]"
                >
                  {b.icon} {b.label}
                </div>
              )
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-[#1846AA]/10 dark:border-white/10 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-[#0B1B4D] dark:text-white">
                Today Top 3 Badges
              </h3>
              <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                Hold #1, #2 or #3 till 11:00 PM everyday to earn
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5A6A92] dark:text-[#93A3CC]">
                <Clock className="w-3 h-3" />
                {cutoff.isLocked ? "Resets in" : "Cutoff in"}
              </span>
              <strong className="block font-mono-nums text-xs font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
                {cutoff.isLocked ? cutoff.resetLabel : cutoff.countdownLabel}
              </strong>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([1, 2, 3] as const).map((rank) => {
              const wins = dailyBadges
                .filter((d) => d.rank === rank)
                .sort((a, b) => b.date.localeCompare(a.date));
              const latest = wins[0];
              const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
              if (latest) {
                return (
                  <button
                    key={`daily-slot-${rank}`}
                    type="button"
                    onClick={() =>
                      onOpenBadge({
                        kind: "daily",
                        rank,
                        dateLabel: latest.date,
                        xpToday: latest.xp,
                      })
                    }
                    className="p-2.5 rounded-2xl text-center border border-[#1457E0]/25 dark:border-[#5AA2FF]/30 bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 cursor-pointer hover:bg-[#1457E0]/15 transition-colors"
                  >
                    <span className="block text-lg leading-none">{medal}</span>
                    <strong className="block text-xs font-extrabold text-[#0B1B4D] dark:text-white mt-1">
                      Today #{rank}
                    </strong>
                    <span className="block text-[11px] font-bold text-[#1457E0] dark:text-[#5AA2FF] mt-0.5">
                      {wins.length}× earned
                    </span>
                  </button>
                );
              }
              return (
                <div
                  key={`daily-slot-${rank}`}
                  className="p-2.5 rounded-2xl text-center border border-[#1846AA]/10 dark:border-white/10 opacity-55"
                >
                  <span className="block text-lg leading-none">{medal}</span>
                  <strong className="block text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC] mt-1">
                    Today #{rank}
                  </strong>
                  <span className="block text-[11px] text-[#5A6A92] dark:text-[#93A3CC] mt-0.5">
                    Locked
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {hasAnyBadge ? (
          <button
            type="button"
            onClick={() => onOpenBadge()}
            className="w-full h-12 rounded-[20px] amay-play-btn text-white font-bold text-sm cursor-pointer"
          >
            🏅 Share my badge
          </button>
        ) : (
          <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC]">
            Reach 100 Overall XP or finish Top 3 by 11:00 PM today to unlock a shareable badge.
          </p>
        )}
      </div>

      {/* Sign Out / Switch Account */}
      {!isImpersonating && onSignOut && (
        <div className="amay-card rounded-[26px] p-4">
          {!confirmSignOut ? (
            <button
              type="button"
              onClick={() => setConfirmSignOut(true)}
              className="w-full py-2 text-sm font-bold text-[#D92D3A] dark:text-[#FF6B76] inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out / Switch Account</span>
            </button>
          ) : (
            <div className="space-y-2.5 text-center">
              <p className="text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC]">
                {profile.username
                  ? `You can sign back in anytime using @${profile.username} and your password.`
                  : "Set a username & password above before signing out so you don't lose access to your XP."}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmSignOut(false);
                    onSignOut();
                  }}
                  className="h-10 rounded-xl bg-[#D92D3A] text-white text-xs font-bold cursor-pointer"
                >
                  Confirm Sign Out
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmSignOut(false)}
                  className="h-10 rounded-xl amay-card text-xs font-bold text-[#0B1B4D] dark:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
