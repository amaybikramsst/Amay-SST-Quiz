import React, { useEffect, useState } from "react";
import { Check, Clock, Eye, EyeOff, Lock, LogOut, Share2 } from "lucide-react";
import type { BadgeDesignSpec } from "../lib/badgeCanvas";
import {
  formatCompactXp,
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
  onShareApp?: () => void;
  isImpersonating?: boolean;
  onOpenBadge: (spec?: BadgeDesignSpec) => void;
}

const AVATAR_GENDER_KEY = "amaysst_avatar_gender";

function loadSavedGender(): "male" | "female" | null {
  try {
    const val = localStorage.getItem(AVATAR_GENDER_KEY);
    return val === "male" || val === "female" ? val : null;
  } catch {
    return null;
  }
}

function saveGenderPreference(gender: "male" | "female") {
  try {
    localStorage.setItem(AVATAR_GENDER_KEY, gender);
  } catch {
    // ignore storage errors
  }
}

function inferAvatarGender(name: string): "male" | "female" {
  const clean = name.trim().toLowerCase().replace(/[^a-z\s]/g, "");
  const parts = clean.split(/\s+/).filter(Boolean);
  const first = parts[0] || "";
  const last = parts[parts.length - 1] || "";

  if (!first) return "male";

  const maleExceptions = new Set([
    "rabi",
    "ravi",
    "aditya",
    "krishna",
    "shiva",
    "surya",
    "arya",
    "rudra",
    "kabir",
    "jasin",
    "aman",
    "amit",
    "sumit",
    "rohit",
    "mohit",
    "ankit",
    "rahul",
    "abhishek",
    "akash",
    "vikash",
    "vikas",
    "deepak",
    "prince",
    "harsh",
    "yash",
    "ayush",
    "piyush",
    "amay",
    "sunny",
    "lucky",
    "bunny",
    "vicky",
    "bobby",
    "monty",
    "sonu",
    "monu",
    "golu",
    "chhotu",
    "raja",
    "rana",
    "mustafa",
    "hamza",
    "ali",
    "usman",
    "umar",
    "farhan",
    "arjun",
    "karan",
    "varun",
    "tarun",
    "arun",
  ]);

  if (maleExceptions.has(first)) return "male";
  if (last === "kumar") return "male";
  if (
    last === "kumari" ||
    last === "devi" ||
    last === "bano" ||
    last === "khatoon" ||
    last === "parveen"
  ) {
    return "female";
  }

  const femaleExact = new Set([
    "priya",
    "neha",
    "pooja",
    "puja",
    "anjali",
    "sneha",
    "swati",
    "kavita",
    "sunita",
    "anita",
    "nikita",
    "ankita",
    "shreya",
    "divya",
    "riya",
    "siya",
    "jiya",
    "diya",
    "tanya",
    "sanya",
    "anya",
    "isha",
    "nisha",
    "asha",
    "usha",
    "kiran",
    "simran",
    "muskan",
    "khushi",
    "kajal",
    "komal",
    "sonam",
    "poonam",
    "rekha",
    "seema",
    "meena",
    "geeta",
    "sita",
    "radha",
    "ganga",
    "laxmi",
    "lakshmi",
    "saraswati",
    "durga",
    "parvati",
    "nandini",
    "roshni",
    "chandni",
    "jyoti",
    "arti",
    "aarti",
    "bharti",
    "sweta",
    "shweta",
    "sakshi",
    "megha",
    "varsha",
    "richa",
    "ruchika",
    "monika",
    "sonia",
    "soniya",
    "tina",
    "nina",
    "mina",
    "hina",
    "sana",
    "zoya",
    "fatima",
    "ayesha",
    "aisha",
    "sadia",
    "nazia",
    "rubina",
    "shabnam",
    "palak",
    "mahak",
    "mehak",
    "payal",
    "sheetal",
    "sapna",
    "archana",
    "vandana",
    "sadhana",
    "kalpana",
    "arpita",
    "ipsita",
    "susmita",
    "sushmita",
    "madhu",
    "nidhi",
    "siddhi",
    "riddhi",
    "vrinda",
    "shruti",
    "smriti",
    "kriti",
    "aditi",
    "stuti",
    "pragati",
    "unnati",
    "bhavya",
    "navya",
    "kavya",
    "saumya",
    "soumya",
  ]);

  if (femaleExact.has(first)) return "female";

  if (
    first.endsWith("a") ||
    first.endsWith("i") ||
    first.endsWith("ee") ||
    first.endsWith("ya") ||
    first.endsWith("shi")
  ) {
    return "female";
  }

  return "male";
}

