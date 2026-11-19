import React from "react";
import { type MapItem } from "../../data/class10/mapData";

interface IndiaMapSvgProps {
  items: MapItem[];
  selectedItem: MapItem | null;
  targetItem: MapItem | null;
  highlightedCorrectId: string | null;
  wrongTappedId: string | null;
  onPinClick: (item: MapItem) => void;
  scale: number;
  translateX: number;
  translateY: number;
}

export const IndiaMapSvg: React.FC<IndiaMapSvgProps> = ({
  items,
  selectedItem,
  targetItem,
  highlightedCorrectId,
  wrongTappedId,
  onPinClick,
  scale,
  translateX,
  translateY,
}) => {
  return (
    <svg
      viewBox="0 0 600 760"
      className="w-full h-full select-none"
      style={{
        transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
        transformOrigin: "center center",
        transition: "transform 0.15s ease-out",
      }}
    >
      <defs>
        {/* Soft Indian Ocean Background Gradient */}
        <linearGradient id="mapBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1B4D9B" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#0B235E" stopOpacity="0.14" />
        </linearGradient>

        {/* Land Gradient for Light Theme */}
        <linearGradient id="landGradLight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#F5F9FF" />
          <stop offset="100%" stopColor="#E9F2FE" />
        </linearGradient>

        {/* Land Gradient for Dark Theme */}
        <linearGradient id="landGradDark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#131E38" />
          <stop offset="50%" stopColor="#0F1A33" />
          <stop offset="100%" stopColor="#0A1226" />
        </linearGradient>

        {/* Glow Filters */}
        <filter id="correctGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="wrongGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="pinShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Water Body Labels & Coordinates Grid */}
      <g className="text-[11px] font-semibold fill-[#7B8FB5]/60 dark:fill-[#506385]/60 tracking-wider">
        <text x="35" y="520" textAnchor="middle" transform="rotate(-30 35 520)">
          ARABIAN SEA
        </text>
        <text x="525" y="540" textAnchor="middle" transform="rotate(25 525 540)">
          BAY OF BENGAL
        </text>
        <text x="310" y="748" textAnchor="middle">
          INDIAN OCEAN
        </text>
      </g>

      {/* Tropic of Cancer Line */}
      <line
        x1="50"
        y1="385"
        x2="550"
        y2="385"
        stroke="currentColor"
        strokeDasharray="4 4"
        className="text-[#1457E0]/25 dark:text-[#5AA2FF]/20"
        strokeWidth="1.2"
      />
      <text
        x="60"
        y="380"
        className="text-[9px] font-bold fill-[#1457E0]/50 dark:fill-[#5AA2FF]/50 tracking-wider"
      >
        23.5° N · TROPIC OF CANCER
      </text>

      {/* Main India Landmass Polygon / High Precision Vector Contour */}
      {/* Handcrafted vector path conforming to India's official geographical shape */}
      <path
        d="M 215,90
           C 225,82 245,82 260,95
           C 275,108 285,120 290,140
           C 295,155 315,175 320,195
           C 325,210 310,230 300,240
           C 320,245 350,245 385,255
           C 405,260 435,270 455,275
           C 475,280 495,270 515,265
           C 535,260 560,270 565,285
           C 570,305 545,320 535,325
           C 520,330 500,315 480,318
           C 460,320 450,335 440,350
           C 445,365 470,360 485,365
           C 500,370 510,385 495,405
           C 485,420 475,440 455,445
           C 445,448 430,470 415,505
           C 400,535 375,580 360,615
           C 350,640 330,680 310,720
           C 300,740 290,740 280,725
           C 265,700 245,660 235,630
           C 225,600 215,570 205,535
           C 195,505 180,475 168,455
           C 160,445 150,430 135,420
           C 120,410 95,410 90,395
           C 85,380 95,365 115,360
           C 135,355 155,340 160,320
           C 165,300 170,270 175,240
           C 180,210 175,185 185,160
           C 195,135 205,100 215,90 Z"
        className="fill-[url(#landGradLight)] dark:fill-[url(#landGradDark)] stroke-[#1457E0]/35 dark:stroke-[#5AA2FF]/35"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* Gujarat Kathiawar Peninsula Accent Detail */}
      <path
        d="M 90,395
           C 95,415 110,435 130,435
           C 145,435 155,425 155,410
           C 155,395 140,385 125,385
           C 105,385 95,388 90,395 Z"
        className="fill-[url(#landGradLight)] dark:fill-[url(#landGradDark)] stroke-[#1457E0]/30 dark:stroke-[#5AA2FF]/30"
        strokeWidth="1.5"
      />

      {/* Regional / State Internal Stylized Boundary Guides */}
      <g
        className="stroke-[#1457E0]/15 dark:stroke-white/10"
        strokeWidth="1"
        strokeDasharray="2 3"
        fill="none"
      >
        {/* Punjab / J&K Border Guide */}
        <path d="M 185,175 Q 225,180 270,195" />
        {/* Rajasthan / Gujarat Border Guide */}
        <path d="M 140,345 Q 195,340 240,360" />
        {/* UP / MP / Bihar Border Guide */}
        <path d="M 270,300 Q 345,330 430,340" />
        {/* Maharashtra / Deccan Plateau Guide */}
        <path d="M 175,465 Q 250,460 360,465" />
        {/* Telangana / Andhra / Karnataka Guide */}
        <path d="M 205,560 Q 280,560 380,555" />
        {/* Tamil Nadu / Kerala Divide */}
        <path d="M 255,650 Q 275,690 288,730" />
        {/* Odisha Coast Guide */}
        <path d="M 370,440 Q 430,430 460,445" />
      </g>

      {/* Major River Vector Cues (Crucial for learning Dam locations!) */}
      <g
        className="stroke-[#38B0FF]/45 dark:stroke-[#38B0FF]/40"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      >
        {/* Satluj (Bhakra Nangal) */}
        <path d="M 260,190 Q 240,205 210,210" />
        {/* Bhagirathi / Ganga (Tehri) */}
        <path d="M 280,215 Q 315,255 380,295 T 470,390" />
        {/* Narmada (Sardar Sarovar) */}
        <path d="M 290,425 Q 240,422 178,422" />
        {/* Mahanadi (Hirakud) */}
        <path d="M 360,428 Q 415,425 460,445" />
        {/* Krishna & Tungabhadra (Nagarjuna Sagar & Tungabhadra) */}
        <path d="M 230,555 Q 280,565 330,545 T 395,570" />
        <path d="M 240,600 Q 255,585 280,568" />
        {/* Chambal (Rana Pratap Sagar) */}
        <path d="M 220,380 Q 210,345 245,315" />
      </g>

      {/* Location Hotspots & Interactive Pins */}
      {items.map((item) => {
        const isSelected = selectedItem?.id === item.id;
        const isTarget = targetItem?.id === item.id;
        const isCorrectHighlighted = highlightedCorrectId === item.id;
        const isWrongTapped = wrongTappedId === item.id;

        // Categorical colors
        let pinColor = "#1457E0"; // Default Blue

        if (item.category.startsWith("history")) {
          pinColor = "#E65100"; // Warm Orange / Saffron for History
        } else if (item.category === "geography-dams") {
          pinColor = "#0288D1"; // Ocean Cyan for Dams
        } else if (item.category === "geography-ports") {
          pinColor = "#2E7D32"; // Emerald Teal for Ports
        } else if (item.category === "geography-airports") {
          pinColor = "#6A1B9A"; // Royal Violet for Airports
        }

        if (isCorrectHighlighted) {
          pinColor = "#10B981"; // Vibrant Emerald
        } else if (isWrongTapped) {
          pinColor = "#EF4444"; // Vibrant Crimson
        }

        return (
          <g
            key={item.id}
            transform={`translate(${item.x}, ${item.y})`}
            onClick={() => onPinClick(item)}
            className="cursor-pointer group"
          >
            {/* Invisible Large Touch Target for Fingers (Min 36px diameter) */}
            <circle cx="0" cy="0" r="22" fill="transparent" />

            {/* Glowing Ring when Correct or Highlighted */}
            {(isCorrectHighlighted || (isSelected && isTarget)) && (
              <circle
                cx="0"
                cy="0"
                r="18"
                fill="none"
                stroke="#10B981"
                strokeWidth="2.5"
                className="animate-ping opacity-75"
              />
            )}

            {/* Shake / Ripple Ring when Wrong */}
            {isWrongTapped && (
              <circle
                cx="0"
                cy="0"
                r="16"
                fill="none"
                stroke="#EF4444"
                strokeWidth="2.5"
                className="animate-ping opacity-85"
              />
            )}

            {/* Pin Outer Halo */}
            <circle
              cx="0"
              cy="0"
              r={isSelected || isCorrectHighlighted ? "11" : "8"}
              fill={pinColor}
              fillOpacity={isSelected || isCorrectHighlighted ? "0.3" : "0.18"}
              className="transition-all duration-200 group-hover:scale-125"
            />

            {/* Pin Center Core */}
            <circle
              cx="0"
              cy="0"
              r={isSelected || isCorrectHighlighted ? "6.5" : "5"}
              fill={pinColor}
              stroke="#FFFFFF"
              strokeWidth="2"
              filter="url(#pinShadow)"
              className="transition-all duration-200 group-hover:scale-110"
            />

            {/* Always visible or hover badge label */}
            <g
              transform={`translate(0, ${item.y > 680 ? -14 : 14})`}
              className={`transition-opacity duration-150 pointer-events-none ${
                isSelected || isCorrectHighlighted
                  ? "opacity-100"
                  : "opacity-85 group-hover:opacity-100"
              }`}
            >
              <rect
                x="-40"
                y="-9"
                width="80"
                height="18"
                rx="9"
                fill={
                  isCorrectHighlighted
                    ? "#065F46"
                    : isWrongTapped
                    ? "#991B1B"
                    : isSelected
                    ? "#0B1B4D"
                    : "#0B1B4D"
                }
                fillOpacity="0.88"
                stroke="#FFFFFF"
                strokeWidth="0.8"
              />
              <text
                x="0"
                y="3.5"
                textAnchor="middle"
                className="text-[9.5px] font-bold fill-white tracking-tight"
              >
                {item.name.length > 12 ? item.name.substring(0, 11) + "…" : item.name}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
};
