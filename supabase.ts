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
  username?: string | null;
  password?: string | null;
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

export interface AuthRpcResult {
  ok: boolean;
  error?: string;
  needsSql?: boolean;
  has_credentials?: boolean;
  guest_uuid?: string;
  display_name?: string;
  username?: string;
  password?: string;
  xp?: number;
  streak?: number;
  quizzes_count?: number;
  perfect_count?: number;
}

export async function registerWithCredentials(
  guestId: string,
  name: string,
  username: string,
  password: string
): Promise<AuthRpcResult> {
  try {
    const { data, error } = await supabase.rpc("register_with_credentials", {
      p_guest: guestId,
      p_name: name.trim(),
      p_username: username.trim().toLowerCase(),
      p_password: password,
      p_state: "Bihar",
    });
    if (error) {
      const missing = /could not find the function|function .* does not exist/i.test(error.message);
      if (missing) {
        await registerPlayer(guestId, name.trim());
        return {
          ok: true,
          needsSql: true,
          guest_uuid: guestId,
          display_name: name.trim(),
          username: username.trim().toLowerCase(),
          password,
        };
      }
      if (/duplicate key|unique constraint|candidates_username/i.test(error.message)) {
        return { ok: false, error: "This username is already taken. Choose another." };
      }
      return { ok: false, error: error.message };
    }
    const res = (data || {}) as AuthRpcResult;
    return { ...res, password };
  } catch {
    return { ok: false, error: "Network error. Please check your connection and try again." };
  }
}

export async function loginWithCredentials(
  username: string,
  password: string
): Promise<AuthRpcResult> {
  try {
    const { data, error } = await supabase.rpc("login_with_credentials", {
      p_username: username.trim().toLowerCase(),
      p_password: password,
    });
    if (error) {
      const missing = /could not find the function|function .* does not exist/i.test(error.message);
      if (missing) {
        return {
          ok: false,
          needsSql: true,
          error: "Login database setup is pending. Please run the updated SQL in Supabase.",
        };
      }
      return { ok: false, error: error.message };
    }
    const res = (data || { ok: false, error: "Invalid username or password." }) as AuthRpcResult;
    return res.ok ? { ...res, password: res.password || password } : res;
  } catch {
    return { ok: false, error: "Network error. Please check your connection and try again." };
  }
}

