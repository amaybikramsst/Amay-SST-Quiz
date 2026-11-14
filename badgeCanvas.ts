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

function drawSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, gap: number) {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * (chars.length - 1);
  let pos = x - total / 2;
  ctx.textAlign = "left";
  chars.forEach((ch, idx) => {
    ctx.fillText(ch, pos, y);
    pos += widths[idx] + gap;
  });
  ctx.textAlign = "center";
}

export async function generateBadgePng(xp: number, studentName: string): Promise<Blob | null> {
  const milestone = Math.floor(xp / 100) * 100;
  const title =
    milestone >= 2000 ? "QUIZ LEGEND" : milestone >= 1000 ? "QUIZ CHAMPION" : "RISING STAR";
  const name = studentName || "Player";
  const num = milestone.toLocaleString("en-US");

  try {
    await document.fonts.load('800 80px "Plus Jakarta Sans"');
    await document.fonts.load('600 40px "Plus Jakarta Sans"');
  } catch {
    // fallback system font
  }

  const W = 1080;
  const H = 1350;
  const cx = W / 2;
  const cy = 450;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d");
  if (!c) return null;

  const font = (w: number, size: number) => `${w} ${size}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const lin = (x0: number, y0: number, x1: number, y1: number, stops: string[]) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((col, i) => g.addColorStop(i / (stops.length - 1), col));
    return g;
  };

  c.fillStyle = lin(0, 0, W, H, ["#05070B", "#0E141D", "#05070B"]);
  c.fillRect(0, 0, W, H);

  let g = c.createRadialGradient(cx, cy, 40, cx, cy, 640);
  g.addColorStop(0, "rgba(77,184,245,.4)");
  g.addColorStop(1, "rgba(77,184,245,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  g = c.createRadialGradient(cx, H, 40, cx, H, 560);
  g.addColorStop(0, "rgba(190,200,220,.2)");
  g.addColorStop(1, "rgba(190,200,220,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  c.strokeStyle = lin(0, 0, W, H, ["#E6EBF2", "#4DB8F5", "#8E99A9"]);
  c.lineWidth = 4;
  roundRect(c, 36, 36, W - 72, H - 72, 48);
  c.stroke();

  c.textAlign = "center";
  c.fillStyle = "#7FD0FA";
  c.font = font(600, 30);
  drawSpaced(c, "ACHIEVEMENT UNLOCKED", cx, 128, 10);

  [-1, 1].forEach((d) => {
    c.save();
    c.translate(cx, cy + 150);
    c.rotate(-d * 0.2);
    c.beginPath();
    [
      [d * 20, 0],
      [d * 170, 0],
      [d * 170, 300],
      [d * 95, 245],
      [d * 20, 300],
    ].forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
    c.fillStyle = lin(0, 0, 0, 300, ["#35A9EE", "#0A5E9E"]);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,.35)";
    c.lineWidth = 3;
    c.stroke();
    c.restore();
  });

  const spikes = 36;
  c.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i * Math.PI) / spikes - Math.PI / 2;
    const r = i % 2 ? 282 : 300;
    if (i === 0) c.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    else c.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  c.closePath();
  c.fillStyle = lin(0, cy - 300, 0, cy + 300, ["#FFFFFF", "#C9D1DC", "#8E99A9", "#E6EBF2"]);
  c.shadowColor = "rgba(77,184,245,.65)";
  c.shadowBlur = 60;
  c.fill();
  c.shadowBlur = 0;

  c.beginPath();
  c.arc(cx, cy, 262, 0, Math.PI * 2);
  c.fillStyle = "#0A0E14";
  c.fill();

  c.beginPath();
  c.arc(cx, cy, 250, 0, Math.PI * 2);
  c.fillStyle = lin(0, cy - 250, 0, cy + 250, ["#22304A", "#080B10"]);
  c.fill();

  c.lineWidth = 5;
  c.strokeStyle = "#4DB8F5";
  c.beginPath();
  c.arc(cx, cy, 230, 0, Math.PI * 2);
  c.stroke();

  c.lineWidth = 2;
  c.strokeStyle = "rgba(255,255,255,.25)";
  c.beginPath();
  c.arc(cx, cy, 212, 0, Math.PI * 2);
  c.stroke();

  c.font = font(600, 34);
  c.fillStyle = "#C9D1DC";
  drawSpaced(c, "★ ★ ★", cx, cy - 120, 6);

  c.font = font(800, num.length > 3 ? 150 : 190);
  c.fillStyle = lin(0, cy - 130, 0, cy + 40, ["#FFFFFF", "#8FD3FA"]);
  c.fillText(num, cx, cy + 45);

  c.font = font(800, 60);
  c.fillStyle = "#4DB8F5";
  drawSpaced(c, "XP", cx, cy + 135, 18);

  c.font = font(800, 40);
  c.fillStyle = "#7FD0FA";
  drawSpaced(c, title, cx, 975, 12);

  let fs = 104;
  c.font = font(800, fs);
  while (c.measureText(name).width > 880 && fs > 40) {
    fs -= 4;
    c.font = font(800, fs);
  }
  c.fillStyle = "#FFFFFF";
  c.fillText(name, cx, 1085);

  c.font = font(600, 36);
  c.fillStyle = "#AEB8C7";
  c.fillText(
    `Reached ${num} XP · ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
    cx,
    1150
  );

  c.strokeStyle = "rgba(255,255,255,.18)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(160, 1195);
  c.lineTo(W - 160, 1195);
  c.stroke();

  c.font = font(800, 46);
  const tw = c.measureText("AmaySST Quiz").width;
  const x0 = cx - (80 + 16 + tw) / 2;

  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      c.save();
      c.beginPath();
      c.arc(x0 + 40, 1262, 40, 0, Math.PI * 2);
      c.clip();
      c.drawImage(img, x0, 1222, 80, 80);
      c.restore();
      c.strokeStyle = "#4DB8F5";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(x0 + 40, 1262, 40, 0, Math.PI * 2);
      c.stroke();
      resolve();
    };
    img.onerror = () => resolve();
    img.src = "./amay-avatar.jpg";
  });

  c.textAlign = "left";
  c.fillStyle = "#FFFFFF";
  c.fillText("AmaySST Quiz", x0 + 96, 1277);

  return new Promise((resolve) => cv.toBlob(resolve, "image/png"));
}
