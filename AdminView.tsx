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
} from "lucide-react";
import { BENCHMARK_PLAYERS } from "../data/benchmarks";
import type { SubjectKey } from "../data/questions";
import { parseBulkQuestionFile, type ParsedBulkQuestion } from "../lib/questionParser";
import {
  adminDeleteNotification,
  adminDeleteQuestion,
  adminGetSession,
  adminInsertQuestion,
  adminLoadAttempts,
  adminLoadCandidates,
  adminLoadCandidateTaps,
  adminLoadInstallStatusMap,
  adminLoadStats,
  adminSaveBotOverrides,
  adminSaveLatestVideo,
  adminSendNotification,
  adminSignIn,
  adminSignOut,
  adminUpdateCandidate,
  DEFAULT_LATEST_VIDEO,
  deriveYouTubeThumbnail,
  fetchBotOverrides,
  fetchDynamicQuestions,
  fetchLatestVideo,
  fetchNotifications,
  loadBotOverrides,
  saveBotOverrides,
  supabase,
  type AdminAttemptRow,
  type AdminCandidateRow,
  type AppNotification,
  type BotOverride,
  type CandidateTapEvent,
  type DynamicQuestionRow,
  type LatestVideoConfig,
  type NotificationActionType,
} from "../lib/supabase";