export async function setMyCredentials(
  guestId: string,
  username: string,
  password: string,
  displayName?: string
): Promise<AuthRpcResult> {
  try {
    const cleanedName = displayName?.trim() || "";
    const { data, error } = await supabase.rpc("set_my_credentials", {
      p_guest: guestId,
      p_username: username.trim().toLowerCase(),
      p_password: password,
      ...(cleanedName.length >= 2 ? { p_display_name: cleanedName } : {}),
    });
    if (error) {
      const missing = /could not find the function|function .* does not exist/i.test(error.message);
      if (missing && cleanedName.length >= 2) {
        // Fallback if database still has the 3-argument signature
        const legacyRes = await supabase.rpc("set_my_credentials", {
          p_guest: guestId,
          p_username: username.trim().toLowerCase(),
          p_password: password,
        });
        if (!legacyRes.error) {
          await registerPlayer(guestId, cleanedName);
          const parsed = (legacyRes.data || { ok: false }) as AuthRpcResult;
          return parsed.ok ? { ...parsed, password, display_name: cleanedName } : parsed;
        }
      }
      if (missing) {
        return {
          ok: false,
          needsSql: true,
          error: "Account setup SQL has not been run in Supabase yet.",
        };
      }
      if (/duplicate key|unique constraint|candidates_username/i.test(error.message)) {
        return { ok: false, error: "This username is already taken. Choose another." };
      }
      return { ok: false, error: error.message };
    }
    const res = (data || { ok: false, error: "Could not save credentials." }) as AuthRpcResult;
    if (res.ok && cleanedName.length >= 2 && res.display_name !== cleanedName) {
      await registerPlayer(guestId, cleanedName);
    }
    return res.ok ? { ...res, password, display_name: res.display_name || cleanedName || undefined } : res;
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function getMyCredentials(guestId: string): Promise<AuthRpcResult> {
  try {
    const { data, error } = await supabase.rpc("get_my_credentials", { p_guest: guestId });
    if (error) {
      const missing = /could not find the function|function .* does not exist/i.test(error.message);
      return { ok: false, needsSql: missing };
    }
    return (data || { ok: false }) as AuthRpcResult;
  } catch {
    return { ok: false };
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

export interface LeaderboardFetchResult {
  rows: LiveLeaderRow[];
  isIstSynced: boolean;
}

export async function getMyTodayIST(guestId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc("get_my_today_ist", { p_guest: guestId });
    if (error || data === null || data === undefined) return null;
    const num = Number(data);
    return Number.isFinite(num) ? Math.max(0, num) : null;
  } catch {
    return null;
  }
}

export async function getLeaderboard(guestId: string): Promise<LeaderboardFetchResult | null> {
  try {
    const { data: istData, error: istErr } = await supabase.rpc("get_leaderboard_ist", {
      p_guest: guestId,
    });
    if (!istErr && Array.isArray(istData)) {
      return { rows: istData as LiveLeaderRow[], isIstSynced: true };
    }
  } catch {
    // Fallback to legacy get_leaderboard below
  }

  try {
    const { data, error } = await supabase.rpc("get_leaderboard", { p_guest: guestId });
    if (error || !Array.isArray(data)) return null;
    return { rows: data as LiveLeaderRow[], isIstSynced: false };
  } catch {
    return null;
  }
}

const STANDARD_SUBJECT_SET = new Set<SubjectKey>(["math", "sci", "sst", "eng", "hin", "ca"]);

export async function fetchDynamicQuestions(): Promise<DynamicQuestionRow[]> {
  try {
    const { data, error } = await supabase
      .from("dynamic_questions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return (data as DynamicQuestionRow[]).filter((row) =>
      STANDARD_SUBJECT_SET.has(row.subject)
    );
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

export async function adminBulkInsertQuestions(
  rows: Array<Omit<DynamicQuestionRow, "id" | "created_at">>
): Promise<{ error: { message: string } | null }> {
  if (rows.length === 0) return { error: null };
  const res = await supabase.from("dynamic_questions").insert(rows);
  if (!res.error) return { error: null };
  return { error: { message: res.error.message } };
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
    username: string | null;
    password: string | null;
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
    // Query only "App Installed" events (up to 5000) so previous installs stay visible
    // and are never overwritten by later browser-tab opens ("App Not Installed").
    const { data, error } = await supabase
      .from("candidate_events")
      .select("guest_uuid")
      .eq("action", "App Installed")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const key = String(row.guest_uuid || "");
        if (key) {
          map[key] = true;
        }
      }
    }
  } catch {
    // ignore errors and fallback to local taps
  }

  for (const ev of getLocalTaps()) {
    if (ev.action === "App Installed" && ev.guest_uuid) {
      map[ev.guest_uuid] = true;
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
  baseXp?: number;
  xpOffset?: number;
  manualTodayDate?: string;
  manualTodayOffset?: number;
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

const BOT_DAILY_CEILINGS_KEY = "amaysst_bot_daily_ceilings_v1";

export function loadBotDailyCeilings(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(BOT_DAILY_CEILINGS_KEY) || "{}");
    if (!raw || typeof raw !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[k] = Math.round(n);
    }
    return out;
  } catch {
    return {};
  }
}

export function saveBotDailyCeilings(map: Record<string, number>): void {
  try {
    localStorage.setItem(BOT_DAILY_CEILINGS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function mergeBotDailyCeilingMaps(
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > (out[k] || 0)) {
      out[k] = Math.round(n);
    }
  }
  return out;
}

export async function fetchBotDailyCeilings(): Promise<Record<string, number>> {
  const local = loadBotDailyCeilings();
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "bot_daily_ceilings")
      .maybeSingle();

    if (error || !data?.value || typeof data.value !== "object") {
      return local;
    }

    const cloudMap: Record<string, number> = {};
    for (const [k, v] of Object.entries(data.value as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) cloudMap[k] = Math.round(n);
    }
    const merged = mergeBotDailyCeilingMaps(local, cloudMap);
    saveBotDailyCeilings(merged);
    return merged;
  } catch {
    return local;
  }
}

export async function adminSaveBotDailyCeilings(
  map: Record<string, number>
): Promise<{ ok: boolean }> {
  const merged = mergeBotDailyCeilingMaps(loadBotDailyCeilings(), map);
  saveBotDailyCeilings(merged);
  try {
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: "bot_daily_ceilings",
        value: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

// ============================================================
// Candidate Today XP Overrides (IST day-scoped admin additions)
// ============================================================

export interface CandidateTodayOverride {
  dateKey: string;
  delta: number;
  name?: string;
}

const CANDIDATE_TODAY_OVERRIDES_KEY = "amaysst_candidate_today_overrides";

export function loadCandidateTodayOverrides(): Record<string, CandidateTodayOverride> {
  try {
    return JSON.parse(localStorage.getItem(CANDIDATE_TODAY_OVERRIDES_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export function saveCandidateTodayOverrides(map: Record<string, CandidateTodayOverride>): void {
  try {
    localStorage.setItem(CANDIDATE_TODAY_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export async function fetchCandidateTodayOverrides(): Promise<Record<string, CandidateTodayOverride>> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "candidate_today_overrides")
      .maybeSingle();

    if (error || !data?.value || typeof data.value !== "object") {
      return loadCandidateTodayOverrides();
    }

    const cloudMap = data.value as Record<string, CandidateTodayOverride>;
    saveCandidateTodayOverrides(cloudMap);
    return cloudMap;
  } catch {
    return loadCandidateTodayOverrides();
  }
}

export async function adminSaveCandidateTodayOverrides(
  map: Record<string, CandidateTodayOverride>
): Promise<{
  ok: boolean;
  needsTableSetup: boolean;
  errorMessage?: string;
}> {
  saveCandidateTodayOverrides(map);
  try {
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: "candidate_today_overrides",
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

// ============================================================
// Real-Time Messaging & Help Support Chat
// ============================================================

export const HELP_CHAT_UUID = "__help__";

export interface ChatDirectoryUser {
  guest_uuid: string;
  display_name: string;
  xp: number;
}

export interface ChatMessageRow {
  id: string;
  sender_uuid: string;
  sender_name: string;
  recipient_uuid: string;
  recipient_name: string;
  body: string;
  deleted_by_sender?: boolean;
  deleted_by_recipient?: boolean;
  deleted_for_everyone?: boolean;
  deleted_at?: string | null;
  created_at: string;
}

let chatBroadcastChannel: ReturnType<typeof supabase.channel> | null = null;

function broadcastChatSignal(payload: Record<string, unknown>) {
  try {
    if (!chatBroadcastChannel) {
      chatBroadcastChannel = supabase.channel("amaysst_chat_live", {
        config: { broadcast: { self: true } },
      });
      chatBroadcastChannel.subscribe();
    }
    chatBroadcastChannel.send({
      type: "broadcast",
      event: "chat_sync",
      payload,
    });
  } catch {
    // ignore realtime broadcast errors
  }
}

export function subscribeChatRealtime(
  onSignal: (payload: Record<string, unknown>) => void,
  listenPostgresChanges = false
): () => void {
  const channelName = `amaysst_chat_sub_${Math.random().toString(36).slice(2, 8)}`;
  let channel = supabase.channel(channelName).on(
    "broadcast",
    { event: "chat_sync" },
    ({ payload }) => {
      onSignal((payload || {}) as Record<string, unknown>);
    }
  );

  if (listenPostgresChanges) {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chat_messages" },
      (change) => {
        onSignal({ type: "postgres_change", eventType: change.eventType });
      }
    );
  }

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getChatDirectory(guestId: string): Promise<{
  users: ChatDirectoryUser[];
  needsTableSetup: boolean;
}> {
  try {
    const { data, error } = await supabase.rpc("get_chat_directory", { p_guest: guestId });
    if (error) {
      const missing = /could not find the function|does not exist/i.test(error.message);
      return { users: [], needsTableSetup: missing };
    }
    return { users: (data as ChatDirectoryUser[]) || [], needsTableSetup: false };
  } catch {
    return { users: [], needsTableSetup: false };
  }
}

export async function getMyChatMessages(guestId: string): Promise<{
  messages: ChatMessageRow[];
  needsTableSetup: boolean;
}> {
  try {
    const { data, error } = await supabase.rpc("get_my_chat_messages", { p_guest: guestId });
    if (error) {
      const missing = /could not find the function|relation.*does not exist/i.test(error.message);
      return { messages: [], needsTableSetup: missing };
    }
    return { messages: (data as ChatMessageRow[]) || [], needsTableSetup: false };
  } catch {
    return { messages: [], needsTableSetup: false };
  }
}

export async function sendChatMessage(
  senderUuid: string,
  recipientUuid: string,
  body: string
): Promise<{ ok: boolean; message?: ChatMessageRow; error?: string; needsTableSetup?: boolean }> {
  try {
    const { data, error } = await supabase.rpc("send_chat_message", {
      p_sender_uuid: senderUuid,
      p_recipient_uuid: recipientUuid,
      p_body: body.trim(),
    });
    if (error) {
      const missing = /could not find the function|relation.*does not exist/i.test(error.message);
      return { ok: false, error: error.message, needsTableSetup: missing };
    }
    const parsed = (data || {}) as { ok: boolean; message?: ChatMessageRow; error?: string };
    if (parsed.ok && parsed.message) {
      broadcastChatSignal({
        type: "message_created",
        sender_uuid: senderUuid,
        recipient_uuid: recipientUuid,
        id: parsed.message.id,
      });
    }
    return parsed;
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function deleteChatMessage(guestId: string, messageId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("delete_chat_message", {
      p_guest: guestId,
      p_message_id: messageId,
    });
    if (!error) {
      broadcastChatSignal({ type: "message_deleted", guest_uuid: guestId, id: messageId });
      return Boolean(data);
    }
    return false;
  } catch {
    return false;
  }
}

export async function deleteChatThread(guestId: string, otherUuid: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("delete_chat_thread", {
      p_guest: guestId,
      p_other_uuid: otherUuid,
    });
    if (!error) {
      broadcastChatSignal({ type: "thread_deleted", guest_uuid: guestId, other_uuid: otherUuid });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function adminLoadAllChatMessages(): Promise<{
  messages: ChatMessageRow[];
  needsTableSetup: boolean;
}> {
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1000);

    if (error) {
      const missing = /could not find the table|relation.*does not exist/i.test(error.message);
      return { messages: [], needsTableSetup: missing };
    }
    return { messages: (data as ChatMessageRow[]) || [], needsTableSetup: false };
  } catch {
    return { messages: [], needsTableSetup: false };
  }
}

export async function adminSendHelpReply(
  recipientUuid: string,
  recipientName: string,
  body: string
): Promise<{ ok: boolean; message?: ChatMessageRow; error?: string }> {
  const cleaned = body.trim();
  if (!cleaned) return { ok: false, error: "Message cannot be empty." };
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert([
        {
          sender_uuid: HELP_CHAT_UUID,
          sender_name: "Help",
          recipient_uuid: recipientUuid,
          recipient_name: recipientName || "Candidate",
          body: cleaned,
        },
      ])
      .select("*")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    const row = data as ChatMessageRow;
    broadcastChatSignal({
      type: "message_created",
      sender_uuid: HELP_CHAT_UUID,
      recipient_uuid: recipientUuid,
      id: row.id,
    });
    return { ok: true, message: row };
  } catch {
    return { ok: false, error: "Network error." };
  }
}

export async function adminSendMessageAs(
  senderUuid: string,
  senderName: string,
  recipientUuid: string,
  recipientName: string,
  body: string
): Promise<{ ok: boolean; message?: ChatMessageRow; error?: string }> {
  const cleaned = body.trim();
  if (!cleaned) return { ok: false, error: "Message cannot be empty." };
  if (senderUuid === recipientUuid) {
    return { ok: false, error: "Sender and recipient cannot be the same." };
  }
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert([
        {
          sender_uuid: senderUuid,
          sender_name: senderName || "Candidate",
          recipient_uuid: recipientUuid,
          recipient_name: recipientName || "Candidate",
          body: cleaned,
        },
      ])
      .select("*")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    const row = data as ChatMessageRow;
    broadcastChatSignal({
      type: "message_created",
      sender_uuid: senderUuid,
      recipient_uuid: recipientUuid,
      id: row.id,
    });
    return { ok: true, message: row };
  } catch {
    return { ok: false, error: "Network error." };
  }
}
