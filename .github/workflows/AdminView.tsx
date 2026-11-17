import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  LogOut,
  Plus,
  Trash2,
  Search,
  Edit3,
  Eye,
  X,
  RefreshCw,
  Copy,
  Check,
  Upload,
  FileText,
  Download,
  Video,
  Image as ImageIcon,
  ExternalLink,
  Smartphone,
  Bell,
  Send,
  Users,
  User,
  MessageCircle,
  LifeBuoy,
  Lock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trophy,
  Clock,
  Crown,
} from "lucide-react";
import { BENCHMARK_PLAYERS } from "../data/benchmarks";
import type { AdminSubjectKey } from "../data/questions";
import {
  getCompetitionCeiling,
  getIstClock,
  reconstructBotDailyCeilingsFromAttempts,
  resolveBotRoster,
  type ResolvedBotPlayer,
} from "../lib/botSimulator";
import {
  classifyQuestionDifficulty,
  parseBulkQuestionFile,
  type ParsedBulkQuestion,
} from "../lib/questionParser";
import {
  getQuestionInventory,
  HIGH_LEVEL_TARGET_PER_MODE,
  LEVELS,
  mergeDynamicQuestions,
} from "../lib/quizEngine";
import {
  adminBulkInsertQuestions,
  adminDeleteNotification,
  adminDeleteQuestion,
  adminDeleteSingleMsdSubmission,
  adminGetSession,
  adminInsertQuestion,
  adminLoadAllChatMessages,
  adminLoadAttempts,
  adminLoadCandidates,
  adminLoadCandidateTaps,
  adminLoadInstallStatusMap,
  adminLoadNotificationSeenMap,
  adminLoadStats,
  adminResetMsdSubmissions,
  adminSaveBotDailyCeilings,
  adminSaveBotOverrides,
  adminSaveCandidateTodayOverrides,
  adminSaveLatestVideo,
  adminSaveMsdEventConfig,
  adminSendHelpReply,
  adminSendMessageAs,
  adminSendNotification,
  adminSignIn,
  adminSignOut,
  adminUpdateCandidate,
  DEFAULT_LATEST_VIDEO,
  DEFAULT_MSD_EVENT_CONFIG,
  deriveYouTubeThumbnail,
  fetchBotDailyCeilings,
  fetchBotOverrides,
  fetchCandidateTodayOverrides,
  fetchDynamicQuestions,
  fetchLatestVideo,
  fetchMsdEventConfig,
  fetchMsdLeaderboard,
  fetchNotifications,
  HELP_CHAT_UUID,
  loadBotDailyCeilings,
  loadBotOverrides,
  loadCandidateTodayOverrides,
  mergeBotDailyCeilingMaps,
  MSD_EVENT_DURATION_MS,
  MSD_QUESTION_TARGET,
  resolveMsdEventPhase,
  saveBotDailyCeilings,
  saveBotOverrides,
  saveCandidateTodayOverrides,
  subscribeChatRealtime,
  type AdminAttemptRow,
  type AdminCandidateRow,
  type AppNotification,
  type BotOverride,
  type CandidateTapEvent,
  type CandidateTodayOverride,
  type ChatMessageRow,
  type DynamicQuestionRow,
  type LatestVideoConfig,
  type MsdEventConfig,
  type MsdSubmissionRow,
  type NotificationActionType,
} from "../lib/supabase";

export interface OpenCandidateIdPayload {
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
}

interface AdminViewProps {
  onBack: () => void;
  onQuestionsChanged: () => void;
  onBotsChanged: (overrides: Record<string, BotOverride>) => void;
  onBotDailyCeilingsChanged?: (ceilings: Record<string, number>) => void;
  onCandidateTodayChanged?: (overrides: Record<string, CandidateTodayOverride>) => void;
  onLatestVideoChanged: (video: LatestVideoConfig) => void;
  onNotificationsChanged: (list: AppNotification[]) => void;
  onMsdEventChanged?: (cfg: MsdEventConfig) => void;
  onOpenCandidateId: (target: OpenCandidateIdPayload) => void;
}

const TAP_SQL = `create table if not exists public.candidate_events (
  id uuid default gen_random_uuid() primary key,
  guest_uuid text not null,
  candidate_name text not null,
  action text not null,
  detail text default '',
  screen text default '',
  created_at timestamptz default now()
);
alter table public.candidate_events enable row level security;
create policy "Allow public insert taps" on public.candidate_events for insert to anon, authenticated with check (true);
create policy "Allow authenticated read taps" on public.candidate_events for select to authenticated using (true);`;

const SETTINGS_SQL = `create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "Allow public read app_settings" on public.app_settings;
create policy "Allow public read app_settings" on public.app_settings for select to anon, authenticated using (true);
drop policy if exists "Allow authenticated write app_settings" on public.app_settings;
create policy "Allow authenticated write app_settings" on public.app_settings for all to authenticated using (true) with check (true);`;

const CHAT_AUTH_SQL = `-- Run Sections 8 & 9 from supabase-setup.sql for Login & Live Messages + Admin Audit
-- (Paste full supabase-setup.sql into Supabase SQL Editor -> Run)`;

const MSD_SQL = `-- Run Section 10 from supabase-setup.sql for MS Dhoni 24h Rank Board & 1-Attempt Lock
create table if not exists public.msd_submissions (
  guest_uuid text primary key,
  candidate_name text not null,
  score integer not null check (score >= 0 and score <= 20),
  total integer not null check (total > 0 and total <= 20),
  time_taken_sec integer not null default 0 check (time_taken_sec >= 0),
  created_at timestamptz not null default now()
);
alter table public.msd_submissions enable row level security;
drop policy if exists "Allow public read msd_submissions" on public.msd_submissions;
create policy "Allow public read msd_submissions" on public.msd_submissions for select to anon, authenticated using (true);
drop policy if exists "Allow authenticated manage msd_submissions" on public.msd_submissions;
create policy "Allow authenticated manage msd_submissions" on public.msd_submissions for all to authenticated using (true) with check (true);
-- Plus submit_msd_quiz() & get_msd_leaderboard() RPCs in supabase-setup.sql`;

