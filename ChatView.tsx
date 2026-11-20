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
              <span className
