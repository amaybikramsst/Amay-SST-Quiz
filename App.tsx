import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminView } from "./components/AdminView";
import { BadgeModal } from "./components/BadgeModal";
import { BottomNav } from "./components/BottomNav";
import { GateView } from "./components/GateView";
import { Header, type AppRoute } from "./components/Header";
import { HomeView } from "./components/HomeView";
import { ProfileView } from "./components/ProfileView";
import { PWAInstallModal } from "./components/PWAInstallModal";
import { QuizView } from "./components/QuizView";
import { RankView, type RankEntry } from "./components/RankView";
import { SubjectConfigView, SubjectsGridView } from "./components/SubjectsView";
import { usePWAInstall } from "./hooks/usePWAInstall";
import { BENCHMARK_PLAYERS } from "./data/benchmarks";
import { type QuizKey, type RawQuestion, type SubjectKey } from "./data/questions";
import {
  buildQuizSet,
  calculateQuizScore,
  getGuestUUID,
  LEVELS,
  loadProfile,
  loadQueue,
  mergeDynamicQuestions,
  QUIZ_LENGTHS,
  saveProfile,
  saveQueue,
  todayUTC,
  type ActiveQuizState,
  type StudentProfile,
} from "./lib/quizEngine";
import { getCrossedXpMilestone, launchMilestoneConfetti } from "./lib/confetti";
import { playMilestoneSound, playQuizCompleteSound, playSelectTapSound } from "./lib/soundEffects";
import {
  fetchBotOverrides,
  fetchDynamicQuestions,
  fetchLatestVideo,
  getLeaderboard,
  getMyStats,
  loadBotOverrides,
  loadLocalLatestVideo,
  logCandidateTap,
  registerPlayer,
  reportAppInstallStatus,
  submitQuizAttempt,
  type BotOverride,
  type CloudStats,
  type LatestVideoConfig,
  type LiveLeaderRow,
} from "./lib/supabase";

function isSecretAdminUrl(): boolean {
  if (typeof window === "undefined") return false;
  const { pathname, hash, search } = window.location;
  const params = new URLSearchParams(search);
  return (
    pathname.endsWith("/admin") ||
    pathname.endsWith("/admin.html") ||
    hash === "#admin" ||
    params.get("admin") === "1"
  );
}

