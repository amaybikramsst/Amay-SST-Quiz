import React, { useEffect, useState } from "react";
import { Download, ExternalLink, Eye, EyeOff, Lock, ShieldCheck, UserCheck, UserPlus } from "lucide-react";

interface GateViewProps {
  existingAccount?: { name: string; xp: number; nameAt?: number } | null;
  showInstallBanner?: boolean;
  onInstallClick?: () => void;
  isInAppBrowser?: boolean;
  externalBrowserUrl?: string;
  onRegister: (payload: {
    name: string;
    username: string;
    password: string;
  }) => Promise<string | null>;
  onClaimExisting: (payload: {
    name: string;
    username: string;
    password: string;
  }) => Promise<string | null>;
  onLogin: (payload: { username: string; password: string }) => Promise<string | null>;
}

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

function formatWait(ms: number): string {
  const mins = Math.ceil(ms / 6e4);
  const hrs = Math.floor(mins / 60);
  return hrs ? `${hrs}h ${mins % 60}m` : `${mins}m`;
}

export const GateView: React.FC<GateViewProps> = ({
  existingAccount = null,
  showInstallBanner = false,
  onInstallClick,
  isInAppBrowser = false,
  externalBrowserUrl = "",
  onRegister,
  onClaimExisting,
  onLogin,
}) => {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState(existingAccount?.name || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (existingAccount?.name) {
      setName((prev) => prev || existingAccount.name);
    }
  }, [existingAccount?.name]);

  useEffect(() => {
    if (!existingAccount?.nameAt) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, [existingAccount?.nameAt]);

  const isClaimFlow = Boolean(existingAccount && mode === "signup");
  const msLeft = existingAccount
    ? Math.max(0, (existingAccount.nameAt || 0) + 864e5 - nowTick)
    : 0;
  const nameLockedByCooldown = Boolean(existingAccount && msLeft > 0);

  const handleUsernameChange = (raw: string) => {
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(cleaned);
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const cleanUser = username.trim().toLowerCase();
    if (!USERNAME_REGEX.test(cleanUser)) {
      setError("Username must be 3–20 characters (letters, numbers, underscore only).");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    if (isClaimFlow) {
      const cleanName = (nameLockedByCooldown ? existingAccount!.name : name).trim();
      if (cleanName.length < 2) {
        setError("Enter the candidate's name to continue.");
        return;
      }
      setError("");
      setSubmitting(true);
      const err = await onClaimExisting({ name: cleanName, username: cleanUser, password });
      setSubmitting(false);
      if (err) setError(err);
      return;
    }

    if (mode === "signup") {
      const cleanName = name.trim();
      if (cleanName.length < 2) {
        setError("Enter the candidate's name to continue.");
        return;
      }
      setError("");
      setSubmitting(true);
      const err = await onRegister({ name: cleanName, username: cleanUser, password });
      setSubmitting(false);
      if (err) setError(err);
      return;
    }

    setError("");
    setSubmitting(true);
    const err = await onLogin({ username: cleanUser, password });
    setSubmitting(false);
    if (err) setError(err);
  };

  return (
    <div className="space-y-4 pt-2">
      {isInAppBrowser && externalBrowserUrl && (
        <div className="amay-card rounded-[24px] p-4 flex items-center justify-between gap-3 border border-[#1457E0]/25 overflow-hidden">
          <div className="min-w-0">
            <strong className="block text-sm font-extrabold text-[#0B1B4D] dark:text-white">
              Open in Chrome / Browser
            </strong>
            <span className="block text-xs text-[#5A6A92] dark:text-[#93A3CC]">
              For faster play &amp; smooth app install
            </span>
          </div>
          <a
            href={externalBrowserUrl}
            className="shrink-0 h-10 px-4 rounded-full bg-[#1457E0] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open</span>
          </a>
        </div>
      )}

      <div className="amay-card rounded-[28px] p-6 space-y-4 overflow-hidden">
        <div>
          <h1 className="text-[26px] sm:text-[30px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF]">
            {isClaimFlow
              ? `Secure Your Account, ${existingAccount!.name}`
              : "Welcome to AmaySST Quiz"}
          </h1>
          <p className="text-sm sm:text-base text-[#5A6A92] dark:text-[#93A3CC] mt-1.5">
            {isClaimFlow
              ? `Your ${existingAccount!.xp.toLocaleString()} XP is safe! Confirm your name and set a compulsory unique username & password to unlock quizzes, ranks, and chat.`
              : mode === "signup"
                ? "Create your compulsory username & password to start playing quizzes and chatting."
                : "Sign in with your username & password to restore your XP and rank."}
          </p>
        </div>

        <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#1457E0]/[0.07] dark:bg-white/[0.06] gap-1">
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
            }}
            className={`h-10 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
              mode === "signup"
                ? "bg-[#1457E0] text-white shadow-sm"
                : "text-[#5A6A92] dark:text-[#93A3CC]"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>{existingAccount ? "Set Up Account" : "Create Account"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`h-10 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
              mode === "login"
                ? "bg-[#1457E0] text-white shadow-sm"
                : "text-[#5A6A92] dark:text-[#93A3CC]"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Sign In</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="amay-card rounded-[28px] p-6 space-y-4">
        {mode === "signup" && (
          <div>
            <label
              htmlFor="candidate-name"
              className="block text-sm font-bold text-[#0B1B4D] dark:text-[#EAF0FF] mb-1.5"
            >
              Candidate name
            </label>
            <input
              id="candidate-name"
              type="text"
              maxLength={20}
              autoFocus={!isClaimFlow}
              autoComplete="name"
              readOnly={nameLockedByCooldown}
              value={nameLockedByCooldown ? existingAccount!.name : name}
              onChange={(e) => {
                if (nameLockedByCooldown) return;
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder="Your full name (shown on leaderboard)"
              className={`w-full h-12 px-4 rounded-2xl border border-[#1846AA]/15 dark:border-white/10 text-[#0B1B4D] dark:text-white placeholder:text-[#5A6A92]/60 focus:outline-none focus:border-[#1457E0] text-base font-medium ${
                nameLockedByCooldown
                  ? "bg-slate-100/80 dark:bg-white/[0.04] opacity-80 cursor-not-allowed"
                  : "bg-white/75 dark:bg-[#0B1224]/80"
              }`}
            />
            <p className="text-[11px] text-[#5A6A92] dark:text-[#93A3CC] mt-1.5">
              {nameLockedByCooldown
                ? `🔒 Autofilled · You can change your name again in ${formatWait(msLeft)} (every 24h)`
                : isClaimFlow
                  ? "Autofilled from your existing profile · can be changed once every 24 hours."
                  : "Shown on leaderboard · can be changed once every 24 hours."}
            </p>
          </div>
        )}

        <div>
          <label
            htmlFor="candidate-username"
            className="block text-sm font-bold text-[#0B1B4D] dark:text-[#EAF0FF] mb-1.5"
          >
            Unique username
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-[#1457E0] dark:text-[#5AA2FF] select-none">
              @
            </span>
            <input
              id="candidate-username"
              type="text"
              maxLength={20}
              autoFocus={mode === "login" || isClaimFlow}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="e.g. suman_07"
              className="w-full h-12 pl-9 pr-4 rounded-2xl bg-white/75 dark:bg-[#0B1224]/80 border border-[#1846AA]/15 dark:border-white/10 text-[#0B1B4D] dark:text-white placeholder:text-[#5A6A92]/60 focus:outline-none focus:border-[#1457E0] text-base font-mono-nums font-semibold"
            />
          </div>
          {mode === "signup" && (
            <p className="text-[11px] text-[#5A6A92] dark:text-[#93A3CC] mt-1.5 inline-flex items-center gap-1">
              <Lock className="w-3 h-3 shrink-0" />
              <span>Private to you in Me · cannot be changed later. Others only see your name.</span>
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="candidate-password"
            className="block text-sm font-bold text-[#0B1B4D] dark:text-[#EAF0FF] mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="candidate-password"
              type={showPassword ? "text" : "password"}
              maxLength={40}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              placeholder={mode === "signup" ? "Create a password (min 4 chars)" : "Enter your password"}
              className="w-full h-12 pl-4 pr-12 rounded-2xl bg-white/75 dark:bg-[#0B1224]/80 border border-[#1846AA]/15 dark:border-white/10 text-[#0B1B4D] dark:text-white placeholder:text-[#5A6A92]/60 focus:outline-none focus:border-[#1457E0] text-base font-medium"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center text-[#5A6A92] hover:text-[#1457E0] cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mode === "signup" && (
          <div className="rounded-2xl bg-[#1457E0]/[0.06] dark:bg-[#5AA2FF]/[0.08] border border-[#1457E0]/15 dark:border-[#5AA2FF]/20 px-3.5 py-2.5 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#1457E0] dark:text-[#5AA2FF] shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-[#5A6A92] dark:text-[#93A3CC] leading-relaxed">
              <strong className="text-[#0B1B4D] dark:text-white">Set a strong password</strong> (use a mix of letters &amp; numbers you&apos;ll remember) so your XP and chats stay protected.
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm font-semibold text-[#D92D3A] dark:text-[#FF6B76]" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-13 rounded-[22px] amay-play-btn text-white font-bold text-base cursor-pointer disabled:opacity-60"
        >
          {submitting
            ? isClaimFlow
              ? "Saving account…"
              : mode === "signup"
                ? "Creating account…"
                : "Signing in…"
            : isClaimFlow
              ? "Save Username & Password"
              : mode === "signup"
                ? "Create Account & Start"
                : "Sign In"}
        </button>
      </form>

      {showInstallBanner && onInstallClick && (
        <div className="amay-card rounded-[24px] p-4 flex items-center justify-between gap-3 overflow-hidden">
          <div className="min-w-0">
            <strong className="block text-sm font-extrabold text-[#0B1B4D] dark:text-white truncate">
              Install AmaySST Quiz App
            </strong>
            <span className="block text-xs text-[#5A6A92] dark:text-[#93A3CC]">
              1-tap launch from your home screen
            </span>
          </div>
          <button
            type="button"
            onClick={onInstallClick}
            className="shrink-0 h-10 px-4 rounded-full bg-gradient-to-b from-[#2B7BFF] to-[#1457E0] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-[0_8px_18px_rgba(20,87,224,0.28)] active:scale-95 transition cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Install App</span>
          </button>
        </div>
      )}
    </div>
  );
};
