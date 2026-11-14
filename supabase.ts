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