export const AdminView: React.FC<AdminViewProps> = ({
  onBack,
  onQuestionsChanged,
  onBotsChanged,
  onBotDailyCeilingsChanged,
  onCandidateTodayChanged,
  onLatestVideoChanged,
  onNotificationsChanged,
  onMsdEventChanged,
  onOpenCandidateId,
}) => {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<
    "candidates" | "messages" | "attempts" | "taps" | "questions" | "video" | "notifications"
  >("candidates");
  const [candidateFilter, setCandidateFilter] = useState<"students" | "bots">("students");
  const [installFilter, setInstallFilter] = useState<"all" | "installed" | "not_installed">("all");
  const [stats, setStats] = useState({ users: 0, tests: 0, questions: 0, totalXp: 0 });
  const [dynamicQuestions, setDynamicQuestions] = useState<DynamicQuestionRow[]>([]);
  const [candidates, setCandidates] = useState<AdminCandidateRow[]>([]);
  const [installStatusMap, setInstallStatusMap] = useState<Record<string, boolean>>({});
  const [attempts, setAttempts] = useState<AdminAttemptRow[]>([]);
  const [taps, setTaps] = useState<CandidateTapEvent[]>([]);
  const [needsTapTable, setNeedsTapTable] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Manual Notifications state
  const [notificationsList, setNotificationsList] = useState<AppNotification[]>([]);
  const [notifSeenMap, setNotifSeenMap] = useState<Record<string, { count: number; names: string[] }>>({});
  const [expandedSeenNotifId, setExpandedSeenNotifId] = useState<string | null>(null);
  const [notifTarget, setNotifTarget] = useState<"all" | "candidate">("all");
  const [notifTargetGuestUuid, setNotifTargetGuestUuid] = useState("");
  const [notifCandidateSearch, setNotifCandidateSearch] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifImageUrl, setNotifImageUrl] = useState("");
  const [notifActionType, setNotifActionType] = useState<NotificationActionType>("none");
  const [notifActionLabel, setNotifActionLabel] = useState("");
  const [notifActionUrl, setNotifActionUrl] = useState("");
  const [sendingNotif, setSendingNotif] = useState(false);
  const [needsNotifTable, setNeedsNotifTable] = useState(false);
  const [copiedNotifSql, setCopiedNotifSql] = useState(false);

  // Latest video editor state
  const [videoUrl, setVideoUrl] = useState(DEFAULT_LATEST_VIDEO.url);
  const [videoTitle, setVideoTitle] = useState(DEFAULT_LATEST_VIDEO.title);
  const [videoSubtitle, setVideoSubtitle] = useState(DEFAULT_LATEST_VIDEO.subtitle);
  const [videoThumb, setVideoThumb] = useState(DEFAULT_LATEST_VIDEO.thumbnailUrl);
  const [savingVideo, setSavingVideo] = useState(false);
  const [needsVideoTable, setNeedsVideoTable] = useState(false);
  const [copiedVideoSql, setCopiedVideoSql] = useState(false);

  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Quick inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  // Bot overrides + daily ceilings state + live 30s schedule tick
  const [botOverrides, setBotOverrides] = useState<Record<string, BotOverride>>(() => loadBotOverrides());
  const [botDailyCeilings, setBotDailyCeilings] = useState<Record<string, number>>(() =>
    loadBotDailyCeilings()
  );
  const [candidateTodayOverrides, setCandidateTodayOverrides] = useState<
    Record<string, CandidateTodayOverride>
  >(() => loadCandidateTodayOverrides());
  const [botClockTick, setBotClockTick] = useState<number>(() => Date.now());
  const [editingBotOriginalName, setEditingBotOriginalName] = useState<string | null>(null);
  const [botDraftName, setBotDraftName] = useState("");
  const [botDraftXp, setBotDraftXp] = useState(0);
  const [botDraftTodayXp, setBotDraftTodayXp] = useState(0);
  const [botBaseWithoutToday, setBotBaseWithoutToday] = useState(0);
  const [needsBotTable, setNeedsBotTable] = useState(false);
  const [copiedBotSql, setCopiedBotSql] = useState(false);

  // Candidate XP & Stats Editor + Inspector Modal
  const [selectedCandidate, setSelectedCandidate] = useState<AdminCandidateRow | null>(null);
  const [copiedCandidateId, setCopiedCandidateId] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editXp, setEditXp] = useState(0);
  const [editTodayXp, setEditTodayXp] = useState(0);
  const [candidateBaseWithoutToday, setCandidateBaseWithoutToday] = useState(0);
  const [editStreak, setEditStreak] = useState(0);
  const [editQuizzes, setEditQuizzes] = useState(0);
  const [savingCandidate, setSavingCandidate] = useState(false);

  // Admin Messages & Help state (sees ALL chats including student-deleted ones)
  const [chatMessages, setChatMessages] = useState<ChatMessageRow[]>([]);
  const [needsChatTable, setNeedsChatTable] = useState(false);
  const [copiedChatSql, setCopiedChatSql] = useState(false);
  const [msgSubTab, setMsgSubTab] = useState<"help" | "bots" | "audit">("help");
  const [selectedHelpUuid, setSelectedHelpUuid] = useState<string | null>(null);
  const [selectedAuditPairKey, setSelectedAuditPairKey] = useState<string | null>(null);
  const [helpReplyDraft, setHelpReplyDraft] = useState("");
  const [sendingHelpReply, setSendingHelpReply] = useState(false);
  const [botComposerFromUuid, setBotComposerFromUuid] = useState("");
  const [botComposerToUuid, setBotComposerToUuid] = useState("");
  const [botReplyAsUuid, setBotReplyAsUuid] = useState("");
  const [botReplyDraft, setBotReplyDraft] = useState("");
  const [sendingBotReply, setSendingBotReply] = useState(false);

  // Question Entry Mode: single vs bulk
  const [qEntryMode, setQEntryMode] = useState<"single" | "bulk">("single");

  // Single question form
  const [qSub, setQSub] = useState<AdminSubjectKey>("ca");
  const [qLvl, setQLvl] = useState(1);
  const [qTxt, setQTxt] = useState("");
  const [qOa, setQOa] = useState("");
  const [qOb, setQOb] = useState("");
  const [qOc, setQOc] = useState("");
  const [qOd, setQOd] = useState("");
  const [qAns, setQAns] = useState(0);
  const [qExp, setQExp] = useState("");
  const [savingQ, setSavingQ] = useState(false);

  // Bulk upload state
  const [bulkDefaultSub, setBulkDefaultSub] = useState<AdminSubjectKey>("sst");
  const [bulkDefaultLvl, setBulkDefaultLvl] = useState<number>(1);
  const [bulkQueue, setBulkQueue] = useState<ParsedBulkQuestion[]>([]);
  const [parsingFile, setParsingFile] = useState(false);
  const [publishingBulk, setPublishingBulk] = useState(false);
  const [rawExtractPreview, setRawExtractPreview] = useState("");

  // MS Dhoni 24-Hour Special Competition state
  const [msdConfig, setMsdConfig] = useState<MsdEventConfig>(DEFAULT_MSD_EVENT_CONFIG);
  const [msdSavingConfig, setMsdSavingConfig] = useState(false);
  const [msdBoard, setMsdBoard] = useState<MsdSubmissionRow[]>([]);
  const [needsMsdSql, setNeedsMsdSql] = useState(false);
  const [copiedMsdSql, setCopiedMsdSql] = useState(false);
  const [showMsdBoardPanel, setShowMsdBoardPanel] = useState(false);
  const [msdResetConfirm, setMsdResetConfirm] = useState(false);
  const [qListFilter, setQListFilter] = useState<"all" | "msd" | "standard">("all");

  const refreshAdminChatOnly = async () => {
    const res = await adminLoadAllChatMessages();
    setChatMessages(res.messages);
    setNeedsChatTable(res.needsTableSetup);
  };

  const loadAllAdminData = async () => {
    const localBots = loadBotOverrides();
    const localCandToday = loadCandidateTodayOverrides();
    const localCeilings = loadBotDailyCeilings();
    const [
      st,
      dqs,
      cands,
      atts,
      tapRes,
      vid,
      cloudBots,
      cloudCandToday,
      cloudCeilings,
      installMap,
      notifs,
      seenMap,
      chatRes,
      msdCfg,
      msdLbRes,
    ] = await Promise.all([
      adminLoadStats(),
      fetchDynamicQuestions(),
      adminLoadCandidates(),
      adminLoadAttempts(),
      adminLoadCandidateTaps(),
      fetchLatestVideo(),
      fetchBotOverrides(),
      fetchCandidateTodayOverrides(),
      fetchBotDailyCeilings(),
      adminLoadInstallStatusMap(),
      fetchNotifications(),
      adminLoadNotificationSeenMap(),
      adminLoadAllChatMessages(),
      fetchMsdEventConfig(),
      fetchMsdLeaderboard(),
    ]);
    const mergedBots = { ...cloudBots, ...localBots };
    const mergedCandToday = { ...cloudCandToday, ...localCandToday };

    // Reconstruct every historical IST day's bot competition ceiling from attempts + live today scores
    // so XP earned by bots in Today mode permanently rolls into Overall XP after 12:00 AM IST.
    const mergedCeilings = mergeBotDailyCeilingMaps(localCeilings, cloudCeilings);
    const reconstructedCeilings = reconstructBotDailyCeilingsFromAttempts(atts, mergedCeilings);
    const todayKey = getIstClock().dateKey;
    const liveTodayByCand = new Map<string, number>();
    for (const a of atts) {
      const ms = Date.parse(a.created_at);
      if (!Number.isFinite(ms) || getIstClock(ms).dateKey !== todayKey) continue;
      const k = a.guest_uuid || a.candidate_name || "";
      if (k) liveTodayByCand.set(k, (liveTodayByCand.get(k) || 0) + (Number(a.xp_earned) || 0));
    }
    const todayRealScores = cands
      .filter((c) => !c.hidden)
      .map((c) => {
        const fromAtt = liveTodayByCand.get(c.guest_uuid) ?? liveTodayByCand.get(c.display_name) ?? 0;
        const ov = mergedCandToday[c.guest_uuid];
        const delta = ov && ov.dateKey === todayKey ? ov.delta : 0;
        return Math.max(0, fromAtt + delta);
      });
    const liveTodayCeil = getCompetitionCeiling(todayRealScores);
    if (liveTodayCeil > (reconstructedCeilings[todayKey] || 0)) {
      reconstructedCeilings[todayKey] = liveTodayCeil;
    }

    const ceilingsChanged = Object.entries(reconstructedCeilings).some(
      ([k, v]) => v > (cloudCeilings[k] || 0)
    );
    saveBotDailyCeilings(reconstructedCeilings);
    setBotDailyCeilings(reconstructedCeilings);
    onBotDailyCeilingsChanged?.(reconstructedCeilings);
    if (ceilingsChanged) {
      adminSaveBotDailyCeilings(reconstructedCeilings);
    }

    setStats(st);
    setDynamicQuestions(dqs);
    setCandidates(cands);
    setInstallStatusMap(installMap);
    setAttempts(atts);
    setTaps(tapRes.events);
    setNeedsTapTable(tapRes.needsTableSetup);
    setChatMessages(chatRes.messages);
    setNeedsChatTable(chatRes.needsTableSetup);
    setVideoUrl(vid.url);
    setVideoTitle(vid.title);
    setVideoSubtitle(vid.subtitle);
    setVideoThumb(vid.thumbnailUrl);
    setNotificationsList(notifs);
    setNotifSeenMap(seenMap);
    onNotificationsChanged(notifs);
    setBotOverrides(mergedBots);
    saveBotOverrides(mergedBots);
    onBotsChanged(mergedBots);
    setCandidateTodayOverrides(mergedCandToday);
    saveCandidateTodayOverrides(mergedCandToday);
    onCandidateTodayChanged?.(mergedCandToday);
    setMsdConfig(msdCfg);
    onMsdEventChanged?.(msdCfg);
    setMsdBoard(msdLbRes.rows);
    setNeedsMsdSql(msdLbRes.needsSql);
  };

  useEffect(() => {
    adminGetSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setAdminEmail(session.user.email);
        loadAllAdminData();
      }
      setCheckingAuth(false);
    });
    const timer = window.setInterval(() => setBotClockTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!adminEmail) return;
    const unsubscribe = subscribeChatRealtime(() => {
      refreshAdminChatOnly();
    }, true);
    return () => {
      unsubscribe();
    };
  }, [adminEmail]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    const { data, error } = await adminSignIn(email.trim(), password.trim());
    setLoggingIn(false);
    if (error) {
      setLoginError(error.message);
      return;
    }
    if (data.user?.email) {
      setAdminEmail(data.user.email);
      loadAllAdminData();
    }
  };

  const handleLogout = async () => {
    await adminSignOut();
    setAdminEmail(null);
  };

  const openCandidateEditor = (cand: AdminCandidateRow) => {
    const todayVal = getCandidateTodayIstXp(cand);
    const totalVal = cand.xp || 0;
    setCopiedCandidateId(false);
    setSelectedCandidate(cand);
    setEditName(cand.display_name || "");
    setEditUsername(cand.username || "");
    setEditPassword(cand.password || "");
    setEditXp(totalVal);
    setEditTodayXp(todayVal);
    setCandidateBaseWithoutToday(totalVal - todayVal);
    setEditStreak(cand.streak || 0);
    setEditQuizzes(cand.quizzes_count || 0);
  };

  const openInspectorByIdentity = (guestUuid?: string, candidateName?: string) => {
    const match =
      (guestUuid && candidates.find((c) => c.guest_uuid === guestUuid)) ||
      (candidateName &&
        candidates.find((c) => c.display_name.toLowerCase() === candidateName.trim().toLowerCase()));
    if (match) {
      openCandidateEditor(match);
      return;
    }
    if (!candidateName && !guestUuid) return;
    openCandidateEditor({
      guest_uuid: guestUuid || `lookup_${candidateName || "candidate"}`,
      display_name: candidateName || "Candidate",
      xp: 0,
      today_xp: 0,
      streak: 0,
      quizzes_count: 0,
      perfect_count: 0,
    });
  };

  const launchCandidateIdView = (cand: AdminCandidateRow) => {
    setSelectedCandidate(null);
    onOpenCandidateId({
      guestUuid: cand.guest_uuid,
      name: cand.display_name,
      username: cand.username ?? null,
      password: cand.password ?? null,
      xp: cand.xp || 0,
      todayXp: getCandidateTodayIstXp(cand),
      streak: cand.streak || 0,
      quizzes: cand.quizzes_count || 0,
      perfect: cand.perfect_count || 0,
    });
  };

  const handleQuickRename = async (cand: AdminCandidateRow) => {
    const cleaned = renameDraft.trim();
    if (cleaned.length < 2) return;
    const { data, error } = await adminUpdateCandidate(cand.guest_uuid, { display_name: cleaned });
    if (error || !data || data.length === 0) {
      setFeedback({
        text: error ? error.message : "Could not rename candidate. Check Supabase UPDATE RLS policy.",
        ok: false,
      });
      return;
    }
    setRenamingId(null);
    setFeedback({ text: `Renamed "${cand.display_name}" to "${cleaned}".`, ok: true });
    await loadAllAdminData();
  };

  const handleSaveBotEdit = async (bot: ResolvedBotPlayer) => {
    const cleaned = botDraftName.trim() || bot.originalName;
    const parsedXp = Number.isFinite(Number(botDraftXp)) ? Math.max(0, Math.round(Number(botDraftXp))) : bot.xp;
    const parsedTodayXp = Number.isFinite(Number(botDraftTodayXp))
      ? Math.max(0, Math.round(Number(botDraftTodayXp)))
      : bot.todayXp;

    const next = {
      ...botOverrides,
      [bot.originalName]: {
        name: cleaned,
        xp: parsedXp,
        todayXp: parsedTodayXp,
        baseXp: bot.baseXp,
        xpOffset: parsedXp - bot.unadjustedOverallXp,
        manualTodayDate: botSchedule.clock.dateKey,
        manualTodayOffset: parsedTodayXp - bot.unadjustedTodayXp,
      },
    };
    setBotOverrides(next);
    setEditingBotOriginalName(null);
    onBotsChanged(next);

    const res = await adminSaveBotOverrides(next);
    if (res.ok) {
      setNeedsBotTable(false);
      setFeedback({ text: `Updated "${cleaned}" (${parsedXp} XP · ${parsedTodayXp} Today) for all candidates!`, ok: true });
    } else if (res.needsTableSetup) {
      setNeedsBotTable(true);
      setFeedback({
        text: "Updated locally, but run the 1-time SQL below in Supabase so all students see updated bot XP.",
        ok: false,
      });
    } else {
      setFeedback({
        text: `Updated locally, cloud sync failed: ${res.errorMessage || "Unknown error"}`,
        ok: false,
      });
    }
  };

  const handleSyncAllBotsToCloud = async () => {
    const [res] = await Promise.all([
      adminSaveBotOverrides(botOverrides),
      adminSaveBotDailyCeilings(botDailyCeilings),
    ]);
    if (res.ok) {
      setNeedsBotTable(false);
      onBotsChanged(botOverrides);
      onBotDailyCeilingsChanged?.(botDailyCeilings);
      setFeedback({ text: "Synced all bot XP & name updates to all candidates!", ok: true });
    } else if (res.needsTableSetup) {
      setNeedsBotTable(true);
      setFeedback({
        text: "Run the 1-time SQL below in Supabase → SQL Editor first so all students see updated bot XP.",
        ok: false,
      });
    } else {
      setFeedback({ text: `Sync failed: ${res.errorMessage || "Unknown error"}`, ok: false });
    }
  };

  const handleSaveCandidateEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    const cleanUsername = editUsername.trim().toLowerCase();
    if (cleanUsername && !/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      setFeedback({
        text: "Username must be 3–20 letters, numbers, or underscore.",
        ok: false,
      });
      return;
    }
    setSavingCandidate(true);
    setFeedback(null);

    const savedName = editName.trim() || selectedCandidate.display_name;
    const savedXp = Math.max(0, Math.round(Number(editXp) || 0));
    const savedTodayXp = Math.max(0, Math.round(Number(editTodayXp) || 0));

    const updates: Parameters<typeof adminUpdateCandidate>[1] = {
      display_name: savedName,
      xp: savedXp,
      today_xp: savedTodayXp,
      streak: Math.max(0, Math.round(Number(editStreak) || 0)),
      quizzes_count: Math.max(0, Math.round(Number(editQuizzes) || 0)),
    };
    if (cleanUsername !== (selectedCandidate.username || "")) {
      updates.username = cleanUsername || null;
    }
    if (editPassword !== (selectedCandidate.password || "")) {
      updates.password = editPassword || null;
    }

    const { data, error } = await adminUpdateCandidate(selectedCandidate.guest_uuid, updates);

    if (error) {
      setSavingCandidate(false);
      const dup = /duplicate key|unique constraint|candidates_username/i.test(error.message);
      setFeedback({
        text: dup ? "That username is already assigned to another candidate." : `Update failed: ${error.message}`,
        ok: false,
      });
      return;
    }
    if (!data || data.length === 0) {
      setSavingCandidate(false);
      setFeedback({
        text: "Database settings blocked updating this row. Check Supabase RLS policies for candidates UPDATE.",
        ok: false,
      });
      return;
    }

    const todayKey = getIstClock().dateKey;
    const attemptsToday = getCandidateAttemptsTodayIstXp(selectedCandidate);
    const nextDelta = savedTodayXp - attemptsToday;
    const nextOverrides: Record<string, CandidateTodayOverride> = { ...candidateTodayOverrides };
    if (nextDelta === 0) {
      delete nextOverrides[selectedCandidate.guest_uuid];
    } else {
      nextOverrides[selectedCandidate.guest_uuid] = {
        dateKey: todayKey,
        delta: nextDelta,
        name: savedName,
      };
    }
    setCandidateTodayOverrides(nextOverrides);
    onCandidateTodayChanged?.(nextOverrides);
    await adminSaveCandidateTodayOverrides(nextOverrides);

    setSavingCandidate(false);
    setCandidateBaseWithoutToday(savedXp - savedTodayXp);
    setFeedback({ text: `Updated ${savedName}'s profile, credentials & XP.`, ok: true });
    setSelectedCandidate(data[0] as AdminCandidateRow);
    await loadAllAdminData();
  };

  const handleToggleCandidateHidden = async (cand: AdminCandidateRow) => {
    const nextHidden = !cand.hidden;
    const { data, error } = await adminUpdateCandidate(cand.guest_uuid, { hidden: nextHidden });
    if (error || !data || data.length === 0) {
      setFeedback({
        text: error ? error.message : "Database policy blocked updating candidate visibility.",
        ok: false,
      });
      return;
    }
    setFeedback({
      text: nextHidden
        ? `"${cand.display_name}" hidden from leaderboard.`
        : `"${cand.display_name}" restored to leaderboard.`,
      ok: true,
    });
    await loadAllAdminData();
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingQ(true);
    setFeedback(null);
    const { error } = await adminInsertQuestion({
      subject: qSub,
      level: qLvl,
      question_text: qTxt.trim(),
      option_a: qOa.trim(),
      option_b: qOb.trim(),
      option_c: qOc.trim(),
      option_d: qOd.trim(),
      correct_index: qAns,
      explanation: qExp.trim(),
    });
    setSavingQ(false);

    if (error) {
      setFeedback({ text: `Could not publish question: ${error.message}`, ok: false });
      return;
    }

    setQTxt("");
    setQOa("");
    setQOb("");
    setQOc("");
    setQOd("");
    setQExp("");
    setFeedback({ text: "Question published to live quizzes.", ok: true });
    await loadAllAdminData();
    onQuestionsChanged();
  };

  const handleBulkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsingFile(true);
    setFeedback(null);
    setRawExtractPreview("");
    try {
      const { questions, rawTextPreview } = await parseBulkQuestionFile(
        file,
        bulkDefaultSub,
        bulkDefaultLvl
      );
      setBulkQueue(questions);
      if (questions.length === 0) {
        setRawExtractPreview(rawTextPreview || "");
        setFeedback({
          text: "No questions matched automatically. Check the extracted text preview or use CSV/TXT format.",
          ok: false,
        });
      } else {
        setFeedback({
          text: `Extracted ${questions.length} question${questions.length === 1 ? "" : "s"} from "${file.name}". Review below and click Publish All.`,
          ok: true,
        });
      }
    } catch (err) {
      setFeedback({
        text: `Could not read file: ${(err as Error)?.message || "Invalid file"}`,
        ok: false,
      });
    } finally {
      setParsingFile(false);
      e.target.value = "";
    }
  };

  const handleSetMsdStatus = async (mode: "live" | "coming_soon" | "ended") => {
    setMsdSavingConfig(true);
    setFeedback(null);
    const now = Date.now();
    const next: MsdEventConfig =
      mode === "live"
        ? {
            status: "live",
            liveStartedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + MSD_EVENT_DURATION_MS).toISOString(),
            questionCount: MSD_QUESTION_TARGET,
          }
        : mode === "ended"
        ? {
            status: "ended",
            liveStartedAt: msdConfig.liveStartedAt,
            expiresAt: new Date(now).toISOString(),
            questionCount: MSD_QUESTION_TARGET,
          }
        : {
            status: "coming_soon",
            liveStartedAt: null,
            expiresAt: null,
            questionCount: MSD_QUESTION_TARGET,
          };

    const res = await adminSaveMsdEventConfig(next);
    setMsdSavingConfig(false);
    setMsdConfig(next);
    onMsdEventChanged?.(next);

    if (res.ok) {
      setFeedback({
        text:
          mode === "live"
            ? "MS Dhoni 24-Hour Special Competition is now LIVE on everyone's Dashboard!"
            : mode === "ended"
            ? "MS Dhoni Special Competition marked as Ended."
            : "MS Dhoni Special reset to Coming Soon.",
        ok: true,
      });
    } else {
      setFeedback({
        text: `Saved locally, cloud sync note: ${res.errorMessage || "Run app_settings SQL in Supabase"}`,
        ok: false,
      });
    }
  };

  const handleDeleteMsdEntry = async (guestUuid: string) => {
    const res = await adminDeleteSingleMsdSubmission(guestUuid);
    if (!res.ok) {
      setFeedback({ text: `Could not delete entry: ${res.errorMessage || "Error"}`, ok: false });
      return;
    }
    setMsdBoard((prev) => prev.filter((r) => r.guest_uuid !== guestUuid));
    setFeedback({ text: "Removed player from MS Dhoni leaderboard.", ok: true });
  };

  const handleResetMsdBoard = async () => {
    const res = await adminResetMsdSubmissions();
    setMsdResetConfirm(false);
    if (!res.ok) {
      setFeedback({ text: `Reset failed: ${res.errorMessage || "Error"}`, ok: false });
      return;
    }
    setMsdBoard([]);
    setFeedback({ text: "Cleared all MS Dhoni Special leaderboard submissions.", ok: true });
  };

  const handlePublishBulk = async () => {
    if (bulkQueue.length === 0) return;
    setPublishingBulk(true);
    setFeedback(null);

    const { error } = await adminBulkInsertQuestions(bulkQueue);
    setPublishingBulk(false);

    if (error) {
      setFeedback({ text: `Bulk upload failed: ${error.message}`, ok: false });
      return;
    }

    const count = bulkQueue.length;
    setBulkQueue([]);
    setRawExtractPreview("");
    setFeedback({ text: `Successfully published ${count} questions to live quizzes!`, ok: true });
    await loadAllAdminData();
    onQuestionsChanged();
  };

  const downloadSampleCsv = () => {
    const sample = [
      "subject,level,question,option_a,option_b,option_c,option_d,answer,explanation",
      'sst,1,"Who was the first President of India?","Dr. Rajendra Prasad","Jawaharlal Nehru","Sardar Patel","B.R. Ambedkar",A,"Dr. Rajendra Prasad took office in 1950."',
      'sci,0,"What is the chemical symbol of water?","H2O","CO2","O2","NaCl",A,"Water is made of 2 hydrogen and 1 oxygen atoms."',
    ].join("\n");
    const blob = new Blob([sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "amaysst-questions-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDeleteQuestion = async (id: string) => {
    const { error } = await adminDeleteQuestion(id);
    if (error) {
      setFeedback({ text: `Could not delete: ${error.message}`, ok: false });
      return;
    }
    setFeedback({ text: "Question removed.", ok: true });
    await loadAllAdminData();
    onQuestionsChanged();
  };

  const handleVideoUrlChange = (nextUrl: string) => {
    const prevAutoThumb = deriveYouTubeThumbnail(videoUrl);
    const nextAutoThumb = deriveYouTubeThumbnail(nextUrl);
    setVideoUrl(nextUrl);
    // Automatically update thumbnail if it's currently empty or was previously auto-derived from YouTube
    if (nextAutoThumb && (!videoThumb || videoThumb === prevAutoThumb)) {
      setVideoThumb(nextAutoThumb);
    }
  };

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 640;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.82);
          setVideoThumb(compressed);
          setFeedback({ text: "Custom thumbnail loaded. Click Save Latest Video to publish it!", ok: true });
        }
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSaveLatestVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedUrl = videoUrl.trim();
    if (!cleanedUrl) {
      setFeedback({ text: "Please enter a video link URL.", ok: false });
      return;
    }
    setSavingVideo(true);
    setFeedback(null);

    const payload: LatestVideoConfig = {
      url: cleanedUrl,
      title: videoTitle.trim() || "Latest video",
      subtitle: videoSubtitle.trim() || "Watch my latest Short · opens on YouTube",
      thumbnailUrl: videoThumb.trim() || deriveYouTubeThumbnail(cleanedUrl),
    };

    const res = await adminSaveLatestVideo(payload);
    setSavingVideo(false);
    onLatestVideoChanged(payload);

    if (res.ok) {
      setNeedsVideoTable(false);
      setFeedback({ text: "Latest video & thumbnail updated for all candidates!", ok: true });
    } else if (res.needsTableSetup) {
      setNeedsVideoTable(true);
      setFeedback({
        text: "Preview saved locally, but run the 1-time SQL below in Supabase so all students see it across phones.",
        ok: false,
      });
    } else {
      setFeedback({
        text: `Saved locally, cloud update failed: ${res.errorMessage || "Unknown error"}`,
        ok: false,
      });
    }
  };

  const openNotifyForCandidate = (cand: AdminCandidateRow) => {
    setSelectedCandidate(null);
    setNotifTarget("candidate");
    setNotifTargetGuestUuid(cand.guest_uuid);
    setNotifCandidateSearch("");
    setTab("notifications");
    setFeedback(null);
  };

  const handleNotifImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 720;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.8);
          setNotifImageUrl(compressed);
          setFeedback({ text: "Picture attached! Ready to send.", ok: true });
        }
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = notifTitle.trim();
    const cleanMessage = notifMessage.trim();
    if (!cleanTitle || !cleanMessage) {
      setFeedback({ text: "Please enter both a Title and Message.", ok: false });
      return;
    }

    let targetName: string | undefined;
    if (notifTarget === "candidate") {
      const picked = candidates.find((c) => c.guest_uuid === notifTargetGuestUuid);
      if (!picked) {
        setFeedback({ text: "Please select a candidate to notify.", ok: false });
        return;
      }
      targetName = picked.display_name;
    }

    setSendingNotif(true);
    setFeedback(null);
    const res = await adminSendNotification({
      target: notifTarget,
      targetGuestUuid: notifTarget === "candidate" ? notifTargetGuestUuid : undefined,
      targetName,
      title: cleanTitle,
      message: cleanMessage,
      imageUrl: notifImageUrl.trim() || undefined,
      actionType: notifActionType,
      actionLabel: notifActionLabel.trim() || undefined,
      actionUrl: notifActionType === "link" ? notifActionUrl.trim() || undefined : undefined,
    });
    setSendingNotif(false);
    setNotificationsList(res.list);
    onNotificationsChanged(res.list);

    if (res.ok) {
      setNeedsNotifTable(false);
      setNotifTitle("");
      setNotifMessage("");
      setNotifImageUrl("");
      setNotifActionLabel("");
      setNotifActionUrl("");
      setFeedback({
        text:
          notifTarget === "all"
            ? "Notification sent to ALL candidates!"
            : `Notification sent to ${targetName}!`,
        ok: true,
      });
    } else if (res.needsTableSetup) {
      setNeedsNotifTable(true);
      setFeedback({
        text: "Saved locally, but run the 1-time SQL below in Supabase so all students receive notifications.",
        ok: false,
      });
    } else {
      setFeedback({
        text: `Failed to send: ${res.errorMessage || "Unknown error"}`,
        ok: false,
      });
    }
  };

  const handleDeleteNotification = async (id: string) => {
    const res = await adminDeleteNotification(id);
    setNotificationsList(res.list);
    onNotificationsChanged(res.list);
    if (res.ok) {
      setFeedback({ text: "Notification deleted.", ok: true });
    } else {
      setFeedback({ text: `Could not delete: ${res.errorMessage || "Unknown error"}`, ok: false });
    }
  };

  const isCandidateInstalled = (c: AdminCandidateRow): boolean => {
    return Boolean(c.app_installed || c.app_installed_at || installStatusMap[c.guest_uuid]);
  };

  const installCounts = useMemo(() => {
    let installed = 0;
    for (const c of candidates) {
      if (isCandidateInstalled(c)) installed++;
    }
    return { installed, notInstalled: Math.max(0, candidates.length - installed) };
  }, [candidates, installStatusMap]);

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return candidates.filter((c) => {
      const installed = isCandidateInstalled(c);
      if (installFilter === "installed" && !installed) return false;
      if (installFilter === "not_installed" && installed) return false;
      if (!q) return true;
      return (
        c.display_name.toLowerCase().includes(q) ||
        (c.username || "").toLowerCase().includes(q) ||
        c.guest_uuid.toLowerCase().includes(q)
      );
    });
  }, [candidates, installFilter, installStatusMap, searchQuery]);

  // Derived Help support conversations & Full All-Chats Audit (including student-deleted messages!)
  const { helpThreads, botThreads, auditThreads, deletedMessageCount } = useMemo(() => {
    const nameByUuid = new Map<string, { displayName: string; username?: string | null; isBot?: boolean }>();
    for (const c of candidates) {
      nameByUuid.set(c.guest_uuid, { displayName: c.display_name, username: c.username, isBot: false });
    }
    for (const bName of BENCHMARK_PLAYERS) {
      const orig = bName.name;
      const ov = botOverrides[orig];
      const disp = ov?.name?.trim() || orig;
      nameByUuid.set(`bot_${orig}`, { displayName: disp, username: null, isBot: true });
      if (disp !== orig) {
        nameByUuid.set(`bot_${disp}`, { displayName: disp, username: null, isBot: true });
      }
    }
    const resolveLabel = (uuid: string, fallbackName: string) => {
      if (uuid === HELP_CHAT_UUID) return { displayName: "Help", username: null as string | null, isBot: false };
      const match = nameByUuid.get(uuid);
      if (match) return { displayName: match.displayName, username: match.username || null, isBot: Boolean(match.isBot) };
      if (uuid.startsWith("bot_")) {
        return { displayName: fallbackName || uuid.slice(4), username: null as string | null, isBot: true };
      }
      return {
        displayName: fallbackName || "Candidate",
        username: null as string | null,
        isBot: false,
      };
    };

    const helpMap = new Map<
      string,
      {
        candidateUuid: string;
        candidateName: string;
        username?: string | null;
        messages: ChatMessageRow[];
        lastMessage: ChatMessageRow;
        deletedCount: number;
      }
    >();

    const pairMap = new Map<
      string,
      {
        pairKey: string;
        leftUuid: string;
        leftName: string;
        leftUsername?: string | null;
        rightUuid: string;
        rightName: string;
        rightUsername?: string | null;
        messages: ChatMessageRow[];
        lastMessage: ChatMessageRow;
        deletedCount: number;
      }
    >();

    let totalDeleted = 0;
    const q = searchQuery.trim().toLowerCase();

    for (const m of chatMessages) {
      const isDeleted = Boolean(m.deleted_for_everyone || m.deleted_by_sender || m.deleted_by_recipient);
      if (isDeleted) totalDeleted++;

      // 1. Help inbox grouping
      if (m.sender_uuid === HELP_CHAT_UUID || m.recipient_uuid === HELP_CHAT_UUID) {
        const candUuid = m.sender_uuid === HELP_CHAT_UUID ? m.recipient_uuid : m.sender_uuid;
        const fallback = m.sender_uuid === HELP_CHAT_UUID ? m.recipient_name : m.sender_name;
        const info = resolveLabel(candUuid, fallback);
        const existing = helpMap.get(candUuid) || {
          candidateUuid: candUuid,
          candidateName: info.displayName,
          username: info.username,
          messages: [],
          lastMessage: m,
          deletedCount: 0,
        };
        existing.messages.push(m);
        existing.lastMessage = m;
        if (isDeleted) existing.deletedCount++;
        helpMap.set(candUuid, existing);
      }

      // 2. All conversation pairs grouping (for Admin Audit)
      const [aUuid, bUuid] =
        m.sender_uuid < m.recipient_uuid
          ? [m.sender_uuid, m.recipient_uuid]
          : [m.recipient_uuid, m.sender_uuid];
      const pairKey = `${aUuid}::${bUuid}`;
      const aFallback = m.sender_uuid === aUuid ? m.sender_name : m.recipient_name;
      const bFallback = m.sender_uuid === bUuid ? m.sender_name : m.recipient_name;
      const aInfo = resolveLabel(aUuid, aFallback);
      const bInfo = resolveLabel(bUuid, bFallback);

      const pairExisting = pairMap.get(pairKey) || {
        pairKey,
        leftUuid: aUuid,
        leftName: aInfo.displayName,
        leftUsername: aInfo.username,
        rightUuid: bUuid,
        rightName: bInfo.displayName,
        rightUsername: bInfo.username,
        messages: [],
        lastMessage: m,
        deletedCount: 0,
      };
      pairExisting.messages.push(m);
      pairExisting.lastMessage = m;
      if (isDeleted) pairExisting.deletedCount++;
      pairMap.set(pairKey, pairExisting);
    }

    const helpList = Array.from(helpMap.values())
      .filter(
        (t) =>
          !q ||
          t.candidateName.toLowerCase().includes(q) ||
          (t.username || "").toLowerCase().includes(q) ||
          t.messages.some((msg) => msg.body.toLowerCase().includes(q))
      )
      .sort((a, b) => Date.parse(b.lastMessage.created_at) - Date.parse(a.lastMessage.created_at));

    const auditList = Array.from(pairMap.values())
      .filter(
        (t) =>
          !q ||
          t.leftName.toLowerCase().includes(q) ||
          t.rightName.toLowerCase().includes(q) ||
          (t.leftUsername || "").toLowerCase().includes(q) ||
          (t.rightUsername || "").toLowerCase().includes(q) ||
          t.messages.some((msg) => msg.body.toLowerCase().includes(q))
      )
      .sort((a, b) => Date.parse(b.lastMessage.created_at) - Date.parse(a.lastMessage.created_at));

    const botList = auditList.filter(
      (t) => t.leftUuid.startsWith("bot_") || t.rightUuid.startsWith("bot_")
    );

    return { helpThreads: helpList, botThreads: botList, auditThreads: auditList, deletedMessageCount: totalDeleted };
  }, [botOverrides, candidates, chatMessages, searchQuery]);

  const questionInventory = useMemo(
    () => getQuestionInventory(mergeDynamicQuestions(dynamicQuestions), HIGH_LEVEL_TARGET_PER_MODE),
    [dynamicQuestions]
  );

  const msdDynamicQuestions = useMemo(
    () => dynamicQuestions.filter((q) => q.subject === "msd"),
    [dynamicQuestions]
  );

  const filteredDynamicQuestions = useMemo(() => {
    if (qListFilter === "msd") return dynamicQuestions.filter((q) => q.subject === "msd");
    if (qListFilter === "standard") return dynamicQuestions.filter((q) => q.subject !== "msd");
    return dynamicQuestions;
  }, [dynamicQuestions, qListFilter]);

  const msdAdminPhase = useMemo(
    () => resolveMsdEventPhase(msdConfig, botClockTick),
    [msdConfig, botClockTick]
  );

  const handleSendAdminHelpReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHelpUuid || sendingHelpReply) return;
    const text = helpReplyDraft.trim();
    if (!text) return;

    const cand = candidates.find((c) => c.guest_uuid === selectedHelpUuid);
    const candName =
      cand?.display_name ||
      helpThreads.find((t) => t.candidateUuid === selectedHelpUuid)?.candidateName ||
      "Candidate";

    setSendingHelpReply(true);
    setFeedback(null);
    const res = await adminSendHelpReply(selectedHelpUuid, candName, text);
    setSendingHelpReply(false);

    if (!res.ok || !res.message) {
      setFeedback({ text: `Reply failed: ${res.error || "Unknown error"}`, ok: false });
      return;
    }

    setHelpReplyDraft("");
    setChatMessages((prev) =>
      prev.some((m) => m.id === res.message!.id) ? prev : [...prev, res.message!]
    );
  };

  const handleSendBotReplyInThread = async (
    e: React.FormEvent,
    senderUuid: string,
    senderName: string,
    recipientUuid: string,
    recipientName: string
  ) => {
    e.preventDefault();
    if (sendingBotReply) return;
    const text = botReplyDraft.trim();
    if (!text) return;

    setSendingBotReply(true);
    setFeedback(null);
    const res = await adminSendMessageAs(senderUuid, senderName, recipientUuid, recipientName, text);
    setSendingBotReply(false);

    if (!res.ok || !res.message) {
      setFeedback({ text: `Send failed: ${res.error || "Unknown error"}`, ok: false });
      return;
    }

    setBotReplyDraft("");
    setChatMessages((prev) =>
      prev.some((m) => m.id === res.message!.id) ? prev : [...prev, res.message!]
    );
  };

  const istTodayXpMap = useMemo(() => {
    const todayKey = getIstClock(botClockTick).dateKey;
    const byGuest = new Map<string, number>();
    const byName = new Map<string, number>();
    for (const a of attempts) {
      const ms = Date.parse(a.created_at);
      if (!Number.isFinite(ms)) continue;
      if (getIstClock(ms).dateKey !== todayKey) continue;
      const earned = Number(a.xp_earned) || 0;
      if (a.guest_uuid) {
        byGuest.set(a.guest_uuid, (byGuest.get(a.guest_uuid) || 0) + earned);
      } else if (a.candidate_name) {
        byName.set(a.candidate_name, (byName.get(a.candidate_name) || 0) + earned);
      }
    }
    return { byGuest, byName };
  }, [attempts, botClockTick]);

  const getCandidateAttemptsTodayIstXp = (c: AdminCandidateRow): number => {
    const val = istTodayXpMap.byGuest.get(c.guest_uuid) ?? istTodayXpMap.byName.get(c.display_name) ?? 0;
    return Math.max(0, val);
  };

  const getCandidateTodayIstXp = (c: AdminCandidateRow): number => {
    const attemptsVal = getCandidateAttemptsTodayIstXp(c);
    const todayKey = getIstClock(botClockTick).dateKey;
    const ov = candidateTodayOverrides[c.guest_uuid];
    const adminDelta = ov && ov.dateKey === todayKey ? ov.delta : 0;
    return Math.max(0, attemptsVal + adminDelta);
  };

  const botSchedule = useMemo(() => {
    const realTodayScores = candidates.filter((c) => !c.hidden).map((c) => getCandidateTodayIstXp(c));
    return resolveBotRoster(botOverrides, realTodayScores, botClockTick, botDailyCeilings);
  }, [botClockTick, botDailyCeilings, botOverrides, candidateTodayOverrides, candidates, istTodayXpMap]);

  useEffect(() => {
    const key = botSchedule.clock.dateKey;
    const ceil = botSchedule.competitionCeiling;
    if (ceil > (botDailyCeilings[key] || 0)) {
      const next = { ...botDailyCeilings, [key]: ceil };
      setBotDailyCeilings(next);
      saveBotDailyCeilings(next);
      onBotDailyCeilingsChanged?.(next);
    }
  }, [botDailyCeilings, botSchedule.clock.dateKey, botSchedule.competitionCeiling, onBotDailyCeilingsChanged]);

  const filteredBots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return botSchedule.bots
      .filter((b) => !q || b.name.toLowerCase().includes(q))
      .sort((a, b) => b.xp - a.xp);
  }, [botSchedule.bots, searchQuery]);

  const filteredAttempts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return attempts;
    return attempts.filter(
      (a) =>
        (a.candidate_name || "").toLowerCase().includes(q) ||
        (a.subject || "").toLowerCase().includes(q)
    );
  }, [attempts, searchQuery]);

  const filteredTaps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return taps;
    return taps.filter(
      (t) =>
        (t.candidate_name || "").toLowerCase().includes(q) ||
        (t.action || "").toLowerCase().includes(q) ||
        (t.detail || "").toLowerCase().includes(q)
    );
  }, [taps, searchQuery]);

  const selectedAttempts = useMemo(() => {
    if (!selectedCandidate) return [];
    return attempts.filter(
      (a) =>
        a.guest_uuid === selectedCandidate.guest_uuid ||
        a.candidate_name === selectedCandidate.display_name
    );
  }, [attempts, selectedCandidate]);

  const selectedTaps = useMemo(() => {
    if (!selectedCandidate) return [];
    return taps.filter(
      (t) =>
        t.guest_uuid === selectedCandidate.guest_uuid ||
        t.candidate_name === selectedCandidate.display_name
    );
  }, [taps, selectedCandidate]);

  if (checkingAuth) {
    return (
      <div className="py-16 text-center text-sm text-[#5A6A92] dark:text-[#93A3CC]">
        Checking admin session…
      </div>
    );
  }

  if (!adminEmail) {
    return (
      <div className="max-w-md mx-auto space-y-5 py-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#1457E0] dark:text-[#5AA2FF] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Quiz</span>
        </button>

        <div className="amay-card rounded-[30px] p-7 space-y-5">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0B1B4D] dark:text-white">Admin Console</h1>
            <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC] mt-1">
              Sign in with your Supabase Admin account.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mb-1.5">
                Admin Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@amaysst.com"
                className="w-full h-11 px-3.5 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-3.5 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
              />
            </div>

            {loginError && <p className="text-sm text-[#D92D3A] dark:text-[#FF6B76]">{loginError}</p>}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full h-11 rounded-xl amay-play-btn text-white font-bold text-sm cursor-pointer disabled:opacity-60"
            >
              {loggingIn ? "Verifying…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1457E0] dark:text-[#5AA2FF] mb-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Quiz App</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1B4D] dark:text-white">
            AmaySST Admin Console
          </h1>
          <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">Signed in as {adminEmail}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadAllAdminData}
            className="h-10 px-3.5 rounded-xl amay-card text-sm font-bold text-[#1457E0] dark:text-[#5AA2FF] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="h-10 px-4 rounded-xl amay-card text-sm font-bold text-[#D92D3A] dark:text-[#FF6B76] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Candidates", value: stats.users },
          { label: "Quiz Results", value: stats.tests },
          { label: "Added Questions", value: stats.questions },
          { label: "Total Community XP", value: stats.totalXp.toLocaleString() },
        ].map((st) => (
          <div key={st.label} className="amay-card rounded-[22px] p-4">
            <div className="text-2xl font-extrabold text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
              {st.value}
            </div>
            <div className="text-xs text-[#5A6A92] dark:text-[#93A3CC] mt-0.5">{st.label}</div>
          </div>
        ))}
      </div>

      {/* Navigation Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex flex-wrap p-1 rounded-2xl amay-card gap-1">
          {(
            [
              ["candidates", "Everyone & XP"],
              ["messages", `Messages & Help (${chatMessages.length})`],
              ["attempts", "Every Result"],
              ["taps", "Every Tap"],
              ["questions", "Questions & Bulk Upload"],
              ["video", "Latest Video"],
              ["notifications", "Notifications"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setFeedback(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                tab === id
                  ? "bg-[#1457E0] text-white"
                  : "text-[#5A6A92] dark:text-[#93A3CC] hover:text-[#0B1B4D] dark:hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab !== "questions" && tab !== "video" && tab !== "notifications" && (
          <div className="relative sm:w-64">
            <Search className="w-4 h-4 text-[#5A6A92] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, ID, or subject…"
              className="w-full h-10 pl-9 pr-3.5 rounded-xl amay-card text-sm focus:outline-none"
            />
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-sm font-semibold border ${
            feedback.ok
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* TAB 1: EVERYONE (CANDIDATES + BOTS) & XP / RENAME CONTROL */}
      {tab === "candidates" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex p-1 rounded-xl amay-card gap-1">
              <button
                type="button"
                onClick={() => setCandidateFilter("students")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  candidateFilter === "students"
                    ? "bg-[#0B1B4D] dark:bg-[#1457E0] text-white"
                    : "text-[#5A6A92] dark:text-[#93A3CC]"
                }`}
              >
                Registered Candidates ({candidates.length})
              </button>
              <button
                type="button"
                onClick={() => setCandidateFilter("bots")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  candidateFilter === "bots"
                    ? "bg-[#0B1B4D] dark:bg-[#1457E0] text-white"
                    : "text-[#5A6A92] dark:text-[#93A3CC]"
                }`}
              >
                Bot Roster ({BENCHMARK_PLAYERS.length})
              </button>
            </div>

            {candidateFilter === "students" && (
              <div className="inline-flex flex-wrap p-1 rounded-xl amay-card gap-1">
                <button
                  type="button"
                  onClick={() => setInstallFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    installFilter === "all"
                      ? "bg-[#1457E0] text-white"
                      : "text-[#5A6A92] dark:text-[#93A3CC]"
                  }`}
                >
                  All ({candidates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setInstallFilter("installed")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                    installFilter === "installed"
                      ? "bg-emerald-600 text-white"
                      : "text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Installed ({installCounts.installed})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInstallFilter("not_installed")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    installFilter === "not_installed"
                      ? "bg-amber-600 text-white"
                      : "text-amber-700 dark:text-amber-300"
                  }`}
                >
                  Not Installed ({installCounts.notInstalled})
                </button>
              </div>
            )}
          </div>

          {candidateFilter === "students" ? (
            <div className="amay-card rounded-[26px] overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#1846AA]/12 dark:border-white/10 text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                  <tr>
                    <th className="py-3.5 px-4">Rank</th>
                    <th className="py-3.5 px-4">Name</th>
                    <th className="py-3.5 px-4">Username</th>
                    <th className="py-3.5 px-4">Password</th>
                    <th className="py-3.5 px-4">App Status</th>
                    <th className="py-3.5 px-4">Total XP</th>
                    <th className="py-3.5 px-4">Today XP</th>
                    <th className="py-3.5 px-4">Streak</th>
                    <th className="py-3.5 px-4">Quizzes</th>
                    <th className="py-3.5 px-4 text-right">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1846AA]/10 dark:divide-white/10">
                  {filteredCandidates.map((c, idx) => {
                    const isRenaming = renamingId === c.guest_uuid;
                    const installed = isCandidateInstalled(c);
                    return (
                      <tr key={c.guest_uuid} className={c.hidden ? "opacity-50" : ""}>
                        <td className="py-3 px-4 font-mono-nums font-bold">#{idx + 1}</td>
                        <td className="py-3 px-4 font-bold">
                          {isRenaming ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                maxLength={24}
                                value={renameDraft}
                                onChange={(e) => setRenameDraft(e.target.value)}
                                className="h-8 px-2.5 rounded-lg bg-white dark:bg-[#0B1224] border border-[#1457E0] text-xs font-bold"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleQuickRename(c)}
                                className="px-2.5 py-1 rounded-lg bg-[#12A150] text-white text-xs font-bold cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setRenamingId(null)}
                                className="px-2 py-1 rounded-lg amay-card text-xs cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openCandidateEditor(c)}
                              className="text-left group cursor-pointer"
                              title="Click to inspect or open this candidate's ID"
                            >
                              <span className="block text-[#0B1B4D] dark:text-white group-hover:text-[#1457E0] dark:group-hover:text-[#5AA2FF] group-hover:underline">
                                {c.display_name}
                                {c.hidden ? " (Hidden)" : ""}
                              </span>
                              <span className="block text-[11px] font-mono-nums font-medium text-[#5A6A92] dark:text-[#93A3CC]">
                                ID: {c.guest_uuid.slice(0, 14)}{c.guest_uuid.length > 14 ? "…" : ""}
                              </span>
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono-nums text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF] whitespace-nowrap">
                          {c.username ? `@${c.username}` : <span className="text-[#5A6A92]/60 font-normal">—</span>}
                        </td>
                        <td className="py-3 px-4 font-mono-nums text-xs font-semibold text-[#0B1B4D] dark:text-white whitespace-nowrap select-all">
                          {c.password ? c.password : <span className="text-[#5A6A92]/60 font-normal">—</span>}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {installed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              <Smartphone className="w-3 h-3" />
                              <span>Installed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/12 text-amber-800 dark:text-amber-300 border border-amber-500/25">
                              Not Installed
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono-nums font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
                          {c.xp} XP
                        </td>
                        <td className="py-3 px-4 font-mono-nums">{getCandidateTodayIstXp(c)}</td>
                        <td className="py-3 px-4 font-mono-nums">{c.streak}🔥</td>
                        <td className="py-3 px-4 font-mono-nums">{c.quizzes_count}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openNotifyForCandidate(c)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                              title="Send notification to this candidate"
                            >
                              <Bell className="w-3.5 h-3.5" />
                              <span>Notify</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => launchCandidateIdView(c)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                              title="Open app logged in as this candidate's ID"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open ID</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingId(c.guest_uuid);
                                setRenameDraft(c.display_name);
                              }}
                              className="px-2.5 py-1.5 rounded-lg amay-card text-[#0B1B4D] dark:text-white text-xs font-bold cursor-pointer"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => openCandidateEditor(c)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#1457E0] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit / Inspect</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleCandidateHidden(c)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer ${
                                c.hidden ? "bg-[#12A150]" : "bg-[#D92D3A]"
                              }`}
                            >
                              {c.hidden ? "Restore" : "Remove"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-4">
              {needsBotTable && (
                <div className="amay-card rounded-[24px] p-5 border-2 border-amber-400/60 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-amber-800 dark:text-amber-300">
                        One-time Supabase setup needed so ALL students see updated Bot XP
                      </h3>
                      <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                        Run this SQL once in Supabase → SQL Editor, then click Sync Bot Edits to All Phones.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(SETTINGS_SQL);
                        setCopiedBotSql(true);
                        setTimeout(() => setCopiedBotSql(false), 2000);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedBotSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedBotSql ? "Copied SQL" : "Copy SQL"}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-950 text-slate-100 text-[11px] overflow-x-auto font-mono">
                    {SETTINGS_SQL}
                  </pre>
                </div>
              )}

              <div className="amay-card rounded-[22px] p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                    Showing all {filteredBots.length} bots sorted by Total XP. Daily auto-XP adds from <strong>2:00 AM – 11:00 PM IST</strong> (<strong>500 – {botSchedule.competitionCeiling.toLocaleString()} XP</strong>, matching top real score {botSchedule.maxRealTodayXp.toLocaleString()} XP) into both Today &amp; Overall XP, and resets Today XP to <strong>0</strong> at <strong>12:00 AM IST</strong> daily.
                  </p>
                  <button
                    type="button"
                    onClick={handleSyncAllBotsToCloud}
                    className="px-3.5 py-2 rounded-xl bg-[#1457E0] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync Bot Edits to All Phones</span>
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                  <span className="px-2.5 py-1 rounded-full bg-[#1457E0]/10 text-[#1457E0] dark:text-[#5AA2FF]">
                    Clock: {botSchedule.clock.timeLabel}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full ${
                      botSchedule.clock.phase === "active"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : botSchedule.clock.phase === "reset_wait"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-slate-500/15 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {botSchedule.clock.phase === "active"
                      ? "Active Window (2:00 AM – 11:00 PM)"
                      : botSchedule.clock.phase === "reset_wait"
                      ? "Midnight Reset (0 Today XP until 2:00 AM)"
                      : "Daily Earning Done (Resets at 12:00 AM)"}
                  </span>
                </div>
              </div>

              <div className="amay-card rounded-[26px] overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#1846AA]/12 dark:border-white/10 text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                    <tr>
                      <th className="py-3.5 px-4">Rank</th>
                      <th className="py-3.5 px-4">Name</th>
                      <th className="py-3.5 px-4">Total XP</th>
                      <th className="py-3.5 px-4">Today XP</th>
                      <th className="py-3.5 px-4 text-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1846AA]/10 dark:divide-white/10">
                    {filteredBots.map((b, idx) => {
                      const isEditing = editingBotOriginalName === b.originalName;
                      return (
                        <tr key={b.originalName}>
                          <td className="py-3 px-4 font-mono-nums font-bold">#{idx + 1}</td>
                          <td className="py-3 px-4 font-bold">
                            {isEditing ? (
                              <input
                                type="text"
                                value={botDraftName}
                                onChange={(e) => setBotDraftName(e.target.value)}
                                className="h-8 px-2.5 rounded-lg bg-white dark:bg-[#0B1224] border border-[#1457E0] text-xs font-bold"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenCandidateId({
                                    guestUuid: `bot_${b.originalName}`,
                                    name: b.name,
                                    xp: b.xp,
                                    todayXp: b.todayXp,
                                    streak: 3,
                                    quizzes: Math.max(1, Math.floor(b.xp / 120)),
                                    perfect: 0,
                                    botOriginalName: b.originalName,
                                  })
                                }
                                className="text-left hover:text-[#1457E0] dark:hover:text-[#5AA2FF] hover:underline cursor-pointer"
                                title="Click to open app view for this ID"
                              >
                                {b.name}
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono-nums font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
                            {isEditing ? (
                              <input
                                type="number"
                                min={0}
                                value={botDraftXp}
                                onChange={(e) => {
                                  const nextTotal = Math.max(0, Math.round(Number(e.target.value) || 0));
                                  setBotDraftXp(nextTotal);
                                  setBotBaseWithoutToday(nextTotal - botDraftTodayXp);
                                }}
                                className="w-24 h-8 px-2.5 rounded-lg bg-white dark:bg-[#0B1224] border border-[#1457E0] text-xs font-mono-nums font-bold"
                              />
                            ) : (
                              `${b.xp} XP`
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono-nums">
                            {isEditing ? (
                              <input
                                type="number"
                                min={0}
                                value={botDraftTodayXp}
                                onChange={(e) => {
                                  const nextToday = Math.max(0, Math.round(Number(e.target.value) || 0));
                                  setBotDraftTodayXp(nextToday);
                                  setBotDraftXp(Math.max(0, botBaseWithoutToday + nextToday));
                                }}
                                className="w-20 h-8 px-2.5 rounded-lg bg-white dark:bg-[#0B1224] border border-[#1457E0] text-xs font-mono-nums font-bold"
                              />
                            ) : (
                              `${b.todayXp} XP`
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <div className="inline-flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSaveBotEdit(b)}
                                  className="px-2.5 py-1 rounded-lg bg-[#12A150] text-white text-xs font-bold cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingBotOriginalName(null)}
                                  className="px-2.5 py-1 rounded-lg amay-card text-xs cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenCandidateId({
                                      guestUuid: `bot_${b.originalName}`,
                                      name: b.name,
                                      xp: b.xp,
                                      todayXp: b.todayXp,
                                      streak: 3,
                                      quizzes: Math.max(1, Math.floor(b.xp / 120)),
                                      perfect: 0,
                                      botOriginalName: b.originalName,
                                    })
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Open ID</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBotOriginalName(b.originalName);
                                    setBotDraftName(b.name);
                                    setBotDraftXp(b.xp);
                                    setBotDraftTodayXp(b.todayXp);
                                    setBotBaseWithoutToday(b.xp - b.todayXp);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#1457E0] text-white text-xs font-bold cursor-pointer"
                                >
                                  Rename / Edit XP
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EVERY QUIZ RESULT */}
      {tab === "attempts" && (
        <div className="amay-card rounded-[26px] overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#1846AA]/12 dark:border-white/10 text-xs text-[#5A6A92] dark:text-[#93A3CC]">
              <tr>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Candidate</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">Score</th>
                <th className="py-3.5 px-4">Accuracy</th>
                <th className="py-3.5 px-4">XP Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1846AA]/10 dark:divide-white/10">
              {filteredAttempts.map((a, idx) => {
                const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
                return (
                  <tr key={a.id || idx}>
                    <td className="py-3 px-4 font-mono-nums text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                      {new Date(a.created_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4 font-bold">
                      <button
                        type="button"
                        onClick={() => openInspectorByIdentity(a.guest_uuid, a.candidate_name)}
                        className="text-left text-[#1457E0] dark:text-[#5AA2FF] hover:underline cursor-pointer"
                        title="Click to open this candidate's ID"
                      >
                        {a.candidate_name}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-semibold">{String(a.subject || "").toUpperCase()}</td>
                    <td className="py-3 px-4 font-mono-nums font-bold">
                      {a.score} / {a.total}
                    </td>
                    <td className="py-3 px-4 font-mono-nums">{pct}%</td>
                    <td className="py-3 px-4 font-mono-nums font-bold text-[#1457E0] dark:text-[#5AA2FF]">
                      +{a.xp_earned} XP
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: EVERY TAP & INTERACTION LOG */}
      {tab === "taps" && (
        <div className="space-y-4">
          {needsTapTable && (
            <div className="amay-card rounded-[24px] p-5 space-y-3 border border-amber-400/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-[#0B1B4D] dark:text-white">
                    Enable Cross-Device Live Tap Sync in Supabase (1-time SQL)
                  </h2>
                  <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] mt-1">
                    Showing taps recorded on this browser right now. Run this SQL once in your Supabase SQL Editor to receive every tap from all student phones live:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(TAP_SQL);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2500);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1457E0] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? "Copied SQL" : "Copy SQL"}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono-nums bg-[#060A16] text-blue-100 p-3 rounded-xl overflow-x-auto">
                {TAP_SQL}
              </pre>
            </div>
          )}

          <div className="amay-card rounded-[26px] overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#1846AA]/12 dark:border-white/10 text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                <tr>
                  <th className="py-3.5 px-4">Time</th>
                  <th className="py-3.5 px-4">Candidate</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Tap Detail</th>
                  <th className="py-3.5 px-4">Screen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1846AA]/10 dark:divide-white/10">
                {filteredTaps.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-[#5A6A92]">
                      No tap events recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredTaps.map((t, idx) => (
                    <tr key={t.id || `${t.created_at}-${idx}`}>
                      <td className="py-3 px-4 font-mono-nums text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                        {new Date(t.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <button
                          type="button"
                          onClick={() => openInspectorByIdentity(t.guest_uuid, t.candidate_name)}
                          className="text-left text-[#1457E0] dark:text-[#5AA2FF] hover:underline cursor-pointer"
                          title="Click to open this candidate's ID"
                        >
                          {t.candidate_name}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#1457E0] dark:text-[#5AA2FF]">
                        {t.action}
                      </td>
                      <td className="py-3 px-4">{t.detail}</td>
                      <td className="py-3 px-4 text-xs text-[#5A6A92] dark:text-[#93A3CC]">{t.screen}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: QUESTIONS & BULK FILE UPLOAD */}
      {tab === "questions" && (
        <div className="space-y-5">
          {/* MS Dhoni 24-Hour Retirement Special Event Control */}
          <div className="amay-msd-card rounded-[28px] p-5 sm:p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <img
                  src="./msd-badge.jpg"
                  alt="MS Dhoni #7 Special"
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-[#0B1B4D]/25 dark:border-yellow-400/50 shadow-md shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0B1B4D] text-[#FDE047] text-[10px] font-extrabold uppercase tracking-wider">
                      <Crown className="w-3 h-3" />
                      <span>24h CSK Event</span>
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                        msdAdminPhase.phase === "live"
                          ? "bg-emerald-600 text-white"
                          : msdAdminPhase.phase === "ended"
                          ? "bg-slate-700 text-white"
                          : "bg-amber-600/20 text-[#5D3200] dark:text-[#FDE047]"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>
                        {msdAdminPhase.phase === "live"
                          ? `LIVE · ${msdAdminPhase.remainingLabel} left`
                          : msdAdminPhase.phase === "ended"
                          ? "Ended (24h complete)"
                          : "Coming Soon on Dashboard"}
                      </span>
                    </span>
                  </div>
                  <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-[#FEF08A] mt-1">
                    MS Dhoni Retirement Special (20Q · 1 Attempt · Separate Board)
                  </h2>
                  <p className="text-xs font-semibold text-[#473100] dark:text-amber-100/80 mt-0.5">
                    Questions uploaded for MS Dhoni:{" "}
                    <strong className="font-mono-nums">
                      {msdDynamicQuestions.length} / {MSD_QUESTION_TARGET}
                    </strong>{" "}
                    · Leaderboard entries: <strong className="font-mono-nums">{msdBoard.length}</strong> · Does NOT add to Normal XP
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {msdAdminPhase.phase !== "live" ? (
                  <button
                    type="button"
                    disabled={msdSavingConfig}
                    onClick={() => handleSetMsdStatus("live")}
                    className="h-11 px-5 rounded-xl amay-msd-btn text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 shadow-md"
                  >
                    <Trophy className="w-4 h-4" />
                    <span>
                      {msdSavingConfig
                        ? "Activating…"
                        : msdAdminPhase.phase === "ended"
                        ? "Restart Competition Live (24h)"
                        : "Make Competition Live (24h)"}
                    </span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={msdSavingConfig}
                      onClick={() => handleSetMsdStatus("coming_soon")}
                      className="h-10 px-4 rounded-xl bg-white/90 dark:bg-[#0B1224] text-[#0B1B4D] dark:text-[#FDE047] border border-[#0B1B4D]/20 text-xs font-extrabold cursor-pointer disabled:opacity-60"
                    >
                      Set Coming Soon
                    </button>
                    <button
                      type="button"
                      disabled={msdSavingConfig}
                      onClick={() => handleSetMsdStatus("ended")}
                      className="h-10 px-4 rounded-xl bg-[#D92D3A] text-white text-xs font-extrabold cursor-pointer disabled:opacity-60"
                    >
                      End Now
                    </button>
                  </>
                )}
              </div>
            </div>

            {msdDynamicQuestions.length < MSD_QUESTION_TARGET && (
              <div className="rounded-2xl bg-white/65 dark:bg-[#0B1224]/70 border border-amber-500/35 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[#5D3200] dark:text-amber-200">
                  {msdDynamicQuestions.length === 0
                    ? "Upload up to 20 MS Dhoni questions below, then click Make Competition Live (24h)."
                    : `${msdDynamicQuestions.length} of 20 MS Dhoni questions ready (${MSD_QUESTION_TARGET - msdDynamicQuestions.length} remaining for full 20Q set).`}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQEntryMode("single");
                      setQSub("msd");
                      setQListFilter("msd");
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#0B1B4D] text-[#FDE047] font-extrabold text-[11px] cursor-pointer"
                  >
                    + Add MS Dhoni Question
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQEntryMode("bulk");
                      setBulkDefaultSub("msd");
                      setQListFilter("msd");
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#14203E] text-[#0B1B4D] dark:text-[#FDE047] border border-[#0B1B4D]/20 font-extrabold text-[11px] cursor-pointer"
                  >
                    Bulk Upload MS Dhoni Qs
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-500/25">
              <button
                type="button"
                onClick={() => setShowMsdBoardPanel((v) => !v)}
                className="text-xs font-extrabold text-[#0B1B4D] dark:text-[#FDE047] inline-flex items-center gap-1.5 cursor-pointer hover:underline"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>
                  {showMsdBoardPanel ? "Hide" : "View"} MS Dhoni Trophy Leaderboard ({msdBoard.length} submitted)
                </span>
              </button>

              {msdBoard.length > 0 && (
                msdResetConfirm ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetMsdBoard}
                      className="px-2.5 py-1 rounded-lg bg-[#D92D3A] text-white text-[11px] font-extrabold cursor-pointer"
                    >
                      Confirm Clear Board
                    </button>
                    <button
                      type="button"
                      onClick={() => setMsdResetConfirm(false)}
                      className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-[#0B1224] text-[11px] font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMsdResetConfirm(true)}
                    className="text-[11px] font-bold text-[#D92D3A] dark:text-[#FF8A93] hover:underline cursor-pointer"
                  >
                    Clear Dhoni Leaderboard
                  </button>
                )
              )}
            </div>

            {showMsdBoardPanel && (
              <div className="rounded-2xl bg-white/80 dark:bg-[#0B1224]/85 p-3.5 space-y-2.5 border border-amber-500/25">
                {msdBoard.length === 0 ? (
                  <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">No MS Dhoni submissions yet.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto divide-y divide-amber-500/15 text-xs">
                    {msdBoard.map((row, idx) => (
                      <div key={row.guest_uuid} className="py-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono-nums font-extrabold text-[#0B1B4D] dark:text-[#FDE047] w-6">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-[#0B1B4D] dark:text-white truncate">
                            {row.candidate_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono-nums font-extrabold text-[#0B1B4D] dark:text-[#FDE047]">
                            {row.score}/{row.total}
                          </span>
                          <span className="font-mono-nums text-[#5A6A92] dark:text-[#93A3CC]">
                            {row.time_taken_sec}s
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteMsdEntry(row.guest_uuid)}
                            aria-label="Remove submission"
                            className="p-1 text-[#5A6A92] hover:text-[#D92D3A] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {needsMsdSql && (
              <div className="rounded-2xl bg-white/85 dark:bg-[#0B1224] border border-amber-500/40 p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold text-[#0B1B4D] dark:text-[#FDE047]">
                      1-time Supabase SQL needed for Global MS Dhoni Rank Board &amp; 1-Attempt Lock
                    </p>
                    <p className="text-[11px] text-[#5A6A92] dark:text-[#93A3CC]">
                      Run Section 10 from supabase-setup.sql in Supabase SQL Editor.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(MSD_SQL);
                      setCopiedMsdSql(true);
                      setTimeout(() => setCopiedMsdSql(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#0B1B4D] text-[#FDE047] font-extrabold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedMsdSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedMsdSql ? "Copied SQL" : "Copy SQL"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Question Bank Inventory & High-Level Gap Advisor */}
          <div className="amay-card rounded-[28px] p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">
                  Question Bank Inventory (By Subject &amp; Mode)
                </h2>
                <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] mt-0.5">
                  Built-in + live uploaded questions · Recommended high-level depth:{" "}
                  <strong className="font-mono-nums">{HIGH_LEVEL_TARGET_PER_MODE}+</strong> Hard &amp;{" "}
                  <strong className="font-mono-nums">{HIGH_LEVEL_TARGET_PER_MODE}+</strong> Amay Special per subject
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                <span className="text-[#0B1B4D] dark:text-white font-mono-nums">
                  Total Bank: {questionInventory.grandTotal} Qs
                </span>
                <span className="text-[#1457E0] dark:text-[#5AA2FF] font-mono-nums">
                  Mixed High-Level Pool (Hard + Amay Special): {questionInventory.highLevelTotal} Qs
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#1846AA]/15 dark:border-white/10 text-[11px] uppercase tracking-wider text-[#5A6A92] dark:text-[#93A3CC]">
                    <th className="py-2 pr-3 font-extrabold">Subject</th>
                    <th className="py-2 px-2 text-right font-extrabold">Easy</th>
                    <th className="py-2 px-2 text-right font-extrabold">Medium</th>
                    <th className="py-2 px-2 text-right font-extrabold">Hard</th>
                    <th className="py-2 px-2 text-right font-extrabold">Amay Special</th>
                    <th className="py-2 px-2 text-right font-extrabold">Total</th>
                    <th className="py-2 pl-3 text-right font-extrabold">High-Level Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1846AA]/10 dark:divide-white/10">
                  {questionInventory.rows.map((row) => {
                    const needsHard = row.counts[2] < HIGH_LEVEL_TARGET_PER_MODE;
                    const needsSpecial = row.counts[3] < HIGH_LEVEL_TARGET_PER_MODE;
                    const ready = !needsHard && !needsSpecial;
                    return (
                      <tr key={row.subject} className="hover:bg-[#1457E0]/[0.03] dark:hover:bg-white/[0.03]">
                        <td className="py-2.5 pr-3 font-bold text-[#0B1B4D] dark:text-white whitespace-nowrap">
                          <span className="mr-1.5" aria-hidden="true">
                            {row.emoji}
                          </span>
                          {row.name}
                          {row.dynamicTotal > 0 && (
                            <span className="ml-1.5 text-[11px] font-semibold text-[#12A150] dark:text-emerald-400 font-mono-nums">
                              (+{row.dynamicTotal} live)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono-nums font-semibold text-[#5A6A92] dark:text-[#93A3CC]">
                          {row.counts[0]}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono-nums font-semibold text-[#5A6A92] dark:text-[#93A3CC]">
                          {row.counts[1]}
                        </td>
                        <td
                          className={`py-2.5 px-2 text-right font-mono-nums font-extrabold ${
                            needsHard
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-[#0B1B4D] dark:text-white"
                          }`}
                        >
                          {row.counts[2]}
                        </td>
                        <td
                          className={`py-2.5 px-2 text-right font-mono-nums font-extrabold ${
                            needsSpecial
                              ? "text-[#D92D3A] dark:text-[#FF6B76]"
                              : "text-[#1457E0] dark:text-[#5AA2FF]"
                          }`}
                        >
                          {row.counts[3]}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono-nums font-extrabold text-[#0B1B4D] dark:text-white">
                          {row.total}
                        </td>
                        <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                          {ready ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#12A150] dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Add more
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-[#1846AA]/20 dark:border-white/15 bg-[#1457E0]/[0.05] dark:bg-white/[0.04] font-extrabold text-[#0B1B4D] dark:text-white">
                    <td className="py-2.5 pr-3">Normal Mixed Quiz (All Subjects)</td>
                    <td className="py-2.5 px-2 text-right font-mono-nums">{questionInventory.modeTotals[0]}</td>
                    <td className="py-2.5 px-2 text-right font-mono-nums">{questionInventory.modeTotals[1]}</td>
                    <td className="py-2.5 px-2 text-right font-mono-nums">{questionInventory.modeTotals[2]}</td>
                    <td className="py-2.5 px-2 text-right font-mono-nums text-[#1457E0] dark:text-[#5AA2FF]">
                      {questionInventory.modeTotals[3]}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono-nums">{questionInventory.grandTotal}</td>
                    <td className="py-2.5 pl-3 text-right text-xs font-mono-nums">
                      {questionInventory.highLevelTotal} Hard+Special
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {questionInventory.gaps.length > 0 ? (
              <div className="rounded-2xl border border-amber-400/35 bg-amber-500/[0.08] p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Needs More High-Level Questions ({questionInventory.gaps.length} subject-mode slot
                    {questionInventory.gaps.length === 1 ? "" : "s"} below {HIGH_LEVEL_TARGET_PER_MODE} Qs)
                  </span>
                </div>
                <p className="text-xs text-[#5A6A92] dark:text-[#DCE6FF]">
                  Top 20 &amp; Top 50 candidates play Hard / Amay Special in Mixed Quiz. Tap any slot below to add questions there directly:
                </p>
                <div className="flex flex-wrap gap-2">
                  {questionInventory.gaps.map((gap) => (
                    <button
                      key={`${gap.subject}-${gap.level}`}
                      type="button"
                      onClick={() => {
                        setQEntryMode("single");
                        setQSub(gap.subject);
                        setQLvl(gap.level);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/90 dark:bg-[#0B1224] border border-amber-500/35 text-xs font-bold text-[#0B1B4D] dark:text-white hover:border-[#1457E0] transition cursor-pointer"
                    >
                      + {gap.subjectName} · {gap.levelName}{" "}
                      <span className="font-mono-nums text-[#D92D3A] dark:text-[#FF6B76]">
                        ({gap.current}/{gap.target} · need {gap.needed})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#12A150]/25 bg-[#12A150]/[0.07] px-3.5 py-2.5 flex items-center gap-2 text-xs font-bold text-[#12A150] dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  All 6 subjects have {HIGH_LEVEL_TARGET_PER_MODE}+ Hard and {HIGH_LEVEL_TARGET_PER_MODE}+ Amay Special questions ready for Top 20 / Top 50 Mixed Quiz rotation.
                </span>
              </div>
            )}
          </div>

          <div className="inline-flex p-1 rounded-xl amay-card gap-1">
            <button
              type="button"
              onClick={() => setQEntryMode("single")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                qEntryMode === "single"
                  ? "bg-[#1457E0] text-white"
                  : "text-[#5A6A92] dark:text-[#93A3CC]"
              }`}
            >
              Add Single Question
            </button>
            <button
              type="button"
              onClick={() => setQEntryMode("bulk")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                qEntryMode === "bulk"
                  ? "bg-[#1457E0] text-white"
                  : "text-[#5A6A92] dark:text-[#93A3CC]"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Bulk Upload (PDF / CSV / TXT / JSON)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {qEntryMode === "single" ? (
              <form onSubmit={handleSaveQuestion} className="lg:col-span-7 amay-card rounded-[28px] p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">Publish New Question</h2>
                  <button
                    type="button"
                    onClick={() => {
                      const suggested = classifyQuestionDifficulty(qSub, qTxt, [qOa, qOb, qOc, qOd], qExp);
                      setQLvl(suggested);
                      setFeedback({
                        text: `Auto-categorised as "${LEVELS[suggested]}" based on question complexity.`,
                        ok: true,
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl amay-card text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Categorise Difficulty</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                      Subject
                    </label>
                    <select
                      value={qSub}
                      onChange={(e) => setQSub(e.target.value as AdminSubjectKey)}
                      className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                    >
                      <option value="msd">🏏 MS Dhoni Special (24h Event)</option>
                      <option value="ca">Current Affairs</option>
                      <option value="math">Mathematics</option>
                      <option value="sci">Science</option>
                      <option value="sst">Social Science</option>
                      <option value="eng">English</option>
                      <option value="hin">Hindi</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                      Difficulty
                    </label>
                    <select
                      value={qLvl}
                      onChange={(e) => setQLvl(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                    >
                      <option value={0}>Easy (10 XP)</option>
                      <option value={1}>Medium (15 XP)</option>
                      <option value={2}>Hard (20 XP)</option>
                      <option value={3}>Amay Special (30 XP)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                    Question Text
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={qTxt}
                    onChange={(e) => setQTxt(e.target.value)}
                    placeholder="Enter the question…"
                    className="w-full p-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    ["Option A", qOa, setQOa],
                    ["Option B", qOb, setQOb],
                    ["Option C", qOc, setQOc],
                    ["Option D", qOd, setQOd],
                  ].map(([label, val, setter]) => (
                    <div key={label as string}>
                      <label className="block text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                        {label as string}
                      </label>
                      <input
                        type="text"
                        required
                        value={val as string}
                        onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                      Correct Option
                    </label>
                    <select
                      value={qAns}
                      onChange={(e) => setQAns(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                    >
                      <option value={0}>Option A</option>
                      <option value={1}>Option B</option>
                      <option value={2}>Option C</option>
                      <option value={3}>Option D</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                      Explanation
                    </label>
                    <input
                      type="text"
                      required
                      value={qExp}
                      onChange={(e) => setQExp(e.target.value)}
                      placeholder="Why this answer is right"
                      className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingQ}
                  className="h-11 px-5 rounded-xl amay-play-btn text-white font-bold text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  <span>{savingQ ? "Publishing…" : "Publish to Live Quizzes"}</span>
                </button>
              </form>
            ) : (
              <div className="lg:col-span-7 amay-card rounded-[28px] p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">
                    Bulk Upload Questions
                  </h2>
                  <button
                    type="button"
                    onClick={downloadSampleCsv}
                    className="px-3 py-1.5 rounded-xl amay-card text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Sample CSV</span>
                  </button>
                </div>

                <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                  Upload a <strong>PDF</strong>, <strong>CSV</strong>, <strong>TXT</strong>, or <strong>JSON</strong> file.
                  For PDF/TXT, format questions like: <code>1. Question? A) Opt1 B) Opt2 C) Opt3 D) Opt4 Answer: A</code>.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                      Default Subject
                    </label>
                    <select
                      value={bulkDefaultSub}
                      onChange={(e) => setBulkDefaultSub(e.target.value as AdminSubjectKey)}
                      className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                    >
                      <option value="msd">🏏 MS Dhoni Special (24h Event)</option>
                      <option value="sst">Social Science</option>
                      <option value="ca">Current Affairs</option>
                      <option value="math">Mathematics</option>
                      <option value="sci">Science</option>
                      <option value="eng">English</option>
                      <option value="hin">Hindi</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                      Default Difficulty
                    </label>
                    <select
                      value={bulkDefaultLvl}
                      onChange={(e) => setBulkDefaultLvl(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                    >
                      <option value={0}>Easy (10 XP)</option>
                      <option value={1}>Medium (15 XP)</option>
                      <option value={2}>Hard (20 XP)</option>
                      <option value={3}>Amay Special (30 XP)</option>
                    </select>
                  </div>
                </div>

                <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-[#1457E0]/40 bg-[#1457E0]/[0.04] hover:bg-[#1457E0]/[0.08] transition-colors cursor-pointer text-center">
                  <FileText className="w-8 h-8 text-[#1457E0] dark:text-[#5AA2FF]" />
                  <span className="text-sm font-bold text-[#0B1B4D] dark:text-white">
                    {parsingFile ? "Reading file…" : "Click to choose PDF, CSV, TXT, or JSON file"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.csv,.txt,.json"
                    onChange={handleBulkFileChange}
                    className="hidden"
                  />
                </label>

                {rawExtractPreview && bulkQueue.length === 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#5A6A92]">Extracted text preview:</p>
                    <pre className="text-[11px] bg-[#060A16] text-blue-100 p-3 rounded-xl max-h-36 overflow-auto whitespace-pre-wrap">
                      {rawExtractPreview}
                    </pre>
                  </div>
                )}

                {bulkQueue.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm font-extrabold text-[#0B1B4D] dark:text-white">
                        Ready to publish: {bulkQueue.length} questions
                      </strong>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setBulkQueue((prev) =>
                              prev.map((q) => ({
                                ...q,
                                level: classifyQuestionDifficulty(
                                  q.subject,
                                  q.question_text,
                                  [q.option_a, q.option_b, q.option_c, q.option_d],
                                  q.explanation
                                ),
                              }))
                            );
                            setFeedback({
                              text: "Auto-categorised Easy, Medium, Hard & Amay Special across all queued questions.",
                              ok: true,
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl amay-card text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Auto-Categorise All</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkQueue([])}
                          className="px-3 py-1.5 rounded-xl amay-card text-xs font-bold cursor-pointer"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          disabled={publishingBulk}
                          onClick={handlePublishBulk}
                          className="px-4 py-1.5 rounded-xl amay-play-btn text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                        >
                          {publishingBulk ? "Publishing…" : `Publish All (${bulkQueue.length})`}
                        </button>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-[#1846AA]/10 dark:divide-white/10 pr-1">
                      {bulkQueue.map((item, idx) => (
                        <div key={idx} className="py-3 space-y-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <input
                              type="text"
                              value={item.question_text}
                              onChange={(e) => {
                                const next = [...bulkQueue];
                                next[idx] = { ...next[idx], question_text: e.target.value };
                                setBulkQueue(next);
                              }}
                              className="flex-1 h-8 px-2.5 rounded-lg bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => setBulkQueue((prev) => prev.filter((_, i) => i !== idx))}
                              className="p-1.5 text-[#D92D3A] cursor-pointer"
                              aria-label="Remove row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            <span>A: {item.option_a}</span>
                            <span>B: {item.option_b}</span>
                            <span>C: {item.option_c}</span>
                            <span>D: {item.option_d}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={item.subject}
                              onChange={(e) => {
                                const next = [...bulkQueue];
                                next[idx] = { ...next[idx], subject: e.target.value as AdminSubjectKey };
                                setBulkQueue(next);
                              }}
                              className="h-7 px-2 rounded-lg bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15"
                            >
                              <option value="msd">MSD #7</option>
                              <option value="sst">SST</option>
                              <option value="ca">CA</option>
                              <option value="math">Math</option>
                              <option value="sci">Sci</option>
                              <option value="eng">Eng</option>
                              <option value="hin">Hin</option>
                            </select>
                            <select
                              value={item.level}
                              onChange={(e) => {
                                const next = [...bulkQueue];
                                next[idx] = { ...next[idx], level: Number(e.target.value) };
                                setBulkQueue(next);
                              }}
                              className="h-7 px-2 rounded-lg bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 font-semibold"
                            >
                              <option value={0}>Easy</option>
                              <option value={1}>Medium</option>
                              <option value={2}>Hard</option>
                              <option value={3}>Amay Special</option>
                            </select>
                            <select
                              value={item.correct_index}
                              onChange={(e) => {
                                const next = [...bulkQueue];
                                next[idx] = { ...next[idx], correct_index: Number(e.target.value) };
                                setBulkQueue(next);
                              }}
                              className="h-7 px-2 rounded-lg bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 font-bold text-[#12A150]"
                            >
                              <option value={0}>Ans: A</option>
                              <option value={1}>Ans: B</option>
                              <option value={2}>Ans: C</option>
                              <option value={3}>Ans: D</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="lg:col-span-5 amay-card rounded-[28px] p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">
                  Added Questions ({filteredDynamicQuestions.length})
                </h2>
                <div className="inline-flex p-0.5 rounded-lg bg-[#1457E0]/[0.08] dark:bg-white/[0.06] text-[11px] font-bold">
                  {(
                    [
                      ["all", `All (${dynamicQuestions.length})`],
                      ["msd", `MSD (${msdDynamicQuestions.length})`],
                      ["standard", `Subjects (${dynamicQuestions.length - msdDynamicQuestions.length})`],
                    ] as const
                  ).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setQListFilter(k)}
                      className={`px-2 py-1 rounded-md cursor-pointer transition ${
                        qListFilter === k
                          ? k === "msd"
                            ? "bg-[#FACC15] text-[#0B1B4D]"
                            : "bg-[#1457E0] text-white"
                          : "text-[#5A6A92] dark:text-[#93A3CC]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              {filteredDynamicQuestions.length === 0 ? (
                <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC]">No added questions in this filter yet.</p>
              ) : (
                <div className="divide-y divide-[#1846AA]/10 dark:divide-white/10 max-h-[460px] overflow-y-auto pr-1">
                  {filteredDynamicQuestions.map((dq) => (
                    <div key={dq.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0B1B4D] dark:text-white">{dq.question_text}</p>
                        <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] mt-0.5">
                          <span
                            className={
                              dq.subject === "msd"
                                ? "font-extrabold text-amber-700 dark:text-[#FDE047]"
                                : ""
                            }
                          >
                            {dq.subject === "msd" ? "MS DHONI #7" : dq.subject.toUpperCase()}
                          </span>{" "}
                          · Level {dq.level + 1} ·{" "}
                          {[dq.option_a, dq.option_b, dq.option_c, dq.option_d][dq.correct_index]}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(dq.id)}
                        aria-label="Delete question"
                        className="p-2 text-[#5A6A92] hover:text-[#D92D3A] cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: LATEST VIDEO & THUMBNAIL */}
      {tab === "video" && (
        <div className="space-y-4">
          {needsVideoTable && (
            <div className="amay-card rounded-[24px] p-5 border-2 border-amber-400/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-amber-800 dark:text-amber-300">
                    One-time Supabase setup needed to sync Latest Video to all phones
                  </h3>
                  <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                    Run this SQL once in Supabase → SQL Editor, then click Save Latest Video again.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(SETTINGS_SQL);
                    setCopiedVideoSql(true);
                    setTimeout(() => setCopiedVideoSql(false), 2000);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedVideoSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedVideoSql ? "Copied SQL" : "Copy SQL"}</span>
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-slate-950 text-slate-100 text-[11px] overflow-x-auto font-mono">
                {SETTINGS_SQL}
              </pre>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <form
              onSubmit={handleSaveLatestVideo}
              className="lg:col-span-7 amay-card rounded-[28px] p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-[#1457E0] dark:text-[#5AA2FF]" />
                <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">
                  Update Latest Video & Thumbnail
                </h2>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                  Video Link (YouTube Short, YouTube Video, or any URL)
                </label>
                <input
                  type="url"
                  required
                  value={videoUrl}
                  onChange={(e) => handleVideoUrlChange(e.target.value)}
                  placeholder="https://youtube.com/shorts/..."
                  className="w-full h-11 px-3.5 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm focus:outline-none focus:border-[#1457E0]"
                />
                {deriveYouTubeThumbnail(videoUrl) && (
                  <button
                    type="button"
                    onClick={() => setVideoThumb(deriveYouTubeThumbnail(videoUrl))}
                    className="mt-1.5 text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF] hover:underline cursor-pointer"
                  >
                    Auto-fill thumbnail from YouTube link
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                    Card Title
                  </label>
                  <input
                    type="text"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="Latest video"
                    className="w-full h-11 px-3.5 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm focus:outline-none focus:border-[#1457E0]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                    Card Subtitle
                  </label>
                  <input
                    type="text"
                    value={videoSubtitle}
                    onChange={(e) => setVideoSubtitle(e.target.value)}
                    placeholder="Watch my latest Short · opens on YouTube"
                    className="w-full h-11 px-3.5 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm focus:outline-none focus:border-[#1457E0]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC]">
                  Thumbnail Image (paste URL or upload image from your device)
                </label>
                <input
                  type="text"
                  value={videoThumb}
                  onChange={(e) => setVideoThumb(e.target.value)}
                  placeholder="https://i.ytimg.com/vi/.../hqdefault.jpg"
                  className="w-full h-11 px-3.5 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm focus:outline-none focus:border-[#1457E0]"
                />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <label className="px-3.5 py-2 rounded-xl amay-card text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF] inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#1457E0]/10">
                    <ImageIcon className="w-4 h-4" />
                    <span>Upload Thumbnail Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailUpload}
                      className="hidden"
                    />
                  </label>
                  {videoThumb && (
                    <button
                      type="button"
                      onClick={() => setVideoThumb("")}
                      className="px-3 py-2 rounded-xl amay-card text-xs font-bold text-[#5A6A92] hover:text-[#D92D3A] cursor-pointer"
                    >
                      Clear Thumbnail
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={savingVideo}
                className="w-full h-12 rounded-2xl amay-play-btn text-white font-bold text-sm cursor-pointer disabled:opacity-60"
              >
                {savingVideo ? "Saving…" : "Save Latest Video & Thumbnail"}
              </button>
            </form>

            {/* Live Candidate View Preview */}
            <div className="lg:col-span-5 amay-card rounded-[28px] p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-[#0B1B4D] dark:text-white">
                  Candidate Home Preview
                </h3>
                <a
                  href={videoUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF] inline-flex items-center gap-1"
                >
                  <span>Test link</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="amay-card rounded-[26px] p-3.5 flex items-center gap-3.5">
                <div className="w-24 h-16 rounded-[16px] bg-gradient-to-br from-[#2B9BF6] to-[#0B57DD] flex items-center justify-center text-white shrink-0 relative overflow-hidden shadow-sm">
                  {videoThumb || deriveYouTubeThumbnail(videoUrl) ? (
                    <>
                      <img
                        src={videoThumb || deriveYouTubeThumbnail(videoUrl)}
                        alt="Video thumbnail preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                        <span className="w-8 h-8 rounded-full bg-black/65 flex items-center justify-center text-white text-xs pl-0.5">
                          ▶
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-xl ml-0.5">▶</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <strong className="block text-[16px] font-bold text-[#0B1B4D] dark:text-[#EAF0FF] truncate">
                    {videoTitle || "Latest video"}
                  </strong>
                  <span className="block text-xs text-[#5A6A92] dark:text-[#93A3CC] line-clamp-2 mt-0.5">
                    {videoSubtitle || "Watch my latest Short · opens on YouTube"}
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] leading-relaxed">
                Whenever you upload a new YouTube Short or video, just paste the new link here — its thumbnail fills in automatically, or you can upload any custom thumbnail image.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: MANUAL NOTIFICATIONS (ALL OR SPECIFIC CANDIDATE) */}
      {tab === "notifications" && (
        <div className="space-y-5">
          {needsNotifTable && (
            <div className="amay-card rounded-[24px] p-5 border-2 border-amber-400/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-amber-800 dark:text-amber-300">
                    One-time Supabase table needed for Live Notifications
                  </h3>
                  <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                    Run this SQL once in Supabase → SQL Editor so all students receive your notifications instantly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(SETTINGS_SQL);
                    setCopiedNotifSql(true);
                    setTimeout(() => setCopiedNotifSql(false), 2000);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedNotifSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedNotifSql ? "Copied SQL" : "Copy SQL"}</span>
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-slate-950 text-slate-100 text-[11px] overflow-x-auto font-mono">
                {SETTINGS_SQL}
              </pre>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <form
              onSubmit={handleSendNotification}
              className="lg:col-span-7 amay-card rounded-[28px] p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-2xl bg-[#1457E0]/12 text-[#1457E0] dark:text-[#5AA2FF] flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">
                    Send Notification
                  </h2>
                  <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                    Choose to broadcast to everyone in 1 click or target one particular candidate.
                  </p>
                </div>
              </div>

              {/* Exact 2 Audience Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setNotifTarget("all")}
                  className={`p-3.5 rounded-2xl text-left border-2 transition cursor-pointer flex items-start gap-2.5 ${
                    notifTarget === "all"
                      ? "border-[#1457E0] bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15"
                      : "border-[#1846AA]/12 dark:border-white/10 amay-card"
                  }`}
                >
                  <Users className="w-5 h-5 text-[#1457E0] dark:text-[#5AA2FF] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-sm font-extrabold text-[#0B1B4D] dark:text-white">
                      1. Send to All ({candidates.length})
                    </strong>
                    <span className="block text-[11px] text-[#5A6A92] dark:text-[#93A3CC]">
                      Broadcast to every student
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setNotifTarget("candidate")}
                  className={`p-3.5 rounded-2xl text-left border-2 transition cursor-pointer flex items-start gap-2.5 ${
                    notifTarget === "candidate"
                      ? "border-[#1457E0] bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15"
                      : "border-[#1846AA]/12 dark:border-white/10 amay-card"
                  }`}
                >
                  <User className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-sm font-extrabold text-[#0B1B4D] dark:text-white">
                      2. Particular Candidate
                    </strong>
                    <span className="block text-[11px] text-[#5A6A92] dark:text-[#93A3CC]">
                      Send private notice to 1 person
                    </span>
                  </div>
                </button>
              </div>

              {notifTarget === "candidate" && (
                <div className="space-y-2 rounded-2xl bg-[#1457E0]/[0.04] dark:bg-white/[0.04] p-3.5 border border-[#1846AA]/12 dark:border-white/10">
                  <label className="block text-xs font-bold text-[#0B1B4D] dark:text-white">
                    Pick Candidate
                  </label>
                  <input
                    type="search"
                    value={notifCandidateSearch}
                    onChange={(e) => setNotifCandidateSearch(e.target.value)}
                    placeholder="Filter candidate by name or ID…"
                    className="w-full h-9 px-3 rounded-xl bg-white/90 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-xs focus:outline-none focus:border-[#1457E0]"
                  />
                  <select
                    value={notifTargetGuestUuid}
                    onChange={(e) => setNotifTargetGuestUuid(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-white/90 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm font-semibold focus:outline-none focus:border-[#1457E0]"
                    required
                  >
                    <option value="">-- Select a candidate --</option>
                    {candidates
                      .filter((c) => {
                        const q = notifCandidateSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          c.display_name.toLowerCase().includes(q) ||
                          c.guest_uuid.toLowerCase().includes(q)
                        );
                      })
                      .map((c) => (
                        <option key={c.guest_uuid} value={c.guest_uuid}>
                          {c.display_name} ({c.xp} XP · {isCandidateInstalled(c) ? "Installed" : "Not Installed"})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                  Notification Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="e.g. Mega SST Test Tonight at 8 PM!"
                  className="w-full h-11 px-3.5 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm font-semibold focus:outline-none focus:border-[#1457E0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                  Message
                </label>
                <textarea
                  rows={3}
                  required
                  maxLength={400}
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  placeholder="Write your announcement or personal message here…"
                  className="w-full p-3.5 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm focus:outline-none focus:border-[#1457E0]"
                />
              </div>

              {/* Attach Picture (Optional) */}
              <div className="space-y-2 rounded-2xl bg-[#1457E0]/[0.04] dark:bg-white/[0.04] p-3.5 border border-[#1846AA]/12 dark:border-white/10">
                <label className="block text-xs font-bold text-[#0B1B4D] dark:text-white">
                  Picture / Poster (Optional)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3.5 py-2 rounded-xl amay-card text-xs font-bold text-[#1457E0] dark:text-[#5AA2FF] inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#1457E0]/10">
                    <ImageIcon className="w-4 h-4" />
                    <span>Upload Picture</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleNotifImageUpload}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    value={notifImageUrl.startsWith("data:") ? "" : notifImageUrl}
                    onChange={(e) => setNotifImageUrl(e.target.value)}
                    placeholder="Or paste image URL…"
                    className="flex-1 min-w-[160px] h-9 px-3 rounded-xl bg-white/90 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-xs focus:outline-none focus:border-[#1457E0]"
                  />
                  {notifImageUrl && (
                    <button
                      type="button"
                      onClick={() => setNotifImageUrl("")}
                      className="px-2.5 py-1.5 rounded-xl amay-card text-xs font-bold text-[#D92D3A] cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {notifImageUrl && (
                  <div className="overflow-hidden rounded-xl border border-[#1846AA]/15 dark:border-white/10 max-w-xs">
                    <img
                      src={notifImageUrl}
                      alt="Notification attachment preview"
                      className="w-full max-h-40 object-cover block"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                    Action Button (Optional)
                  </label>
                  <select
                    value={notifActionType}
                    onChange={(e) => setNotifActionType(e.target.value as NotificationActionType)}
                    className="w-full h-11 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                  >
                    <option value="none">No button</option>
                    <option value="play">Open Quiz (Play Now)</option>
                    <option value="ranks">Open Leaderboard</option>
                    <option value="video">Open Latest Video</option>
                    <option value="link">Custom Link URL</option>
                  </select>
                </div>

                {notifActionType !== "none" && (
                  <div>
                    <label className="block text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                      Button Label (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={32}
                      value={notifActionLabel}
                      onChange={(e) => setNotifActionLabel(e.target.value)}
                      placeholder="Default button text"
                      className="w-full h-11 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                    />
                  </div>
                )}
              </div>

              {notifActionType === "link" && (
                <div>
                  <label className="block text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                    Custom Link URL
                  </label>
                  <input
                    type="url"
                    required
                    value={notifActionUrl}
                    onChange={(e) => setNotifActionUrl(e.target.value)}
                    placeholder="https://youtube.com/..."
                    className="w-full h-11 px-3.5 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={sendingNotif}
                className="w-full h-12 rounded-2xl amay-play-btn text-white font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                <span>
                  {sendingNotif
                    ? "Sending…"
                    : notifTarget === "all"
                      ? "Send to All Candidates (1-Click)"
                      : `Send to ${
                          candidates.find((c) => c.guest_uuid === notifTargetGuestUuid)?.display_name ||
                          "Selected Candidate"
                        }`}
                </span>
              </button>
            </form>

            {/* Sent Notifications History + Live Seen Count */}
            <div className="lg:col-span-5 amay-card rounded-[28px] p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-[#0B1B4D] dark:text-white">
                  Sent Notifications ({notificationsList.length})
                </h3>
                <button
                  type="button"
                  onClick={async () => {
                    const seenMap = await adminLoadNotificationSeenMap();
                    setNotifSeenMap(seenMap);
                  }}
                  className="px-2.5 py-1 rounded-lg amay-card text-[11px] font-bold text-[#1457E0] dark:text-[#5AA2FF] inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh Views</span>
                </button>
              </div>

              {notificationsList.length === 0 ? (
                <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] py-6 text-center">
                  No notifications sent yet. Send one on the left!
                </p>
              ) : (
                <div className="max-h-[520px] overflow-y-auto space-y-3 pr-1">
                  {notificationsList.map((n) => {
                    const seen = notifSeenMap[n.id] || { count: 0, names: [] };
                    const isExpanded = expandedSeenNotifId === n.id;
                    return (
                      <div
                        key={n.id}
                        className="rounded-2xl p-3.5 bg-[#1457E0]/[0.04] dark:bg-white/[0.04] border border-[#1846AA]/10 dark:border-white/10 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              n.target === "all"
                                ? "bg-[#1457E0]/12 text-[#1457E0] dark:text-[#5AA2FF]"
                                : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                            }`}
                          >
                            {n.target === "all" ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
                            <span>{n.target === "all" ? "Everyone" : `To: ${n.targetName || "Candidate"}`}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteNotification(n.id)}
                            aria-label="Delete notification"
                            className="text-[#5A6A92] hover:text-[#D92D3A] p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <strong className="block text-sm font-extrabold text-[#0B1B4D] dark:text-white">
                          {n.title}
                        </strong>
                        <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] whitespace-pre-line">
                          {n.message}
                        </p>

                        {n.imageUrl && (
                          <div className="overflow-hidden rounded-xl border border-[#1846AA]/10 dark:border-white/10">
                            <img
                              src={n.imageUrl}
                              alt={n.title}
                              referrerPolicy="no-referrer"
                              className="w-full max-h-32 object-cover block"
                            />
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSeenNotifId(isExpanded ? null : n.id)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>
                              Seen by {seen.count} {seen.count === 1 ? "person" : "people"}
                            </span>
                          </button>

                          <span className="text-[10px] text-[#5A6A92] dark:text-[#93A3CC] font-mono-nums">
                            {new Date(n.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {isExpanded && (
                          <div className="text-[11px] text-[#5A6A92] dark:text-[#93A3CC] bg-white/70 dark:bg-black/20 rounded-xl p-2">
                            {seen.names.length > 0 ? (
                              <span>
                                <strong>Seen by:</strong> {seen.names.join(", ")}
                              </span>
                            ) : (
                              <span>No one has opened this message yet.</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: MESSAGES, HELP SUPPORT INBOX & ALL-CHATS AUDIT (INCLUDES DELETED) */}
      {tab === "messages" && (
        <div className="space-y-4">
          {needsChatTable && (
            <div className="amay-card rounded-[24px] p-5 border-2 border-amber-400/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-amber-800 dark:text-amber-300">
                    Run updated supabase-setup.sql in Supabase → SQL Editor
                  </h3>
                  <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                    Sections 8 &amp; 9 create unique username/password login and the live chat_messages audit table.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(CHAT_AUTH_SQL);
                    setCopiedChatSql(true);
                    setTimeout(() => setCopiedChatSql(false), 2000);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedChatSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedChatSql ? "Copied Note" : "Copy Reminder"}</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex p-1 rounded-xl amay-card gap-1">
              <button
                type="button"
                onClick={() => setMsgSubTab("help")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                  msgSubTab === "help"
                    ? "bg-[#1457E0] text-white"
                    : "text-[#5A6A92] dark:text-[#93A3CC]"
                }`}
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                <span>Help Inbox ({helpThreads.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMsgSubTab("bots")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                  msgSubTab === "bots"
                    ? "bg-[#1457E0] text-white"
                    : "text-[#5A6A92] dark:text-[#93A3CC]"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Bot Chats ({botThreads.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMsgSubTab("audit")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                  msgSubTab === "audit"
                    ? "bg-[#1457E0] text-white"
                    : "text-[#5A6A92] dark:text-[#93A3CC]"
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>All Candidate Chats ({auditThreads.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-lg amay-card text-[#5A6A92] dark:text-[#93A3CC]">
                Total messages: {chatMessages.length}
              </span>
              {deletedMessageCount > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-[#D92D3A]/12 text-[#D92D3A] dark:text-[#FF6B76]">
                  Deleted by students (retained): {deletedMessageCount}
                </span>
              )}
              <button
                type="button"
                onClick={refreshAdminChatOnly}
                className="px-3 py-1 rounded-lg amay-card text-[#1457E0] dark:text-[#5AA2FF] inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Sync</span>
              </button>
            </div>
          </div>

          {msgSubTab === "help" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left column: Help conversations + start Help chat with any candidate */}
              <div className="lg:col-span-4 amay-card rounded-[26px] p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-extrabold text-[#0B1B4D] dark:text-white">
                    Help Conversations
                  </h3>
                  <p className="text-[11px] text-[#5A6A92] dark:text-[#93A3CC]">
                    Students see you as &ldquo;Help&rdquo;. Reply directly below.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#5A6A92] mb-1">
                    Or message any candidate as Help:
                  </label>
                  <select
                    value={selectedHelpUuid || ""}
                    onChange={(e) => setSelectedHelpUuid(e.target.value || null)}
                    className="w-full h-9 px-2.5 rounded-xl bg-white/85 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-xs font-semibold"
                  >
                    <option value="">-- Pick any candidate --</option>
                    {candidates.map((c) => (
                      <option key={c.guest_uuid} value={c.guest_uuid}>
                        {c.display_name} {c.username ? `(@${c.username})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {helpThreads.length === 0 ? (
                  <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] py-6 text-center">
                    No Help messages yet.
                  </p>
                ) : (
                  <div className="divide-y divide-[#1846AA]/10 dark:divide-white/10 max-h-[420px] overflow-y-auto">
                    {helpThreads.map((t) => {
                      const active = selectedHelpUuid === t.candidateUuid;
                      return (
                        <button
                          key={t.candidateUuid}
                          type="button"
                          onClick={() => setSelectedHelpUuid(t.candidateUuid)}
                          className={`w-full py-2.5 px-2.5 rounded-xl text-left transition cursor-pointer ${
                            active
                              ? "bg-[#1457E0]/12 dark:bg-[#5AA2FF]/15"
                              : "hover:bg-[#1457E0]/5"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-sm font-bold text-[#0B1B4D] dark:text-white truncate">
                              {t.candidateName}
                              {t.username ? (
                                <span className="ml-1 text-[11px] font-mono-nums font-semibold text-[#1457E0] dark:text-[#5AA2FF]">
                                  @{t.username}
                                </span>
                              ) : null}
                            </strong>
                            {t.deletedCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-[#D92D3A]/12 text-[#D92D3A] dark:text-[#FF6B76] text-[10px] font-bold shrink-0">
                                {t.deletedCount} del
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] truncate mt-0.5">
                            {t.lastMessage.sender_uuid === HELP_CHAT_UUID ? "Help: " : ""}
                            {t.lastMessage.body}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right column: Active Help thread transcript & reply box */}
              <div className="lg:col-span-8 amay-card rounded-[26px] p-5 flex flex-col min-h-[440px]">
                {!selectedHelpUuid ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-[#5A6A92] dark:text-[#93A3CC]">
                    Select a candidate on the left to view messages &amp; reply as Help.
                  </div>
                ) : (
                  (() => {
                    const threadMsgs = chatMessages.filter(
                      (m) =>
                        (m.sender_uuid === selectedHelpUuid && m.recipient_uuid === HELP_CHAT_UUID) ||
                        (m.sender_uuid === HELP_CHAT_UUID && m.recipient_uuid === selectedHelpUuid)
                    );
                    const cand = candidates.find((c) => c.guest_uuid === selectedHelpUuid);
                    const candName =
                      cand?.display_name ||
                      helpThreads.find((t) => t.candidateUuid === selectedHelpUuid)?.candidateName ||
                      "Candidate";

                    return (
                      <>
                        <div className="pb-3 mb-3 border-b border-[#1846AA]/10 dark:border-white/10 flex items-center justify-between gap-2">
                          <div>
                            <strong className="text-base font-extrabold text-[#0B1B4D] dark:text-white">
                              {candName}
                            </strong>
                            {cand?.username && (
                              <span className="ml-2 text-xs font-mono-nums font-bold text-[#1457E0] dark:text-[#5AA2FF]">
                                @{cand.username}
                              </span>
                            )}
                            <span className="block text-[11px] text-[#5A6A92] dark:text-[#93A3CC]">
                              Replying as &ldquo;Help&rdquo; · Deleted messages remain visible here
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 max-h-[340px] overflow-y-auto space-y-2.5 pr-1">
                          {threadMsgs.length === 0 ? (
                            <p className="text-xs text-[#5A6A92] py-10 text-center">
                              No messages in this Help chat yet. Send the first reply below.
                            </p>
                          ) : (
                            threadMsgs.map((m) => {
                              const fromHelp = m.sender_uuid === HELP_CHAT_UUID;
                              const isDeleted = Boolean(
                                m.deleted_for_everyone || m.deleted_by_sender || m.deleted_by_recipient
                              );
                              return (
                                <div
                                  key={m.id}
                                  className={`flex ${fromHelp ? "justify-end" : "justify-start"}`}
                                >
                                  <div
                                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                                      fromHelp
                                        ? "bg-[#1457E0] text-white"
                                        : "bg-white/85 dark:bg-[#131E3A] text-[#0B1B4D] dark:text-white border border-[#1846AA]/12 dark:border-white/10"
                                    } ${isDeleted ? "ring-2 ring-[#D92D3A]/60" : ""}`}
                                  >
                                    {isDeleted && (
                                      <span className="inline-block mb-1 px-1.5 py-0.5 rounded bg-[#D92D3A] text-white text-[10px] font-extrabold">
                                        {m.deleted_for_everyone ? "Unsent by sender" : "Deleted by student"}
                                      </span>
                                    )}
                                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                                    <span
                                      className={`block text-[10px] font-mono-nums mt-1 ${
                                        fromHelp ? "text-white/75 text-right" : "text-[#5A6A92] dark:text-[#93A3CC]"
                                      }`}
                                    >
                                      {fromHelp ? "Help · " : `${candName} · `}
                                      {new Date(m.created_at).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <form
                          onSubmit={handleSendAdminHelpReply}
                          className="pt-3 mt-3 border-t border-[#1846AA]/10 dark:border-white/10 flex items-center gap-2"
                        >
                          <input
                            type="text"
                            maxLength={1000}
                            value={helpReplyDraft}
                            onChange={(e) => setHelpReplyDraft(e.target.value)}
                            placeholder={`Reply to ${candName} as Help…`}
                            className="flex-1 h-11 px-3.5 rounded-xl bg-white/85 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                          />
                          <button
                            type="submit"
                            disabled={sendingHelpReply || !helpReplyDraft.trim()}
                            className="h-11 px-4 rounded-xl amay-play-btn text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{sendingHelpReply ? "Sending…" : "Send as Help"}</span>
                          </button>
                        </form>
                      </>
                    );
                  })()
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left column: Bot conversations OR All conversations */}
              <div className="lg:col-span-5 amay-card rounded-[26px] p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-extrabold text-[#0B1B4D] dark:text-white">
                    {msgSubTab === "bots"
                      ? `Bot Chats (${botThreads.length})`
                      : `Every Chat Thread (${auditThreads.length})`}
                  </h3>
                  <p className="text-[11px] text-[#5A6A92] dark:text-[#93A3CC]">
                    {msgSubTab === "bots"
                      ? "Reply on behalf of any bot directly here, or start a new bot conversation."
                      : "Full visibility across all candidates & bots, including deleted chats."}
                  </p>
                </div>

                {msgSubTab === "bots" && (
                  <div className="rounded-2xl bg-[#1457E0]/[0.06] dark:bg-white/[0.05] p-3 space-y-2 border border-[#1846AA]/12 dark:border-white/10">
                    <span className="block text-[11px] font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
                      Open / Start Chat as Any Bot
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <select
                        value={botComposerFromUuid}
                        onChange={(e) => setBotComposerFromUuid(e.target.value)}
                        className="h-9 px-2 rounded-xl bg-white/90 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-xs font-semibold"
                      >
                        <option value="">From Bot…</option>
                        {botSchedule.bots.map((b) => (
                          <option key={`from-${b.originalName}`} value={`bot_${b.originalName}`}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={botComposerToUuid}
                        onChange={(e) => setBotComposerToUuid(e.target.value)}
                        className="h-9 px-2 rounded-xl bg-white/90 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-xs font-semibold"
                      >
                        <option value="">To Person / Bot…</option>
                        <optgroup label="Candidates">
                          {candidates.map((c) => (
                            <option key={`to-c-${c.guest_uuid}`} value={c.guest_uuid}>
                              {c.display_name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Roster">
                          {botSchedule.bots
                            .filter((b) => `bot_${b.originalName}` !== botComposerFromUuid)
                            .map((b) => (
                              <option key={`to-b-${b.originalName}`} value={`bot_${b.originalName}`}>
                                {b.name}
                              </option>
                            ))}
                        </optgroup>
                      </select>
                    </div>
                    {botComposerFromUuid && botComposerToUuid && botComposerFromUuid !== botComposerToUuid && (
                      <button
                        type="button"
                        onClick={() => {
                          const [aUuid, bUuid] =
                            botComposerFromUuid < botComposerToUuid
                              ? [botComposerFromUuid, botComposerToUuid]
                              : [botComposerToUuid, botComposerFromUuid];
                          setSelectedAuditPairKey(`${aUuid}::${bUuid}`);
                          setBotReplyAsUuid(botComposerFromUuid);
                        }}
                        className="w-full h-8 rounded-xl bg-[#1457E0] text-white text-xs font-bold cursor-pointer"
                      >
                        Open Conversation
                      </button>
                    )}
                  </div>
                )}

                {(msgSubTab === "bots" ? botThreads : auditThreads).length === 0 ? (
                  <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] py-8 text-center">
                    {msgSubTab === "bots" ? "No bot conversations yet." : "No chat messages recorded yet."}
                  </p>
                ) : (
                  <div className="divide-y divide-[#1846AA]/10 dark:divide-white/10 max-h-[480px] overflow-y-auto">
                    {(msgSubTab === "bots" ? botThreads : auditThreads).map((t) => {
                      const active = selectedAuditPairKey === t.pairKey;
                      return (
                        <button
                          key={t.pairKey}
                          type="button"
                          onClick={() => {
                            setSelectedAuditPairKey(t.pairKey);
                            const defaultBot = t.leftUuid.startsWith("bot_")
                              ? t.leftUuid
                              : t.rightUuid.startsWith("bot_")
                                ? t.rightUuid
                                : "";
                            setBotReplyAsUuid(defaultBot);
                          }}
                          className={`w-full py-2.5 px-2.5 rounded-xl text-left transition cursor-pointer ${
                            active
                              ? "bg-[#1457E0]/12 dark:bg-[#5AA2FF]/15"
                              : "hover:bg-[#1457E0]/5"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-xs font-extrabold text-[#0B1B4D] dark:text-white truncate">
                              {t.leftName} ↔ {t.rightName}
                            </strong>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="px-1.5 py-0.5 rounded bg-[#1457E0]/10 text-[#1457E0] dark:text-[#5AA2FF] text-[10px] font-bold">
                                {t.messages.length}
                              </span>
                              {t.deletedCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-[#D92D3A]/12 text-[#D92D3A] dark:text-[#FF6B76] text-[10px] font-bold">
                                  {t.deletedCount} deleted
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-[11px] text-[#5A6A92] dark:text-[#93A3CC] truncate mt-0.5">
                            {t.lastMessage.body}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right column: Full audit transcript + reply on behalf of bot */}
              <div className="lg:col-span-7 amay-card rounded-[26px] p-5 min-h-[440px] flex flex-col">
                {(() => {
                  const pool = msgSubTab === "bots" ? botThreads : auditThreads;
                  let chosen = pool.find((t) => t.pairKey === selectedAuditPairKey) || null;

                  // Support newly started Bot conversation even before first message is sent
                  if (!chosen && selectedAuditPairKey && selectedAuditPairKey.includes("::")) {
                    const [aUuid, bUuid] = selectedAuditPairKey.split("::");
                    const resolvePairSide = (u: string) => {
                      if (u.startsWith("bot_")) {
                        const key = u.slice(4);
                        const matched = botSchedule.bots.find((b) => b.originalName === key);
                        return { name: matched?.name || key, username: null as string | null };
                      }
                      const cand = candidates.find((c) => c.guest_uuid === u);
                      return { name: cand?.display_name || "Candidate", username: cand?.username || null };
                    };
                    if (aUuid && bUuid && (aUuid.startsWith("bot_") || bUuid.startsWith("bot_"))) {
                      const a = resolvePairSide(aUuid);
                      const b = resolvePairSide(bUuid);
                      chosen = {
                        pairKey: selectedAuditPairKey,
                        leftUuid: aUuid,
                        leftName: a.name,
                        leftUsername: a.username,
                        rightUuid: bUuid,
                        rightName: b.name,
                        rightUsername: b.username,
                        messages: [],
                        lastMessage: {
                          id: "draft",
                          sender_uuid: aUuid,
                          sender_name: a.name,
                          recipient_uuid: bUuid,
                          recipient_name: b.name,
                          body: "",
                          created_at: new Date().toISOString(),
                        },
                        deletedCount: 0,
                      };
                    }
                  }

                  if (!chosen) {
                    return (
                      <div className="flex-1 flex items-center justify-center text-sm text-[#5A6A92] dark:text-[#93A3CC]">
                        {msgSubTab === "bots"
                          ? "Select a bot thread or pick a bot on the left to reply on their behalf."
                          : "Select any conversation on the left to inspect all messages (including deleted ones)."}
                      </div>
                    );
                  }

                  const botSides: Array<{ uuid: string; name: string; peerUuid: string; peerName: string }> = [];
                  if (chosen.leftUuid.startsWith("bot_")) {
                    botSides.push({
                      uuid: chosen.leftUuid,
                      name: chosen.leftName,
                      peerUuid: chosen.rightUuid,
                      peerName: chosen.rightName,
                    });
                  }
                  if (chosen.rightUuid.startsWith("bot_")) {
                    botSides.push({
                      uuid: chosen.rightUuid,
                      name: chosen.rightName,
                      peerUuid: chosen.leftUuid,
                      peerName: chosen.leftName,
                    });
                  }
                  const activeBotSender =
                    botSides.find((s) => s.uuid === botReplyAsUuid) || botSides[0] || null;

                  return (
                    <>
                      <div className="pb-3 mb-3 border-b border-[#1846AA]/10 dark:border-white/10">
                        <strong className="text-base font-extrabold text-[#0B1B4D] dark:text-white">
                          {chosen.leftName}
                          {chosen.leftUsername ? ` (@${chosen.leftUsername})` : ""} ↔ {chosen.rightName}
                          {chosen.rightUsername ? ` (@${chosen.rightUsername})` : ""}
                        </strong>
                        <span className="block text-[11px] text-[#5A6A92] dark:text-[#93A3CC]">
                          {chosen.messages.length} total messages · {chosen.deletedCount} deleted by participants
                        </span>
                      </div>

                      <div className="flex-1 max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
                        {chosen.messages.length === 0 ? (
                          <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] py-10 text-center">
                            No messages yet. Send the first message on behalf of {activeBotSender?.name} below.
                          </p>
                        ) : (
                          chosen.messages.map((m) => {
                            const deleteReasons: string[] = [];
                            if (m.deleted_for_everyone) deleteReasons.push("Unsent (for everyone)");
                            if (m.deleted_by_sender) deleteReasons.push("Deleted by sender");
                            if (m.deleted_by_recipient) deleteReasons.push("Deleted by recipient");
                            const isDeleted = deleteReasons.length > 0;
                            const isLeft = m.sender_uuid === chosen!.leftUuid;

                            return (
                              <div
                                key={m.id}
                                className={`rounded-2xl p-3 border text-xs space-y-1 ${
                                  isDeleted
                                    ? "bg-[#D92D3A]/[0.07] border-[#D92D3A]/35"
                                    : isLeft
                                      ? "bg-[#1457E0]/[0.05] border-[#1846AA]/12 dark:border-white/10"
                                      : "bg-white/75 dark:bg-[#131E3A] border-[#1846AA]/12 dark:border-white/10"
                                }`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <strong className="text-[#0B1B4D] dark:text-white">
                                    {m.sender_uuid === HELP_CHAT_UUID ? "Help" : m.sender_name} →{" "}
                                    {m.recipient_uuid === HELP_CHAT_UUID ? "Help" : m.recipient_name}
                                  </strong>
                                  <span className="font-mono-nums text-[10px] text-[#5A6A92] dark:text-[#93A3CC]">
                                    {new Date(m.created_at).toLocaleString()}
                                  </span>
                                </div>
                                {isDeleted && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded bg-[#D92D3A] text-white text-[10px] font-extrabold">
                                      DELETED: {deleteReasons.join(" · ")}
                                    </span>
                                    {m.deleted_at && (
                                      <span className="text-[10px] font-mono-nums text-[#D92D3A] dark:text-[#FF6B76]">
                                        at {new Date(m.deleted_at).toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <p className="text-sm text-[#0B1B4D] dark:text-white whitespace-pre-wrap break-words">
                                  {m.body}
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {activeBotSender && (
                        <form
                          onSubmit={(e) =>
                            handleSendBotReplyInThread(
                              e,
                              activeBotSender.uuid,
                              activeBotSender.name,
                              activeBotSender.peerUuid,
                              activeBotSender.peerName
                            )
                          }
                          className="pt-3 mt-3 border-t border-[#1846AA]/10 dark:border-white/10 space-y-2"
                        >
                          {botSides.length > 1 && (
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                              <span className="text-[#5A6A92] dark:text-[#93A3CC]">Reply as:</span>
                              {botSides.map((s) => (
                                <button
                                  key={s.uuid}
                                  type="button"
                                  onClick={() => setBotReplyAsUuid(s.uuid)}
                                  className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                                    activeBotSender.uuid === s.uuid
                                      ? "bg-[#1457E0] text-white"
                                      : "amay-card text-[#0B1B4D] dark:text-white"
                                  }`}
                                >
                                  {s.name}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              maxLength={1000}
                              value={botReplyDraft}
                              onChange={(e) => setBotReplyDraft(e.target.value)}
                              placeholder={`Reply as ${activeBotSender.name} to ${activeBotSender.peerName}…`}
                              className="flex-1 h-11 px-3.5 rounded-xl bg-white/85 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                            />
                            <button
                              type="submit"
                              disabled={sendingBotReply || !botReplyDraft.trim()}
                              className="h-11 px-4 rounded-xl amay-play-btn text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{sendingBotReply ? "Sending…" : `Reply as ${activeBotSender.name}`}</span>
                            </button>
                          </div>
                        </form>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CANDIDATE EDITOR & INSPECTOR MODAL */}
      {selectedCandidate && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedCandidate(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto amay-card rounded-[30px] p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold text-[#0B1B4D] dark:text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-[#1457E0] shrink-0" />
                  <span className="truncate">{selectedCandidate.display_name}</span>
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] font-mono-nums break-all">
                    ID: {selectedCandidate.guest_uuid}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(selectedCandidate.guest_uuid);
                      setCopiedCandidateId(true);
                      setTimeout(() => setCopiedCandidateId(false), 1800);
                    }}
                    className="px-2 py-0.5 rounded-md amay-card text-[11px] font-bold text-[#1457E0] dark:text-[#5AA2FF] inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCandidateId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCandidateId ? "Copied" : "Copy ID"}</span>
                  </button>
                  {selectedCandidate.username && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold font-mono-nums bg-[#1457E0]/12 text-[#1457E0] dark:text-[#5AA2FF]">
                      <Lock className="w-3 h-3" />
                      <span>@{selectedCandidate.username}</span>
                    </span>
                  )}
                  {selectedCandidate.password && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold font-mono-nums bg-slate-500/15 text-[#0B1B4D] dark:text-white select-all">
                      Pass: {selectedCandidate.password}
                    </span>
                  )}
                  {isCandidateInstalled(selectedCandidate) ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <Smartphone className="w-3 h-3" />
                      <span>App Installed</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/12 text-amber-800 dark:text-amber-300 border border-amber-500/25">
                      App Not Installed
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openNotifyForCandidate(selectedCandidate)}
                  className="h-9 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Notify</span>
                </button>
                <button
                  type="button"
                  onClick={() => launchCandidateIdView(selectedCandidate)}
                  className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open ID in App</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCandidate(null)}
                  className="w-9 h-9 rounded-xl amay-card flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveCandidateEdits} className="space-y-4 border-t border-[#1846AA]/10 dark:border-white/10 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC]">Quick XP adjust:</span>
                {[-100, -50, 50, 100, 250, 500].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => {
                      const nextTotal = Math.max(0, editXp + delta);
                      setEditXp(nextTotal);
                      setCandidateBaseWithoutToday(nextTotal - editTodayXp);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 text-[#1457E0] dark:text-[#5AA2FF] text-xs font-bold cursor-pointer"
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setEditXp(0);
                    setCandidateBaseWithoutToday(0 - editTodayXp);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#D92D3A]/10 text-[#D92D3A] text-xs font-bold cursor-pointer"
                >
                  Reset 0
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-[#5A6A92] mb-1">Display Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5A6A92] mb-1">Username</label>
                  <input
                    type="text"
                    maxLength={20}
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="Not set"
                    className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm font-mono-nums font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5A6A92] mb-1">Password</label>
                  <input
                    type="text"
                    maxLength={40}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Not set"
                    className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm font-mono-nums font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5A6A92] mb-1">Total XP</label>
                  <input
                    type="number"
                    min={0}
                    value={editXp}
                    onChange={(e) => {
                      const nextTotal = Math.max(0, Math.round(Number(e.target.value) || 0));
                      setEditXp(nextTotal);
                      setCandidateBaseWithoutToday(nextTotal - editTodayXp);
                    }}
                    className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm font-mono-nums font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5A6A92] mb-1">
                    Today XP <span className="text-[10px] font-normal text-[#1457E0] dark:text-[#5AA2FF]">(adds to Total)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editTodayXp}
                    onChange={(e) => {
                      const nextToday = Math.max(0, Math.round(Number(e.target.value) || 0));
                      setEditTodayXp(nextToday);
                      setEditXp(Math.max(0, candidateBaseWithoutToday + nextToday));
                    }}
                    className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm font-mono-nums font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5A6A92] mb-1">Streak (days)</label>
                  <input
                    type="number"
                    min={0}
                    value={editStreak}
                    onChange={(e) => setEditStreak(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm font-mono-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5A6A92] mb-1">Quizzes Count</label>
                  <input
                    type="number"
                    min={0}
                    value={editQuizzes}
                    onChange={(e) => setEditQuizzes(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm font-mono-nums"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingCandidate}
                className="h-11 px-5 rounded-xl amay-play-btn text-white font-bold text-sm cursor-pointer disabled:opacity-60"
              >
                {savingCandidate ? "Updating…" : "Save Profile, Credentials & XP"}
              </button>
            </form>

            <div className="space-y-2 border-t border-[#1846AA]/10 dark:border-white/10 pt-4">
              <h3 className="text-sm font-extrabold text-[#0B1B4D] dark:text-white">
                All Quiz Results ({selectedAttempts.length})
              </h3>
              {selectedAttempts.length === 0 ? (
                <p className="text-xs text-[#5A6A92]">No submitted quiz results found for this candidate.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto divide-y divide-[#1846AA]/10 dark:divide-white/10 text-xs">
                  {selectedAttempts.map((a, i) => (
                    <div key={a.id || i} className="py-2 flex items-center justify-between gap-3">
                      <span>
                        <strong>{String(a.subject || "").toUpperCase()}</strong> ·{" "}
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                      <span className="font-mono-nums font-bold">
                        {a.score}/{a.total} (+{a.xp_earned} XP)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-[#1846AA]/10 dark:border-white/10 pt-4">
              <h3 className="text-sm font-extrabold text-[#0B1B4D] dark:text-white">
                Recent Taps ({selectedTaps.length})
              </h3>
              {selectedTaps.length === 0 ? (
                <p className="text-xs text-[#5A6A92]">No tap events recorded for this candidate yet.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto divide-y divide-[#1846AA]/10 dark:divide-white/10 text-xs">
                  {selectedTaps.map((t, i) => (
                    <div key={t.id || i} className="py-2 flex items-center justify-between gap-3">
                      <span>
                        <strong className="text-[#1457E0] dark:text-[#5AA2FF]">{t.action}</strong> — {t.detail}
                      </span>
                      <span className="font-mono-nums text-[#5A6A92] shrink-0">
                        {new Date(t.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
