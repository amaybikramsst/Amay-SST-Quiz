/* =========================================================
   AmaySST Quiz - Universal Cloud Sync
   ========================================================= */

// 1. PASTE YOUR 2 SUPABASE KEYS HERE:
const SB_URL = "https://mhlsezufxyypvgygqgiz.supabase.co";
const SB_KEY = "sb_publishable_PwaUNHsURR2mGKxKBtagBw_MzNtJ0yd";

// 2. LOAD SUPABASE CLIENT
let sb = null;
(function initSupabase() {
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  s.onload = () => {
    if (window.supabase && SB_URL && !SB_URL.includes("PASTE_YOUR")) {
      sb = window.supabase.createClient(SB_URL, SB_KEY);
      fetchLiveRanks();
    }
  };
  document.head.appendChild(s);
})();

// 3. GUEST WRISTBAND (UUID)
function getGuestUUID() {
  let id = localStorage.getItem("amaysst_uuid");
  if (!id) {
    id = "guest_" + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now());
    localStorage.setItem("amaysst_uuid", id);
  }
  return id;
}
const GUEST_ID = getGuestUUID();

// 4. UNIVERSAL LISTENER: Catches the score whenever a quiz finishes
let lastQuizzesCount = -1;
const _originalSetItem = Storage.prototype.setItem;

Storage.prototype.setItem = function(key, val) {
  _originalSetItem.apply(this, arguments);

  if (key === "r10" && sb) {
    try {
      const student = JSON.parse(val);
      if (student && student.name) {
        const isNewQuiz = lastQuizzesCount !== -1 && student.quizzes > lastQuizzesCount;
        lastQuizzesCount = student.quizzes;

        pushToCloud(student, isNewQuiz);
      }
    } catch(e) {}
  }
};

// 5. PUSH STUDENT SCORE TO ADMIN DASHBOARD
async function pushToCloud(student, isNewQuiz) {
  if (!sb) return;
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayXP = (student.td && student.td.d === todayStr) ? student.td.xp : 0;

    // Save candidate
    const { data: existing } = await sb.from("candidates").select("*").eq("guest_uuid", GUEST_ID).maybeSingle();

    if (!existing) {
      await sb.from("candidates").insert([{
        guest_uuid: GUEST_ID,
        display_name: student.name,
        state: student.state || "Bihar",
        xp: student.xp || 0,
        today_xp: todayXP,
        streak: student.streak || 0,
        quizzes_count: student.quizzes || 0,
        perfect_count: student.perfect || 0,
        last_active_date: todayStr
      }]);
    } else {
      await sb.from("candidates").update({
        display_name: student.name,
        xp: student.xp || 0,
        today_xp: todayXP,
        streak: student.streak || 0,
        quizzes_count: student.quizzes || 0,
        perfect_count: student.perfect || 0,
        last_active_date: todayStr,
        updated_at: new Date()
      }).eq("guest_uuid", GUEST_ID);
    }

    // Save attempt if a quiz was completed
    if (isNewQuiz) {
      await sb.from("quiz_attempts").insert([{
        guest_uuid: GUEST_ID,
        candidate_name: student.name,
        subject: "General SST",
        level: 1,
        score: 10,
        total: 10,
        xp_earned: 20
      }]);
    }

    fetchLiveRanks();
  } catch(err) {
    console.warn("Cloud sync error:", err);
  }
}

// 6. LIVE LEADERBOARD (COMBINING BENCHMARK + SUPABASE)
let liveCandidates = [];
async function fetchLiveRanks() {
  if (!sb) return;
  try {
    const { data, error } = await sb.from("candidates").select("display_name,xp,today_xp,guest_uuid");
    if (!error && data) {
      liveCandidates = data;
    }
  } catch(e) {}
}

window.rankOf = function() {
  const isToday = window.rt === "td";
  let combined = (window.D || []).filter(x => !isToday || x[3] > 0).map(x => ({
    name: x[0],
    xp: isToday ? x[3] : x[2],
    isMe: false
  }));

  liveCandidates.forEach(c => {
    if (c.guest_uuid !== GUEST_ID) {
      const score = isToday ? (c.today_xp || 0) : (c.xp || 0);
      if (!isToday || score > 0) {
        combined.push({ name: c.display_name, xp: score, isMe: false });
      }
    }
  });

  let myScore = 0;
  let myName = "You";
  try {
    const local = JSON.parse(localStorage.getItem("r10"));
    if (local) {
      myName = local.name || "You";
      myScore = isToday ? (local.td ? local.td.xp : 0) : (local.xp || 0);
    }
  } catch(e) {}

  combined.push({ name: myName, xp: myScore, isMe: true });
  combined.sort((a, b) => b.xp - a.xp);
  return combined.map(item => [item.name, "", item.xp, item.isMe ? 1 : 0]);
};
