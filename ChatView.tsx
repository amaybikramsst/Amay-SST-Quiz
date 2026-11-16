import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  LifeBuoy,
  MessageCircle,
  Search,
  Send,
  Trash2,
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
  initialPeer?: { uuid: string; name: string } | null;
  onClearInitialPeer?: () => void;
  onUnreadCountChange?: (count: number) => void;
}

const CHAT_READ_KEY = "amaysst_chat_read_at";

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

function formatMsgTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const ChatView: React.FC<ChatViewProps> = ({
  guestId,
  myName,
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
  const [readMap, setReadMap] = useState<Record<string, string>>(() => loadReadMap());

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialPeer?.uuid) {
      setActivePeerUuid(initialPeer.uuid);
      setActivePeerFallbackName(initialPeer.name);
      setConfirmDeleteThread(false);
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

  // Mark active thread as read
  const markPeerRead = useCallback((peerUuid: string) => {
    const nowIso = new Date().toISOString();
    setReadMap((prev) => {
      const next = { ...prev, [peerUuid]: nowIso };
      saveReadMap(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (activePeerUuid) {
      markPeerRead(activePeerUuid);
    }
  }, [activePeerUuid, messages.length, markPeerRead]);

  // Compute threads & unread counts
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

    let unreadSum = 0;
    for (const item of map.values()) {
      unreadSum += item.unread;
    }
    return { threadsMap: map, totalUnread: unreadSum };
  }, [activePeerUuid, guestId, messages, readMap]);

  useEffect(() => {
    onUnreadCountChange?.(totalUnread);
  }, [onUnreadCountChange, totalUnread]);

  const activePeerName = useMemo(() => {
    if (!activePeerUuid) return "";
    if (activePeerUuid === HELP_CHAT_UUID) return "Help";
    const fromThread = threadsMap.get(activePeerUuid)?.peerName;
    if (fromThread) return fromThread;
    const fromDir = directory.find((u) => u.guest_uuid === activePeerUuid)?.display_name;
    if (fromDir) return fromDir;
    if (activePeerFallbackName) return activePeerFallbackName;
    if (activePeerUuid.startsWith("bot_")) return activePeerUuid.slice(4);
    return "Candidate";
  }, [activePeerFallbackName, activePeerUuid, directory, threadsMap]);

  const activeMessages = useMemo(() => {
    if (!activePeerUuid) return [];
    return messages.filter(
      (m) =>
        (m.sender_uuid === guestId && m.recipient_uuid === activePeerUuid) ||
        (m.sender_uuid === activePeerUuid && m.recipient_uuid === guestId)
    );
  }, [activePeerUuid, guestId, messages]);

  useEffect(() => {
    if (activePeerUuid) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activePeerUuid, activeMessages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePeerUuid || sending) return;
    const text = draft.trim();
    if (!text) return;

    setSendError("");
    setSending(true);
    setDraft("");

    const res = await sendChatMessage(guestId, activePeerUuid, text);
    setSending(false);

    if (!res.ok || !res.message) {
      setDraft(text);
      setSendError(res.error || "Could not send message.");
      return;
    }

    setMessages((prev) =>
      prev.some((item) => item.id === res.message!.id) ? prev : [...prev, res.message!]
    );
    markPeerRead(activePeerUuid);
  };

  const handleDeleteOneMessage = async (msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    await deleteChatMessage(guestId, msgId);
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

  // Show recent threads + ONLY show search results when user actually types a name (no directory listing of who is available!)
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
        ? directory
            .filter((u) => !threadsMap.has(u.guest_uuid))
            .filter((u) => u.display_name.toLowerCase().includes(q))
        : [];

    return { recentThreads: activeList, searchMatches: matches };
  }, [directory, search, threadsMap]);

  const helpThread = threadsMap.get(HELP_CHAT_UUID);

  // CONVERSATION SCREEN (strictly text-only, no photo/file uploads)
  if (activePeerUuid) {
    const isHelp = activePeerUuid === HELP_CHAT_UUID;
    return (
      <div className="space-y-3">
        <div className="amay-card rounded-[26px] p-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                setActivePeerUuid(null);
                setActivePeerFallbackName("");
                setConfirmDeleteThread(false);
                setSendError("");
                onClearInitialPeer?.();
              }}
              aria-label="Back to messages"
              className="w-10 h-10 rounded-xl amay-card flex items-center justify-center text-[#1457E0] dark:text-[#5AA2FF] cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm text-white shrink-0 ${
                isHelp
                  ? "bg-gradient-to-br from-[#38B0FF] to-[#0B57DD]"
                  : "bg-gradient-to-br from-[#2B7BFF] to-[#1457E0]"
              }`}
            >
              {isHelp ? <LifeBuoy className="w-5 h-5" /> : activePeerName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <strong className="block text-base font-extrabold text-[#0B1B4D] dark:text-white truncate">
                {activePeerName}
              </strong>
              <span className="block text-[11px] text-[#5A6A92] dark:text-[#93A3CC]">
                {isHelp ? "Support · Text only" : "Text messages only"}
              </span>
            </div>
          </div>

          {activeMessages.length > 0 && !confirmDeleteThread && (
            <button
              type="button"
              onClick={() => setConfirmDeleteThread(true)}
              className="h-9 px-3 rounded-xl bg-[#D92D3A]/10 text-[#D92D3A] dark:text-[#FF6B76] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete chat</span>
            </button>
          )}
        </div>

        {confirmDeleteThread && (
          <div className="amay-card rounded-2xl p-3.5 border border-[#D92D3A]/25 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#0B1B4D] dark:text-white">
              Clear this chat from your list?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={deletingThread}
                onClick={handleDeleteEntireThread}
                className="px-3 py-1.5 rounded-xl bg-[#D92D3A] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {deletingThread ? "Deleting…" : "Yes, Delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteThread(false)}
                className="px-3 py-1.5 rounded-xl amay-card text-xs font-bold text-[#0B1B4D] dark:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="amay-card rounded-[28px] p-4 flex flex-col min-h-[380px] max-h-[60vh]">
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {activeMessages.length === 0 ? (
              <div className="py-16 text-center space-y-1.5">
                <p className="text-sm font-bold text-[#0B1B4D] dark:text-white">
                  {isHelp ? "Need help with anything?" : `Say hi to ${activePeerName}!`}
                </p>
                <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                  {isHelp
                    ? "Send a text message here and Help will reply in this chat."
                    : `Chatting as ${myName}. Text messages only.`}
                </p>
              </div>
            ) : (
              activeMessages.map((m) => {
                const isMine = m.sender_uuid === guestId;
                return (
                  <div
                    key={m.id}
                    className={`flex items-end gap-1.5 ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    {isMine && (
                      <button
                        type="button"
                        onClick={() => handleDeleteOneMessage(m.id)}
                        aria-label="Delete message"
                        title="Delete message"
                        className="p-1.5 rounded-lg text-[#5A6A92]/70 hover:text-[#D92D3A] cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <div
                      className={`max-w-[78%] rounded-[20px] px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                        isMine
                          ? "bg-gradient-to-br from-[#2B7BFF] to-[#1457E0] text-white rounded-br-md shadow-sm"
                          : "bg-white/85 dark:bg-[#131E3A] text-[#0B1B4D] dark:text-white border border-[#1846AA]/12 dark:border-white/10 rounded-bl-md"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <span
                        className={`block text-[10px] font-mono-nums mt-1 ${
                          isMine ? "text-white/75 text-right" : "text-[#5A6A92] dark:text-[#93A3CC]"
                        }`}
                      >
                        {formatMsgTime(m.created_at)}
                      </span>
                    </div>

                    {!isMine && (
                      <button
                        type="button"
                        onClick={() => handleDeleteOneMessage(m.id)}
                        aria-label="Delete message"
                        title="Delete message"
                        className="p-1.5 rounded-lg text-[#5A6A92]/70 hover:text-[#D92D3A] cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {sendError && (
            <p className="text-xs font-semibold text-[#D92D3A] dark:text-[#FF6B76] mt-2">{sendError}</p>
          )}

          <form onSubmit={handleSend} className="pt-3 mt-2 border-t border-[#1846AA]/10 dark:border-white/10 flex items-center gap-2">
            <input
              type="text"
              maxLength={1000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={isHelp ? "Type a text message to Help…" : `Type a text message to ${activePeerName}…`}
              className="flex-1 h-11 px-4 rounded-2xl bg-white/85 dark:bg-[#0B1224] border border-[#1846AA]/15 dark:border-white/10 text-base text-[#0B1B4D] dark:text-white placeholder:text-[#5A6A92]/60 focus:outline-none focus:border-[#1457E0]"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Send message"
              className="w-11 h-11 rounded-2xl amay-play-btn text-white flex items-center justify-center cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // INBOX SCREEN (no directory listing showing who is available/not!)
  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-[26px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF]">
          Messages
        </h1>
        <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
          Text chats · Tap Help or click any name on Leaderboard to start a chat
        </p>
      </div>

      {needsSetup && (
        <div className="amay-card rounded-2xl p-4 text-xs text-amber-800 dark:text-amber-300 border border-amber-400/40">
          Messaging database setup is pending. Run the updated SQL from the Admin Console once to enable chat.
        </div>
      )}

      {/* Pinned Help Support Card */}
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
            <strong className="text-base font-extrabold text-[#0B1B4D] dark:text-white">
              Help
            </strong>
            {helpThread?.lastMessage && (
              <span className="text-[11px] font-mono-nums text-[#5A6A92] dark:text-[#93A3CC]">
                {formatMsgTime(helpThread.lastMessage.created_at)}
              </span>
            )}
          </div>
          <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] truncate mt-0.5">
            {helpThread?.lastMessage
              ? helpThread.lastMessage.body
              : "Tap to message Help for doubts or support"}
          </p>
        </div>
        {(helpThread?.unread ?? 0) > 0 && (
          <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#E5091E] text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
            {helpThread!.unread}
          </span>
        )}
      </button>

      {/* Search by Name (only shows matching results while typing) */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#5A6A92] absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a name to start a chat…"
          className="w-full h-11 pl-10 pr-4 rounded-2xl amay-card text-sm text-[#0B1B4D] dark:text-white placeholder:text-[#5A6A92]/70 focus:outline-none"
        />
      </div>

      {/* Search Results (shown ONLY when typing a search query) */}
      {search.trim().length > 0 && (
        <div className="amay-card rounded-[28px] p-4 space-y-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#5A6A92] dark:text-[#93A3CC] px-1">
            Search Results
          </h2>
          {searchMatches.length === 0 ? (
            <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] py-3 text-center">
              No matching name found. You can also tap any name directly on Leaderboard.
            </p>
          ) : (
            <div className="divide-y divide-[#1846AA]/10 dark:divide-white/10 max-h-[260px] overflow-y-auto">
              {searchMatches.map((u) => (
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
                    <div className="w-9 h-9 rounded-full bg-[#1457E0]/12 text-[#1457E0] dark:text-[#5AA2FF] font-extrabold text-xs flex items-center justify-center shrink-0">
                      {u.display_name.charAt(0).toUpperCase()}
                    </div>
                    <strong className="text-sm font-bold text-[#0B1B4D] dark:text-white truncate">
                      {u.display_name}
                    </strong>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 text-[#1457E0] dark:text-[#5AA2FF] text-xs font-bold inline-flex items-center gap-1 shrink-0">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Message</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Conversations */}
      <div className="amay-card rounded-[28px] p-4 space-y-2">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#5A6A92] dark:text-[#93A3CC] px-1">
          Your Chats
        </h2>
        {recentThreads.length === 0 ? (
          <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] py-6 text-center">
            No chats yet. Tap Help above or tap any player&apos;s name on Ranks to start messaging.
          </p>
        ) : (
          <div className="divide-y divide-[#1846AA]/10 dark:divide-white/10">
            {recentThreads.map((t) => (
              <button
                key={t.peerUuid}
                type="button"
                onClick={() => {
                  setActivePeerFallbackName(t.peerName);
                  setActivePeerUuid(t.peerUuid);
                }}
                className="w-full py-3 px-1 flex items-center gap-3 text-left cursor-pointer hover:opacity-90"
              >
                <div className="w-10 h-10 rounded-full bg-[#1457E0]/15 text-[#1457E0] dark:text-[#5AA2FF] font-extrabold text-sm flex items-center justify-center shrink-0">
                  {t.peerName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm font-bold text-[#0B1B4D] dark:text-white truncate">
                      {t.peerName}
                    </strong>
                    {t.lastMessage && (
                      <span className="text-[11px] font-mono-nums text-[#5A6A92] dark:text-[#93A3CC]">
                        {formatMsgTime(t.lastMessage.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC] truncate">
                    {t.lastMessage?.body || ""}
                  </p>
                </div>
                {t.unread > 0 && (
                  <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#E5091E] text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                    {t.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
