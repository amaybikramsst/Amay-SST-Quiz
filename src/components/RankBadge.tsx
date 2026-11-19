import React, { useId } from "react";

interface RankBadgeProps {
  rank: 1 | 2 | 3;
  size?: "sm" | "md" | "lg";
}

const PALETTES = {
  1: {
    ribbonTop: "#FF3B4E",
    ribbonMid: "#E5091E",
    ribbonBot: "#A80012",
    foldColor: "#8A000E",
    starColor: "#9B0010",
    crownLight: "#FFE787",
    crownMid: "#F5B82E",
    crownDark: "#B87503",
    shadow: "drop-shadow(0 8px 14px rgba(229,9,30,0.34))",
  },
  2: {
    ribbonTop: "#249DF0",
    ribbonMid: "#0B76C2",
    ribbonBot: "#044D85",
    foldColor: "#033B68",
    starColor: "#044273",
    crownLight: "#FFE787",
    crownMid: "#F2B632",
    crownDark: "#B37406",
    shadow: "drop-shadow(0 8px 14px rgba(11,118,194,0.3))",
  },
  3: {
    ribbonTop: "#FF822E",
    ribbonMid: "#EA580C",
    ribbonBot: "#B43800",
    foldColor: "#8C2B00",
    starColor: "#9A3000",
    crownLight: "#FFE787",
    crownMid: "#F2B632",
    crownDark: "#B37406",
    shadow: "drop-shadow(0 8px 14px rgba(234,88,12,0.3))",
  },
} as const;

export const RankBadge: React.FC<RankBadgeProps> = ({ rank, size = "md" }) => {
  const uid = useId().replace(/:/g, "");
  const p = PALETTES[rank];

  const dims =
    size === "lg"
      ? "w-[88px] h-[103px]"
      : size === "md"
        ? "w-[66px] h-[77px]"
        : "w-[54px] h-[63px]";

  const ribbonGradId = `ribbon-${uid}-${rank}`;
  const crownGradId = `crown-${uid}-${rank}`;

  return (
    <svg
      viewBox="0 0 120 140"
      className={`${dims} shrink-0 select-none`}
      style={{ filter: p.shadow }}
      aria-label={`Rank ${rank}`}
    >
      <defs>
        <linearGradient id={ribbonGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.ribbonTop} />
          <stop offset="55%" stopColor={p.ribbonMid} />
          <stop offset="100%" stopColor={p.ribbonBot} />
        </linearGradient>
        <linearGradient id={crownGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.crownLight} />
          <stop offset="60%" stopColor={p.crownMid} />
          <stop offset="100%" stopColor={p.crownDark} />
        </linearGradient>
      </defs>

      {/* Crown */}
      <g>
        <path
          d="M32 36 L26 17 L44 27 L60 11 L76 27 L94 17 L88 36 Z"
          fill={`url(#${crownGradId})`}
          stroke={p.crownDark}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <rect x="31" y="36" width="58" height="5" rx="2.5" fill={`url(#${crownGradId})`} />
        <circle cx="26" cy="15.5" r="3" fill={p.crownMid} />
        <circle cx="60" cy="9.5" r="3.5" fill={p.crownLight} />
        <circle cx="94" cy="15.5" r="3" fill={p.crownMid} />
      </g>

      {/* Top Ribbon Folded Ears */}
      <path d="M16 49 C16 44 21 43 26 43 L26 56 L19 56 C16.8 56 16 53 16 49 Z" fill={p.foldColor} />
      <path d="M104 49 C104 44 99 43 94 43 L94 56 L101 56 C103.2 56 104 53 104 49 Z" fill={p.foldColor} />

      {/* Main Shield Ribbon Banner */}
      <path
        d="M22 43 H98 C100.5 43 101.5 45 101.5 48 V110 L60 133 L18.5 110 V48 C18.5 45 19.5 43 22 43 Z"
        fill={`url(#${ribbonGradId})`}
      />

      {/* Subtle top highlight curl */}
      <path
        d="M19 46.5 C19 44 21 43 24 43 H96 C99 43 101 44 101 46.5 V50 H19 Z"
        fill="rgba(255,255,255,0.18)"
      />

      {/* Side Stars */}
      <polygon
        points="31,84 32.8,88 37,88.4 33.8,91.2 34.8,95.4 31,93.1 27.2,95.4 28.2,91.2 25,88.4 29.2,88"
        fill={p.starColor}
        opacity="0.7"
      />
      <polygon
        points="89,84 90.8,88 95,88.4 91.8,91.2 92.8,95.4 89,93.1 85.2,95.4 86.2,91.2 83,88.4 87.2,88"
        fill={p.starColor}
        opacity="0.7"
      />

      {/* RANK Label */}
      <text
        x="60"
        y="65"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="14.5"
        fontWeight="800"
        letterSpacing="1.8"
        fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
      >
        RANK
      </text>

      {/* Big Number 1 / 2 / 3 */}
      <text
        x="60"
        y="112"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="50"
        fontWeight="800"
        fontFamily="Georgia, Cambria, Times New Roman, serif"
      >
        {rank}
      </text>
    </svg>
  );
};
