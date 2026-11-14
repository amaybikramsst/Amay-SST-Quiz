import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminView, loadBotOverrides, type BotOverride } from "./components/AdminView";
import { BadgeModal } from "./components/BadgeModal";
import { BottomNav } from "./components/BottomNav";
import { GateView } from "./components/GateView";
import { Header, type AppRoute } from "./components/Header";
import { HomeView } from "./components/HomeView";
import { ProfileView } from "./components/ProfileView";
import { QuizView } from "./components/QuizView";
import { RankView, type RankEntry } from "./components/RankView";
import { SubjectConfigView, SubjectsGridView } from "./components/SubjectsView";
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
import {
  fetchDynamicQuestions,
  getLeaderboard,
  getMyStats,
  logCandidateTap,
  registerPlayer,
  submitQuizAttempt,
  type CloudStats,
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
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== "undefined" ? !navigator.onLine : false));

  const [configKey, setConfigKey] = useState<QuizKey>("mix");
  const [configLevel, setConfigLevel] = useState<number>(1);
  const [configLength, setConfigLength] = useState<number>(10);

  const [quiz, setQuiz] = useState<ActiveQuizState | null>(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);

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
      const name = loadProfile().name;
      if (!name) return;
      logCandidateTap(guestId, name, action, detail, screen);
    },
    [guestId]
  );

  // Sync cloud stats without overwriting client-side 1/4 negative-marked XP,
  // while still honoring admin manual XP edits from Supabase!
  const applyCloudStats = useCallback((stats: CloudStats, fromAdminCheck = false) => {
    if (loadQueue().length > 0) return;
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
  }, []);

  const refreshDynamicQuestions = useCallback(async () => {
    const rows = await fetchDynamicQuestions();
    setMergedBank(mergeDynamicQuestions(rows));
  }, []);

  const refreshLeaderboard = useCallback(
    async (force = false) => {
      if (!force && Date.now() - lastLeaderboardFetchRef.current < 15000) return;
      lastLeaderboardFetchRef.current = Date.now();
      const rows = await getLeaderboard(guestId);
      if (rows) {
        setLivePlayers(rows);
      }
    },
    [guestId]
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

      recordTap(
        "Finish Quiz",
        `${active.k.toUpperCase()} (${LEVELS[active.L]}) · ${score.c}/${score.n} right, ${score.w} wrong (${score.xp >= 0 ? "+" : ""}${score.xp} XP)`,
        "quiz"
      );

      let unlocked500 = false;
      setProfile((prev) => {
        const today = todayUTC(0);
        const yesterday = todayUTC(1);
        const nextStreak = prev.last === today ? prev.streak : prev.last === yesterday ? prev.streak + 1 : 1;
        const prevTodayXp = prev.td?.d === today ? prev.td.xp : 0;
        const nextXp = Math.max(0, prev.xp + score.xp);
        const nextTodayXp = Math.max(0, prevTodayXp + score.xp);
        unlocked500 = prev.xp < 500 && nextXp >= 500;

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

      setQuiz({
        ...active,
        done: true,
        res: {
          ...score,
          up: unlocked500,
        },
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [flushQueue, recordTap]
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
    if (!profile.name && nextView !== "admin") {
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

  const handleUpdateName = (name: string) => {
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
    const myToday = profile.td?.d === todayUTC(0) ? profile.td.xp : 0;

    const resolvedBots = BENCHMARK_PLAYERS.map((b) => {
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
      { name: profile.name || "You", xp: profile.xp, isMe: true },
    ].sort((a, b) => b.xp - a.xp);

    const tdList: RankEntry[] = [
      ...resolvedBots
        .filter((b) => b.todayXp > 0)
        .map((b) => ({ name: b.name, xp: b.todayXp, isMe: false })),
      ...livePlayers
        .filter((l) => (l.today_xp || 0) > 0)
        .map((l) => ({ name: l.name, xp: l.today_xp || 0, isMe: false })),
      { name: profile.name || "You", xp: myToday, isMe: true },
    ].sort((a, b) => b.xp - a.xp);

    return { allTimeEntries: allList, todayEntries: tdList };
  }, [botOverrides, livePlayers, profile.name, profile.td, profile.xp]);

  const hideHeader = view === "quiz" || view === "admin";
  const hideNav = view === "quiz" || view === "gate" || view === "admin";

  return (
    <div className="min-h-screen relative flex flex-col">
      <div className="amay-bg-mesh" aria-hidden="true" />

      <div className="relative z-10 flex-1 flex flex-col">
        {isOffline && (
          <div className="bg-amber-500 text-slate-950 text-xs font-bold text-center py-1.5 px-4">
            Offline mode · Quizzes work offline and XP syncs automatically when reconnected.
          </div>
        )}

        {!hideHeader && <Header onNavigateHome={() => navigate("home")} />}

        <main
          className={`w-full mx-auto px-4 pt-4 ${
            view === "admin" ? "max-w-5xl pb-12" : `max-w-[560px] ${hideNav ? "pb-10" : "pb-32"}`
          }`}
        >
          {view === "gate" && <GateView onComplete={handleCompleteOnboarding} />}

          {view === "home" && (
            <HomeView
              profile={profile}
              allTimeEntries={allTimeEntries}
              todayEntries={todayEntries}
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
              profile={profile}
              onSelectOption={(optIdx) => {
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
              profile={profile}
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
                setView(profile.name ? "home" : "gate");
              }}
              onQuestionsChanged={refreshDynamicQuestions}
              onBotsChanged={() => setBotOverrides(loadBotOverrides())}
            />
          )}
        </main>
      </div>

      {!hideNav && <BottomNav activeView={view} onNavigate={navigate} />}

      {showBadgeModal && (
        <BadgeModal
          xp={profile.xp}
          name={profile.name}
          onClose={() => setShowBadgeModal(false)}
        />
      )}
    </div>
  );
}
