/* =========================================================
   AmaySST Quiz - Live Cloud Sync + Diagnostic Monitor
   ========================================================= */

const SB_URL = "https://mhlsezufxyypvgygqgiz.supabase.co";
const SB_KEY = "sb_publishable_PwaUNHsURR2mGKxKBtagBw_MzNtJ0yd";

// 1. Create a live status badge at the top of the screen
const dbg = document.createElement("div");
dbg.id = "cloud-status";
dbg.style = "position:fixed;top:6px;left:50%;transform:translateX(-50%);background:#0F172A;color:#38BDF8;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;font-family:sans-serif;z-index:9999;box-shadow:0 4px 14px rgba(0,0,0,0.5);border:1px solid #38BDF8;";
dbg.textContent = "☁️ Supabase: Connecting...";
document.addEventListener("DOMContentLoaded", () => document.body.appendChild(dbg));
// if (document.body) document.body.appendChild(dbg);

function setStatus(msg, isError) {
  if (!dbg) return;
  dbg.textContent = msg;
  dbg.style.borderColor = isError ? "#EF4444" : "#10B981";
  dbg.style.color = isError ? "#EF4444" : "#38BDF8";
}

// 2. Load Supabase
let sb = null;
(function init() {
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  s.onload = () => {
    try {
      if (!window.supabase) return setStatus("❌ Supabase library failed to load", true);
      if (SB_URL.includes("PASTE_YOUR")) return setStatus("❌ Replace PASTE_YOUR keys in backend.js", true);
      sb = window.supabase.createClient(SB_URL, SB_KEY);
      setStatus("☁️ Supabase: Connected!");
    } catch(e) {
      setStatus("❌ Config Error: " + e.message, true);
    }
  };
  document.head.appendChild(s);
})();

// 3. Guest UUID
function getGuestUUID() {
  let id = localStorage.getItem("amaysst_uuid");
  if (!id) {
    id = "guest_" + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now());
    localStorage.setItem("amaysst_uuid", id);
  }
  return id;
}
const GUEST_ID = getGuestUUID();

// 4. Save to Cloud
async function pushToCloud(student) {
  if (!sb) return setStatus("⚠️ Cannot sync: Not connected", true);
  setStatus("⏳ Saving to Supabase...");

  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayXP = (student.td && student.td.d === todayStr) ? student.td.xp : 0;

    const { error: candErr } = await sb.from("candidates").upsert({
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

    if (candErr) {
      setStatus("❌ Database Error: " + candErr.message, true);
      return;
    }

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

    setStatus(`✅ Synced: ${student.name} (${student.xp || 0} XP)`);
  } catch(e) {
    setStatus("❌ Error: " + e.message, true);
  }
}

// 5. Catch any score save
const _orig = Storage.prototype.setItem;
Storage.prototype.setItem = function(k, v) {
  _orig.apply(this, arguments);
  if (k === "r10") {
    try {
      const data = JSON.parse(v);
      if (data && data.name) {
        setTimeout(() => pushToCloud(data), 400);
      }
    } catch(e) {}
  }
};
