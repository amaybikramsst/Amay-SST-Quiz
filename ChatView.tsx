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

  // Instagram-style Study Notes, Double-Tap Likes & Reply State
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

  // Mark active thread as read (resilient to minor client/server clock skew)
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

  // Capture unseen messages count when a chat is opened, then mark that ID as read
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
          :