export default function App() {
  const [guestId] = useState<string>(() => getGuestUUID());
  const [profile, setProfile] = useState<StudentProfile>(() => loadProfile());
  const [view, setView] = useState<AppRoute>(() => {
    if (isSecretAdminUrl()) return "admin";
    return loadProfile().name ? "home" : "gate";
  });

  const [mergedBank, setMergedBank] = useState<Record<SubjectKey, RawQuestion[]>>(() =>
    mergeDynamicQuestions([])
  );
  const [livePlayers, setLivePlayers] = useState<LiveLeaderRow[]>([]);
  const [botOverrides, setBotOverrides] = useState<Record<string, BotOverride>>(() => loadBotOverrides());
  const [latestVideo, setLatestVideo] = useState<LatestVideoConfig>(() => loadLocalLatestVideo());
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== "undefined" ? !navigator.onLine : false));

  const [configKey, setConfigKey] = useState<QuizKey>("mix");
  const [configLevel, setConfigLevel] = useState<number>(1);
  const [configLength, setConfigLength] = useState<number>(10);

  const [quiz, setQuiz] = useState<ActiveQuizState | null>(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [impersonated, setImpersonated] = useState<{
    guestUuid: string;
    profile: StudentProfile;
    botOriginalName?: string;
  } | null>(null);
  const { canNativeInstall, isInstalled, isIOS, install } = usePWAInstall();

  const effectiveProfile = impersonated ? impersonated.profile : profile;
  const effectiveGuestId = impersonated ? impersonated.guestUuid : guestId;

  const flushingRef = useRef(false);
  const lastSyncedNameRef = useRef("");
  const lastLeaderboardFetchRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);

  const isDark = useMemo(() => {
    if (profile.theme === "dark") return true;
    if (profile.theme === "light") return false;
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, [profile.theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    const onHashOrPop = () => {
      if (isSecretAdminUrl()) {
        setView("admin");
      }
    };
    window.addEventListener("hashchange", onHashOrPop);
    window.addEventListener("popstate", onHashOrPop);
    return () => {
      window.removeEventListener("hashchange", onHashOrPop);
      window.removeEventListener("popstate", onHashOrPop);
    };
  }, []);

  const recordTap = useCallback(
    (action: string, detail: string, screen: string) => {
      if (impersonated) return;
      const name = loadProfile().name;
      if (!name) return;
      logCandidateTap(guestId, name, action, detail, screen);
    },
    [guestId, impersonated]
  );

  // Show install popup within the first 30 seconds to anyone who hasn't installed the app yet
  useEffect(() => {
    if (isInstalled || view === "admin" || view === "quiz") return;
    try {
      if (sessionStorage.getItem("amaysst_install_prompted") === "1") return;
    } catch {
      // ignore storage errors
    }

    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem("amaysst_install_prompted", "1");
      } catch {
        // ignore
      }
      setShowInstallModal(true);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [isInstalled, view]);

  const handleInstallClick = useCallback(async () => {
    recordTap("Install App", "Tapped Install App button", view);
    if (canNativeInstall) {
      const outcome = await install();
      if (outcome === "accepted") {
        setShowInstallModal(false);
        return;
      }
    }
    setShowInstallModal(true);
  }, [canNativeInstall, install, recordTap, view]);

  // Report each student's app install state to Supabase whenever it changes (so Admin sees Installed vs Not Installed)
  useEffect(() => {
    if (!profile.name || impersonated) return;
    const nextVal = isInstalled ? "1" : "0";
    try {
      const prevReported = localStorage.getItem("amaysst_reported_install");
      if (prevReported === nextVal) return;
      localStorage.setItem("amaysst_reported_install", nextVal);
    } catch {
      // continue reporting even if localStorage is blocked
    }
    reportAppInstallStatus(guestId, profile.name, isInstalled);
  }, [guestId, impersonated, isInstalled, profile.name]);

  // Sync cloud stats without overwriting client-side 1/4 negative-marked XP,
  // while still honoring admin manual XP edits from Supabase!
  const applyCloudStats = useCallback((stats: CloudStats, fromAdminCheck = false) => {
    if (loadQueue().length > 0) return;
    const current = loadProfile();
    const beforeXp = current.xp;
    let computedAfterXp = beforeXp;
    if (fromAdminCheck) {
      if (current.lastCloudXp === undefined) {
        computedAfterXp = Math.max(current.xp, stats.xp);
      } else if (stats.xp !== current.lastCloudXp) {
        const delta = stats.xp - current.lastCloudXp;
        computedAfterXp = Math.max(0, current.xp + delta);
      }
    }

    setProfile((prev) => {
      let nextXp = prev.xp;
      let nextTodayXp = prev.td?.d === todayUTC(0) ? prev.td.xp : 0;

      if (fromAdminCheck) {
        if (prev.lastCloudXp === undefined) {
          nextXp = Math.max(prev.xp, stats.xp);
          nextTodayXp = Math.max(nextTodayXp, stats.today_xp || 0);
        } else if (stats.xp !== prev.lastCloudXp) {
          // Admin edited XP directly in Supabase
          const delta = stats.xp - prev.lastCloudXp;
          nextXp = Math.max(0, prev.xp + delta);
        }
      }

      const next: StudentProfile = {
        ...prev,
        xp: nextXp,
        streak: Math.max(prev.streak, stats.streak),
        quizzes: Math.max(prev.quizzes, stats.quizzes),
        perfect: Math.max(prev.perfect, stats.perfect),
        td: { d: todayUTC(0), xp: nextTodayXp },
        lastCloudXp: stats.xp,
      };
      saveProfile(next);
      return next;
    });

    if (fromAdminCheck) {
      const crossed = getCrossedXpMilestone(beforeXp, computedAfterXp);
      if (crossed !== null) {
        launchMilestoneConfetti(crossed);
      }
    }
  }, []);

  const refreshDynamicQuestions = useCallback(async () => {
    const rows = await fetchDynamicQuestions();
    setMergedBank(mergeDynamicQuestions(rows));
  }, []);

  const refreshLeaderboard = useCallback(
    async (force = false, guestOverride?: string) => {
      if (!force && Date.now() - lastLeaderboardFetchRef.current < 15000) return;
      lastLeaderboardFetchRef.current = Date.now();
      const rows = await getLeaderboard(guestOverride ?? effectiveGuestId);
      if (rows) {
        setLivePlayers(rows);
      }
    },
    [effectiveGuestId]
  );

  const syncIdentity = useCallback(
    async (prof: StudentProfile) => {
      if (!prof.name || prof.name === lastSyncedNameRef.current) return;
      const ok = await registerPlayer(guestId, prof.name);
      if (ok) lastSyncedNameRef.current = prof.name;
    },
    [guestId]
  );

  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const currentProfile = loadProfile();
      await syncIdentity(currentProfile);

      const queue = loadQueue();
      while (queue.length > 0) {
        const attempt = queue[0];
        const res = await submitQuizAttempt(guestId, attempt.k, attempt.L, attempt.t, attempt.c);
        if (res.status === "ok") {
          queue.shift();
          saveQueue(queue);
          if (queue.length === 0) applyCloudStats(res.data, false);
          continue;
        }
        if (res.status === "rate_limit") {
          if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = window.setTimeout(() => {
            flushQueue();
          }, 16000);
          break;
        }
        if (res.status === "invalid") {
          queue.shift();
          saveQueue(queue);
          continue;
        }
        break;
      }
    } finally {
      flushingRef.current = false;
      refreshLeaderboard(true);
    }
  }, [applyCloudStats, guestId, refreshLeaderboard, syncIdentity]);

  useEffect(() => {
    refreshDynamicQuestions();
    fetchLatestVideo().then((v) => setLatestVideo(v));
    fetchBotOverrides().then((ov) => setBotOverrides(ov));

    const initCloud = async () => {
      const current = loadProfile();
      await syncIdentity(current);
      if (loadQueue().length === 0 && current.name) {
        const stats = await getMyStats(guestId);
        if (stats) applyCloudStats(stats, true);
      }
      await flushQueue();
      await refreshLeaderboard(true);
    };

    initCloud();

    const onOnline = () => {
      setIsOffline(false);
      flushQueue();
      refreshDynamicQuestions();
      fetchLatestVideo().then((v) => setLatestVideo(v));
      fetchBotOverrides().then((ov) => setBotOverrides(ov));
    };
    const onOffline = () => setIsOffline(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    };
  }, [applyCloudStats, flushQueue, guestId, refreshDynamicQuestions, refreshLeaderboard, syncIdentity]);

  const finishQuiz = useCallback(
    (active: ActiveQuizState) => {
      if (active.done) return;

      const score = calculateQuizScore(active.qs, active.sel, active.L);
      const prevXp = impersonated ? impersonated.profile.xp : loadProfile().xp;
      const nextXpEst = Math.max(0, prevXp + score.xp);
      const reachedMilestone = getCrossedXpMilestone(prevXp, nextXpEst);
      const unlocked500 = prevXp < 500 && nextXpEst >= 500;

      if (reachedMilestone !== null) {
        playMilestoneSound();
        launchMilestoneConfetti(reachedMilestone);
      } else {
        playQuizCompleteSound(score.c, score.w);
      }

      recordTap(
        "Finish Quiz",
        `${active.k.toUpperCase()} (${LEVELS[active.L]}) · ${score.c}/${score.n} right, ${score.w} wrong (${score.xp >= 0 ? "+" : ""}${score.xp} XP)`,
        "quiz"
      );

      if (impersonated) {
        setImpersonated((prev) => {
          if (!prev) return prev;
          const today = todayUTC(0);
          const prevTodayXp = prev.profile.td?.d === today ? prev.profile.td.xp : 0;
          return {
            ...prev,
            profile: {
              ...prev.profile,
              xp: Math.max(0, prev.profile.xp + score.xp),
              quizzes: prev.profile.quizzes + 1,
              perfect: prev.profile.perfect + (score.c === score.n ? 1 : 0),
              td: { d: today, xp: Math.max(0, prevTodayXp + score.xp) },
            },
          };
        });
      } else {
        setProfile((prev) => {
          const today = todayUTC(0);
          const yesterday = todayUTC(1);
          const nextStreak = prev.last === today ? prev.streak : prev.last === yesterday ? prev.streak + 1 : 1;
          const prevTodayXp = prev.td?.d === today ? prev.td.xp : 0;
          const nextXp = Math.max(0, prev.xp + score.xp);
          const nextTodayXp = Math.max(0, prevTodayXp + score.xp);

          const updated: StudentProfile = {
            ...prev,
            xp: nextXp,
            streak: nextStreak,
            last: today,
            quizzes: prev.quizzes + 1,
            perfect: prev.perfect + (score.c === score.n ? 1 : 0),
            td: { d: today, xp: nextTodayXp },
          };
          saveProfile(updated);
          return updated;
        });

        const queue = loadQueue();
        queue.push({ k: active.k, L: active.L, t: score.n, c: score.c });
        saveQueue(queue);
        flushQueue();
      }

      setQuiz({
        ...active,
        done: true,
        res: {
          ...score,
          up: unlocked500,
          milestoneXp: reachedMilestone,
        },
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [flushQueue, impersonated, recordTap]
  );

  useEffect(() => {
    if (view !== "quiz" || !quiz || quiz.done) return;
    const timer = window.setInterval(() => {
      setQuiz((prev) => {
        if (!prev || prev.done) return prev;
        const nextT = prev.t - 1;
        if (nextT <= 0) {
          window.setTimeout(() => finishQuiz({ ...prev, t: 0 }), 0);
          return { ...prev, t: 0 };
        }
        return { ...prev, t: nextT };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [view, quiz?.done, finishQuiz]);

  const navigate = (nextView: AppRoute) => {
    if (!effectiveProfile.name && nextView !== "admin") {
      setView("gate");
      return;
    }
    recordTap("Navigate", `Opened ${nextView}`, nextView);
    setQuiz(null);
    setView(nextView);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (nextView === "rank") refreshLeaderboard(false);
  };

  const openSubjectConfig = (key: QuizKey) => {
    recordTap("Select Subject", `Subject: ${key}`, "subs");
    setConfigKey(key);
    setConfigLevel(1);
    setConfigLength(10);
    setView("sub");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startQuiz = (k = configKey, L = configLevel, N = configLength) => {
    const qs = buildQuizSet(k, L, N, mergedBank);
    if (qs.length === 0) return;
    recordTap("Start Quiz", `${k.toUpperCase()} · ${LEVELS[L]} · ${N} Qs`, "quiz");
    const minutes = QUIZ_LENGTHS[N] ?? 2;
    setQuiz({
      k,
      L,
      N: qs.length,
      qs,
      i: 0,
      sel: Array(qs.length).fill(undefined),
      t: minutes * 60,
      done: false,
    });
    setView("quiz");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCompleteOnboarding = (name: string) => {
    const next: StudentProfile = {
      ...profile,
      name,
      nameAt: Date.now(),
    };
    setProfile(next);
    saveProfile(next);
    syncIdentity(next);
    logCandidateTap(guestId, name, "Joined", "Entered candidate name", "gate");
    setView("home");
  };

  const handleOpenCandidateId = useCallback(
    (target: {
      guestUuid: string;
      name: string;
      xp: number;
      todayXp: number;
      streak: number;
      quizzes: number;
      perfect: number;
      botOriginalName?: string;
    }) => {
      const previewProfile: StudentProfile = {
        name: target.name,
        xp: target.xp,
        streak: target.streak,
        last: todayUTC(0),
        quizzes: target.quizzes,
        perfect: target.perfect,
        theme: profile.theme,
        td: { d: todayUTC(0), xp: target.todayXp },
      };
      setImpersonated({
        guestUuid: target.guestUuid,
        profile: previewProfile,
        botOriginalName: target.botOriginalName,
      });
      setQuiz(null);
      setView("home");
      window.scrollTo({ top: 0, behavior: "smooth" });
      refreshLeaderboard(true, target.guestUuid);
    },
    [profile.theme, refreshLeaderboard]
  );

  const handleUpdateName = (name: string) => {
    if (impersonated) {
      setImpersonated((prev) => (prev ? { ...prev, profile: { ...prev.profile, name } } : prev));
      return;
    }
    const next: StudentProfile = {
      ...profile,
      name,
      nameAt: Date.now(),
    };
    setProfile(next);
    saveProfile(next);
    syncIdentity(next);
    recordTap("Profile Update", `Renamed to ${name}`, "me");
  };

  const handleToggleTheme = () => {
    const nextTheme = isDark ? "light" : "dark";
    const next: StudentProfile = { ...profile, theme: nextTheme };
    setProfile(next);
    saveProfile(next);
    recordTap("Theme Toggle", `Switched to ${nextTheme}`, "me");
  };

  // Unified All-Time & Today Leaderboards (150 Indian bots + live Supabase students, zero distinction)
  const { allTimeEntries, todayEntries } = useMemo(() => {
    const myToday = effectiveProfile.td?.d === todayUTC(0) ? effectiveProfile.td.xp : 0;

    const resolvedBots = BENCHMARK_PLAYERS.filter((b) => b.name !== impersonated?.botOriginalName).map((b) => {
      const ov = botOverrides[b.name];
      return {
        name: ov?.name ?? b.name,
        xp: ov?.xp ?? b.xp,
        todayXp: ov?.todayXp ?? b.todayXp,
      };
    });

    const allList: RankEntry[] = [
      ...resolvedBots.map((b) => ({ name: b.name, xp: b.xp, isMe: false })),
      ...livePlayers.map((l) => ({ name: l.name, xp: l.xp || 0, isMe: false })),
      { name: effectiveProfile.name || "You", xp: effectiveProfile.xp, isMe: true },
    ].sort((a, b) => b.xp - a.xp);

    const tdList: RankEntry[] = [
      ...resolvedBots
        .filter((b) => b.todayXp > 0)
        .map((b) => ({ name: b.name, xp: b.todayXp, isMe: false })),
      ...livePlayers
        .filter((l) => (l.today_xp || 0) > 0)
        .map((l) => ({ name: l.name, xp: l.today_xp || 0, isMe: false })),
      { name: effectiveProfile.name || "You", xp: myToday, isMe: true },
    ].sort((a, b) => b.xp - a.xp);

    return { allTimeEntries: allList, todayEntries: tdList };
  }, [botOverrides, effectiveProfile.name, effectiveProfile.td, effectiveProfile.xp, impersonated?.botOriginalName, livePlayers]);

  const hideHeader = view === "quiz" || view === "admin";
  const hideNav = view === "quiz" || view === "gate" || view === "admin";

  return (
    <div className="min-h-screen relative flex flex-col">
      <div className="amay-bg-mesh" aria-hidden="true" />

      <div className="relative z-10 flex-1 flex flex-col">
        {impersonated && view !== "admin" && (
          <div className="sticky top-0 z-40 bg-[#0B1B4D] text-white text-xs font-bold px-4 py-2 flex items-center justify-between gap-2 shadow-md">
            <span className="truncate">
              Viewing ID: <strong>{impersonated.profile.name}</strong> ({impersonated.profile.xp.toLocaleString()} XP)
              {impersonated.botOriginalName ? " · Roster" : ""}
            </span>
            <button
              type="button"
              onClick={() => {
                setImpersonated(null);
                setQuiz(null);
                setView("admin");
                refreshLeaderboard(true, guestId);
              }}
              className="shrink-0 px-3 py-1 rounded-lg bg-white text-[#0B1B4D] font-extrabold text-[11px] cursor-pointer"
            >
              ← Back to Admin
            </button>
          </div>
        )}

        {isOffline && (
          <div className="bg-amber-500 text-slate-950 text-xs font-bold text-center py-1.5 px-4">
            Offline mode · Quizzes work offline and XP syncs automatically when reconnected.
          </div>
        )}

        {!hideHeader && (
          <Header
            onNavigateHome={() => navigate("home")}
            showInstallButton={!isInstalled}
            onInstallClick={handleInstallClick}
          />
        )}

        <main
          className={`w-full mx-auto px-4 pt-4 ${
            view === "admin" ? "max-w-5xl pb-12" : `max-w-[560px] ${hideNav ? "pb-10" : "pb-32"}`
          }`}
        >
          {view === "gate" && <GateView onComplete={handleCompleteOnboarding} />}

          {view === "home" && (
            <HomeView
              profile={effectiveProfile}
              allTimeEntries={allTimeEntries}
              todayEntries={todayEntries}
              latestVideo={latestVideo}
              onStartNormalQuiz={() => openSubjectConfig("mix")}
              onOpenSubjects={() => navigate("subs")}
              onOpenRank={() => navigate("rank")}
              onOpenBadge={() => {
                recordTap("Open Badge", "Opened shareable badge", "home");
                setShowBadgeModal(true);
              }}
            />
          )}

          {view === "subs" && <SubjectsGridView onSelectSubject={openSubjectConfig} />}

          {view === "sub" && (
            <SubjectConfigView
              subjectKey={configKey}
              level={configLevel}
              length={configLength}
              mergedBank={mergedBank}
              onChangeLevel={(lvl) => {
                setConfigLevel(lvl);
                recordTap("Select Level", LEVELS[lvl], "sub");
              }}
              onChangeLength={(len) => {
                setConfigLength(len);
                recordTap("Select Length", `${len} questions`, "sub");
              }}
              onBack={() => navigate(configKey === "mix" ? "home" : "subs")}
              onStart={() => startQuiz()}
            />
          )}

          {view === "quiz" && quiz && (
            <QuizView
              quiz={quiz}
              profile={effectiveProfile}
              onSelectOption={(optIdx) => {
                playSelectTapSound();
                recordTap(
                  "Answer Tap",
                  optIdx === undefined ? `Q${quiz.i + 1}: cleared choice` : `Q${quiz.i + 1}: tapped ${"ABCD"[optIdx]}`,
                  "quiz"
                );
                setQuiz((prev) => {
                  if (!prev || prev.done) return prev;
                  const nextSel = [...prev.sel];
                  nextSel[prev.i] = optIdx;
                  return { ...prev, sel: nextSel };
                });
              }}
              onGoToQuestion={(idx) =>
                setQuiz((prev) => {
                  if (!prev || prev.done) return prev;
                  const bounded = Math.max(0, Math.min(prev.qs.length - 1, idx));
                  return { ...prev, i: bounded };
                })
              }
              onFinish={() => quiz && finishQuiz(quiz)}
              onQuit={() => {
                recordTap("Quit Quiz", `Left Q${quiz.i + 1}/${quiz.qs.length}`, "quiz");
                navigate("home");
              }}
              onRetry={() => startQuiz(quiz.k, quiz.L, quiz.N)}
              onChangeSetup={() => openSubjectConfig(quiz.k)}
              onOpenRank={() => navigate("rank")}
              onOpenBadge={() => setShowBadgeModal(true)}
            />
          )}

          {view === "rank" && (
            <RankView allTimeEntries={allTimeEntries} todayEntries={todayEntries} />
          )}

          {view === "me" && (
            <ProfileView
              profile={effectiveProfile}
              isDark={isDark}
              onToggleTheme={handleToggleTheme}
              onUpdateName={handleUpdateName}
              onOpenBadge={() => {
                recordTap("Open Badge", "Opened shareable badge", "me");
                setShowBadgeModal(true);
              }}
            />
          )}

          {view === "admin" && (
            <AdminView
              onBack={() => {
                if (window.location.hash === "#admin") {
                  window.history.replaceState(null, "", window.location.pathname);
                }
                setImpersonated(null);
                setView(profile.name ? "home" : "gate");
              }}
              onQuestionsChanged={refreshDynamicQuestions}
              onBotsChanged={(ov) => setBotOverrides(ov)}
              onLatestVideoChanged={(v) => setLatestVideo(v)}
              onOpenCandidateId={handleOpenCandidateId}
            />
          )}
        </main>
      </div>

      {!hideNav && <BottomNav activeView={view} onNavigate={navigate} />}

      {showBadgeModal && (
        <BadgeModal
          xp={effectiveProfile.xp}
          name={effectiveProfile.name}
          onClose={() => setShowBadgeModal(false)}
        />
      )}

      {showInstallModal && !isInstalled && (
        <PWAInstallModal
          canNativeInstall={canNativeInstall}
          isIOS={isIOS}
          onInstall={async () => {
            const outcome = await install();
            if (outcome === "accepted") {
              setShowInstallModal(false);
            }
          }}
          onClose={() => setShowInstallModal(false)}
        />
      )}
    </div>
  );
}
