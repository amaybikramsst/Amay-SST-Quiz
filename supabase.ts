import { createClient } from "@supabase/supabase-js";
import type { SubjectKey } from "../data/questions";

const SB_URL = "https://mhlsezufxyypvgygqgiz.supabase.co";
const SB_KEY = "sb_publishable_PwaUNHsURR2mGKxKBtagBw_MzNtJ0yd";

export const supabase = createClient(SB_URL, SB_KEY);

export interface CloudStats {
  xp: number;
  streak: number;
  quizzes: number;
  perfect: number;
  today_xp: number;
}

export interface LiveLeaderRow {
  name: string;
  xp: number;
  today_xp: number;
}

export interface DynamicQuestionRow {
  id: string;
  subject: SubjectKey;
  level: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_index: number;
  explanation: string;
  created_at?: string;
}

export interface AdminCandidateRow {
  id?: string;
  guest_uuid: string;
  display_name: string;
  xp: number;
  today_xp?: number;
  streak: number;
  quizzes_count: number;
  perfect_count?: number;
  last_active_date?: string;
  updated_at?: string;
  hidden?: boolean;
  app_installed?: boolean;
  app_installed_at?: string;
}

export interface AdminAttemptRow {
  id?: string;
  guest_uuid?: string;
  created_at: string;
  candidate_name: string;
  subject: string;
  level?: number;
  score: number;
  total: number;
  xp_earned: number;
}

export interface CandidateTapEvent {
  id?: string;
  guest_uuid: string;
  candidate_name: string;
  action: string;
  detail: string;
  screen: string;
  created_at: string;
}

export async function registerPlayer(guestId: string, name: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("register_player", {
      p_guest: guestId,
      p_name: name,
      p_state: "Bihar",
    });
    return !error;
  } catch {
    return false;
  }
}

export async function getMyStats(guestId: string): Promise<CloudStats | null> {
  try {
    const { data, error } = await supabase.rpc("get_my_stats", { p_guest: guestId });
    if (error || !data) return null;
    return data as CloudStats;
  } catch {
    return null;
  }
}

export async function submitQuizAttempt(
  guestId: string,
  subject: string,
  level: number,
  total: number,
  correct: number
): Promise<{ status: "ok"; data: CloudStats } | { status: "rate_limit" } | { status: "invalid" } | { status: "network" }> {
  try {
    const { data, error } = await supabase.rpc("submit_quiz", {
      p_guest: guestId,
      p_subject: subject,
      p_level: level,
      p_total: total,
      p_correct: correct,
    });
    if (!error && data) {
      return { status: "ok", data: data as CloudStats };
    }
    if (error?.code === "P0001") {
      if (/wait/i.test(error.message || "")) {
        return { status: "rate_limit" };
      }
      return { status: "invalid" };
    }
    return { status: "network" };
  } catch {
    return { status: "network" };
  }
}

export async function getLeaderboard(guestId: string): Promise<LiveLeaderRow[] | null> {
  try {
    const { data, error } = await supabase.rpc("get_leaderboard", { p_guest: guestId });
    if (error || !Array.isArray(data)) return null;
    return data as LiveLeaderRow[];
  } catch {
    return null;
  }
}

export async function fetchDynamicQuestions(): Promise<DynamicQuestionRow[]> {
  try {
    const { data, error } = await supabase
      .from("dynamic_questions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data as DynamicQuestionRow[];
  } catch {
    return [];
  }
}

// Local + Supabase tap activity logging
const LOCAL_TAPS_KEY = "amaysst_tap_log";
let tapTableAvailable: boolean | null = null;

export function getLocalTaps(): CandidateTapEvent[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_TAPS_KEY) || "[]") || [];
  } catch {
    return [];
  }
}

export async function logCandidateTap(
  guestId: string,
  candidateName: string,
  action: string,
  detail: string,
  screen: string
): Promise<void> {
  if (!candidateName) return;
  const event: CandidateTapEvent = {
    guest_uuid: guestId,
    candidate_name: candidateName,
    action,
    detail,
    screen,
    created_at: new Date().toISOString(),
  };

  try {
    const existing = getLocalTaps();
    existing.unshift(event);
    localStorage.setItem(LOCAL_TAPS_KEY, JSON.stringify(existing.slice(0, 200)));
  } catch {
    // ignore storage errors
  }

  if (tapTableAvailable === false) return;
  try {
    const { error } = await supabase.from("candidate_events").insert([event]);
    if (error) {
      if (/could not find the table|relation.*does not exist/i.test(error.message)) {
        tapTableAvailable = false;
      }
    } else {
      tapTableAvailable = true;
    }
  } catch {
    // ignore offline tap upload
  }
}

// Admin operations
export async function adminSignIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function adminSignOut() {
  return supabase.auth.signOut();
}

