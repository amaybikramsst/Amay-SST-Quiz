/* =========================================================
   AmaySST Quiz - Supabase Backend Connector
   ========================================================= */

// 1. PASTE YOUR SUPABASE DETAILS HERE:
const SB_URL = "https://mhlsezufxyypvgygqgiz.supabase.co";
const SB_KEY = "sb_publishable_PwaUNHsURR2mGKxKBtagBw_MzNtJ0yd";

// 2. LOAD SUPABASE CLIENT
(function initSupabase() {
  if (!window.supabase) {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload = () => {
      window.sb = window.supabase.createClient(SB_URL, SB_KEY);
      fetchLiveRanks();
      loadCloudQuestions();
    };
    document.head.appendChild(s);
  } else {
    window.sb = window.supabase.createClient(SB_URL, SB_KEY);
    fetchLiveRanks();
    loadCloudQuestions();
  }
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

// 4. SYNC SCORES TO ADMIN DASHBOARD
async function syncToSupabase(xpGained, isPerfect, totalQuestions, correctCount) {
  if (!window.sb) return;
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const { data: existing } = await window.sb.from("candidates").select("*").eq("guest_uuid", GUEST_ID).maybeSingle();

    if (!existing) {
      await window.sb.from("candidates").insert([{
        guest_uuid: GUEST_ID,
        display_name: S.name || "Student",
        state: S.state || "Bihar",
        xp: S.xp,
        today_xp: xpGained,
        streak: S.streak,
        quizzes_count: S.quizzes,
        perfect_count: S.perfect,
        last_active_date: todayStr
      }]);
    } else {
      const isNewDay = existing.last_active_date !== todayStr;
      const newTodayXP = isNewDay ? xpGained : ((existing.today_xp || 0) + xpGained);
      await window.sb.from("candidates").update({
        display_name: S.name,
        xp: S.xp,
        today_xp: newTodayXP,
        streak: S.streak,
        quizzes_count: S.quizzes,
        perfect_count: S.perfect,
        last_active_date: todayStr,
        updated_at: new Date()
      }).eq("guest_uuid", GUEST_ID);
    }

    if (totalQuestions > 0) {
      await window.sb.from("quiz_attempts").insert([{
        guest_uuid: GUEST_ID,
        candidate_name: S.name || "Student",
        subject: (window.Z && window.Z.k) ? window.Z.k : "general",
        level: (window.Z && window.Z.L !== undefined) ? window.Z.L : 0,
        score: correctCount,
        total: totalQuestions,
        xp_earned: xpGained
      }]);
    }
  } catch (err) {
    console.warn("Offline mode active:", err);
  }
}

// 5. DOWNLOAD QUESTIONS CREATED IN ADMIN DASHBOARD
async function loadCloudQuestions() {
  if (!window.sb || !window.Q) return;
  try {
    const { data, error } = await window.sb.from("dynamic_questions").select("*");
    if (!error && data && data.length > 0) {
      data.forEach(q => {
        if (window.Q[q.subject]) {
          window.Q[q.subject].q.push([
            q.question_text,
            [q.option_a, q.option_b, q.option_c, q.option_d],
            q.correct_index,
            q.explanation || "",
            q.level || 0
          ]);
        }
      });
    }
  } catch(e) {}
}

// 6. LIVE COMBINED LEADERBOARD
let liveSupabaseCandidates = [];
async function fetchLiveRanks() {
  if (!window.sb) return;
  try {
    const { data, error } = await window.sb.from("candidates").select("display_name,xp,today_xp,guest_uuid");
    if (!error && data) {
      liveSupabaseCandidates = data;
      if (typeof render === "function") render();
    }
  } catch(e) {}
}

// Override rankOf so benchmark + real candidates merge smoothly
window.rankOf = function() {
  const isToday = window.rt === "td";
  let combined = (window.D || []).filter(x => !isToday || x[3] > 0).map(x => ({
    name: x[0],
    xp: isToday ? x[3] : x[2],
    isMe: false
  }));

  liveSupabaseCandidates.forEach(c => {
    if (c.guest_uuid !== GUEST_ID) {
      const score = isToday ? (c.today_xp || 0) : (c.xp || 0);
      if (!isToday || score > 0) {
        combined.push({ name: c.display_name, xp: score, isMe: false });
      }
    }
  });

  const myScore = isToday ? (window.S && window.S.td && window.S.td.d === day(0) ? window.S.td.xp : 0) : (window.S ? window.S.xp : 0);
  combined.push({ name: (window.S && window.S.name) || "You", xp: myScore, isMe: true });
  combined.sort((a, b) => b.xp - a.xp);
  return combined.map(item => [item.name, "", item.xp, item.isMe ? 1 : 0]);
};

window.myRanks = function() {
  const allList = window.rankOf();
  const myIndex = allList.findIndex(x => x[3] === 1);
  const myRank = myIndex >= 0 ? myIndex + 1 : 1;
  return { a: myRank, an: allList.length, t: myRank, tn: allList.length };
};

// Automatic Hooks into Quiz Finishing & Navigation
const _prevFinish = window.finish;
window.finish = function() {
  if (_prevFinish) _prevFinish();
  if (window.Z && window.Z.res) {
    syncToSupabase(window.Z.res.xp, window.Z.res.c === window.Z.res.n, window.Z.res.n, window.Z.res.c);
  }
};

const _prevSetName = window.setName;
window.setName = function() {
  if (_prevSetName) _prevSetName();
  if (window.S && window.S.name) {
    syncToSupabase(0, false, 0, 0);
  }
};

const _prevGo = window.go;
window.go = function(v) {
  if (v === "rank" || v === "home") fetchLiveRanks();
  if (_prevGo) _prevGo(v);
};
