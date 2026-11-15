import React from "react";
import { Bell, ExternalLink, X } from "lucide-react";
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
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-sm max-h-[88vh] overflow-y-auto amay-card rounded-[30px] p-6 space-y-4 text-center relative"
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
              <Bell className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-extrabold text-[#0B1B4D] dark:text-white leading-snug">
            {notification.title}
          </h2>
          <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC] whitespace-pre-line leading-relaxed">
            {notification.message}
          </p>
        </div>

        {notification.imageUrl && (
          <div className="overflow-hidden rounded-2xl border border-[#1846AA]/12 dark:border-white/10 bg-black/5">
            <img
              src={notification.imageUrl}
              alt={notification.title}
              referrerPolicy="no-referrer"
              className="w-full max-h-56 object-cover block"
            />
          </div>
        )}

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
            <h2 className="text-lg font-extrabold text-[#0B1B4D] dark:text-white leading-tight">
              Notifications
            </h2>
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
            notifications.map((n) => (
              <div
                key={n.id}
                className="rounded-[22px] p-4 space-y-2.5 border bg-[#1457E0]/[0.05] dark:bg-white/[0.04] border-[#1846AA]/12 dark:border-white/10"
              >
                <div>
                  <strong className="block text-[15px] font-extrabold text-[#0B1B4D] dark:text-white">
                    {n.title}
                  </strong>
                  <p className="text-sm text-[#5A6A92] dark:text-[#93A3CC] mt-1 whitespace-pre-line">
                    {n.message}
                  </p>
                </div>

                {n.imageUrl && (
                  <div className="overflow-hidden rounded-xl border border-[#1846AA]/12 dark:border-white/10 bg-black/5">
                    <img
                      src={n.imageUrl}
                      alt={n.title}
                      referrerPolicy="no-referrer"
                      className="w-full max-h-52 object-cover block"
                    />
                  </div>
                )}

                <NotificationActionButton
                  notif={n}
                  latestVideoUrl={latestVideoUrl}
                  onPlayNow={onPlayNow}
                  onOpenRanks={onOpenRanks}
                  onClose={onClose}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