export async function adminGetSession() {
  return supabase.auth.getSession();
}

export async function adminLoadStats() {
  const [usersRes, testsRes, qsRes, xpRes] = await Promise.all([
    supabase.from("candidates").select("*", { count: "exact", head: true }),
    supabase.from("quiz_attempts").select("*", { count: "exact", head: true }),
    supabase.from("dynamic_questions").select("*", { count: "exact", head: true }),
    supabase.from("candidates").select("xp"),
  ]);

  const totalXp = Array.isArray(xpRes.data)
    ? xpRes.data.reduce((sum, row) => sum + (Number(row.xp) || 0), 0)
    : 0;

  return {
    users: usersRes.count || 0,
    tests: testsRes.count || 0,
    questions: qsRes.count || 0,
    totalXp,
  };
}

export async function adminInsertQuestion(payload: Omit<DynamicQuestionRow, "id" | "created_at">) {
  return supabase.from("dynamic_questions").insert([payload]);
}

export async function adminDeleteQuestion(id: string) {
  return supabase.from("dynamic_questions").delete().eq("id", id);
}

export async function adminLoadCandidates(): Promise<AdminCandidateRow[]> {
  const { data } = await supabase
    .from("candidates")
    .select("*")
    .order("xp", { ascending: false })
    .limit(500);
  return (data as AdminCandidateRow[]) || [];
}

export async function adminUpdateCandidate(
  guestUuid: string,
  updates: Partial<{
    display_name: string;
    xp: number;
    today_xp: number;
    streak: number;
    quizzes_count: number;
    perfect_count: number;
    hidden: boolean;
  }>
) {
  return supabase
    .from("candidates")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("guest_uuid", guestUuid)
    .select("*");
}

export async function adminLoadAttempts(): Promise<AdminAttemptRow[]> {
  const { data } = await supabase
    .from("quiz_attempts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  return (data as AdminAttemptRow[]) || [];
}

export async function adminLoadCandidateTaps(): Promise<{
  events: CandidateTapEvent[];
  needsTableSetup: boolean;
}> {
  try {
    const { data, error } = await supabase
      .from("candidate_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      if (/could not find the table|relation.*does not exist/i.test(error.message)) {
        return { events: getLocalTaps(), needsTableSetup: true };
      }
      return { events: getLocalTaps(), needsTableSetup: false };
    }
    return { events: (data as CandidateTapEvent[]) || [], needsTableSetup: false };
  } catch {
    return { events: getLocalTaps(), needsTableSetup: false };
  }
}

export async function reportAppInstallStatus(
  guestId: string,
  candidateName: string,
  installed: boolean
): Promise<boolean> {
  if (!guestId || !candidateName) return false;
  let ok = false;

  // 1. Update candidates.app_installed via RPC if present
  try {
    const { error } = await supabase.rpc("report_app_install", {
      p_guest: guestId,
      p_installed: installed,
    });
    if (!error) ok = true;
  } catch {
    // RPC may not be added yet; fallback to candidate_events works immediately
  }

  // 2. Also record latest install state in candidate_events (works immediately with existing table)
  try {
    await logCandidateTap(
      guestId,
      candidateName,
      installed ? "App Installed" : "App Not Installed",
      installed ? "Running or installed PWA app" : "Opened in browser (not installed)",
      "pwa"
    );
    ok = true;
  } catch {
    // ignore offline errors
  }

  return ok;
}

export async function adminLoadInstallStatusMap(): Promise<Record<string, boolean>> {
  const map: Record<string, boolean> = {};
  try {
    const { data, error } = await supabase
      .from("candidate_events")
      .select("guest_uuid, candidate_name, action, created_at")
      .in("action", ["App Installed", "App Not Installed"])
      .order("created_at", { ascending: false })
      .limit(1000);

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const key = String(row.guest_uuid || "");
        if (!key || key in map) continue;
        map[key] = row.action === "App Installed";
      }
    }
  } catch {
    // ignore errors and fallback to local taps
  }

  for (const ev of getLocalTaps()) {
    if (ev.action === "App Installed" || ev.action === "App Not Installed") {
      if (!(ev.guest_uuid in map)) {
        map[ev.guest_uuid] = ev.action === "App Installed";
      }
    }
  }

  return map;
}

// ============================================================
// Latest Video Settings (link + thumbnail editable from Admin)
// ============================================================

export interface LatestVideoConfig {
  url: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string;
}

const LOCAL_VIDEO_KEY = "amaysst_latest_video";

export function extractYouTubeVideoId(url: string): string | null {
  const raw = (url || "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }
    if (host.includes("youtube.com") || host.includes("youtube-nocookie.com")) {
      const vParam = u.searchParams.get("v");
      if (vParam) return vParam;
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2 && ["shorts", "embed", "live", "v"].includes(parts[0])) {
        return parts[1];
      }
    }
  } catch {
    const m = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:shorts\/|watch\?v=|embed\/|live\/))([A-Za-z0-9_-]{6,})/);
    if (m) return m[1];
  }
  return null;
}

