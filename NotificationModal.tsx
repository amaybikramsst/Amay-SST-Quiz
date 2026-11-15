import React from "react";
import { Bell, ExternalLink, Sparkles, User, Users, X } from "lucide-react";
import type { AppNotification } from "../lib/supabase";

interface ActionProps {
  notif: AppNotification;
  latestVideoUrl: string;
  onPlayNow: () => void;
  onOpenRanks: () => void;
  onClose: () => void;
}

const NotificationActionButton: React.FC<ActionProps> = ({
  notif,
  latestVideoUrl,
  onPlayNow,
  onOpenRanks,
  onClose,
}) => {
  const type = notif.actionType || "none";
  if (type === "none") return null;

  const label =
    notif.actionLabel?.trim() ||
    (type === "play"
      ? "Play Now"
      : type === "ranks"
        ? "See Ranks"
        : type === "video"
          ? "Watch Latest Video"
          : "Open Link");

  if (type === "play") {
    return (
      <button
        type="button"
        onClick={() => {
          onClose();
          onPlayNow();
        }}
        className="w-full h-11 rounded-[16px] amay-play-btn text-white font-bold text-sm cursor-pointer"
      >
        {label}
      </button>
    );
  }

  if (type === "ranks") {
    return (
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenRanks();
        }}
        className="w-full h-11 rounded-[16px] amay-play-btn text-white font-bold text-sm cursor-pointer"
      >
        {label}
      </button>
    );
  }

  const href = type === "video" ? latestVideoUrl : notif.actionUrl || "#";
  if (!href || href === "#") return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClose}
      className="w-full h-11 rounded-[16px] amay-play-btn text-white font-bold text-sm inline-flex items-center justify-center gap-1.5"
    >
      <span>{label}</span>
      <ExternalLink className="w-4 h-4" />
    </a>
  );
};

interface PopupProps {
  notification: AppNotification;
  latestVideoUrl: string;
  onPlayNow: () => void;
  onOpenRanks: () => void;
  onDismiss: () => void;
}

export const NotificationPopupModal: React.FC<PopupProps> = ({
  notification,
  latestVideoUrl,
  onPlayNow,
  onOpenRanks,
  onDismiss,
}) => {
  const isPersonal = notification.target === "candidate";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-sm amay-card rounded-[30px] p-6 space-y-4 text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close notification"
          className="absolute top-4 right-4 w-8 h-8 rounded-full amay-card flex items-center justify-center text-[#5A6A92] dark:text-[#93A3CC] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-2 pt-1">
          <div className="relative">
            <img
              src="./amay-avatar.jpg"
              alt="Amay Sir"
              className="w-16 h-16 rounded-full object-cover border-[3px] border-[#1457E0] shadow-md"
            />
            <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#1457E0] text-white flex items-center justify-center shadow">
              {isPersonal ? <Sparkles className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
              isPersonal
                ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                : "bg-[#1457E0]/12 text-[#1457E0] dark:text-[#5AA2FF]"
            }`}
          >
            {isPersonal ? <User className="w-3 h-3" /> : <Users className="w-3 h-3" />}
            <span>{isPersonal ? "Personal Message for You" : "Announcement from Amay"}</span>
          </span>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-extrabold text-[#0B1B4D] dark:text-white leading-snug">
            {notification.title}
          </h2>
          <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC] whitespace-pre-line leading-relaxed">
            {notification.message}
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <NotificationActionButton
            notif={notification}
            latestVideoUrl={latestVideoUrl}
            onPlayNow={onPlayNow}
            onOpenRanks={onOpenRanks}
            onClose={onDismiss}
          />
          <button
            type="button"
            onClick={onDismiss}
            className="w-full h-10 rounded-[16px] amay-card text-sm font-bold text-[#5A6A92] dark:text-[#93A3CC] cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

interface InboxProps {
  notifications: AppNotification[];
  latestVideoUrl: string;
  onPlayNow: () => void;
  onOpenRanks: () => void;
  onClose: () => void;
}

export const NotificationInboxModal: React.FC<InboxProps> = ({
  notifications,
  latestVideoUrl,
  onPlayNow,
  onOpenRanks,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85vh] flex flex-col amay-card rounded-[30px] p-5 sm:p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-[#1457E0]/12 text-[#1457E0] dark:text-[#5AA2FF] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white leading-tight">
                Notifications
              </h2>
              <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
                Updates & personal messages
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="w-9 h-9 rounded-xl amay-card flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto space-y-3 pr-0.5">
          {notifications.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Bell className="w-8 h-8 mx-auto text-[#5A6A92]/50" />
              <p className="text-sm font-semibold text-[#5A6A92] dark:text-[#93A3CC]">
                No notifications yet.
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const isPersonal = n.target === "candidate";
              return (
                <div
                  key={n.id}
                  className={`rounded-[22px] p-4 space-y-2.5 border ${
                    isPersonal
                      ? "bg-amber-500/8 border-amber-500/25"
                      : "bg-[#1457E0]/[0.05] dark:bg-white/[0.04] border-[#1846AA]/12 dark:border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-extrabold ${
                        isPersonal
                          ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                          : "bg-[#1457E0]/12 text-[#1457E0] dark:text-[#5AA2FF]"
                      }`}
                    >
                      {isPersonal ? <User className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                      <span>{isPersonal ? "Personal" : "Everyone"}</span>
                    </span>
                    <span className="text-[#5A6A92] dark:text-[#93A3CC] font-mono-nums">
                      {new Date(n.createdAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div>
                    <strong className="block text-[15px] font-extrabold text-[#0B1B4D] dark:text-white">
                      {n.title}
                    </strong>
                    <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC] mt-1 whitespace-pre-line">
                      {n.message}
                    </p>
                  </div>

                  <NotificationActionButton
                    notif={n}
                    latestVideoUrl={latestVideoUrl}
                    onPlayNow={onPlayNow}
                    onOpenRanks={onOpenRanks}
                    onClose={onClose}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
