import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Heart,
  LifeBuoy,
  MessageCircle,
  Plus,
  Reply,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteChatMessage,
  deleteChatThread,
  getChatDirectory,
  getMyChatMessages,
  HELP_CHAT_UUID,
  sendChatMessage,
  subscribeChatRealtime,
  type ChatDirectoryUser,
  type ChatMessageRow,
} from "../lib/supabase";

interface ChatViewProps {
  guestId: string;
  myName: string;
  extraDirectory?: ChatDirectoryUser[];
  initialPeer?: { uuid: string; name: string } | null;
  onClearInitialPeer?: () => void;
  onUnreadCountChange?: (count: number) => void;
}

const CHAT_READ_KEY = "amaysst_chat_read_at";
const CHAT_NOTE_KEY = "amaysst_my_study_note";
const CHAT_LIKES_KEY = "amaysst_chat_likes_v1";

function loadReadMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CHAT_READ_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveReadMap(map: Record<string, string>) {
  try {
    localStorage.setItem(CHAT_READ_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function loadMyNote(): string {
  try {
    return localStorage.getItem(CHAT_NOTE_KEY) || "";
  } catch {
    return "";
  }
}

function saveMyNote(note: string) {
  try {
    localStorage.setItem(CHAT_NOTE_KEY, note);
  } catch {
    // ignore storage errors
  }
}

function loadLikesMap(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(CHAT_LIKES_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveLikesMap(map: Record<string, boolean>) {
  try {
    localStorage.setItem(CHAT_LIKES_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function formatMsgTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function parseReplyFormat(rawBody: string): { replyQuote: string | null; cleanBody: string } {
  if (rawBody.startsWith("↪ ")) {
    const splitIdx = rawBody.indexOf("\n\n");
    if (splitIdx !== -1) {
      return {
        replyQuote: rawBody.slice(2, splitIdx).trim(),
        cleanBody: rawBody.slice(splitIdx + 2),
      };
    }
  }
  return { replyQuote: null, cleanBody: rawBody };
}

function inferAvatarGender(name: string): "male" | "female" {
  const clean = name.trim().toLowerCase().replace(/[^a-z\s]/g, "");
  const parts = clean.split(/\s+/).filter(Boolean);
  const first = parts[0] || "";
  const last = parts[parts.length - 1] || "";

  if (!first) return "male";

  const maleExceptions = new Set([
    "rabi",
    "ravi",
    "aditya",
    "krishna",
    "shiva",
    "surya",
    "arya",
    "rudra",
    "kabir",
    "jasin",
    "aman",
    "amit",
    "sumit",
    "rohit",
    "mohit",
    "ankit",
    "rahul",
    "abhishek",
    "akash",
    "vikash",
    "vikas",
    "deepak",
    "prince",
    "harsh",
    "yash",
    "ayush",
    "piyush",
    "amay",
    "sunny",
    "lucky",
    "bunny",
    "vicky",
    "bobby",
    "monty",
    "sonu",
    "monu",
    "golu",
    "chhotu",
    "raja",
    "rana",
    "mustafa",
    "hamza",
    "ali",
    "usman",
    "umar",
    "farhan",
    "arjun",
    "karan",
    "varun",
    "tarun",
    "arun",
  ]);

  if (maleExceptions.has(first)) return "male";
  if (last === "kumar") return "male";
  if (
    last === "kumari" ||
    last === "devi" ||
    last === "bano" ||
    last === "khatoon" ||
    last === "parveen"
  ) {
    return "female";
  }

  const femaleExact = new Set([
    "priya",
    "neha",
    "pooja",
    "puja",
    "anjali",
    "sneha",
    "swati",
    "kavita",
    "sunita",
    "anita",
    "nikita",
    "ankita",
    "shreya",
    "divya",
    "riya",
    "siya",
    "jiya",
    "diya",
    "tanya",
    "sanya",
    "anya",
    "isha",
    "nisha",
    "asha",
    "usha",
    "kiran",
    "simran",
    "muskan",
    "khushi",
    "kajal",
    "komal",
    "sonam",
    "poonam",
    "rekha",
    "seema",
    "meena",
    "geeta",
    "sita",
    "radha",
    "ganga",
    "laxmi",
    "lakshmi",
    "saraswati",
    "durga",
    "parvati",
    "nandini",
    "roshni",
    "chandni",
    "jyoti",
    "arti",
    "aarti",
    "bharti",
    "sweta",
    "shweta",
    "sakshi",
    "megha",
    "varsha",
    "richa",
    "ruchika",
    "monika",
    "sonia",
    "soniya",
    "tina",
    "nina",
    "mina",
    "hina",
    "sana",
    "zoya",
    "fatima",
    "ayesha",
    "aisha",
    "sadia",
    "nazia",
    "rubina",
    "shabnam",
    "palak",
    "mahak",
    "mehak",
    "payal",
    "sheetal",
    "sapna",
    "archana",
    "vandana",
    "sadhana",
    "kalpana",
    "arpita",
    "ipsita",
    "susmita",
    "sushmita",
    "madhu",
    "nidhi",
    "siddhi",
    "riddhi",
    "vrinda",
    "shruti",
    "smriti",
    "kriti",
    "aditi",
    "stuti",
    "pragati",
    "unnati",
    "bhavya",
    "navya",
    "kavya",
    "saumya",
    "soumya",
  ]);

  if (femaleExact.has(first)) return "female";

  if (
    first.endsWith("a") ||
    first.endsWith("i") ||
    first.endsWith("ee") ||
    first.endsWith("ya") ||
    first.endsWith("shi")
  ) {
    return "female";
  }

  return "male";
}

// Stylized Male & Female Vector Bust Silhouettes matching user's reference graphic
const ProfileSilhouetteAvatar: React.FC<{
  name: string;
  sizeClass?: string;
}> = ({ name, sizeClass = "w-10 h-10" }) => {
  const gender = inferAvatarGender(name);

  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden flex items-center justify-center shrink-0 select-none ${
        gender === "female"
          ? "bg-gradient-to-b from-[#2A53A8] to-[#132656]"
          : "bg-gradient-to-b from-[#214B9C] to-[#0F204A]"
      }`}
    >
      {gender === "female" ? (
        /* Female Bust Silhouette with Long Swept Hair & V-Tapered Base */
        <svg viewBox="0 0 100 100" className="w-[84%] h-[84%]" aria-hidden="true">
          {/* Hair & Head Silhouette */}
          <path
            d="M52 13c-13.5 0-22.5 9.2-24 23.5-1.1 10.6 0.4 18.8 3.2 24.2 1.3 2.5 3.1 4.2 5.4 4.8-1.4-2.8-1.8-6.4-0.8-10.3 0.7-2.6 1.9-5.1 3.4-7.1-1.3-4.8-1.3-11.2 1.6-15.8 1.5-2.4 3.8-4.1 6.2-4.8-3.5 3.6-4.6 9.5-3.6 15.2 1 5.6 4.4 10.4 9.2 12.1 2.2 0.8 4.6 0.9 6.8 0.3 4.8-1.4 8.2-5.9 9.5-11.4 1.1-4.8 0.6-10.1-1.6-14.2 2.4 3.2 3.8 7.5 3.7 12.2-0.1 4.4-1.5 8.6-3.8 11.8 1.8 3.1 4.5 5.4 7.8 6.4-1.6-2.5-2.4-5.7-2.2-9.2 0.3-5.2 1.8-11.6 1.1-18.8C72.7 21.8 64.5 13 52 13z"
            fill="#F0F5FF"
          />
          {/* Inner Face & Neck Fill */}
          <path
            d="M44.5 28.5c-2.6 3.5-2.8 9.2-1.7 14.3 1.1 5 4.2 9.2 8.4 10.6 2 0.7 4.2 0.7 6.1 0.1 4.2-1.3 7.2-5.2 8.3-10.1 1-4.4 0.5-9.2-1.5-12.8-2.4-4.2-6.6-6.3-11.2-6.1-3.4 0.1-6.5 1.6-8.4 4z"
            fill="#F0F5FF"
          />
          {/* Neck & V-Tapered Shoulders */}
          <path
            d="M44.5 53.5c0.2 3.4-0.6 6.2-2.6 7.7-4.8 3.2-13.5 4.2-17.2 8.6-2.1 2.5-2.9 6.1-2.5 9.6 0.3 2.5 1.8 4.4 4.1 5.5 6.8 3.2 13.8 6.4 18.8 10.6 2.8 2.3 6.9 2.3 9.7 0 5-4.2 12-7.4 18.8-10.6 2.3-1.1 3.8-3 4.1-5.5 0.4-3.5-0.4-7.1-2.5-9.6-3.7-4.4-12.4-5.4-17.2-8.6-2-1.5-2.8-4.3-2.6-7.7-3.6 1.2-7.3 1.2-10.9 0z"
            fill="#F0F5FF"
          />
        </svg>
      ) : (
        /* Male Bust Silhouette with Spiky Hair, V-Neck Collar & V-Tapered Base */
        <svg viewBox="0 0 100 100" className="w-[84%] h-[84%]" aria-hidden="true">
          {/* Spiky Hair & Head Silhouette */}
          <path
            d="M50 12c-3.5 0-6.8 1.2-9.4 2.7l1.6-2.2c-4.4 0.6-8.4 2.9-11.2 6.2l0.8-2.3c-3.4 2.1-5.8 5.6-6.7 9.6l1.4-1.2c-0.9 3.2-1 6.7-0.2 10-1.9 0.3-3.1 2.3-2.5 4.9 0.6 2.5 2.4 4.4 4.3 4.6 1.4 4.6 4.4 8.3 8.4 10.2 2.4 1.1 5.1 1.6 7.8 1.4 3.5-0.3 6.8-1.9 9.2-4.6 2.3-2.6 3.9-5.9 4.7-9.4 1.8-0.3 3.4-2.1 4-4.5 0.6-2.5-0.5-4.5-2.4-4.8 0.9-4.1 0.6-8.5-1.2-12.2-2.6-5.3-7.9-8.4-13.6-8.4z"
            fill="#F0F5FF"
          />
          {/* Neck */}
          <path
            d="M42.2 52.5c0.3 3.3-0.3 6-1.8 7.8 3.2 4.1 6.4 7.4 9.6 9.6 3.2-2.2 6.4-5.5 9.6-9.6-1.5-1.8-2.1-4.5-1.8-7.8-5.1 1.8-10.5 1.8-15.6 0z"
            fill="#F0F5FF"
          />
          {/* V-Neck Shirt Shoulders & V-Tapered Bust */}
          <path
            d="M38.2 61.8c-5.4 2.3-12.4 3.8-15.6 7.9-2.2 2.8-2.9 6.6-2.4 10.3 0.3 2.5 1.9 4.5 4.2 5.6 7.1 3.3 14.5 6.6 19.8 11 2.9 2.4 7.1 2.4 10 0 5.3-4.4 12.7-7.7 19.8-11 2.3-1.1 3.9-3.1 4.2-5.6 0.5-3.7-0.2-7.5-2.4-10.3-3.2-4.1-10.2-5.6-15.6-7.9-3.4 4.3-6.8 7.8-10.2 10.2-3.4-2.4-6.8-5.9-10.2-10.2z"
            fill="#F0F5FF"
          />
        </svg>
      )}
    </div>
  );
};

export const ChatView: React.FC<ChatViewProps> = ({
  guestId,
  myName,
  extraDirectory = [],
  initialPeer = null,
  onClearInitialPeer,
  onUnreadCountChange,
}) => {
  const [directory, setDirectory] = useState<ChatDirectoryUser[]>([]);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [needsSetup, setNeedsSetup] = useState(false);

  const [activePeerUuid, setActivePeerUuid] = useState<string | null>(initialPeer?.uuid ?? null);
  const [activePeerFallbackName, setActivePeerFallbackName] = useState<string>(initialPeer?.name ?? "");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [confirmDeleteThread, setConfirmDeleteThread] = useState(false);
  const [deletingThread, setDeletingThread] = useState(false);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [unsendingMsgId, setUnsendingMsgId] = useState<string | null>(null);
  const [readMap, setReadMap] = useState<Record<string, string>>(() => loadReadMap());
  const [hasLoadedMessages, setHasLoadedMessages] = useState(false);
  const [openedUnseen, setOpenedUnseen] = useState<{
    peerUuid: string;
    count: number;
    firstMsgId: string | null;
  } | null>(null);

  const [myNote, setMyNote] = useState<string>(() => loadMyNote());
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>(() => loadLikesMap());
  const [heartBurstId, setHeartBurstId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ sender: string; snippet: string } | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const unseenDividerRef = useRef<HTMLDivElement | null>(null);
  const capturedSessionPeerRef = useRef<string | null>(null);
  const scrolledUnseenPeerRef = useRef<string | null>(null);
  const prevActiveCountRef = useRef<number>(0);
  const lastTapRef = useRef<{ id: string; time: number }>({ id: "", time: 0 });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialPeer?.uuid) {
      setActivePeerUuid(initialPeer.uuid);
      setActivePeerFallbackName(initialPeer.name);
      setConfirmDeleteThread(false);
      setSelectedMsgId(null);
      setReplyingTo(null);
      setSendError("");
    }
  }, [initialPeer?.uuid, initialPeer?.name]);

  const refreshChatData = useCallback(async () => {
    const [dirRes, msgRes] = await Promise.all([
      getChatDirectory(guestId),
      getMyChatMessages(guestId),
    ]);
    setDirectory(dirRes.users);
    setMessages(msgRes.messages);
    setNeedsSetup(dirRes.needsTableSetup || msgRes.needsTableSetup);
    setHasLoadedMessages(true);
  }, [guestId]);

  useEffect(() => {
    refreshChatData();
    const unsubscribe = subscribeChatRealtime((signal) => {
      const s = String(signal.sender_uuid || "");
      const r = String(signal.recipient_uuid || "");
      const g = String(signal.guest_uuid || "");
      const o = String(signal.other_uuid || "");
      if (!s && !r && !g) {
        refreshChatData();
        return;
      }
      if (s === guestId || r === guestId || g === guestId || o === guestId) {
        refreshChatData();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [guestId, refreshChatData]);

  const markPeerRead = useCallback((peerUuid: string, peerMessages?: ChatMessageRow[]) => {
    let latestMs = Date.now();
    if (peerMessages) {
      for (const m of peerMessages) {
        const ms = Date.parse(m.created_at);
        if (Number.isFinite(ms) && ms > latestMs) {
          latestMs = ms;
        }
      }
    }
    const readIso = new Date(latestMs).toISOString();
    setReadMap((prev) => {
      const prevMs = prev[peerUuid] ? Date.parse(prev[peerUuid]) : 0;
      if (Number.isFinite(prevMs) && prevMs >= latestMs) {
        return prev;
      }
      const next = { ...prev, [peerUuid]: readIso };
      saveReadMap(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!activePeerUuid) {
      capturedSessionPeerRef.current = null;
      setOpenedUnseen(null);
      return;
    }
    if (!hasLoadedMessages) return;

    const peerMsgs = messages.filter(
      (m) =>
        (m.sender_uuid === guestId && m.recipient_uuid === activePeerUuid) ||
        (m.sender_uuid === activePeerUuid && m.recipient_uuid === guestId)
    );

    if (capturedSessionPeerRef.current !== activePeerUuid) {
      const prevReadIso = loadReadMap()[activePeerUuid];
      const prevReadMs = prevReadIso ? Date.parse(prevReadIso) : NaN;
      const unseenMsgs = peerMsgs.filter((m) => {
        if (m.sender_uuid !== activePeerUuid) return false;
        if (!Number.isFinite(prevReadMs)) return true;
        return Date.parse(m.created_at) > prevReadMs;
      });
      capturedSessionPeerRef.current = activePeerUuid;
      setOpenedUnseen(
        unseenMsgs.length > 0
          ? {
              peerUuid: activePeerUuid,
              count: unseenMsgs.length,
              firstMsgId: unseenMsgs[0].id,
            }
          : null
      );
      markPeerRead(activePeerUuid, peerMsgs);
    } else if (peerMsgs.length > 0) {
      markPeerRead(activePeerUuid, peerMsgs);
    }
  }, [activePeerUuid, guestId, hasLoadedMessages, markPeerRead, messages]);

  const { threadsMap, totalUnread } = useMemo(() => {
    const map = new Map<
      string,
      {
        peerUuid: string;
        peerName: string;
        lastMessage?: ChatMessageRow;
        unread: number;
      }
    >();

    for (const m of messages) {
      const isMine = m.sender_uuid === guestId;
      const peerUuid = isMine ? m.recipient_uuid : m.sender_uuid;
      const peerName =
        peerUuid === HELP_CHAT_UUID
          ? "Help"
          : isMine
            ? m.recipient_name
            : m.sender_name;

      const existing = map.get(peerUuid) || {
        peerUuid,
        peerName,
        unread: 0,
      };
      existing.peerName = peerName || existing.peerName;
      existing.lastMessage = m;

      if (!isMine && peerUuid !== activePeerUuid) {
        const lastReadIso = readMap[peerUuid];
        if (!lastReadIso || Date.parse(m.created_at) > Date.parse(lastReadIso)) {
          existing.unread += 1;
        }
      }
      map.set(peerUuid, existing);
    }

    let unreadIdCount = 0;
    for (const item of map.values()) {
      if (item.unread > 0) unreadIdCount += 1;
    }
    return { threadsMap: map, totalUnread: unreadIdCount };
  }, [activePeerUuid, guestId, messages, readMap]);

  useEffect(() => {
    if (hasLoadedMessages) {
      onUnreadCountChange?.(totalUnread);
    }
  }, [hasLoadedMessages, onUnreadCountChange, totalUnread]);

  const { mergedDirectory, rankMap } = useMemo(() => {
    const map = new Map<string, ChatDirectoryUser>();
    for (const u of directory) {
      if (u.guest_uuid && u.guest_uuid !== guestId) {
        map.set(u.guest_uuid, u);
      }
    }
    for (const u of extraDirectory) {
      if (u.guest_uuid && u.guest_uuid !== guestId && !map.has(u.guest_uuid)) {
        map.set(u.guest_uuid, u);
      }
    }
    const sorted = Array.from(map.values()).sort((a, b) => (b.xp || 0) - (a.xp || 0));
    const ranks = new Map<string, number>();
    sorted.forEach((u, idx) => {
      ranks.set(u.guest_uuid, idx + 1);
    });
    return { mergedDirectory: sorted, rankMap: ranks };
  }, [directory, extraDirectory, guestId]);

  const activePeerName = useMemo(() => {
    if (!activePeerUuid) return "";
    if (activePeerUuid === HELP_CHAT_UUID) return "Help";
    const fromDir = mergedDirectory.find((u) => u.guest_uuid === activePeerUuid)?.display_name;
    if (fromDir) return fromDir;
    const fromThread = threadsMap.get(activePeerUuid)?.peerName;
    if (fromThread) return fromThread;
    if (activePeerFallbackName) return activePeerFallbackName;
    if (activePeerUuid.startsWith("bot_")) return activePeerUuid.slice(4);
    return "Candidate";
  }, [activePeerFallbackName, activePeerUuid, mergedDirectory, threadsMap]);

  const activeMessages = useMemo(() => {
    if (!activePeerUuid) return [];
    return messages.filter(
      (m) =>
        (m.sender_uuid === guestId && m.recipient_uuid === activePeerUuid) ||
        (m.sender_uuid === activePeerUuid && m.recipient_uuid === guestId)
    );
  }, [activePeerUuid, guestId, messages]);

  useEffect(() => {
    if (!activePeerUuid) {
      scrolledUnseenPeerRef.current = null;
      prevActiveCountRef.current = 0;
      return;
    }
    if (capturedSessionPeerRef.current !== activePeerUuid) {
      return;
    }

    if (
      openedUnseen?.peerUuid === activePeerUuid &&
      openedUnseen.count > 0 &&
      scrolledUnseenPeerRef.current !== activePeerUuid &&
      unseenDividerRef.current
    ) {
      unseenDividerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      scrolledUnseenPeerRef.current = activePeerUuid;
      prevActiveCountRef.current = activeMessages.length;
      return;
    }

    if (activeMessages.length > 0 && prevActiveCountRef.current !== activeMessages.length) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      prevActiveCountRef.current = activeMessages.length;
    }
  }, [activePeerUuid, activeMessages.length, openedUnseen]);

  const triggerHeartLike = (msgId: string) => {
    setLikedIds((prev) => {
      const next = { ...prev, [msgId]: !prev[msgId] };
      saveLikesMap(next);
      return next;
    });
    setHeartBurstId(msgId);
    setTimeout(() => {
      setHeartBurstId((curr) => (curr === msgId ? null : curr));
    }, 650);
  };

  const handleMessageTap = (msgId: string, isMine: boolean) => {
    const now = Date.now();
    if (lastTapRef.current.id === msgId && now - lastTapRef.current.time < 300) {
      lastTapRef.current = { id: "", time: 0 };
      triggerHeartLike(msgId);
      return;
    }
    lastTapRef.current = { id: msgId, time: now };
    if (isMine) {
      setSelectedMsgId((prev) => (prev === msgId ? null : msgId));
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePeerUuid || sending) return;
    const rawText = draft.trim();
    if (!rawText) return;

    const finalPayload = replyingTo
      ? `↪ ${replyingTo.sender}: "${replyingTo.snippet}"\n\n${rawText}`
      : rawText;

    setSendError("");
    setSending(true);
    setDraft("");
    setReplyingTo(null);

    const res = await sendChatMessage(guestId, activePeerUuid, finalPayload);
    setSending(false);

    if (!res.ok || !res.message) {
      setDraft(rawText);
      setSendError(res.error || "Could not send message.");
      return;
    }

    setMessages((prev) =>
      prev.some((item) => item.id === res.message!.id) ? prev : [...prev, res.message!]
    );
    markPeerRead(activePeerUuid, [res.message!]);
  };

  const handleUnsendMessage = async (msgId: string) => {
    if (unsendingMsgId) return;
    setUnsendingMsgId(msgId);
    setSendError("");
    const ok = await deleteChatMessage(guestId, msgId);
    setUnsendingMsgId(null);
    setSelectedMsgId(null);
    if (ok) {
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } else {
      setSendError("Could not unsend message. Please try again.");
    }
  };

  const handleDeleteEntireThread = async () => {
    if (!activePeerUuid || deletingThread) return;
    setDeletingThread(true);
    await deleteChatThread(guestId, activePeerUuid);
    setMessages((prev) =>
      prev.filter(
        (m) =>
          !(
            (m.sender_uuid === guestId && m.recipient_uuid === activePeerUuid) ||
            (m.sender_uuid === activePeerUuid && m.recipient_uuid === guestId)
          )
      )
    );
    setDeletingThread(false);
    setConfirmDeleteThread(false);
    setActivePeerUuid(null);
    setActivePeerFallbackName("");
    onClearInitialPeer?.();
  };

  const handleSaveStudyNote = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = noteDraft.trim().slice(0, 42);
    setMyNote(cleaned);
    saveMyNote(cleaned);
    setEditingNote(false);
  };

  const { recentThreads, searchMatches } = useMemo(() => {
    const q = search.trim().toLowerCase();

    const activeList = Array.from(threadsMap.values())
      .filter((t) => t.peerUuid !== HELP_CHAT_UUID)
      .filter((t) => !q || t.peerName.toLowerCase().includes(q))
      .sort((a, b) => {
        const aTime = a.lastMessage ? Date.parse(a.lastMessage.created_at) : 0;
        const bTime = b.lastMessage ? Date.parse(b.lastMessage.created_at) : 0;
        return bTime - aTime;
      });

    const matches =
      q.length > 0
        ? mergedDirectory
            .filter((u) => !threadsMap.has(u.guest_uuid))
            .filter((u) => u.display_name.toLowerCase().includes(q))
        : [];

    return { recentThreads: activeList, searchMatches: matches };
  }, [mergedDirectory, search, threadsMap]);

  const helpThread = threadsMap.get(HELP_CHAT_UUID);

  if (activePeerUuid) {
    const isHelp = activePeerUuid === HELP_CHAT_UUID;
    const peerRank = !isHelp ? rankMap.get(activePeerUuid) : undefined;

    return (
      <div className="space-y-3">
        <div className="amay-card rounded-[26px] p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                setActivePeerUuid(null);
                setActivePeerFallbackName("");
                setConfirmDeleteThread(false);
                setSelectedMsgId(null);
                setReplyingTo(null);
                setSendError("");
                onClearInitialPeer?.();
              }}
              aria-label="Back to messages"
              className="w-9 h-9 rounded-full amay-card flex items-center justify-center text-[#1457E0] dark:text-[#5AA2FF] cursor-pointer shrink-0 active:scale-95 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="relative shrink-0">
              {isHelp ? (
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm text-white bg-gradient-to-br from-[#38B0FF] to-[#0B57DD] ring-2 ring-[#38B0FF]/35">
                  <LifeBuoy className="w-5 h-5" />
                </div>
              ) : (
                <ProfileSilhouetteAvatar
                  name={activePeerName}
                  sizeClass="w-10 h-10 ring-2 ring-[#1457E0]/30"
                />
              )}
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#080D1B] absolute bottom-0 right-0" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <strong className="block text-[15px] font-extrabold text-[#0B1B4D] dark:text-white truncate">
                  {activePeerName}
                </strong>

                {peerRank && (
                  <span className="px-1.5 py-0.5 rounded-md bg-[#1457E0]/12 dark:bg-white/10 text-[#1457E0] dark:text-[#93A3CC] text-[10px] font-mono font-bold shrink-0">
                    #{peerRank}
                  </span>
                )}

                {openedUnseen &&
                  openedUnseen.peerUuid === activePeerUuid &&
                  openedUnseen.count > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#E5091E] text-white text-[10px] font-extrabold shrink-0">
                      {openedUnseen.count} new
                    </span>
                  )}
              </div>
              <span className="block text-[11px] text-[#5A6A92] dark:text-[#93A3CC]">
                {isHelp
                  ? "Official Support · Active now"
                  : "Active · Double-tap a message to ❤️"}
              </span>
            </div>
          </div>

          {activeMessages.length > 0 && !confirmDeleteThread && (
            <button
              type="button"
              onClick={() => setConfirmDeleteThread(true)}
              aria-label="Delete chat"
              className="h-9 px-3 rounded-full bg-[#D92D3A]/10 text-[#D92D3A] dark:text-[#FF6B76] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
        </div>

        {confirmDeleteThread && (
          <div className="amay-card rounded-2xl p-3.5 border border-[#D92D3A]/25 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#0B1B4D] dark:text-white">
              Delete this entire chat from your ID? It will remain in the other chat.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={deletingThread}
                onClick={handleDeleteEntireThread}
                className="px-3 py-1.5 rounded-full bg-[#D92D3A] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {deletingThread ? "Deleting…" : "Yes, Delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteThread(false)}
                className="px-3 py-1.5 rounded-full amay-card text-xs font-bold text-[#0B1B4D] dark:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="amay-card rounded-[28px] p-3.5 flex flex-col min-h-[410px] max-h-[63vh]">
          <div className="flex-1 overflow-y-auto px-1 space-y-1">
            {activeMessages.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center space-y-2">
                {isHelp ? (
                  <div className="w-16 h-16 rounded-full flex items-center justify-center font-extrabold text-xl text-white mb-1 bg-gradient-to-br from-[#38B0FF] to-[#0B57DD] ring-4 ring-[#1457E0]/20">
                    <LifeBuoy className="w-7 h-7" />
                  </div>
                ) : (
                  <ProfileSilhouetteAvatar
                    name={activePeerName}
                    sizeClass="w-16 h-16 mb-1 ring-4 ring-[#1457E0]/25"
                  />
                )}
                <p className="text-base font-extrabold text-[#0B1B4D] dark:text-white">
                  {activePeerName}
                </p>
                <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] max-w-[240px]">
                  {isHelp
                    ? "Need help with quizzes, XP, or chapters? Send a message below."
                    : `AmaySST Quiz · Chatting as ${myName}`}
                </p>
              </div>
            ) : (
              activeMessages.map((m, idx) => {
                const isMine = m.sender_uuid === guestId;
                const prevMsg = idx > 0 ? activeMessages[idx - 1] : null;
                const nextMsg = idx < activeMessages.length - 1 ? activeMessages[idx + 1] : null;
                const sameAsPrev = prevMsg?.sender_uuid === m.sender_uuid;
                const sameAsNext = nextMsg?.sender_uuid === m.sender_uuid;

                const isSelected = isMine && selectedMsgId === m.id;
                const isUnsending = unsendingMsgId === m.id;
                const isLiked = Boolean(likedIds[m.id]);
                const isBursting = heartBurstId === m.id;
                const { replyQuote, cleanBody } = parseReplyFormat(m.body);

                const showUnseenDivider =
                  openedUnseen &&
                  openedUnseen.peerUuid === activePeerUuid &&
                  openedUnseen.count > 0 &&
                  openedUnseen.firstMsgId === m.id;

                const dividerEl = showUnseenDivider ? (
                  <div
                    ref={unseenDividerRef}
                    className="flex items-center gap-2.5 py-2.5"
                    aria-label={`${openedUnseen.count} unseen ${openedUnseen.count === 1 ? "message" : "messages"}`}
                  >
                    <span className="flex-1 h-px bg-[#1457E0]/25 dark:bg-[#5AA2FF]/25" />
                    <span className="px-3 py-1 rounded-full bg-[#1457E0]/12 dark:bg-[#5AA2FF]/15 text-[#1457E0] dark:text-[#5AA2FF] text-[11px] font-extrabold tracking-tight shrink-0">
                      {openedUnseen.count} unseen {openedUnseen.count === 1 ? "message" : "messages"}
                    </span>
                    <span className="flex-1 h-px bg-[#1457E0]/25 dark:bg-[#5AA2FF]/25" />
                  </div>
                ) : null;

                const mineRadius = `${sameAsPrev ? "rounded-tr-[6px]" : "rounded-tr-[20px]"} ${
                  sameAsNext ? "rounded-br-[6px]" : "rounded-br-[20px]"
                } rounded-l-[20px]`;

                const peerRadius = `${sameAsPrev ? "rounded-tl-[6px]" : "rounded-tl-[20px]"} ${
                  sameAsNext ? "rounded-bl-[6px]" : "rounded-bl-[20px]"
                } rounded-r-[20px]`;

                if (!isMine) {
                  return (
                    <React.Fragment key={m.id}>
                      {dividerEl}
                      <div
                        className={`group flex items-end gap-2 justify-start ${
                          sameAsPrev ? "mt-0.5" : "mt-2.5"
                        } ${isLiked ? "mb-2" : ""}`}
                      >
                        <div className="w-6 h-6 shrink-0">
                          {!sameAsNext &&
                            (isHelp ? (
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white bg-gradient-to-br from-[#38B0FF] to-[#0B57DD]">
                                <LifeBuoy className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <ProfileSilhouetteAvatar name={activePeerName} sizeClass="w-6 h-6" />
                            ))}
                        </div>

                        <div className="relative max-w-[75%]">
                          <div
                            onClick={() => handleMessageTap(m.id, false)}
                            onDoubleClick={() => triggerHeartLike(m.id)}
                            className={`relative px-3.5 py-2 text-[14px] leading-relaxed break-words bg-white/90 dark:bg-[#131E3A] text-[#0B1B4D] dark:text-white border border-[#1846AA]/12 dark:border-white/10 select-none cursor-pointer transition active:scale-[0.99] ${peerRadius}`}
                          >
                            {replyQuote && (
                              <div className="mb-1.5 pl-2 border-l-2 border-[#38B0FF] text-[11px] text-[#5A6A92] dark:text-[#93A3CC] line-clamp-2">
                                {replyQuote}
                              </div>
                            )}
                            <p className="whitespace-pre-wrap">{cleanBody}</p>
                            {!sameAsNext && (
                              <span className="block text-[9px] font-mono mt-1 text-[#5A6A92] dark:text-[#93A3CC]">
                                {formatMsgTime(m.created_at)}
                              </span>
                            )}

                            {isBursting && (
                              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <Heart className="w-8 h-8 text-[#FF3040] fill-[#FF3040] animate-ping" />
                              </span>
                            )}
                          </div>

                          {isLiked && (
                            <button
                              type="button"
                              onClick={() => triggerHeartLike(m.id)}
                              aria-label="Remove heart"
                              className="absolute -bottom-2.5 left-2 px-1.5 py-0.5 rounded-full bg-[#10182B] border border-white/15 text-[10px] leading-none shadow-md cursor-pointer"
                            >
                              ❤️
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo({
                              sender: activePeerName,
                              snippet: cleanBody.slice(0, 60),
                            });
                            inputRef.current?.focus();
                          }}
                          aria-label="Reply to message"
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[#5A6A92] dark:text-[#93A3CC] opacity-60 hover:opacity-100 hover:bg-white/10 transition cursor-pointer shrink-0"
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </React.Fragment>
                  );
                }

                return (
                  <React.Fragment key={m.id}>
                    {dividerEl}
                    <div
                      className={`group flex flex-col items-end ${
                        sameAsPrev ? "mt-0.5" : "mt-2.5"
                      } ${isLiked ? "mb-2" : ""}`}
                    >
                      <div className="flex items-center justify-end gap-1.5 max-w-full">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo({
                              sender: "You",
                              snippet: cleanBody.slice(0, 60),
                            });
                            inputRef.current?.focus();
                          }}
                          aria-label="Reply to your message"
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[#5A6A92] dark:text-[#93A3CC] opacity-50 hover:opacity-100 hover:bg-white/10 transition cursor-pointer shrink-0"
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>

                        <div className="relative max-w-[76%]">
                          <div
                            onClick={() => handleMessageTap(m.id, true)}
                            onDoubleClick={() => triggerHeartLike(m.id)}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isSelected}
                            className={`relative px-3.5 py-2 text-[14px] leading-relaxed break-words text-left bg-gradient-to-b from-[#256EF6] to-[#1457E0] text-white shadow-sm cursor-pointer select-none transition active:scale-[0.99] ${mineRadius} ${
                              isSelected ? "ring-2 ring-[#5AA2FF]" : ""
                            }`}
                          >
                            {replyQuote && (
                              <div className="mb-1.5 pl-2 border-l-2 border-white/60 text-[11px] text-white/80 line-clamp-2">
                                {replyQuote}
                              </div>
                            )}
                            <p className="whitespace-pre-wrap">{cleanBody}</p>
                            {!sameAsNext && (
                              <span className="block text-[9px] font-mono mt-1 text-white/75 text-right">
                                {formatMsgTime(m.created_at)}
                              </span>
                            )}

                            {isBursting && (
                              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <Heart className="w-8 h-8 text-white fill-white animate-ping" />
                              </span>
                            )}
                          </div>

                          {isLiked && (
                            <button
                              type="button"
                              onClick={() => triggerHeartLike(m.id)}
                              aria-label="Remove heart"
                              className="absolute -bottom-2.5 right-2 px-1.5 py-0.5 rounded-full bg-[#10182B] border border-white/15 text-[10px] leading-none shadow-md cursor-pointer"
                            >
                              ❤️
                            </button>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-1.5 pr-1 mt-1.5">
                          <button
                            type="button"
                            disabled={isUnsending}
                            onClick={() => handleUnsendMessage(m.id)}
                            className="px-3 py-1 rounded-full bg-[#D92D3A] text-white text-xs font-bold shadow-sm hover:brightness-105 active:scale-[0.98] transition cursor-pointer disabled:opacity-60"
                          >
                            {isUnsending ? "Unsending…" : "Unsend"}
                          </button>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {sendError && (
            <p className="text-xs font-semibold text-[#D92D3A] dark:text-[#FF6B76] mt-2 px-1">
              {sendError}
            </p>
          )}

          {replyingTo && (
            <div className="mt-2 px-3 py-2 rounded-2xl bg-[#1457E0]/10 dark:bg-[#131E3A] border-l-4 border-[#1457E0] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="block text-[10px] font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
                  Replying to {replyingTo.sender}
                </span>
                <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] truncate">
                  {replyingTo.snippet}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                aria-label="Cancel reply"
                className="w-6 h-6 rounded-full flex items-center justify-center text-[#5A6A92] dark:text-[#93A3CC] hover:bg-white/10 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="pt-2.5 mt-2 flex items-center gap-2">
            <div className="flex-1 h-11 pl-4 pr-1.5 rounded-full bg-white/90 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 flex items-center gap-2 focus-within:border-[#1457E0]">
              <input
                ref={inputRef}
                type="text"
                maxLength={1000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={isHelp ? "Message Help…" : `Message ${activePeerName}…`}
                className="flex-1 bg-transparent text-[14px] text-[#0B1B4D] dark:text-white placeholder:text-[#5A6A92]/60 focus:outline-none"
              />
              {draft.trim().length > 0 ? (
                <button
                  type="submit"
                  disabled={sending}
                  aria-label="Send message"
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2B7BFF] to-[#1457E0] text-white flex items-center justify-center cursor-pointer disabled:opacity-50 shrink-0 shadow-sm active:scale-95 transition"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDraft("❤️");
                    inputRef.current?.focus();
                  }}
                  aria-label="Quick heart"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#5A6A92] dark:text-[#93A3CC] hover:text-[#FF3040] cursor-pointer shrink-0 transition"
                >
                  <Heart className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="px-1 flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF]">
            Messages
          </h1>
          <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
            Text messages only · Tap Help or search by name
          </p>
        </div>
      </div>

      {needsSetup && (
        <div className="amay-card rounded-2xl p-4 text-xs text-amber-800 dark:text-amber-300 border border-amber-400/40">
          Messaging database setup is pending. Run the updated SQL from the Admin Console once to enable chat.
        </div>
      )}

      <div className="flex items-start gap-3.5 overflow-x-auto pb-1 pt-4 px-1 no-scrollbar">
        <button
          type="button"
          onClick={() => {
            setNoteDraft(myNote);
            setEditingNote(true);
          }}
          className="flex flex-col items-center shrink-0 w-[68px] relative group cursor-pointer"
        >
          <div className="absolute -top-3.5 z-10 max-w-[74px] px-2 py-1 rounded-2xl bg-white dark:bg-[#162240] border border-[#1846AA]/15 dark:border-white/15 shadow-md text-[10px] leading-tight font-semibold text-[#0B1B4D] dark:text-[#EAF0FF] truncate">
            {myNote || "Study note…"}
          </div>
          <div className="w-14 h-14 rounded-full p-[2px] bg-[#1846AA]/20 dark:bg-white/15 relative">
            <ProfileSilhouetteAvatar name={myName} sizeClass="w-full h-full" />
            <span className="w-5 h-5 rounded-full bg-[#1457E0] text-white border-2 border-[#F4F7FC] dark:border-[#080D1B] flex items-center justify-center absolute -bottom-0.5 -right-0.5">
              <Plus className="w-3 h-3 stroke-[3]" />
            </span>
          </div>
          <span className="text-[11px] font-semibold text-[#5A6A92] dark:text-[#93A3CC] mt-1.5 truncate w-full text-center">
            Your note
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActivePeerFallbackName("Help");
            setActivePeerUuid(HELP_CHAT_UUID);
          }}
          className="flex flex-col items-center shrink-0 w-[68px] relative cursor-pointer"
        >
          <div className="absolute -top-3.5 z-10 max-w-[74px] px-2 py-1 rounded-2xl bg-white dark:bg-[#162240] border border-[#1457E0]/25 shadow-md text-[10px] leading-tight font-semibold text-[#1457E0] dark:text-[#5AA2FF] truncate">
            Ask doubts!
          </div>
          <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-[#1457E0] to-[#38B0FF] relative">
            <div className="w-full h-full rounded-full bg-[#0E1833] text-[#38B0FF] flex items-center justify-center">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <span className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#080D1B] absolute bottom-0 right-0" />
          </div>
          <span className="text-[11px] font-bold text-[#0B1B4D] dark:text-white mt-1.5 truncate w-full text-center">
            Help
          </span>
        </button>

        {recentThreads.slice(0, 6).map((t) => (
          <button
            key={t.peerUuid}
            type="button"
            onClick={() => {
              setActivePeerFallbackName(t.peerName);
              setActivePeerUuid(t.peerUuid);
            }}
            className="flex flex-col items-center shrink-0 w-[68px] relative cursor-pointer"
          >
            <div
              className={`w-14 h-14 rounded-full p-[2px] relative ${
                t.unread > 0
                  ? "bg-gradient-to-tr from-[#1457E0] to-[#38B0FF]"
                  : "bg-[#1846AA]/20 dark:bg-white/15"
              }`}
            >
              <ProfileSilhouetteAvatar name={t.peerName} sizeClass="w-full h-full" />
              <span className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#080D1B] absolute bottom-0 right-0" />
            </div>
            <span className="text-[11px] font-semibold text-[#0B1B4D] dark:text-[#EAF0FF] mt-1.5 truncate w-full text-center">
              {t.peerName}
            </span>
          </button>
        ))}
      </div>

      {editingNote && (
        <form
          onSubmit={handleSaveStudyNote}
          className="amay-card rounded-2xl p-3.5 border border-[#1457E0]/30 space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#0B1B4D] dark:text-white">
              Set your study note (visible to you)
            </span>
            <button
              type="button"
              onClick={() => setEditingNote(false)}
              className="text-xs text-[#5A6A92] dark:text-[#93A3CC] cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              maxLength={42}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="e.g. Revising History Ch 1 🇮🇳"
              className="flex-1 h-10 px-3.5 rounded-xl bg-white/90 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-xs text-[#0B1B4D] dark:text-white focus:outline-none focus:border-[#1457E0]"
            />
            <button
              type="submit"
              className="h-10 px-4 rounded-xl bg-[#1457E0] text-white text-xs font-bold cursor-pointer"
            >
              Share
            </button>
          </div>
        </form>
      )}

      <button
        type="button"
        onClick={() => {
          setActivePeerFallbackName("Help");
          setActivePeerUuid(HELP_CHAT_UUID);
        }}
        className="w-full amay-card rounded-[26px] p-4 flex items-center gap-3.5 text-left hover:brightness-[0.99] active:scale-[0.99] transition cursor-pointer border-2 border-[#1457E0]/20 dark:border-[#5AA2FF]/25"
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#38B0FF] to-[#0B57DD] text-white flex items-center justify-center shrink-0 shadow-[0_10px_20px_-10px_rgba(11,87,221,0.85)]">
          <LifeBuoy className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <strong className="text-base font-extrabold text-[#0B1B4D] dark:text-white">
                Help
              </strong>
              <span className="px-1.5 py-0.5 rounded-md bg-[#1457E0]/15 dark:bg-[#38B0FF]/15 text-[#1457E0] dark:text-[#5AA2FF] text-[10px] font-extrabold">
                Official
              </span>
            </div>
            {helpThread?.lastMessage && (
              <span className="text-[11px] font-mono text-[#5A6A92] dark:text-[#93A3CC]">
                {formatMsgTime(helpThread.lastMessage.created_at)}
              </span>
            )}
          </div>
          <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] truncate mt-0.5">
            {helpThread?.lastMessage
              ? parseReplyFormat(helpThread.lastMessage.body).cleanBody
              : "Tap to message Help for doubts or support"}
          </p>
        </div>
        {(helpThread?.unread ?? 0) > 0 && (
          <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#E5091E] text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
            {helpThread!.unread}
          </span>
        )}
      </button>

      <div className="relative">
        <Search className="w-4 h-4 text-[#5A6A92] absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a name to start a chat…"
          className="w-full h-11 pl-10 pr-4 rounded-full amay-card text-sm text-[#0B1B4D] dark:text-white placeholder:text-[#5A6A92]/70 focus:outline-none"
        />
      </div>

      {search.trim().length > 0 && (
        <div className="amay-card rounded-[28px] p-4 space-y-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#5A6A92] dark:text-[#93A3CC] px-1">
            Search Results
          </h2>
          {searchMatches.length === 0 ? (
            <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] py-3 text-center">
              No matching name found.
            </p>
          ) : (
            <div className="divide-y divide-[#1846AA]/10 dark:divide-white/10 max-h-[260px] overflow-y-auto">
              {searchMatches.map((u) => {
                const rank = rankMap.get(u.guest_uuid);
                return (
                  <button
                    key={u.guest_uuid}
                    type="button"
                    onClick={() => {
                      setActivePeerFallbackName(u.display_name);
                      setActivePeerUuid(u.guest_uuid);
                    }}
                    className="w-full py-2.5 px-1 flex items-center justify-between gap-3 text-left cursor-pointer hover:opacity-90"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ProfileSilhouetteAvatar
                        name={u.display_name}
                        sizeClass="w-9 h-9 ring-1 ring-white/10"
                      />
                      <div className="flex items-center gap-1.5 min-w-0">
                        <strong className="text-sm font-bold text-[#0B1B4D] dark:text-white truncate">
                          {u.display_name}
                        </strong>
                        {rank && (
                          <span className="px-1.5 py-0.5 rounded-md bg-[#1457E0]/10 dark:bg-white/10 text-[#1457E0] dark:text-[#93A3CC] text-[10px] font-mono font-bold shrink-0">
                            #{rank}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-full bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 text-[#1457E0] dark:text-[#5AA2FF] text-xs font-bold inline-flex items-center gap-1 shrink-0">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Message</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="amay-card rounded-[28px] p-4 space-y-2">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#5A6A92] dark:text-[#93A3CC] px-1">
          Your Chats
        </h2>
        {recentThreads.length === 0 ? (
          <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] py-6 text-center">
            No chats yet. Tap Help above or search a name to start messaging.
          </p>
        ) : (
          <div className="divide-y divide-[#1846AA]/10 dark:divide-white/10">
            {recentThreads.map((t) => {
              const rank = rankMap.get(t.peerUuid);
              const previewText = t.lastMessage
                ? parseReplyFormat(t.lastMessage.body).cleanBody
                : "";
              const isMineLast = t.lastMessage?.sender_uuid === guestId;

              return (
                <button
                  key={t.peerUuid}
                  type="button"
                  onClick={() => {
                    setActivePeerFallbackName(t.peerName);
                    setActivePeerUuid(t.peerUuid);
                  }}
                  className="w-full py-3 px-1 flex items-center gap-3 text-left cursor-pointer hover:opacity-90"
                >
                  <div
                    className={`w-11 h-11 rounded-full p-[2px] shrink-0 ${
                      t.unread > 0
                        ? "bg-gradient-to-tr from-[#1457E0] to-[#38B0FF]"
                        : "bg-transparent"
                    }`}
                  >
                    <ProfileSilhouetteAvatar name={t.peerName} sizeClass="w-full h-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <strong
                          className={`text-sm truncate ${
                            t.unread > 0
                              ? "font-extrabold text-[#0B1B4D] dark:text-white"
                              : "font-bold text-[#0B1B4D] dark:text-white"
                          }`}
                        >
                          {t.peerName}
                        </strong>
                        {rank && (
                          <span className="px-1.5 py-0.5 rounded-md bg-[#1457E0]/10 dark:bg-white/10 text-[#1457E0] dark:text-[#93A3CC] text-[10px] font-mono font-bold shrink-0">
                            #{rank}
                          </span>
                        )}
                      </div>
                      {t.lastMessage && (
                        <span className="text-[11px] font-mono text-[#5A6A92] dark:text-[#93A3CC] shrink-0">
                          {formatMsgTime(t.lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-xs truncate mt-0.5 ${
                        t.unread > 0
                          ? "font-bold text-[#0B1B4D] dark:text-white"
                          : "text-[#5A6A92] dark:text-[#93A3CC]"
                      }`}
                    >
                      {isMineLast ? `You: ${previewText}` : previewText}
                    </p>
                  </div>
                  {t.unread > 0 && (
                    <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#1457E0] text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                      {t.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