export function deriveYouTubeThumbnail(url: string): string {
  const id = extractYouTubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "";
}

export const DEFAULT_LATEST_VIDEO: LatestVideoConfig = {
  url: "https://youtube.com/shorts/J930N9mF8wU",
  title: "Latest video",
  subtitle: "Watch my latest Short · opens on YouTube",
  thumbnailUrl: "https://i.ytimg.com/vi/J930N9mF8wU/hqdefault.jpg",
};

export function loadLocalLatestVideo(): LatestVideoConfig {
  try {
    const raw = localStorage.getItem(LOCAL_VIDEO_KEY);
    if (!raw) return DEFAULT_LATEST_VIDEO;
    const parsed = JSON.parse(raw) as Partial<LatestVideoConfig>;
    const url = (parsed.url || DEFAULT_LATEST_VIDEO.url).trim();
    return {
      url,
      title: (parsed.title || DEFAULT_LATEST_VIDEO.title).trim(),
      subtitle: (parsed.subtitle || DEFAULT_LATEST_VIDEO.subtitle).trim(),
      thumbnailUrl: parsed.thumbnailUrl ?? deriveYouTubeThumbnail(url),
    };
  } catch {
    return DEFAULT_LATEST_VIDEO;
  }
}

export function saveLocalLatestVideo(config: LatestVideoConfig): void {
  try {
    localStorage.setItem(LOCAL_VIDEO_KEY, JSON.stringify(config));
  } catch {
    // ignore storage errors
  }
}

export async function fetchLatestVideo(): Promise<LatestVideoConfig> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "latest_video")
      .maybeSingle();

    if (error || !data?.value) {
      return loadLocalLatestVideo();
    }

    const val = data.value as Partial<LatestVideoConfig>;
    const url = (val.url || DEFAULT_LATEST_VIDEO.url).trim();
    const resolved: LatestVideoConfig = {
      url,
      title: (val.title || DEFAULT_LATEST_VIDEO.title).trim(),
      subtitle: (val.subtitle || DEFAULT_LATEST_VIDEO.subtitle).trim(),
      thumbnailUrl: val.thumbnailUrl ?? deriveYouTubeThumbnail(url),
    };
    saveLocalLatestVideo(resolved);
    return resolved;
  } catch {
    return loadLocalLatestVideo();
  }
}

export async function adminSaveLatestVideo(config: LatestVideoConfig): Promise<{
  ok: boolean;
  needsTableSetup: boolean;
  errorMessage?: string;
}> {
  saveLocalLatestVideo(config);
  try {
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: "latest_video",
        value: config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      const missing = /could not find the table|relation.*does not exist/i.test(error.message);
      return { ok: false, needsTableSetup: missing, errorMessage: error.message };
    }
    return { ok: true, needsTableSetup: false };
  } catch (err) {
    return {
      ok: false,
      needsTableSetup: false,
      errorMessage: (err as Error)?.message || "Network error",
    };
  }
}

// ============================================================
// Bot Roster Overrides (Name, Total XP, Today XP synced via Supabase)
// ============================================================

export interface BotOverride {
  name: string;
  xp: number;
  todayXp: number;
}

const BOT_OVERRIDES_KEY = "amaysst_bot_overrides";

