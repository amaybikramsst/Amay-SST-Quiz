/* =========================================================
   AmaySST Quiz - Cloud Sync & Live Leaderboard (SAFE version)
   Students can no longer send XP numbers. The app only reports
   "I finished a quiz: level, questions, correct answers" and the
   database works out the XP itself.
   ========================================================= */

const SB_URL = "https://mhlsezufxyypvgygqgiz.supabase.co";
const SB_KEY = "sb_publishable_PwaUNHsURR2mGKxKBtagBw_MzNtJ0yd";

let sb = null;
(function init() {
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  s.onload = () => {
    if (window.supabase && SB_URL && !SB_URL.includes("PASTE_YOUR")) {
      sb = window.supabase.createClient(SB_URL, SB_KEY);
      startSync();
    }
  };
  document.head.appendChild(s);
})();

function getGuestUUID() {
  let id = localStorage.getItem("amaysst_uuid");
  if (!id) {
    id = "guest_" + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now());
    localStorage.setItem("amaysst_uuid", id);
  }
  return id;
}
const GUEST_ID = getGuestUUID();
const todayUTC = () => new Date().toISOString().slice(0, 10);

let lastRanks = 0, lastName = "", lastState = "", flushing = false;

/* 1) Tell the database the student's name and state (never XP) */
async function syncProfile() {
  if (!sb || typeof S === "undefined" || !S || !S.name) return;
  const state = S.state || "Bihar";
  if (S.name === lastName && state === lastState) return;
  try {
    const { error } = await sb.rpc("register_player", { p_guest: GUEST_ID, p_name: S.name, p_state: state });
    if (!error) { lastName = S.name; lastState = state; }
  } catch (e) {}
}

/* 2) Take the numbers saved in the database and show them in the app */
function applyStats(st) {
  if (!st || typeof S === "undefined") return;
  S.xp = st.xp;
  S.streak = st.streak;
  S.quizzes = st.quizzes;
  S.perfect = st.perfect;
  S.td = { d: todayUTC(), xp: st.today_xp || 0 };
  if (typeof save === "function") save();
  if (typeof view !== "undefined" && view !== "quiz" && typeof render === "function") render();
}
async function loadMine() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc("get_my_stats", { p_guest: GUEST_ID });
    if (!error && data) applyStats(data);
  } catch (e) {}
}

/* 3) Quiz results waiting to be sent (kept safely if there is no internet) */
const QKEY = "amaysst_queue";
function getQ() { try { return JSON.parse(localStorage.getItem(QKEY)) || []; } catch (e) { return []; } }
function setQ(q) { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch (e) {} }

async function flushQueue() {
  if (!sb || flushing) return;
  flushing = true;
  try {
    await syncProfile();
    const q = getQ();
    while (q.length) {
      const a = q[0];
      const { data, error } = await sb.rpc("submit_quiz", {
        p_guest: GUEST_ID, p_subject: a.k, p_level: a.L, p_total: a.t, p_correct: a.c
      });
      if (!error) { q.shift(); setQ(q); applyStats(data); continue; }
      if (error.code === "P0001") {                       // the database said no
        if (/wait/i.test(error.message || "")) { setTimeout(flushQueue, 16000); break; }
        q.shift(); setQ(q); continue;                     // not a valid result: drop it
      }
      break;                                              // no internet: keep it, try later
    }
  } catch (e) {}
  flushing = false;
  fetchLiveRanks(true);
}

/* Notice when a quiz finishes and add its result to the waiting list */
(function hookFinish() {
  if (typeof window.finish !== "function") return;
  const original = window.finish;
  window.finish = function () {
    const fresh = typeof Z !== "undefined" && Z && !Z.done && Z.qs;
    const result = original.apply(this, arguments);
    if (fresh && Z && Z.done && Z.res) {
      const q = getQ();
      q.push({ k: Z.k, L: Z.L, t: Z.qs.length, c: Z.res.c });
      setQ(q);
      flushQueue();
    }
    return result;
  };
})();

/* 4) Live leaderboard: other students, top 100 only, at most every 20 seconds */
async function fetchLiveRanks(force) {
  if (!sb || typeof D === "undefined") return;
  if (!force && Date.now() - lastRanks < 20000) return;
  lastRanks = Date.now();
  try {
    const { data, error } = await sb.rpc("get_leaderboard", { p_guest: GUEST_ID });
    if (!error && Array.isArray(data)) {
      if (!window._initialD) window._initialD = [...D];
      D.length = 0;
      window._initialD.forEach(x => D.push([...x]));       // the benchmark players
      data.forEach(c => D.push([c.name, "", c.xp || 0, c.today_xp || 0]));
      if (typeof view !== "undefined" && view !== "quiz" && typeof render === "function") render();
    }
  } catch (e) {}
}

document.addEventListener("click", (e) => {
  if (e.target.closest("button") || e.target.closest("nav")) {
    setTimeout(() => fetchLiveRanks(false), 150);
  }
});

/* 5) Start-up, and whenever the internet comes back */
async function startSync() {
  await syncProfile();
  await loadMine();
  await flushQueue();
  fetchLiveRanks(true);
}
window.addEventListener("online", flushQueue);

/* Whenever the app saves, check if the name changed */
const _orig = Storage.prototype.setItem;
Storage.prototype.setItem = function (k, v) {
  _orig.apply(this, arguments);
  if (k === "r10") setTimeout(syncProfile, 300);
};
