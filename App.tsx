import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminView } from "./components/AdminView";
import { BadgeModal } from "./components/BadgeModal";
import { BottomNav } from "./components/BottomNav";
import { ChatView } from "./components/ChatView";
import { GateView } from "./components/GateView";
import { Header, type AppRoute } from "./components/Header";
import { HomeView } from "./components/HomeView";
import { LaunchSplash } from "./components/LaunchSplash";
import { NotificationInboxModal, NotificationPopupModal } from "./components/NotificationModal";
import { ProfileView } from "./components/ProfileView";
import { PWAInstallModal } from "./components/PWAInstallModal";
import { QuizView } from "./components/QuizView";
import { RankView, type RankEntry } from "./components/RankView";
import { SubjectConfigView, SubjectsGridView } from "./components/SubjectsView";
import { usePWAInstall } from "./hooks/usePWAInstall";
import { type QuizKey, type RawQuestion, type SubjectKey } from "./data/questions";
import { resolveBotRoster } from "./lib/botSimulator";
import type { BadgeDesignSpec } from "./lib/badgeCanvas";
import {
  BLITZ_SECONDS,
  buildBlitzQuizSet,
  buildQuizSet,
  calculateBlitzScore,
  calculateQuizScore,
  clearProfileSession,
  consumeBattleParamFromUrl,
  generateFreshGuestUUID,
  getGuestUUID,
  getRankDifficultyRule,
  getTodayCutoffStatus,
  LEVELS,
  loadBlitzBest,
  loadProfile,
  loadQueue,
  markQuestionsSeen,
  mergeDynamicQuestions,
  QUIZ_LENGTHS,
  saveBlitzBest,
  saveProfile,
  saveQueue,
  setGuestUUID,
  todayIST,
  todayUTC,
  type ActiveQuizState,
  type BattleChallengePayload,
  type DailyBadgeRecord,
  type StudentProfile,
} from "./lib/quizEngine";
import { getCrossedXpMilestone, launchMilestoneConfetti } from "./lib/confetti";
import {
  playCorrectSound,
  playIncorrectSound,
  playMilestoneSound,
  playQuizCompleteSound,
  playSelectTapSound,
  playUiTapSound,
} from "./lib/soundEffects";
import {
  fetchBotDailyCeilings,
  fetchBotOverrides,
  fetchCandidateTodayOverrides,
  fetchDynamicQuestions,
  fetchLatestVideo,
  fetchNotifications,
  getChatDirectory,
  getLeaderboard,
  getMyChatMessages,
  getMyCredentials,
  getMyStats,
  getMyTodayIST,
  loadBotDailyCeilings,
  loadBotOverrides,
  loadCandidateTodayOverrides,
  loadLocalLatestVideo,
  loadLocalNotifications,
  logCandidateTap,
  loginWithCredentials,
  mergeBotDailyCeilingMaps,
  registerPlayer,
  registerWithCredentials,
  reportAppInstallStatus,
  reportNotificationsSeen,
  saveBotDailyCeilings,
  setMyCredentials,
  submitQuizAttempt,
  subscribeChatRealtime,
  type AppNotification,
  type BotOverride,
  type CandidateTodayOverride,
  type ChatDirectoryUser,
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
  const [guestId, setGuestId] = useState<string>(() => getGuestUUID());
  const [profile, setProfile] = useState<StudentProfile>(() => loadProfile());
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatDirectory, setChatDirectory] = useState<ChatDirectoryUser[]>([]);
  const [pendingChatPeer, setPendingChatPeer] = useState<{ uuid: string; name: string } | null>(null);
  const [pendingBattle, setPendingBattle] = useState<BattleChallengePayload | null>(() =>
    consumeBattleParamFromUrl()
  );
  const [view, setView] = useState<AppRoute>(() => {
    if (isSecretAdminUrl()) return "admin";
    const p = loadProfile();
    return p.name && p.username && p.password ? "home" : "gate";
  });
  const [showLaunchSplash, setShowLaunchSplash] = useState<boolean>(() => !isSecretAdminUrl());

  const [mergedBank, setMergedBank] = useState<Record<SubjectKey, RawQuestion[]>>(() =>
    mergeDynamicQuestions([])
  );

  const [livePlayers, setLivePlayers] = useState<LiveLeaderRow[]>([]);
  const [liveLeaderboardIstSynced, setLiveLeaderboardIstSynced] = useState(false);
  const [botOverrides, setBotOverrides] = useState<Record<string, BotOverride>>(() => loadBotOverrides());
  const [botDailyCeilings, setBotDailyCeilings] = useState<Record<string, number>>(() =>
    loadBotDailyCeilings()
  );
  const [candidateTodayOverrides, setCandidateTodayOverrides] = useState<
    Record<string, CandidateTodayOverride>
  >(() => loadCandidateTodayOverrides());
  const [botClockTick, setBotClockTick] = useState<number>(() => Date.now());
  const [latestVideo, setLatestVideo] = useState<LatestVideoConfig>(() => loadLocalLatestVideo());
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== "undefined" ? !navigator.onLine : false));

  const [configKey, setConfigKey] = useState<QuizKey>("mix");
  const [configLevel, setConfigLevel] = useState<number>(1);
  const [configLength, setConfigLength] = useState<number>(10);

  const [quiz, setQuiz] = useState<ActiveQuizState | null>(null);
  const [preQuizRank, setPreQuizRank] = useState<number | null>(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [selectedBadgeSpec, setSelectedBadgeSpec] = useState<BadgeDesignSpec | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [allNotifications, setAllNotifications] = useState<AppNotification[]>(() => loadLocalNotifications());
  const [seenNotifIds, setSeenNotifIds] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("amaysst_seen_notifs") || "[]");
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  });
  const [showNotifInbox, setShowNotifInbox] = useState(false);
  const [impersonated, setImpersonated] = useState<{
    guestUuid: string;
    profile: StudentProfile;
    botOriginalName?: string;
  } | null>(null);
  const { canNativeInstall, isInstalled, isIOS, isInAppBrowser, externalBrowserUrl, install } =
    usePWAInstall();

  const effectiveProfile = impersonated ? impersonated.profile : profile;
  const effectiveGuestId = impersonated ? impersonated.guestUuid : guestId;
  const hasCompleteAccount = Boolean(profile.name && profile.username && profile.password);

  const myNotifications = useMemo(
    () =>
      allNotifications.filter(
        (n) => n.target === "all" || (n.target === "candidate" && n.targetGuestUuid === effectiveGuestId)
      ),
    [allNotifications, effectiveGuestId]
  );

  const unreadNotifCount = useMemo(
    () => myNotifications.filter((n) => !seenNotifIds.includes(n.id)).length,
    [myNotifications, seenNotifIds]
  );

  const activePopupNotif = useMemo(() => {
    if (
      showLaunchSplash ||
      impersonated ||
      !hasCompleteAccount ||
      showNotifInbox ||
      showInstallModal ||
      showBadgeModal ||
      view === "quiz" ||
      view === "gate" ||
      view === "admin"
    ) {
      return null;
    }
    return myNotifications.find((n) => !seenNotifIds.includes(n.id)) || null;
  }, [hasCompleteAccount, impersonated, myNotifications, seenNotifIds, showBadgeModal, showInstallModal, showLaunchSplash, showNotifInbox, view]);

  const markNotifsSeen = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      setSeenNotifIds((prev) => {
        const next = Array.from(new Set([...ids, ...prev])).slice(0, 100);
        try {
          localStorage.setItem("amaysst_seen_notifs", JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
        return next;
      });
      if (!impersonated && profile.name) {
        reportNotificationsSeen(guestId, profile.name, ids);
      }
    },
    [guestId, impersonated, profile.name]
  );

  useEffect(() => {
    if (!activePopupNotif || impersonated || !profile.name) return;
    reportNotificationsSeen(guestId, profile.name, [activePopupNotif.id]);
  }, [activePopupNotif, guestId, impersonated, profile.name]);

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

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const interactive = target.closest(
        'button, a, [role="button"], select, summary, label[for]'
      ) as HTMLElement | null;
      if (!interactive) return;
      if (
        interactive.hasAttribute("disabled") ||
        interactive.getAttribute("aria-disabled") === "true" ||
        interactive.dataset.customSound === "1"
      ) {
        return;
      }
      playUiTapSound(interactive.classList.contains("amay-play-btn"));
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
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

  useEffect(() => {
    if (
      isInstalled ||
      view === "admin" ||
      view === "quiz" ||
      view === "gate" ||
      (!impersonated && !hasCompleteAccount)
    ) {
      return;
    }
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
  }, [hasCompleteAccount, impersonated, isInstalled, view]);

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

  useEffect(() => {
    if (!profile.name || impersonated) return;
    const nextVal = isInstalled ? "1" : "0";
    try {
      const prevReported = localStorage.getItem("amaysst_reported_install");
      if (prevReported === "1" && !isInstalled) return;
      if (prevReported === nextVal) return;
      localStorage.setItem("amaysst_reported_install", nextVal);
    } catch {
      // continue reporting even if localStorage is blocked
    }
    reportAppInstallStatus(guestId, profile.name, isInstalled);
  }, [guestId, impersonated, isInstalled, profile.name]);

  const applyCloudStats = useCallback(
    (
      stats: CloudStats,
      fromAdminCheck = false,
      cloudTodayIst: number | null = null,
      candTodayMap?: Record<string, CandidateTodayOverride>
    ) => {
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

      const todayKey = todayIST(0);
      const ovMap = candTodayMap ?? loadCandidateTodayOverrides();
      const myOv = ovMap[guestId];
      const adminTodayDelta = myOv && myOv.dateKey === todayKey ? myOv.delta : 0;

      setProfile((prev) => {
        let nextXp = prev.xp;
        let nextTodayXp = prev.td?.d === todayKey ? prev.td.xp : 0;

        if (fromAdminCheck) {
          if (prev.lastCloudXp === undefined) {
            nextXp = Math.max(prev.xp, stats.xp);
          } else if (stats.xp !== prev.lastCloudXp) {
            const delta = stats.xp - prev.lastCloudXp;
            nextXp = Math.max(0, prev.xp + delta);
          }
          const prevAdminDelta =
            prev.lastAdminTodayDate === todayKey ? (prev.lastAdminTodayDelta ?? 0) : 0;
          if (adminTodayDelta !== prevAdminDelta) {
            nextTodayXp = Math.max(0, nextTodayXp + (adminTodayDelta - prevAdminDelta));
          }
          if (cloudTodayIst !== null) {
            nextTodayXp = Math.max(nextTodayXp, Math.max(0, cloudTodayIst + adminTodayDelta));
          }
        }

        const next: StudentProfile = {
          ...prev,
          xp: nextXp,
          streak: Math.max(prev.streak, stats.streak),
          quizzes: Math.max(prev.quizzes, stats.quizzes),
          perfect: Math.max(prev.perfect, stats.perfect),
          td: { d: todayKey, xp: nextTodayXp },
          lastCloudXp: stats.xp,
          lastAdminTodayDate: todayKey,
          lastAdminTodayDelta: adminTodayDelta,
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
    },
    [guestId]
  );

  const refreshDynamicQuestions = useCallback(async () => {
    const rows = await fetchDynamicQuestions();
    setMergedBank(mergeDynamicQuestions(rows));
  }, []);

  const refreshLeaderboard = useCallback(
    async (force = false, guestOverride?: string) => {
      if (!force && Date.now() - lastLeaderboardFetchRef.current < 15000) return;
      lastLeaderboardFetchRef.current = Date.now();
      const res = await getLeaderboard(guestOverride ?? effectiveGuestId);
      if (res) {
        setLivePlayers(res.rows);
        setLiveLeaderboardIstSynced(res.isIstSynced);
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
    fetchBotDailyCeilings().then((c) => setBotDailyCeilings((prev) => mergeBotDailyCeilingMaps(prev, c)));
    fetchNotifications().then((list) => setAllNotifications(list));

    const initCloud = async () => {
      let current = loadProfile();
      await syncIdentity(current);

      if (current.name && (!current.username || !current.password)) {
        const credRes = await getMyCredentials(guestId);
        if (credRes.ok && credRes.has_credentials && credRes.username && credRes.password) {
          current = {
            ...current,
            username: credRes.username,
            password: credRes.password,
            name: credRes.display_name || current.name,
          };
          saveProfile(current);
          setProfile(current);
          setView((prev) => (prev === "gate" ? "home" : prev));
        }
      }

      const [candTodayMap, dirRes] = await Promise.all([
        fetchCandidateTodayOverrides(),
        getChatDirectory(guestId),
      ]);
      setCandidateTodayOverrides(candTodayMap);
      if (dirRes.users.length > 0) {
        setChatDirectory(dirRes.users);
      }
      if (loadQueue().length === 0 && current.name) {
        const [stats, todayIst] = await Promise.all([getMyStats(guestId), getMyTodayIST(guestId)]);
        if (stats) applyCloudStats(stats, true, todayIst, candTodayMap);
      }
      await flushQueue();
      await refreshLeaderboard(true);
    };

    initCloud();

    const refreshNotifs = () => {
      fetchNotifications().then((list) => setAllNotifications(list));
    };

    const pollInterval = window.setInterval(refreshNotifs, 30000);
    const botClockInterval = window.setInterval(() => setBotClockTick(Date.now()), 10000);

    const onFocusSync = () => {
      setBotClockTick(Date.now());
      refreshNotifs();
      fetchBotDailyCeilings().then((c) => setBotDailyCeilings((prev) => mergeBotDailyCeilingMaps(prev, c)));
    };

    const onOnline = () => {
      setIsOffline(false);
      setBotClockTick(Date.now());
      flushQueue();
      refreshDynamicQuestions();
      fetchLatestVideo().then((v) => setLatestVideo(v));
      fetchBotOverrides().then((ov) => setBotOverrides(ov));
      fetchBotDailyCeilings().then((c) => setBotDailyCeilings((prev) => mergeBotDailyCeilingMaps(prev, c)));
      fetchCandidateTodayOverrides().then((ov) => setCandidateTodayOverrides(ov));
      getChatDirectory(guestId).then((dirRes) => {
        if (dirRes.users.length > 0) setChatDirectory(dirRes.users);
      });
      refreshNotifs();
    };
    const onOffline = () => setIsOffline(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onFocusSync);
    return () => {
      window.clearInterval(pollInterval);
      window.clearInterval(botClockInterval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onFocusSync);
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    };
  }, [applyCloudStats, flushQueue, guestId, refreshDynamicQuestions, refreshLeaderboard, syncIdentity]);

  useEffect(() => {
    if (!effectiveProfile.name || (!impersonated && !hasCompleteAccount) || view === "admin" || view === "gate") return;

    const refreshUnreadChat = async () => {
      const res = await getMyChatMessages(effectiveGuestId);
      if (res.needsTableSetup) return;
      let readMap: Record<string, string> = {};
      try {
        readMap = JSON.parse(localStorage.getItem("amaysst_chat_read_at") || "{}") || {};
      } catch {
        readMap = {};
      }
      const unreadSenderIds = new Set<string>();
      for (const m of res.messages) {
        if (m.sender_uuid === effectiveGuestId) continue;
        const lastReadIso = readMap[m.sender_uuid];
        if (!lastReadIso || Date.parse(m.created_at) > Date.parse(lastReadIso)) {
          unreadSenderIds.add(m.sender_uuid);
        }
      }
      setUnreadChatCount(unreadSenderIds.size);
    };

    refreshUnreadChat();
    const unsub = subscribeChatRealtime((signal) => {
      const s = String(signal.sender_uuid || "");
      const r = String(signal.recipient_uuid || "");
      const g = String(signal.guest_uuid || "");
      const o = String(signal.other_uuid || "");
      if (
        (!s && !r && !g) ||
        s === effectiveGuestId ||
        r === effectiveGuestId ||
        g === effectiveGuestId ||
        o === effectiveGuestId
      ) {
        refreshUnreadChat();
      }
    });
    return () => {
      unsub();
    };
  }, [effectiveGuestId, effectiveProfile.name, view, hasCompleteAccount, impersonated]);

  const finishQuiz = useCallback(
    (active: ActiveQuizState) => {
      if (active.done) return;

      const isBlitz = active.mode === "blitz";
      const isBattle = active.mode === "battle";
      const bestCombo = Math.max(active.bestCombo ?? 0, active.comboStreak ?? 0);

      const baseScore = isBlitz
        ? calculateBlitzScore(active.qs, active.sel, bestCombo)
        : calculateQuizScore(active.qs, active.sel, active.L);

      let isNewBlitzBest = false;
      if (isBlitz) {
        const prevBest = loadBlitzBest();
        if (baseScore.c > prevBest.correct || (baseScore.c === prevBest.correct && bestCombo > prevBest.streak)) {
          isNewBlitzBest = true;
          saveBlitzBest({
            score: Math.max(prevBest.score, baseScore.xp),
            correct: baseScore.c,
            streak: Math.max(prevBest.streak, bestCombo),
          });
        }
      }

      const elapsedSec = active.startedAtMs
        ? Math.max(1, Math.min(300, Math.round((Date.now() - active.startedAtMs) / 1000)))
        : isBlitz
          ? BLITZ_SECONDS
          : 60;

      const prevXp = impersonated ? impersonated.profile.xp : loadProfile().xp;
      const nextXpEst = Math.max(0, prevXp + baseScore.xp);
      const reachedMilestone = getCrossedXpMilestone(prevXp, nextXpEst);
      const unlockedFirstBadge = prevXp < 100 && nextXpEst >= 100;

      if (reachedMilestone !== null) {
        playMilestoneSound();
        launchMilestoneConfetti(reachedMilestone);
      } else {
        playQuizCompleteSound(baseScore.c, baseScore.w);
      }

      recordTap(
        "Finish Quiz",
        `${isBlitz ? "BLITZ" : isBattle ? "BATTLE" : active.k.toUpperCase()} (${LEVELS[active.L]}) · ${baseScore.c}/${baseScore.n} right (${baseScore.xp >= 0 ? "+" : ""}${baseScore.xp} XP)`,
        "quiz"
      );

      if (impersonated) {
        setImpersonated((prev) => {
          if (!prev) return prev;
          const today = todayIST(0);
          const prevTodayXp = prev.profile.td?.d === today ? prev.profile.td.xp : 0;
          return {
            ...prev,
            profile: {
              ...prev.profile,
              xp: Math.max(0, prev.profile.xp + baseScore.xp),
              quizzes: prev.profile.quizzes + 1,
              perfect: prev.profile.perfect + (!isBlitz && baseScore.c === baseScore.n ? 1 : 0),
              td: { d: today, xp: Math.max(0, prevTodayXp + baseScore.xp) },
            },
          };
        });
      } else {
        setProfile((prev) => {
          const today = todayIST(0);
          const yesterday = todayIST(1);
          const nextStreak = prev.last === today ? prev.streak : prev.last === yesterday ? prev.streak + 1 : 1;
          const prevTodayXp = prev.td?.d === today ? prev.td.xp : 0;
          const nextXp = Math.max(0, prev.xp + baseScore.xp);
          const nextTodayXp = Math.max(0, prevTodayXp + baseScore.xp);

          const updated: StudentProfile = {
            ...prev,
            xp: nextXp,
            streak: nextStreak,
            last: today,
            quizzes: prev.quizzes + 1,
            perfect: prev.perfect + (!isBlitz && baseScore.c === baseScore.n ? 1 : 0),
            td: { d: today, xp: nextTodayXp },
          };
          saveProfile(updated);
          return updated;
        });

        const queue = loadQueue();
        queue.push({
          k: isBlitz ? "mix" : active.k,
          L: active.L,
          t: Math.max(1, baseScore.n),
          c: Math.max(0, baseScore.c),
        });
        saveQueue(queue);
        flushQueue();
      }

      setQuiz({
        ...active,
        done: true,
        res: {
          ...baseScore,
          up: unlockedFirstBadge,
          milestoneXp: reachedMilestone,
          mode: active.mode ?? "normal",
          timeTakenSec: elapsedSec,
          bestStreak: bestCombo,
          isNewBlitzBest,
          battleOpponent: active.battleMeta
            ? {
                name: active.battleMeta.challengerName,
                correct: active.battleMeta.challengerCorrect,
                total: active.battleMeta.challengerTotal,
                secondsTaken: active.battleMeta.challengerSecondsTaken,
              }
            : undefined,
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
    if (!impersonated && !hasCompleteAccount && nextView !== "admin") {
      setView("gate");
      return;
    }
    recordTap("Navigate", `Opened ${nextView}`, nextView);
    setQuiz(null);
    setView(nextView);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (nextView === "rank" || nextView === "chat") {
      if (nextView === "rank") refreshLeaderboard(false);
      getChatDirectory(effectiveGuestId).then((dirRes) => {
        if (dirRes.users.length > 0) setChatDirectory(dirRes.users);
      });
    }
  };

  const handleRegister = async (payload: {
    name: string;
    username: string;
    password: string;
  }): Promise<string | null> => {
    const activeId = guestId || generateFreshGuestUUID();
    const res = await registerWithCredentials(activeId, payload.name, payload.username, payload.password);
    if (!res.ok) {
      return res.error || "Could not create account.";
    }
    const assignedId = res.guest_uuid || activeId;
    if (assignedId !== guestId) {
      setGuestUUID(assignedId);
      setGuestId(assignedId);
    }
    const next: StudentProfile = {
      ...profile,
      name: res.display_name || payload.name.trim(),
      username: res.username || payload.username.trim().toLowerCase(),
      password: res.password || payload.password,
      nameAt: Date.now(),
    };
    setProfile(next);
    saveProfile(next);
    lastSyncedNameRef.current = next.name;
    logCandidateTap(assignedId, next.name, "Joined", `Registered @${next.username}`, "gate");
    setView("home");
    refreshLeaderboard(true, assignedId);
    getChatDirectory(assignedId).then((dirRes) => {
      if (dirRes.users.length > 0) setChatDirectory(dirRes.users);
    });
    return null;
  };

  const handleClaimExistingCredentials = async (payload: {
    name: string;
    username: string;
    password: string;
  }): Promise<string | null> => {
    const existingName = profile.name?.trim();
    if (!existingName) {
      return "Candidate name is missing. Please sign up as a new account.";
    }
    const msLeft = Math.max(0, (profile.nameAt || 0) + 864e5 - Date.now());
    const requestedName = payload.name.trim();
    const targetName = msLeft > 0 || requestedName.length < 2 ? existingName : requestedName;
    const nameChanged = targetName !== existingName;

    let res = await setMyCredentials(guestId, payload.username, payload.password, targetName);
    if (!res.ok && /not found|no candidate|does not exist/i.test(res.error || "")) {
      res = await registerWithCredentials(guestId, targetName, payload.username, payload.password);
    }
    if (!res.ok) {
      return res.error || "Could not save username and password.";
    }
    const next: StudentProfile = {
      ...profile,
      name: res.display_name || targetName,
      nameAt: nameChanged ? Date.now() : profile.nameAt,
      username: res.username || payload.username.trim().toLowerCase(),
      password: res.password || payload.password,
    };
    setProfile(next);
    saveProfile(next);
    lastSyncedNameRef.current = next.name;
    logCandidateTap(guestId, next.name, "Account Setup", `Claimed @${next.username}`, "gate");
    setView("home");
    refreshLeaderboard(true, guestId);
    getChatDirectory(guestId).then((dirRes) => {
      if (dirRes.users.length > 0) setChatDirectory(dirRes.users);
    });
    return null;
  };

  const handleLogin = async (payload: {
    username: string;
    password: string;
  }): Promise<string | null> => {
    const res = await loginWithCredentials(payload.username, payload.password);
    if (!res.ok || !res.guest_uuid) {
      return res.error || "Invalid username or password.";
    }

    const signedId = res.guest_uuid;
    setGuestUUID(signedId);
    saveQueue([]);

    const [stats, todayIst, candTodayMap, dirRes] = await Promise.all([
      getMyStats(signedId),
      getMyTodayIST(signedId),
      fetchCandidateTodayOverrides(),
      getChatDirectory(signedId),
    ]);
    setCandidateTodayOverrides(candTodayMap);
    if (dirRes.users.length > 0) {
      setChatDirectory(dirRes.users);
    }

    const todayKey = todayIST(0);
    const myOv = candTodayMap[signedId];
    const adminTodayDelta = myOv && myOv.dateKey === todayKey ? myOv.delta : 0;
    const baseToday = todayIst ?? stats?.today_xp ?? 0;
    const resolvedToday = Math.max(0, baseToday + adminTodayDelta);
    const resolvedXp = Math.max(0, stats?.xp ?? res.xp ?? 0);

    const next: StudentProfile = {
      name: res.display_name || payload.username,
      username: res.username || payload.username.trim().toLowerCase(),
      password: res.password || payload.password,
      xp: resolvedXp,
      streak: stats?.streak ?? res.streak ?? 0,
      last: todayKey,
      quizzes: stats?.quizzes ?? res.quizzes_count ?? 0,
      perfect: stats?.perfect ?? res.perfect_count ?? 0,
      theme: profile.theme,
      td: { d: todayKey, xp: resolvedToday },
      lastCloudXp: resolvedXp,
      lastAdminTodayDate: todayKey,
      lastAdminTodayDelta: adminTodayDelta,
      earnedDailyBadges: [],
    };
    saveProfile(next);
    setProfile(next);
    setGuestId(signedId);
    lastSyncedNameRef.current = next.name;
    logCandidateTap(signedId, next.name, "Signed In", `Logged in as @${next.username}`, "gate");
    setView("home");
    refreshLeaderboard(true, signedId);
    return null;
  };

  const handleSetCredentials = async (username: string, password: string): Promise<string | null> => {
    const res = await setMyCredentials(guestId, username, password);
    if (!res.ok) {
      return res.error || "Could not save username and password.";
    }
    const next: StudentProfile = {
      ...profile,
      username: res.username || username.trim().toLowerCase(),
      password: res.password || password,
    };
    setProfile(next);
    saveProfile(next);
    recordTap("Account Setup", `Claimed permanent username @${next.username}`, "me");
    return null;
  };

  const handleSignOut = () => {
    const freshId = clearProfileSession();
    lastSyncedNameRef.current = "";
    setImpersonated(null);
    setPendingChatPeer(null);
    setQuiz(null);
    setUnreadChatCount(0);
    setGuestId(freshId);
    setProfile(loadProfile());
    setView("gate");
  };

  const handleOpenCandidateId = useCallback(
    (target: {
      guestUuid: string;
      name: string;
      username?: string | null;
      password?: string | null;
      xp: number;
      todayXp: number;
      streak: number;
      quizzes: number;
      perfect: number;
      botOriginalName?: string;
    }) => {
      const previewProfile: StudentProfile = {
        name: target.name,
        username: target.username ?? undefined,
        password: target.password ?? undefined,
        xp: target.xp,
        streak: target.streak,
        last: todayIST(0),
        quizzes: target.quizzes,
        perfect: target.perfect,
        theme: profile.theme,
        td: { d: todayIST(0), xp: target.todayXp },
      };
      setImpersonated({
        guestUuid: target.guestUuid,
        profile: previewProfile,
        botOriginalName: target.botOriginalName,
      });
      setPendingChatPeer(null);
      setQuiz(null);
      setView("home");
      window.scrollTo({ top: 0, behavior: "smooth" });
      refreshLeaderboard(true, target.guestUuid);
      getChatDirectory(target.guestUuid).then((dirRes) => {
        if (dirRes.users.length > 0) setChatDirectory(dirRes.users);
      });
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

  const { allTimeEntries, todayEntries, botChatDirectory, botRosterDateKey, botLiveCeiling } = useMemo(() => {
    void botClockTick;
    const todayKeyIst = todayIST(0);
    const myToday = effectiveProfile.td?.d === todayKeyIst ? effectiveProfile.td.xp : 0;

    const adminTodayDeltaByName = new Map<string, number>();
    for (const [id, ov] of Object.entries(candidateTodayOverrides)) {
      if (id === effectiveGuestId) continue;
      if (ov?.dateKey === todayKeyIst && ov.name) {
        const key = ov.name.trim().toLowerCase();
        adminTodayDeltaByName.set(key, (adminTodayDeltaByName.get(key) || 0) + (ov.delta || 0));
      }
    }

    const isUtcMismatchWindow = !liveLeaderboardIstSynced && todayKeyIst !== todayUTC(0);
    const resolvedLivePlayers = livePlayers.map((l) => {
      const baseToday = isUtcMismatchWindow ? 0 : Math.max(0, l.today_xp || 0);
      const adminDelta = adminTodayDeltaByName.get((l.name || "").trim().toLowerCase()) || 0;
      return {
        name: l.name,
        xp: l.xp || 0,
        todayXp: Math.max(0, baseToday + adminDelta),
      };
    });

    const realTodayScores = [myToday, ...resolvedLivePlayers.map((l) => l.todayXp)];
    const {
      bots,
      clock: botRosterClock,
      competitionCeiling: botLiveCeil,
    } = resolveBotRoster(botOverrides, realTodayScores, botClockTick, botDailyCeilings);
    const resolvedBots = bots.filter((b) => b.originalName !== impersonated?.botOriginalName);

    const sortWithMePriority = (a: RankEntry, b: RankEntry) => {
      if (b.xp !== a.xp) return b.xp - a.xp;
      if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
      return 0;
    };

    const chatDirUuidByName = new Map<string, string>();
    for (const u of chatDirectory) {
      if (u.guest_uuid && u.display_name) {
        chatDirUuidByName.set(u.display_name.trim().toLowerCase(), u.guest_uuid);
      }
    }

    const botDirList: ChatDirectoryUser[] = resolvedBots.map((b) => ({
      guest_uuid: `bot_${b.originalName}`,
      display_name: b.name,
      xp: b.xp,
    }));

    const allList: RankEntry[] = [
      ...resolvedBots.map((b) => ({ name: b.name, xp: b.xp, isMe: false, peerUuid: `bot_${b.originalName}` })),
      ...resolvedLivePlayers.map((l) => ({
        name: l.name,
        xp: l.xp,
        isMe: false,
        peerUuid: chatDirUuidByName.get((l.name || "").trim().toLowerCase()),
      })),
      { name: effectiveProfile.name || "You", xp: effectiveProfile.xp, isMe: true },
    ].sort(sortWithMePriority);

    const sortedBotsByToday = [...resolvedBots].sort((a, b) => b.todayXp - a.todayXp || b.xp - a.xp);
    const tdList: RankEntry[] = [
      ...sortedBotsByToday.map((b) => ({
        name: b.name,
        xp: b.todayXp,
        isMe: false,
        peerUuid: `bot_${b.originalName}`,
      })),
      ...resolvedLivePlayers.map((l) => ({
        name: l.name,
        xp: l.todayXp,
        isMe: false,
        peerUuid: chatDirUuidByName.get((l.name || "").trim().toLowerCase()),
      })),
      { name: effectiveProfile.name || "You", xp: myToday, isMe: true },
    ].sort(sortWithMePriority);

    return {
      allTimeEntries: allList,
      todayEntries: tdList,
      botChatDirectory: botDirList,
      botRosterDateKey: botRosterClock.dateKey,
      botLiveCeiling: botLiveCeil,
    };
  }, [
    botClockTick,
    botDailyCeilings,
    botOverrides,
    candidateTodayOverrides,
    chatDirectory,
    effectiveGuestId,
    effectiveProfile.name,
    effectiveProfile.td,
    effectiveProfile.xp,
    impersonated?.botOriginalName,
    liveLeaderboardIstSynced,
    livePlayers,
  ]);

  useEffect(() => {
    if (botLiveCeiling > (botDailyCeilings[botRosterDateKey] || 0)) {
      const next = { ...botDailyCeilings, [botRosterDateKey]: botLiveCeiling };
      setBotDailyCeilings(next);
      saveBotDailyCeilings(next);
    }
  }, [botDailyCeilings, botLiveCeiling, botRosterDateKey]);

  const myEffectiveRank = useMemo(() => {
    const allIdx = allTimeEntries.findIndex((e) => e.isMe);
    const tdIdx = todayEntries.findIndex((e) => e.isMe);
    const rAll = allIdx >= 0 ? allIdx + 1 : allTimeEntries.length + 1;
    const rTd = tdIdx >= 0 ? tdIdx + 1 : todayEntries.length + 1;
    return Math.min(rAll, rTd);
  }, [allTimeEntries, todayEntries]);

  const openSubjectConfig = (key: QuizKey) => {
    if (!impersonated && !hasCompleteAccount) {
      setView("gate");
      return;
    }
    recordTap("Select Subject", `Subject: ${key}`, "subs");
    setConfigKey(key);
    if (key === "mix") {
      const rule = getRankDifficultyRule(myEffectiveRank);
      setConfigLevel(rule.defaultLevel);
    } else {
      setConfigLevel(1);
    }
    setConfigLength(10);
    setView("sub");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startQuiz = (k = configKey, L = configLevel, N = configLength) => {
    if (!impersonated && !hasCompleteAccount) {
      setView("gate");
      return;
    }
    const rule = k === "mix" ? getRankDifficultyRule(myEffectiveRank) : null;
    const resolvedLevel = rule ? Math.max(L, rule.minLevel) : L;
    const qs = buildQuizSet(k, resolvedLevel, N, mergedBank, {
      guestId: effectiveGuestId,
      playerRank: myEffectiveRank,
    });
    if (qs.length === 0) return;
    markQuestionsSeen(effectiveGuestId, qs);
    recordTap("Start Quiz", `${k.toUpperCase()} · ${LEVELS[resolvedLevel]} · ${N} Qs`, "quiz");
    const minutes = QUIZ_LENGTHS[N] ?? 2;
    setPreQuizRank(myEffectiveRank);
    setQuiz({
      k,
      L: resolvedLevel,
      N: qs.length,
      qs,
      i: 0,
      sel: Array(qs.length).fill(undefined),
      t: minutes * 60,
      done: false,
      mode: "normal",
      startedAtMs: Date.now(),
      comboStreak: 0,
      bestCombo: 0,
    });
    setView("quiz");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // #4: Start 20-Second Rapid Fire Blitz (Science, SST, English & GK only)
  const startBlitzQuiz = () => {
    if (!impersonated && !hasCompleteAccount) {
      setView("gate");
      return;
    }
    const qs = buildBlitzQuizSet(mergedBank, effectiveGuestId, 25);
    if (qs.length === 0) return;
    markQuestionsSeen(effectiveGuestId, qs);
    recordTap("Start Blitz", "20s Rapid Fire Blitz", "quiz");
    setPreQuizRank(myEffectiveRank);
    setQuiz({
      k: "mix",
      L: 1,
      N: qs.length,
      qs,
      i: 0,
      sel: Array(qs.length).fill(undefined),
      t: BLITZ_SECONDS,
      done: false,
      mode: "blitz",
      startedAtMs: Date.now(),
      comboStreak: 0,
      bestCombo: 0,
    });
    setView("quiz");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // #1: Accept 1v1 Battle Challenge
  const acceptBattleChallenge = () => {
    if (!pendingBattle) return;
    if (!impersonated && !hasCompleteAccount) {
      setView("gate");
      return;
    }
    const battle = pendingBattle;
    setPendingBattle(null);
    recordTap("Accept 1v1", `Battle vs ${battle.challengerName}`, "quiz");
    setPreQuizRank(myEffectiveRank);
    setQuiz({
      k: battle.k,
      L: battle.L,
      N: battle.qs.length,
      qs: battle.qs,
      i: 0,
      sel: Array(battle.qs.length).fill(undefined),
      t: 120,
      done: false,
      mode: "battle",
      startedAtMs: Date.now(),
      comboStreak: 0,
      bestCombo: 0,
      battleMeta: {
        id: battle.id,
        challengerName: battle.challengerName,
        challengerCorrect: battle.challengerCorrect,
        challengerTotal: battle.challengerTotal,
        challengerSecondsTaken: battle.challengerSecondsTaken,
      },
    });
    setView("quiz");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // #4: Blitz instant answer handler (+3s every 3-in-a-row, -2s on wrong answer)
  const handleBlitzAnswer = (optIdx: number) => {
    if (!quiz || quiz.done || quiz.mode !== "blitz") return;
    const currentQ = quiz.qs[quiz.i];
    const isCorrect = currentQ ? optIdx === currentQ[2] : false;

    if (isCorrect) playCorrectSound();
    else playIncorrectSound();

    const nextCombo = isCorrect ? (quiz.comboStreak ?? 0) + 1 : 0;
    const nextBestCombo = Math.max(quiz.bestCombo ?? 0, nextCombo);
    const timeDelta = isCorrect ? 2 : -2;
    const nextTime = Math.max(0, quiz.t + timeDelta);
    const nextSel = [...quiz.sel];
    nextSel[quiz.i] = optIdx;

    const nextIndex = (quiz.i + 1) % quiz.qs.length;
    const updatedState: ActiveQuizState = {
      ...quiz,
      sel: nextSel,
      i: nextIndex,
      t: nextTime,
      comboStreak: nextCombo,
      bestCombo: nextBestCombo,
    };

    if (nextTime <= 0) {
      finishQuiz({ ...updatedState, t: 0 });
      return;
    }
    setQuiz(updatedState);
  };

  useEffect(() => {
    const status = getTodayCutoffStatus(botClockTick);
    const targetSec = status.isLocked ? status.resetSeconds : status.remainingSeconds;
    const delayMs = Math.max(1000, (targetSec + 1) * 1000);
    if (delayMs > 43200000) return;
    const timer = window.setTimeout(() => {
      setBotClockTick(Date.now());
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [botClockTick]);

  useEffect(() => {
    if (impersonated || !profile.name) return;
    const cutoff = getTodayCutoffStatus(botClockTick);
    if (!cutoff.isLocked) return;

    const myTodayEntry = todayEntries.find((e) => e.isMe);
    const myTodayXp = myTodayEntry?.xp ?? 0;
    if (myTodayXp <= 0) return;

    const myTodayRank = 1 + todayEntries.filter((e) => !e.isMe && e.xp > myTodayXp).length;
    if (myTodayRank !== 1 && myTodayRank !== 2 && myTodayRank !== 3) return;

    const existing = profile.earnedDailyBadges ?? [];
    if (existing.some((b) => b.date === cutoff.dateKey)) return;

    const nextRecord: DailyBadgeRecord = {
      date: cutoff.dateKey,
      rank: myTodayRank as 1 | 2 | 3,
      xp: myTodayXp,
    };

    setProfile((prev) => {
      const prevList = prev.earnedDailyBadges ?? [];
      if (prevList.some((b) => b.date === cutoff.dateKey)) return prev;
      const updated: StudentProfile = {
        ...prev,
        earnedDailyBadges: [nextRecord, ...prevList].slice(0, 60),
      };
      saveProfile(updated);
      return updated;
    });

    playMilestoneSound();
    launchMilestoneConfetti(1000);
  }, [botClockTick, impersonated, profile.earnedDailyBadges, profile.name, todayEntries]);

  const openBadgeModal = useCallback(
    (spec?: BadgeDesignSpec, source = "app") => {
      recordTap("Open Badge", "Opened shareable badge", source);
      setSelectedBadgeSpec(spec ?? null);
      setShowBadgeModal(true);
    },
    [recordTap]
  );

  const mustCompleteGate = view !== "admin" && !impersonated && !hasCompleteAccount;
  const effectiveView: AppRoute = mustCompleteGate ? "gate" : view;
  const hideHeader = effectiveView === "quiz" || effectiveView === "admin";
  const hideNav =
    effectiveView === "quiz" ||
    effectiveView === "gate" ||
    effectiveView === "admin";

  return (
    <div className="min-h-screen relative flex flex-col">
      {showLaunchSplash && effectiveView !== "admin" && (
        <LaunchSplash onDone={() => setShowLaunchSplash(false)} />
      )}
      <div className="amay-bg-mesh" aria-hidden="true" />

      <div className="relative z-10 flex-1 flex flex-col">
        {impersonated && effectiveView !== "admin" && (
          <div className="sticky top-0 z-40 bg-[#0B1B4D] text-white text-xs font-bold px-4 py-2 flex items-center justify-between gap-2 shadow-md">
            <span className="truncate">
              Viewing ID: <strong>{impersonated.profile.name}</strong> ({impersonated.profile.xp.toLocaleString()} XP)
              {impersonated.botOriginalName ? " · Roster" : ""}
            </span>
            <button
              type="button"
              onClick={() => {
                setImpersonated(null);
                setPendingChatPeer(null);
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
            unreadNotifications={effectiveView !== "gate" ? unreadNotifCount : 0}
            onOpenNotifications={
              effectiveView !== "gate"
                ? () => {
                    fetchNotifications().then((list) => setAllNotifications(list));
                    setShowNotifInbox(true);
                    if (!impersonated) {
                      markNotifsSeen(myNotifications.map((n) => n.id));
                    }
                  }
                : undefined
            }
          />
        )}

        <main
          className={`w-full mx-auto px-4 pt-4 ${
            effectiveView === "admin" ? "max-w-5xl pb-12" : `max-w-[560px] ${hideNav ? "pb-10" : "pb-32"}`
          }`}
        >
          {effectiveView === "gate" && (
            <GateView
              existingAccount={
                profile.name ? { name: profile.name, xp: profile.xp, nameAt: profile.nameAt } : null
              }
              showInstallBanner={!isInstalled}
              onInstallClick={handleInstallClick}
              isInAppBrowser={isInAppBrowser}
              externalBrowserUrl={externalBrowserUrl}
              onRegister={handleRegister}
              onClaimExisting={handleClaimExistingCredentials}
              onLogin={handleLogin}
            />
          )}

          {effectiveView === "home" && (
            <HomeView
              profile={effectiveProfile}
              allTimeEntries={allTimeEntries}
              todayEntries={todayEntries}
              latestVideo={latestVideo}
              pendingBattle={pendingBattle}
              onAcceptBattle={acceptBattleChallenge}
              onDismissBattle={() => setPendingBattle(null)}
              onStartNormalQuiz={() => openSubjectConfig("mix")}
              onStartBlitz={startBlitzQuiz}
              onOpenSubjects={() => navigate("subs")}
              onOpenRank={() => navigate("rank")}
            />
          )}

          {effectiveView === "subs" && (
            <SubjectsGridView onSelectSubject={openSubjectConfig} mergedBank={mergedBank} />
          )}

          {effectiveView === "sub" && (
            <SubjectConfigView
              subjectKey={configKey}
              level={configLevel}
              length={configLength}
              playerRank={myEffectiveRank}
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

          {effectiveView === "quiz" && quiz && (
            <QuizView
              quiz={quiz}
              profile={effectiveProfile}
              rankChange={
                quiz.done && preQuizRank !== null && myEffectiveRank < preQuizRank
                  ? {
                      prevRank: preQuizRank,
                      newRank: myEffectiveRank,
                      climbed: preQuizRank - myEffectiveRank,
                    }
                  : null
              }
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
              onBlitzAnswer={handleBlitzAnswer}
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
              onRetry={() =>
                quiz.mode === "blitz"
                  ? startBlitzQuiz()
                  : quiz.mode === "battle" && quiz.battleMeta
                    ? setQuiz({
                        ...quiz,
                        i: 0,
                        sel: Array(quiz.qs.length).fill(undefined),
                        t: 120,
                        done: false,
                        res: undefined,
                        startedAtMs: Date.now(),
                      })
                    : startQuiz(quiz.k, quiz.L, quiz.N)
              }
              onChangeSetup={() => openSubjectConfig(quiz.k)}
              onOpenRank={() => navigate("rank")}
              onOpenBadge={() => openBadgeModal(undefined, "quiz")}
            />
          )}

          {effectiveView === "chat" && (
            <ChatView
              guestId={effectiveGuestId}
              myName={effectiveProfile.name || "Candidate"}
              extraDirectory={botChatDirectory}
              initialPeer={pendingChatPeer}
              onClearInitialPeer={() => setPendingChatPeer(null)}
              onUnreadCountChange={setUnreadChatCount}
            />
          )}

          {effectiveView === "rank" && (
            <RankView
              allTimeEntries={allTimeEntries}
              todayEntries={todayEntries}
              onStartQuiz={() => openSubjectConfig("mix")}
              onChatWithPlayer={(peer) => {
                recordTap("Chat from Rank", `Opened chat with ${peer.name}`, "rank");
                setPendingChatPeer(peer);
                setQuiz(null);
                setView("chat");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}

          {effectiveView === "me" && (
            <ProfileView
              profile={effectiveProfile}
              isDark={isDark}
              onToggleTheme={handleToggleTheme}
              onUpdateName={handleUpdateName}
              onSetCredentials={handleSetCredentials}
              onSignOut={handleSignOut}
              onShareApp={() => recordTap("Share App", "Shared app link", "me")}
              isImpersonating={Boolean(impersonated)}
              onOpenBadge={(spec) => openBadgeModal(spec, "me")}
            />
          )}

          {effectiveView === "admin" && (
            <AdminView
              onBack={() => {
                if (window.location.hash === "#admin") {
                  window.history.replaceState(null, "", window.location.pathname);
                }
                setImpersonated(null);
                setView(hasCompleteAccount ? "home" : "gate");
              }}
              onQuestionsChanged={refreshDynamicQuestions}
              onBotsChanged={(ov) => setBotOverrides(ov)}
              onBotDailyCeilingsChanged={(c) =>
                setBotDailyCeilings((prev) => mergeBotDailyCeilingMaps(prev, c))
              }
              onCandidateTodayChanged={(ov) => setCandidateTodayOverrides(ov)}
              onLatestVideoChanged={(v) => setLatestVideo(v)}
              onNotificationsChanged={(list) => setAllNotifications(list)}
              onOpenCandidateId={handleOpenCandidateId}
            />
          )}
        </main>
      </div>

      {!hideNav && (
        <BottomNav activeView={effectiveView} onNavigate={navigate} unreadChatCount={unreadChatCount} />
      )}

      {showBadgeModal && (
        <BadgeModal
          xp={effectiveProfile.xp}
          name={effectiveProfile.name}
          earnedDailyBadges={effectiveProfile.earnedDailyBadges}
          initialSpec={selectedBadgeSpec}
          onClose={() => {
            setShowBadgeModal(false);
            setSelectedBadgeSpec(null);
          }}
        />
      )}

      {showNotifInbox && (
        <NotificationInboxModal
          notifications={myNotifications}
          latestVideoUrl={latestVideo.url}
          onPlayNow={() => openSubjectConfig("mix")}
          onOpenRanks={() => navigate("rank")}
          onClose={() => setShowNotifInbox(false)}
        />
      )}

      {activePopupNotif && (
        <NotificationPopupModal
          notification={activePopupNotif}
          latestVideoUrl={latestVideo.url}
          onPlayNow={() => openSubjectConfig("mix")}
          onOpenRanks={() => navigate("rank")}
          onDismiss={() => markNotifsSeen([activePopupNotif.id])}
        />
      )}

      {showInstallModal && !isInstalled && (
        <PWAInstallModal
          canNativeInstall={canNativeInstall}
          isIOS={isIOS}
          isInAppBrowser={isInAppBrowser}
          externalBrowserUrl={externalBrowserUrl}
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
