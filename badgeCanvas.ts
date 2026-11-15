import { getHighestOverallMilestone, type OverallBadgeMilestone } from "./quizEngine";

export type BadgeDesignSpec =
  | { kind: "overall"; milestone: OverallBadgeMilestone }
  | { kind: "daily"; rank: 1 | 2 | 3; dateLabel?: string; xpToday?: number };

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  gap: number
): number {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, chars.length - 1);
  let pos = x - total / 2;
  ctx.textAlign = "left";
  chars.forEach((ch, idx) => {
    ctx.fillText(ch, pos, y);
    pos += widths[idx] + gap;
  });
  ctx.textAlign = "center";
  return total;
}

function fitTextFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  startSize: number,
  minSize: number,
  maxWidth: number
): number {
  let size = startSize;
  ctx.font = `${weight} ${size}px "Plus Jakarta Sans", system-ui, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 2;
    ctx.font = `${weight} ${size}px "Plus Jakarta Sans", system-ui, sans-serif`;
  }
  return size;
}

interface BadgePalette {
  bgTop: string;
  bgMid: string;
  bgBot: string;
  bloomPrimary: string;
  bloomSecondary: string;
  accentLight: string;
  accentMid: string;
  accentDeep: string;
  ribbonTop: string;
  ribbonBot: string;
  kicker: string;
  tierTitle: string;
  centerMain: string;
  centerSub: string;
  detailLine: string;
}

function resolveBadgePalette(
  xp: number,
  spec?: BadgeDesignSpec
): BadgePalette {
  const defaultDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (spec?.kind === "daily") {
    const datePart = spec.dateLabel || defaultDate;
    const scorePart =
      typeof spec.xpToday === "number" && spec.xpToday > 0
        ? `${spec.xpToday.toLocaleString("en-US")} XP · ${datePart}`
        : datePart;

    if (spec.rank === 1) {
      return {
        bgTop: "#090B14",
        bgMid: "#141A2E",
        bgBot: "#060810",
        bloomPrimary: "rgba(245, 184, 46, 0.28)",
        bloomSecondary: "rgba(37, 99, 235, 0.18)",
        accentLight: "#FFF2C8",
        accentMid: "#F5B82E",
        accentDeep: "#9E6C14",
        ribbonTop: "#1E56C5",
        ribbonBot: "#0B245E",
        kicker: "TODAY RANK · 11 PM CUTOFF",
        tierTitle: "DAILY 1ST PLACE",
        centerMain: "#1",
        centerSub: "TODAY",
        detailLine: `Top Ranked Today · ${scorePart}`,
      };
    }

    if (spec.rank === 2) {
      return {
        bgTop: "#060B18",
        bgMid: "#0E1A33",
        bgBot: "#050914",
        bloomPrimary: "rgba(203, 213, 225, 0.25)",
        bloomSecondary: "rgba(59, 130, 246, 0.22)",
        accentLight: "#F8FAFC",
        accentMid: "#CBD5E1",
        accentDeep: "#64748B",
        ribbonTop: "#2563EB",
        ribbonBot: "#0F2B6B",
        kicker: "TODAY RANK · 11 PM CUTOFF",
        tierTitle: "DAILY 2ND PLACE",
        centerMain: "#2",
        centerSub: "TODAY",
        detailLine: `Runner-Up Today · ${scorePart}`,
      };
    }

    return {
      bgTop: "#080B16",
      bgMid: "#161B2E",
      bgBot: "#060811",
      bloomPrimary: "rgba(217, 119, 54, 0.26)",
      bloomSecondary: "rgba(37, 99, 235, 0.18)",
      accentLight: "#FDE2C8",
      accentMid: "#E08B4F",
      accentDeep: "#854318",
      ribbonTop: "#1D4ED8",
      ribbonBot: "#0B2259",
      kicker: "TODAY RANK · 11 PM CUTOFF",
      tierTitle: "DAILY 3RD PLACE",
      centerMain: "#3",
      centerSub: "TODAY",
      detailLine: `Podium Finish Today · ${scorePart}`,
    };
  }

  const milestone = spec?.milestone ?? getHighestOverallMilestone(xp) ?? 100;
  const num = milestone.toLocaleString("en-US");

  if (milestone >= 100000) {
    return {
      bgTop: "#060814",
      bgMid: "#111A38",
      bgBot: "#04060E",
      bloomPrimary: "rgba(250, 204, 21, 0.28)",
      bloomSecondary: "rgba(56, 189, 248, 0.22)",
      accentLight: "#FEF3C7",
      accentMid: "#F5C451",
      accentDeep: "#A16207",
      ribbonTop: "#2563EB",
      ribbonBot: "#0C2159",
      kicker: "OVERALL RANK MILESTONE",
      tierTitle: "GRAND LEGEND",
      centerMain: num,
      centerSub: "XP",
      detailLine: `Achieved ${num} Overall XP · ${defaultDate}`,
    };
  }

  if (milestone >= 10000) {
    return {
      bgTop: "#060B18",
      bgMid: "#0E1935",
      bgBot: "#050914",
      bloomPrimary: "rgba(232, 186, 98, 0.24)",
      bloomSecondary: "rgba(37, 99, 235, 0.22)",
      accentLight: "#F9E7B8",
      accentMid: "#E5B95C",
      accentDeep: "#9C7328",
      ribbonTop: "#1E56C5",
      ribbonBot: "#0B245E",
      kicker: "OVERALL RANK MILESTONE",
      tierTitle: "GOLD CHAMPION",
      centerMain: num,
      centerSub: "XP",
      detailLine: `Achieved ${num} Overall XP · ${defaultDate}`,
    };
  }

  if (milestone >= 1000) {
    return {
      bgTop: "#060B18",
      bgMid: "#0D1A35",
      bgBot: "#050914",
      bloomPrimary: "rgba(148, 163, 184, 0.25)",
      bloomSecondary: "rgba(56, 130, 246, 0.24)",
      accentLight: "#F8FAFC",
      accentMid: "#CBD5E1",
      accentDeep: "#64748B",
      ribbonTop: "#2563EB",
      ribbonBot: "#0F2B6B",
      kicker: "OVERALL RANK MILESTONE",
      tierTitle: "SILVER CHALLENGER",
      centerMain: num,
      centerSub: "XP",
      detailLine: `Achieved ${num} Overall XP · ${defaultDate}`,
    };
  }

  return {
    bgTop: "#070C1A",
    bgMid: "#111A30",
    bgBot: "#050914",
    bloomPrimary: "rgba(217, 132, 74, 0.24)",
    bloomSecondary: "rgba(37, 99, 235, 0.2)",
    accentLight: "#FDE2C8",
    accentMid: "#DE8E54",
    accentDeep: "#8A471B",
    ribbonTop: "#2563EB",
    ribbonBot: "#102C6E",
    kicker: "OVERALL RANK MILESTONE",
    tierTitle: "BRONZE STARTER",
    centerMain: num,
    centerSub: "XP",
    detailLine: `Achieved ${num} Overall XP · ${defaultDate}`,
  };
}

export async function generateBadgePng(
  xp: number,
  studentName: string,
  spec?: BadgeDesignSpec
): Promise<Blob | null> {
  const name = (studentName || "Player").trim();
  const palette = resolveBadgePalette(xp, spec);

  try {
    await document.fonts.load('800 80px "Plus Jakarta Sans"');
    await document.fonts.load('700 48px "Plus Jakarta Sans"');
    await document.fonts.load('600 28px "Plus Jakarta Sans"');
  } catch {
    // fallback system font
  }

  const W = 1080;
  const H = 1350;
  const cx = W / 2;
  const cy = 445;

  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d");
  if (!c) return null;

  const font = (w: number, size: number) => `${w} ${size}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const lin = (x0: number, y0: number, x1: number, y1: number, stops: string[]) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((col, i) => g.addColorStop(i / Math.max(1, stops.length - 1), col));
    return g;
  };

  // 1. Rich Midnight Sapphire Backdrop
  c.fillStyle = lin(0, 0, W, H, [palette.bgTop, palette.bgMid, palette.bgBot]);
  c.fillRect(0, 0, W, H);

  // Atmospheric radial grading
  let g = c.createRadialGradient(cx, cy - 20, 30, cx, cy, 560);
  g.addColorStop(0, palette.bloomPrimary);
  g.addColorStop(0.55, palette.bloomSecondary);
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  g = c.createRadialGradient(cx, H - 180, 20, cx, H - 180, 540);
  g.addColorStop(0, "rgba(37, 99, 235, 0.12)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  // Faint engraved orbital rings behind crest
  c.save();
  c.strokeStyle = "rgba(255, 255, 255, 0.04)";
  c.lineWidth = 1.5;
  [335, 395, 460].forEach((r) => {
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.stroke();
  });
  c.restore();

  // 2. Crisp Double Architectural Frame
  c.strokeStyle = lin(44, 44, W - 44, H - 44, [
    palette.accentLight,
    palette.accentMid,
    palette.accentDeep,
    palette.accentLight,
  ]);
  c.lineWidth = 2.5;
  roundRect(c, 44, 44, W - 88, H - 88, 40);
  c.stroke();

  c.strokeStyle = "rgba(255, 255, 255, 0.11)";
  c.lineWidth = 1.2;
  roundRect(c, 64, 64, W - 128, H - 128, 28);
  c.stroke();

  // Subtle metallic corner brackets
  const cornerInset = 82;
  const cornerLen = 28;
  c.strokeStyle = palette.accentMid;
  c.lineWidth = 2.5;
  [
    [cornerInset, cornerInset, 1, 1],
    [W - cornerInset, cornerInset, -1, 1],
    [cornerInset, H - cornerInset, 1, -1],
    [W - cornerInset, H - cornerInset, -1, -1],
  ].forEach(([x, y, dx, dy]) => {
    c.beginPath();
    c.moveTo(x, y + dy * cornerLen);
    c.lineTo(x, y);
    c.lineTo(x + dx * cornerLen, y);
    c.stroke();
  });

  // 3. Top Header Kicker
  c.textAlign = "center";
  c.fillStyle = palette.accentMid;
  c.font = font(700, 22);
  drawSpaced(c, palette.kicker, cx, 134, 6);

  // 4. Tailored Royal Ribbons behind seal
  [-1, 1].forEach((d) => {
    c.save();
    c.translate(cx, cy + 142);
    c.rotate(-d * 0.22);
    c.beginPath();
    [
      [d * 18, 0],
      [d * 138, 0],
      [d * 138, 225],
      [d * 78, 182],
      [d * 18, 225],
    ].forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
    c.fillStyle = lin(0, 0, 0, 225, [palette.ribbonTop, palette.ribbonBot]);
    c.fill();
    c.strokeStyle = "rgba(255, 255, 255, 0.35)";
    c.lineWidth = 2;
    c.stroke();
    c.restore();
  });

  // 5. Precision Scalloped Seal
  const spikes = 40;
  c.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i * Math.PI) / spikes - Math.PI / 2;
    const r = i % 2 ? 236 : 248;
    if (i === 0) c.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    else c.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  c.closePath();
  c.fillStyle = lin(0, cy - 250, 0, cy + 250, [
    palette.accentLight,
    palette.accentMid,
    palette.accentDeep,
    palette.accentLight,
  ]);
  c.shadowColor = "rgba(5, 10, 24, 0.85)";
  c.shadowBlur = 44;
  c.shadowOffsetY = 14;
  c.fill();
  c.shadowBlur = 0;
  c.shadowOffsetY = 0;

  c.beginPath();
  c.arc(cx, cy, 222, 0, Math.PI * 2);
  c.fillStyle = "#080E1E";
  c.fill();

  c.beginPath();
  c.arc(cx, cy, 212, 0, Math.PI * 2);
  c.fillStyle = lin(0, cy - 212, 0, cy + 212, ["#182C58", "#0A1226"]);
  c.fill();

  c.lineWidth = 3;
  c.strokeStyle = lin(cx - 200, cy - 200, cx + 200, cy + 200, [
    palette.accentLight,
    palette.accentMid,
    palette.accentDeep,
  ]);
  c.beginPath();
  c.arc(cx, cy, 198, 0, Math.PI * 2);
  c.stroke();

  c.lineWidth = 1.2;
  c.strokeStyle = "rgba(255, 255, 255, 0.16)";
  c.beginPath();
  c.arc(cx, cy, 184, 0, Math.PI * 2);
  c.stroke();

  c.font = font(600, 22);
  c.fillStyle = palette.accentLight;
  drawSpaced(c, "★ ★ ★", cx, cy - 110, 6);

  // Auto-fitted centerpiece value (100 / 1,000 / 10,000 / 100,000 or #1 / #2 / #3)
  const xpFontSize = fitTextFont(c, palette.centerMain, 800, 140, 56, 300);
  c.font = font(800, xpFontSize);
  c.fillStyle = lin(0, cy - xpFontSize * 0.65, 0, cy + 25, ["#FFFFFF", palette.accentLight]);
  c.fillText(palette.centerMain, cx, cy + Math.round(xpFontSize * 0.24));

  c.font = font(800, 32);
  c.fillStyle = palette.accentMid;
  drawSpaced(c, palette.centerSub, cx, cy + 106, 9);

  // 6. Tier Title with crisp horizontal flanking lines
  c.font = font(800, 28);
  c.fillStyle = palette.accentMid;
  const titleWidth = drawSpaced(c, palette.tierTitle, cx, 818, 7);
  const lineGap = 24;
  const lineLeftEnd = cx - titleWidth / 2 - lineGap;
  const lineRightStart = cx + titleWidth / 2 + lineGap;
  if (lineLeftEnd > 140) {
    c.strokeStyle = "rgba(255, 255, 255, 0.24)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(140, 808);
    c.lineTo(lineLeftEnd, 808);
    c.moveTo(lineRightStart, 808);
    c.lineTo(W - 140, 808);
    c.stroke();
  }

  // 7. Compact Candidate Name & Achievement line
  c.font = font(500, 24);
  c.fillStyle = "#94A7C6";
  c.fillText("Awarded to", cx, 888);

  fitTextFont(c, name, 700, 48, 28, 760);
  c.fillStyle = "#FFFFFF";
  c.fillText(name, cx, 956);

  fitTextFont(c, palette.detailLine, 500, 25, 18, 780);
  c.fillStyle = "#A9B8D1";
  c.fillText(palette.detailLine, cx, 1018);

  const divGrad = c.createLinearGradient(180, 0, W - 180, 0);
  divGrad.addColorStop(0, "rgba(255,255,255,0)");
  divGrad.addColorStop(0.5, "rgba(255,255,255,0.28)");
  divGrad.addColorStop(1, "rgba(255,255,255,0)");
  c.strokeStyle = divGrad;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(180, 1112);
  c.lineTo(W - 180, 1112);
  c.stroke();

  // 8. Small App Logo + App Name Footer
  const logoSize = 42;
  const logoGap = 12;
  const appLabel = "AmaySST Quiz";
  c.font = font(700, 26);
  const tw = c.measureText(appLabel).width;
  const lockupW = logoSize + logoGap + tw;
  const x0 = cx - lockupW / 2;
  const footerY = 1188;

  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      c.save();
      c.beginPath();
      c.arc(x0 + logoSize / 2, footerY - 8, logoSize / 2, 0, Math.PI * 2);
      c.clip();
      c.drawImage(img, x0, footerY - 8 - logoSize / 2, logoSize, logoSize);
      c.restore();

      c.strokeStyle = palette.accentMid;
      c.lineWidth = 1.8;
      c.beginPath();
      c.arc(x0 + logoSize / 2, footerY - 8, logoSize / 2, 0, Math.PI * 2);
      c.stroke();
      resolve();
    };
    img.onerror = () => resolve();
    img.src = "./amay-avatar.jpg";
  });

  c.textAlign = "left";
  c.fillStyle = "#DCE6F7";
  c.fillText(appLabel, x0 + logoSize + logoGap, footerY);

  return new Promise((resolve) => cv.toBlob(resolve, "image/png"));
}