const ProfileSilhouetteAvatar: React.FC<{
  gender: "male" | "female";
  sizeClass?: string;
}> = ({ gender, sizeClass = "w-16 h-16" }) => {
  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden flex items-center justify-center shrink-0 select-none shadow-[0_10px_20px_-10px_rgba(11,87,221,0.8)] ${
        gender === "female"
          ? "bg-gradient-to-br from-[#38B0FF] to-[#1457E0]"
          : "bg-gradient-to-br from-[#2B7BFF] to-[#0B57DD]"
      }`}
    >
      {gender === "female" ? (
        <svg viewBox="0 0 100 100" className="w-[84%] h-[84%]" aria-hidden="true">
          <path
            d="M52 13c-13.5 0-22.5 9.2-24 23.5-1.1 10.6 0.4 18.8 3.2 24.2 1.3 2.5 3.1 4.2 5.4 4.8-1.4-2.8-1.8-6.4-0.8-10.3 0.7-2.6 1.9-5.1 3.4-7.1-1.3-4.8-1.3-11.2 1.6-15.8 1.5-2.4 3.8-4.1 6.2-4.8-3.5 3.6-4.6 9.5-3.6 15.2 1 5.6 4.4 10.4 9.2 12.1 2.2 0.8 4.6 0.9 6.8 0.3 4.8-1.4 8.2-5.9 9.5-11.4 1.1-4.8 0.6-10.1-1.6-14.2 2.4 3.2 3.8 7.5 3.7 12.2-0.1 4.4-1.5 8.6-3.8 11.8 1.8 3.1 4.5 5.4 7.8 6.4-1.6-2.5-2.4-5.7-2.2-9.2 0.3-5.2 1.8-11.6 1.1-18.8C72.7 21.8 64.5 13 52 13z"
            fill="#FFFFFF"
          />
          <path
            d="M44.5 28.5c-2.6 3.5-2.8 9.2-1.7 14.3 1.1 5 4.2 9.2 8.4 10.6 2 0.7 4.2 0.7 6.1 0.1 4.2-1.3 7.2-5.2 8.3-10.1 1-4.4 0.5-9.2-1.5-12.8-2.4-4.2-6.6-6.3-11.2-6.1-3.4 0.1-6.5 1.6-8.4 4z"
            fill="#FFFFFF"
          />
          <path
            d="M44.5 53.5c0.2 3.4-0.6 6.2-2.6 7.7-4.8 3.2-13.5 4.2-17.2 8.6-2.1 2.5-2.9 6.1-2.5 9.6 0.3 2.5 1.8 4.4 4.1 5.5 6.8 3.2 13.8 6.4 18.8 10.6 2.8 2.3 6.9 2.3 9.7 0 5-4.2 12-7.4 18.8-10.6 2.3-1.1 3.8-3 4.1-5.5 0.4-3.5-0.4-7.1-2.5-9.6-3.7-4.4-12.4-5.4-17.2-8.6-2-1.5-2.8-4.3-2.6-7.7-3.6 1.2-7.3 1.2-10.9 0z"
            fill="#FFFFFF"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 100 100" className="w-[84%] h-[84%]" aria-hidden="true">
          <path
            d="M50 12c-3.5 0-6.8 1.2-9.4 2.7l1.6-2.2c-4.4 0.6-8.4 2.9-11.2 6.2l0.8-2.3c-3.4 2.1-5.8 5.6-6.7 9.6l1.4-1.2c-0.9 3.2-1 6.7-0.2 10-1.9 0.3-3.1 2.3-2.5 4.9 0.6 2.5 2.4 4.4 4.3 4.6 1.4 4.6 4.4 8.3 8.4 10.2 2.4 1.1 5.1 1.6 7.8 1.4 3.5-0.3 6.8-1.9 9.2-4.6 2.3-2.6 3.9-5.9 4.7-9.4 1.8-0.3 3.4-2.1 4-4.5 0.6-2.5-0.5-4.5-2.4-4.8 0.9-4.1 0.6-8.5-1.2-12.2-2.6-5.3-7.9-8.4-13.6-8.4z"
            fill="#FFFFFF"
          />
          <path
            d="M42.2 52.5c0.3 3.3-0.3 6-1.8 7.8 3.2 4.1 6.4 7.4 9.6 9.6 3.2-2.2 6.4-5.5 9.6-9.6-1.5-1.8-2.1-4.5-1.8-7.8-5.1 1.8-10.5 1.8-15.6 0z"
            fill="#FFFFFF"
          />
          <path
            d="M38.2 61.8c-5.4 2.3-12.4 3.8-15.6 7.9-2.2 2.8-2.9 6.6-2.4 10.3 0.3 2.5 1.9 4.5 4.2 5.6 7.1 3.3 14.5 6.6 19.8 11 2.9 2.4 7.1 2.4 10 0 5.3-4.4 12.7-7.7 19.8-11 2.3-1.1 3.9-3.1 4.2-5.6 0.5-3.7-0.2-7.5-2.4-10.3-3.2-4.1-10.2-5.6-15.6-7.9-3.4 4.3-6.8 7.8-10.2 10.2-3.4-2.4-6.8-5.9-10.2-10.2z"
            fill="#FFFFFF"
          />
        </svg>
      )}
    </div>
  );
};

function getHolographicMilestoneStyle(milestone?: number): {
  cardClass: string;
  pillClass: string;
  tierName: string;
} {
  if (milestone === 100000) {
    return {
      cardClass:
        "border-sky-300/60 dark:border-sky-300/45 bg-gradient-to-br from-indigo-500/20 via-sky-400/25 to-fuchsia-500/20 shadow-[0_10px_24px_-12px_rgba(56,176,255,0.65)]",
      pillClass: "bg-sky-400/25 text-sky-900 dark:text-sky-200",
      tierName: "Diamond",
    };
  }
  if (milestone === 10000) {
    return {
      cardClass:
        "border-amber-400/55 dark:border-amber-300/40 bg-gradient-to-br from-amber-400/22 via-yellow-300/18 to-orange-500/18 shadow-[0_10px_22px_-12px_rgba(245,158,11,0.55)]",
      pillClass: "bg-amber-400/25 text-amber-900 dark:text-amber-200",
      tierName: "Gold",
    };
  }
  if (milestone === 1000) {
    return {
      cardClass:
        "border-slate-300/65 dark:border-slate-300/35 bg-gradient-to-br from-slate-300/25 via-sky-200/20 to-indigo-400/15 shadow-[0_10px_20px_-12px_rgba(148,163,184,0.5)]",
      pillClass: "bg-slate-400/20 text-slate-800 dark:text-slate-200",
      tierName: "Silver",
    };
  }
  return {
    cardClass:
      "border-orange-400/45 dark:border-orange-300/30 bg-gradient-to-br from-orange-400/20 via-amber-300/15 to-rose-400/15 shadow-[0_10px_20px_-12px_rgba(234,88,12,0.45)]",
    pillClass: "bg-orange-400/20 text-orange-900 dark:text-orange-200",
    tierName: "Bronze",
  };
}

function getHolographicRankStyle(rank: 1 | 2 | 3): string {
  if (rank === 1) {
    return "border-amber-400/60 dark:border-amber-300/45 bg-gradient-to-b from-amber-400/25 via-yellow-300/15 to-amber-500/10 shadow-[0_10px_22px_-12px_rgba(245,158,11,0.6)]";
  }
  if (rank === 2) {
    return "border-slate-300/70 dark:border-slate-300/40 bg-gradient-to-b from-slate-300/25 via-sky-200/15 to-slate-400/10 shadow-[0_10px_22px_-12px_rgba(148,163,184,0.55)]";
  }
  return "border-orange-400/50 dark:border-orange-300/35 bg-gradient-to-b from-orange-400/22 via-amber-300/12 to-orange-500/10 shadow-[0_10px_22px_-12px_rgba(234,88,12,0.5)]";
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  isDark,
  onToggleTheme,
  onUpdateName,
  onSetCredentials,
  onSignOut,
  onShareApp,
  isImpersonating = false,
  onOpenBadge,
}) => {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const [error, setError] = useState("");
  const [cutoff, setCutoff] = useState(() => getTodayCutoffStatus());
  const [selectedGender, setSelectedGender] = useState<"male" | "female">(
    () => loadSavedGender() ?? inferAvatarGender(profile.name)
  );

  // Legacy credential claim state (only shown if profile.username isn't set yet)
  const [claimUser, setClaimUser] = useState("");
  const [claimPass, setClaimPass] = useState("");
  const [showClaimPass, setShowClaimPass] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCutoff(getTodayCutoffStatus());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const handleSelectGender = (gender: "male" | "female") => {
    setSelectedGender(gender);
    saveGenderPreference(gender);
  };

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
      if (!loadSavedGender()) {
        setSelectedGender(inferAvatarGender(cleaned));
      }
    }
    setError("");
    setEditing(false);
  };

  const handleShareApp = async () => {
    onShareApp?.();
    const shareUrl = `${window.location.origin}${window.location.pathname}`;
    const shareData = {
      title: "AmaySST Quiz",
      text: "Practice Maths, Science, SST, English, Hindi & Current Affairs with live ranks and daily badges! Join me on AmaySST Quiz:",
      url: shareUrl,
    };

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard?.writeText(shareUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 3000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF] px-1">
        Me
      </h1>

      {/* 3 Stat Tiles */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="amay-card rounded-[20px] p-3.5 text-center" title={`${profile.xp.toLocaleString()} XP`}>
          <strong className="block text-[22px] font-extrabold text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
            {formatCompactXp(profile.xp)}
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

      {/* Profile Card (Name + Male/Female Avatar Selector) */}
      <div className="amay-card rounded-[30px] p-5 space-y-3.5">
        <div className="flex items-center gap-3.5">
          <ProfileSilhouetteAvatar
            gender={selectedGender}
            sizeClass="w-16 h-16 ring-2 ring-[#38B0FF]/35"
          />
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

        {/* Gender Selector (Male / Female) */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[#5A6A92] dark:text-[#93A3CC]">
            Profile Avatar
          </span>
          <div className="inline-flex p-1 rounded-full bg-[#1457E0]/[0.07] dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10">
            <button
              type="button"
              onClick={() => handleSelectGender("male")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition cursor-pointer ${
                selectedGender === "male"
                  ? "bg-gradient-to-r from-[#2B7BFF] to-[#1457E0] text-white shadow-sm"
                  : "text-[#5A6A92] dark:text-[#93A3CC] hover:text-[#0B1B4D] dark:hover:text-white"
              }`}
            >
              Male
            </button>
            <button
              type="button"
              onClick={() => handleSelectGender("female")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition cursor-pointer ${
                selectedGender === "female"
                  ? "bg-gradient-to-r from-[#2B7BFF] to-[#1457E0] text-white shadow-sm"
                  : "text-[#5A6A92] dark:text-[#93A3CC] hover:text-[#0B1B4D] dark:hover:text-white"
              }`}
            >
              Female
            </button>
          </div>
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

      {/* Theme & Share Settings */}
      <div className="amay-card rounded-[28px] divide-y divide-[#1846AA]/10 dark:divide-white/10 overflow-hidden">
        <button
          type="button"
          onClick={handleShareApp}
          className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-[#1457E0]/[0.04] transition-colors"
        >
          <div className="min-w-0">
            <strong className="block text-sm font-extrabold text-[#0B1B4D] dark:text-white">
              Share this app
            </strong>
            <span className="block text-xs text-[#5A6A92] dark:text-[#93A3CC]">
              {shareCopied ? "App link copied! Send it to friends" : "Invite classmates to practice & compete"}
            </span>
          </div>
          <span className="shrink-0 h-9 px-3.5 rounded-full bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 text-[#1457E0] dark:text-[#5AA2FF] text-xs font-bold inline-flex items-center gap-1.5">
            {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{shareCopied ? "Copied" : "Share"}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="w-full px-5 py-3.5 text-sm font-bold text-[#1457E0] dark:text-[#5AA2FF] cursor-pointer text-center hover:bg-[#1457E0]/[0.04] transition-colors"
        >
          {isDark ? "Switch to light mode" : "Switch to dark mode"}
        </button>
      </div>

      {/* Holographic Rank & Daily Badges */}
      <div className="amay-card rounded-[30px] p-5 space-y-4">
        <div className="space-y-2.5">
          <div>
            <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">
              Overall Rank Badges
            </h2>
            <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC]">
              {nextMilestone !== null
                ? `Next badge at ${formatCompactXp(nextMilestone)} XP · ${formatCompactXp(nextMilestone - profile.xp)} XP to go`
                : "All Overall XP badges unlocked!"}
            </p>
          </div>

          <div className="h-2.5 rounded-full bg-[#1457E0]/10 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#38B0FF] via-[#2B7BFF] to-[#0B57DD] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {badges.map((b) => {
              if (b.unlocked && b.milestone) {
                const holo = getHolographicMilestoneStyle(b.milestone);
                return (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => onOpenBadge({ kind: "overall", milestone: b.milestone! })}
                    className={`relative overflow-hidden px-3.5 py-3 rounded-2xl text-left border transition-all duration-200 hover:scale-[1.015] active:scale-[0.99] cursor-pointer flex items-center justify-between gap-2 ${holo.cardClass}`}
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-6 -right-6 w-16 h-16 rounded-full bg-white/25 dark:bg-white/10 blur-md"
                    />
                    <div className="min-w-0">
                      <span className="block text-sm font-extrabold text-[#0B1B4D] dark:text-white truncate">
                        {b.icon} {b.label}
                      </span>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#5A6A92] dark:text-white/70 mt-0.5">
                        {holo.tierName} Tier
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${holo.pillClass}`}
                    >
                      View
                    </span>
                  </button>
                );
              }
              return (
                <div
                  key={b.label}
                  className="px-3.5 py-3 rounded-2xl text-sm font-semibold border border-[#1846AA]/10 dark:border-white/10 bg-[#1457E0]/[0.02] dark:bg-white/[0.02] opacity-50 text-[#5A6A92] dark:text-[#93A3CC] flex items-center justify-between gap-2"
                >
                  <span>
                    {b.icon} {b.label}
                  </span>
                  <span className="text-[10px] font-bold uppercase">Locked</span>
                </div>
              );
            })}
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

          <div className="grid grid-cols-3 gap-2.5">
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
                    className={`relative overflow-hidden p-3 rounded-2xl text-center border transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] cursor-pointer ${getHolographicRankStyle(
                      rank
                    )}`}
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-5 -right-5 w-14 h-14 rounded-full bg-white/30 dark:bg-white/10 blur-md"
                    />
                    <span className="block text-xl leading-none drop-shadow-xs">{medal}</span>
                    <strong className="block text-xs font-extrabold text-[#0B1B4D] dark:text-white mt-1.5">
                      Today #{rank}
                    </strong>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-white/60 dark:bg-white/10 text-[10px] font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
                      {wins.length}× earned
                    </span>
                  </button>
                );
              }
              return (
                <div
                  key={`daily-slot-${rank}`}
                  className="p-3 rounded-2xl text-center border border-[#1846AA]/10 dark:border-white/10 bg-[#1457E0]/[0.02] dark:bg-white/[0.02] opacity-50"
                >
                  <span className="block text-xl leading-none grayscale">{medal}</span>
                  <strong className="block text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC] mt-1.5">
                    Today #{rank}
                  </strong>
                  <span className="block text-[10px] font-bold uppercase text-[#5A6A92] dark:text-[#93A3CC] mt-1">
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
            className="w-full h-12 rounded-[20px] amay-play-btn text-white font-bold text-sm cursor-pointer shadow-[0_12px_24px_-10px_rgba(20,87,224,0.85)]"
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