export interface OpenCandidateIdPayload {
  guestUuid: string;
  name: string;
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
  onLatestVideoChanged: (video: LatestVideoConfig) => void;
  onNotificationsChanged: (list: AppNotification[]) => void;
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

export const AdminView: React.FC<AdminViewProps> = ({
  onBack,
  onQuestionsChanged,
  onBotsChanged,
  onLatestVideoChanged,
  onNotificationsChanged,
  onOpenCandidateId,
}) => {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<
    "candidates" | "attempts" | "taps" | "questions" | "video" | "notifications"
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
  const [notifTarget, setNotifTarget] = useState<"all" | "candidate">("all");
  const [notifTargetGuestUuid, setNotifTargetGuestUuid] = useState("");
  const [notifCandidateSearch, setNotifCandidateSearch] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
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

  // Bot overrides state
  const [botOverrides, setBotOverrides] = useState<Record<string, BotOverride>>(() => loadBotOverrides());
  const [editingBotOriginalName, setEditingBotOriginalName] = useState<string | null>(null);
  const [botDraftName, setBotDraftName] = useState("");
  const [botDraftXp, setBotDraftXp] = useState(0);
  const [botDraftTodayXp, setBotDraftTodayXp] = useState(0);
  const [needsBotTable, setNeedsBotTable] = useState(false);
  const [copiedBotSql, setCopiedBotSql] = useState(false);

  // Candidate XP & Stats Editor + Inspector Modal
  const [selectedCandidate, setSelectedCandidate] = useState<AdminCandidateRow | null>(null);
  const [copiedCandidateId, setCopiedCandidateId] = useState(false);
  const [editName, setEditName] = useState("");
  const [editXp, setEditXp] = useState(0);
  const [editTodayXp, setEditTodayXp] = useState(0);
  const [editStreak, setEditStreak] = useState(0);
  const [editQuizzes, setEditQuizzes] = useState(0);
  const [savingCandidate, setSavingCandidate] = useState(false);

  // Question Entry Mode: single vs bulk
  const [qEntryMode, setQEntryMode] = useState<"single" | "bulk">("single");

  // Single question form
  const [qSub, setQSub] = useState<SubjectKey>("ca");
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
  const [bulkDefaultSub, setBulkDefaultSub] = useState<SubjectKey>("sst");
  const [bulkDefaultLvl, setBulkDefaultLvl] = useState<number>(1);
  const [bulkQueue, setBulkQueue] = useState<ParsedBulkQuestion[]>([]);
  const [parsingFile, setParsingFile] = useState(false);
  const [publishingBulk, setPublishingBulk] = useState(false);
  const [rawExtractPreview, setRawExtractPreview] = useState("");

  const loadAllAdminData = async () => {
    const localBots = loadBotOverrides();
    const [st, dqs, cands, atts, tapRes, vid, cloudBots, installMap, notifs] = await Promise.all([
      adminLoadStats(),
      fetchDynamicQuestions(),
      adminLoadCandidates(),
      adminLoadAttempts(),
      adminLoadCandidateTaps(),
      fetchLatestVideo(),
      fetchBotOverrides(),
      adminLoadInstallStatusMap(),
      fetchNotifications(),
    ]);
    const mergedBots = { ...cloudBots, ...localBots };
    setStats(st);
    setDynamicQuestions(dqs);
    setCandidates(cands);
    setInstallStatusMap(installMap);
    setAttempts(atts);
    setTaps(tapRes.events);
    setNeedsTapTable(tapRes.needsTableSetup);
    setVideoUrl(vid.url);
    setVideoTitle(vid.title);
    setVideoSubtitle(vid.subtitle);
    setVideoThumb(vid.thumbnailUrl);
    setNotificationsList(notifs);
    onNotificationsChanged(notifs);
    setBotOverrides(mergedBots);
    saveBotOverrides(mergedBots);
    onBotsChanged(mergedBots);
  };

  useEffect(() => {
    adminGetSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setAdminEmail(session.user.email);
        loadAllAdminData();
      }
      setCheckingAuth(false);
    });
  }, []);

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
    setCopiedCandidateId(false);
    setSelectedCandidate(cand);
    setEditName(cand.display_name || "");
    setEditXp(cand.xp || 0);
    setEditTodayXp(cand.today_xp || 0);
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
      xp: cand.xp || 0,
      todayXp: cand.today_xp || 0,
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

  const handleSaveBotEdit = async (originalName: string, defaultXp: number, defaultTodayXp: number) => {
    const cleaned = botDraftName.trim() || originalName;
    const parsedXp = Number.isFinite(Number(botDraftXp)) ? Math.max(0, Math.round(Number(botDraftXp))) : defaultXp;
    const parsedTodayXp = Number.isFinite(Number(botDraftTodayXp))
      ? Math.max(0, Math.round(Number(botDraftTodayXp)))
      : defaultTodayXp;

    const next = {
      ...botOverrides,
      [originalName]: {
        name: cleaned,
        xp: parsedXp,
        todayXp: parsedTodayXp,
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
    const res = await adminSaveBotOverrides(botOverrides);
    if (res.ok) {
      setNeedsBotTable(false);
      onBotsChanged(botOverrides);
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
    setSavingCandidate(true);
    setFeedback(null);

    const { data, error } = await adminUpdateCandidate(selectedCandidate.guest_uuid, {
      display_name: editName.trim() || selectedCandidate.display_name,
      xp: Math.max(0, Math.round(Number(editXp) || 0)),
      today_xp: Math.max(0, Math.round(Number(editTodayXp) || 0)),
      streak: Math.max(0, Math.round(Number(editStreak) || 0)),
      quizzes_count: Math.max(0, Math.round(Number(editQuizzes) || 0)),
    });

    setSavingCandidate(false);

    if (error) {
      setFeedback({ text: `Update failed: ${error.message}`, ok: false });
      return;
    }
    if (!data || data.length === 0) {
      setFeedback({
        text: "Database settings blocked updating this row. Check Supabase RLS policies for candidates UPDATE.",
        ok: false,
      });
      return;
    }

    setFeedback({ text: `Updated ${editName.trim()}'s name, XP, and stats.`, ok: true });
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

  const handlePublishBulk = async () => {
    if (bulkQueue.length === 0) return;
    setPublishingBulk(true);
    setFeedback(null);

    const { error } = await supabase.from("dynamic_questions").insert(bulkQueue);
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
    if (c.guest_uuid in installStatusMap) return installStatusMap[c.guest_uuid];
    return Boolean(c.app_installed);
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
      return c.display_name.toLowerCase().includes(q) || c.guest_uuid.toLowerCase().includes(q);
    });
  }, [candidates, installFilter, installStatusMap, searchQuery]);

  const filteredBots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return BENCHMARK_PLAYERS.map((b) => {
      const ov = botOverrides[b.name];
      return {
        originalName: b.name,
        name: ov?.name ?? b.name,
        xp: ov?.xp ?? b.xp,
        todayXp: ov?.todayXp ?? b.todayXp,
      };
    })
      .filter((b) => !q || b.name.toLowerCase().includes(q))
      .sort((a, b) => b.xp - a.xp);
  }, [botOverrides, searchQuery]);

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
                        <td className="py-3 px-4 font-mono-nums">{c.today_xp || 0}</td>
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

              <div className="amay-card rounded-[22px] p-3.5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                  Showing all {filteredBots.length} bots sorted by Total XP. Click <strong>Sync Bot Edits to All Phones</strong> to push any saved changes to every student.
                </p>
                <button
                  type="button"
                  onClick={handleSyncAllBotsToCloud}
                  className="px-3.5 py-2 rounded-xl bg-[#1457E0] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync Bot Edits to All Phones</span>
                </button>
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
                                onChange={(e) => setBotDraftXp(Number(e.target.value))}
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
                                onChange={(e) => setBotDraftTodayXp(Number(e.target.value))}
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
                                  onClick={() => handleSaveBotEdit(b.originalName, b.xp, b.todayXp)}
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
                <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">Publish New Question</h2>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mb-1">
                      Subject
                    </label>
                    <select
                      value={qSub}
                      onChange={(e) => setQSub(e.target.value as SubjectKey)}
                      className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                    >
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
                      onChange={(e) => setBulkDefaultSub(e.target.value as SubjectKey)}
                      className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm"
                    >
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
                    <div className="flex items-center justify-between">
                      <strong className="text-sm font-extrabold text-[#0B1B4D] dark:text-white">
                        Ready to publish: {bulkQueue.length} questions
                      </strong>
                      <div className="flex gap-2">
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
                                next[idx] = { ...next[idx], subject: e.target.value as SubjectKey };
                                setBulkQueue(next);
                              }}
                              className="h-7 px-2 rounded-lg bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15"
                            >
                              <option value="sst">SST</option>
                              <option value="ca">CA</option>
                              <option value="math">Math</option>
                              <option value="sci">Sci</option>
                              <option value="eng">Eng</option>
                              <option value="hin">Hin</option>
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
              <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white">
                Added Questions ({dynamicQuestions.length})
              </h2>
              {dynamicQuestions.length === 0 ? (
                <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC]">No added questions yet.</p>
              ) : (
                <div className="divide-y divide-[#1846AA]/10 dark:divide-white/10 max-h-[460px] overflow-y-auto pr-1">
                  {dynamicQuestions.map((dq) => (
                    <div key={dq.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0B1B4D] dark:text-white">{dq.question_text}</p>
                        <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] mt-0.5">
                          {dq.subject.toUpperCase()} · Level {dq.level + 1} ·{" "}
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

            {/* Sent Notifications History */}
            <div className="lg:col-span-5 amay-card rounded-[28px] p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-[#0B1B4D] dark:text-white">
                  Sent Notifications ({notificationsList.length})
                </h3>
              </div>

              {notificationsList.length === 0 ? (
                <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] py-6 text-center">
                  No notifications sent yet. Send one on the left!
                </p>
              ) : (
                <div className="max-h-[460px] overflow-y-auto space-y-3 pr-1">
                  {notificationsList.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-2xl p-3.5 bg-[#1457E0]/[0.04] dark:bg-white/[0.04] border border-[#1846AA]/10 dark:border-white/10 space-y-1.5"
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
                      <div className="text-[10px] text-[#5A6A92] dark:text-[#93A3CC] font-mono-nums">
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
                    onClick={() => setEditXp((x) => Math.max(0, x + delta))}
                    className="px-2.5 py-1 rounded-lg bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 text-[#1457E0] dark:text-[#5AA2FF] text-xs font-bold cursor-pointer"
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEditXp(0)}
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
                  <label className="block text-xs font-semibold text-[#5A6A92] mb-1">Total XP</label>
                  <input
                    type="number"
                    min={0}
                    value={editXp}
                    onChange={(e) => setEditXp(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-sm font-mono-nums font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5A6A92] mb-1">Today XP</label>
                  <input
                    type="number"
                    min={0}
                    value={editTodayXp}
                    onChange={(e) => setEditTodayXp(Number(e.target.value))}
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
                {savingCandidate ? "Updating…" : "Save Name, XP & Stats"}
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
