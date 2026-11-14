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
} from "lucide-react";
import { BENCHMARK_PLAYERS } from "../data/benchmarks";
import type { SubjectKey } from "../data/questions";
import { parseBulkQuestionFile, type ParsedBulkQuestion } from "../lib/questionParser";
import {
  adminDeleteQuestion,
  adminGetSession,
  adminInsertQuestion,
  adminLoadAttempts,
  adminLoadCandidates,
  adminLoadCandidateTaps,
  adminLoadStats,
  adminSignIn,
  adminSignOut,
  adminUpdateCandidate,
  fetchDynamicQuestions,
  supabase,
  type AdminAttemptRow,
  type AdminCandidateRow,
  type CandidateTapEvent,
  type DynamicQuestionRow,
} from "../lib/supabase";

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

export function saveBotOverrides(map: Record<string, BotOverride>) {
  try {
    localStorage.setItem(BOT_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

interface AdminViewProps {
  onBack: () => void;
  onQuestionsChanged: () => void;
  onBotsChanged: () => void;
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

export const AdminView: React.FC<AdminViewProps> = ({
  onBack,
  onQuestionsChanged,
  onBotsChanged,
}) => {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<"candidates" | "attempts" | "taps" | "questions">("candidates");
  const [candidateFilter, setCandidateFilter] = useState<"students" | "bots">("students");
  const [stats, setStats] = useState({ users: 0, tests: 0, questions: 0, totalXp: 0 });
  const [dynamicQuestions, setDynamicQuestions] = useState<DynamicQuestionRow[]>([]);
  const [candidates, setCandidates] = useState<AdminCandidateRow[]>([]);
  const [attempts, setAttempts] = useState<AdminAttemptRow[]>([]);
  const [taps, setTaps] = useState<CandidateTapEvent[]>([]);
  const [needsTapTable, setNeedsTapTable] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

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

  // Candidate XP & Stats Editor + Inspector Modal
  const [selectedCandidate, setSelectedCandidate] = useState<AdminCandidateRow | null>(null);
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
    const [st, dqs, cands, atts, tapRes] = await Promise.all([
      adminLoadStats(),
      fetchDynamicQuestions(),
      adminLoadCandidates(),
      adminLoadAttempts(),
      adminLoadCandidateTaps(),
    ]);
    setStats(st);
    setDynamicQuestions(dqs);
    setCandidates(cands);
    setAttempts(atts);
    setTaps(tapRes.events);
    setNeedsTapTable(tapRes.needsTableSetup);
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
    setSelectedCandidate(cand);
    setEditName(cand.display_name || "");
    setEditXp(cand.xp || 0);
    setEditTodayXp(cand.today_xp || 0);
    setEditStreak(cand.streak || 0);
    setEditQuizzes(cand.quizzes_count || 0);
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

  const handleSaveBotEdit = (originalName: string, defaultXp: number, defaultTodayXp: number) => {
    const cleaned = botDraftName.trim() || originalName;
    const next = {
      ...botOverrides,
      [originalName]: {
        name: cleaned,
        xp: Math.max(0, Math.round(Number(botDraftXp) || defaultXp)),
        todayXp: defaultTodayXp,
      },
    };
    setBotOverrides(next);
    saveBotOverrides(next);
    setEditingBotOriginalName(null);
    setFeedback({ text: `Updated "${cleaned}".`, ok: true });
    onBotsChanged();
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

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => c.display_name.toLowerCase().includes(q));
  }, [candidates, searchQuery]);

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

        {tab !== "questions" && (
          <div className="relative sm:w-64">
            <Search className="w-4 h-4 text-[#5A6A92] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or subject…"
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

          {candidateFilter === "students" ? (
            <div className="amay-card rounded-[26px] overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#1846AA]/12 dark:border-white/10 text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                  <tr>
                    <th className="py-3.5 px-4">Rank</th>
                    <th className="py-3.5 px-4">Name</th>
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
                            <span>
                              {c.display_name}
                              {c.hidden ? " (Hidden)" : ""}
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
                              <span>Edit XP / Inspect</span>
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
                            b.name
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
                        <td className="py-3 px-4 font-mono-nums">{b.todayXp}</td>
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
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBotOriginalName(b.originalName);
                                setBotDraftName(b.name);
                                setBotDraftXp(b.xp);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[#1457E0] text-white text-xs font-bold cursor-pointer"
                            >
                              Rename / Edit XP
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
                    <td className="py-3 px-4 font-bold">{a.candidate_name}</td>
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
                      <td className="py-3 px-4 font-bold">{t.candidate_name}</td>
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-[#0B1B4D] dark:text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-[#1457E0]" />
                  <span>{selectedCandidate.display_name}</span>
                </h2>
                <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] font-mono-nums">
                  ID: {selectedCandidate.guest_uuid}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="w-9 h-9 rounded-xl amay-card flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
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