export function loadBotOverrides(): Record<string, BotOverride> {
  try {
    return JSON.parse(localStorage.getItem(BOT_OVERRIDES_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export function saveBotOverrides(map: Record<string, BotOverride>): void {
  try {
    localStorage.setItem(BOT_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export async function fetchBotOverrides(): Promise<Record<string, BotOverride>> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "bot_overrides")
      .maybeSingle();

    if (error || !data?.value || typeof data.value !== "object") {
      return loadBotOverrides();
    }

    const cloudMap = data.value as Record<string, BotOverride>;
    saveBotOverrides(cloudMap);
    return cloudMap;
  } catch {
    return loadBotOverrides();
  }
}

export async function adminSaveBotOverrides(map: Record<string, BotOverride>): Promise<{
  ok: boolean;
  needsTableSetup: boolean;
  errorMessage?: string;
}> {
  saveBotOverrides(map);
  try {
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: "bot_overrides",
        value: map,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      const missing = /could not find the table|relation.*does not exist/i.test(error.message);
      return { ok: false, needsTableSetup: missing, errorMessage: error.message };
    }
    return { ok: true, needsTableSetup: false };
  } catch (err) {
    return {
      ok: false,
      needsTableSetup: false,
      errorMessage: (err as Error)?.message || "Network error",
    };
  }
}

// ============================================================
// Manual Admin Notifications (All Candidates or Specific ID)
// ============================================================

export type NotificationActionType = "none" | "play" | "ranks" | "video" | "link";

export interface AppNotification {
  id: string;
  target: "all" | "candidate";
  targetGuestUuid?: string;
  targetName?: string;
  title: string;
  message: string;
  imageUrl?: string;
  actionType?: NotificationActionType;
  actionLabel?: string;
  actionUrl?: string;
  createdAt: string;
}

const LOCAL_NOTIFS_KEY = "amaysst_notifications";
const ACKED_NOTIFS_KEY = "amaysst_acked_notifs";

export function loadLocalNotifications(): AppNotification[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_NOTIFS_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as AppNotification[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalNotifications(list: AppNotification[]): void {
  try {
    localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    // ignore storage errors
  }
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "notifications")
      .maybeSingle();

    if (error || !data?.value || !Array.isArray(data.value)) {
      return loadLocalNotifications();
    }

    const list = data.value as AppNotification[];
    saveLocalNotifications(list);
    return list;
  } catch {
    return loadLocalNotifications();
  }
}

async function persistNotificationsList(nextList: AppNotification[]): Promise<{
  ok: boolean;
  needsTableSetup: boolean;
  errorMessage?: string;
}> {
  const trimmed = nextList.slice(0, 50);
  saveLocalNotifications(trimmed);
  try {
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: "notifications",
        value: trimmed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      const missing = /could not find the table|relation.*does not exist/i.test(error.message);
      return { ok: false, needsTableSetup: missing, errorMessage: error.message };
    }
    return { ok: true, needsTableSetup: false };
  } catch (err) {
    return {
      ok: false,
      needsTableSetup: false,
      errorMessage: (err as Error)?.message || "Network error",
    };
  }
}

export async function adminSendNotification(
  input: Omit<AppNotification, "id" | "createdAt">
): Promise<{
  ok: boolean;
  needsTableSetup: boolean;
  errorMessage?: string;
  list: AppNotification[];
}> {
  const current = await fetchNotifications();
  const nextItem: AppNotification = {
    ...input,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  const nextList = [nextItem, ...current].slice(0, 50);
  const res = await persistNotificationsList(nextList);
  return { ...res, list: nextList };
}

export async function adminDeleteNotification(id: string): Promise<{
  ok: boolean;
  needsTableSetup: boolean;
  errorMessage?: string;
  list: AppNotification[];
}> {
  const current = await fetchNotifications();
  const nextList = current.filter((n) => n.id !== id);
  const res = await persistNotificationsList(nextList);
  return { ...res, list: nextList };
}

export async function reportNotificationsSeen(
  guestId: string,
  candidateName: string,
  notifIds: string[]
): Promise<void> {
  if (!guestId || !candidateName || notifIds.length === 0) return;

  let acked: string[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(ACKED_NOTIFS_KEY) || "[]");
    if (Array.isArray(parsed)) acked = parsed as string[];
  } catch {
    acked = [];
  }

  const ackSet = new Set(acked);
  const toReport = notifIds.filter((id) => id && !ackSet.has(id));
  if (toReport.length === 0) return;

  for (const id of toReport) {
    ackSet.add(id);
  }
  try {
    localStorage.setItem(ACKED_NOTIFS_KEY, JSON.stringify(Array.from(ackSet).slice(-150)));
  } catch {
    // ignore storage errors
  }

  for (const id of toReport) {
    await logCandidateTap(guestId, candidateName, "Notification Seen", id, "notif");
  }
}

export async function adminLoadNotificationSeenMap(): Promise<
  Record<string, { count: number; names: string[] }>
> {
  const viewersByNotif = new Map<string, Map<string, string>>();

  const addRecord = (notifId: string, guestUuid: string, name: string) => {
    if (!notifId || !guestUuid) return;
    let map = viewersByNotif.get(notifId);
    if (!map) {
      map = new Map<string, string>();
      viewersByNotif.set(notifId, map);
    }
    if (!map.has(guestUuid)) {
      map.set(guestUuid, name || "Student");
    }
  };

  try {
    const { data, error } = await supabase
      .from("candidate_events")
      .select("guest_uuid, candidate_name, detail")
      .eq("action", "Notification Seen")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        addRecord(
          String(row.detail || ""),
          String(row.guest_uuid || ""),
          String(row.candidate_name || "Student")
        );
      }
    }
  } catch {
    // fallback to local events below
  }

  for (const ev of getLocalTaps()) {
    if (ev.action === "Notification Seen") {
      addRecord(ev.detail, ev.guest_uuid, ev.candidate_name);
    }
  }

  const out: Record<string, { count: number; names: string[] }> = {};
  for (const [notifId, viewers] of viewersByNotif.entries()) {
    out[notifId] = {
      count: viewers.size,
      names: Array.from(viewers.values()),
    };
  }
  return out;
}




