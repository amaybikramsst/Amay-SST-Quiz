/* =========================================================
   AmaySST Quiz - Universal Cloud Sync & Live Leaderboard
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
      fetchLiveRanks();
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

// Pull all students from Supabase and put them on the Leaderboard
async function fetchLiveRanks() {
  if (!sb || typeof D === "undefined") return;
  try {
    // Skip anyone the admin has removed (falls back safely if the setup step is not done yet)
    let res = await sb.from("candidates").select("display_name,xp,today_xp,guest_uuid").eq("hidden", false);
    if (res.error) res = await sb.from("candidates").select("display_name,xp,today_xp,guest_uuid");
    const { data, error } = res;
    if (!error && data) {
      if (!window._initialD) window._initialD = [...D];

      // Restore benchmark candidates
      D.length = 0;
      window._initialD.forEach(x => D.push([...x]));

      // Merge all live cloud students into the leaderboard
      data.forEach(c => {
        if (c.guest_uuid !== GUEST_ID) {
          D.push([c.display_name, "", c.xp || 0, c.today_xp || 0]);
        }
      });

      if (typeof render === "function") render();
    }
  } catch(e) {}
}

// Automatically fetch latest ranks whenever student clicks any navigation button
document.addEventListener("click", (e) => {
  if (e.target.closest("button") || e.target.closest("nav")) {
    setTimeout(fetchLiveRanks, 150);
  }
});

// Save student data to Supabase
async function pushToCloud(student) {
  if (!sb) return;
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayXP = (student.td && student.td.d === todayStr) ? student.td.xp : 0;

    await sb.from("candidates").upsert({
      guest_uuid: GUEST_ID,
      display_name: student.name,
      state: student.state || "Bihar",
      xp: student.xp || 0,
      today_xp: todayXP,
      streak: student.streak || 0,
      quizzes_count: student.quizzes || 0,
      perfect_count: student.perfect || 0,
      last_active_date: todayStr,
      updated_at: new Date()
    }, { onConflict: "guest_uuid" });

    if (student.quizzes > 0) {
      await sb.from("quiz_attempts").insert([{
        guest_uuid: GUEST_ID,
        candidate_name: student.name,
        subject: "General Quiz",
        level: 1,
        score: 10,
        total: 10,
        xp_earned: 20
      }]);
    }

    fetchLiveRanks();
  } catch(e) {}
}

const _orig = Storage.prototype.setItem;
Storage.prototype.setItem = function(k, v) {
  _orig.apply(this, arguments);
  if (k === "r10") {
    try {
      const data = JSON.parse(v);
      if (data && data.name) {
        setTimeout(() => pushToCloud(data), 300);
      }
    } catch(e) {}
  }
};
