const PAPER = "#f3ead7";
const PAPER2 = "#f7e7d8";
const INK = "#1c140f";
const RED = "#b4332a";
const PENCIL = "#5e5348";

let grain = null;

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

function ensureGrain() {
  if (grain) return grain;
  const c = document.createElement("canvas");
  c.width = 180;
  c.height = 180;
  const g = c.getContext("2d");
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(48, 32, 18, ${Math.random() * 0.045})`;
    g.fillRect(Math.random() * 180, Math.random() * 180, 1, 1);
  }
  grain = c;
  return c;
}

function visible(box, camX, camY, viewW, viewH) {
  return box.x + box.w > camX - 60 && box.x < camX + viewW + 60 && box.y + (box.h || 20) > camY - 80 && box.y < camY + viewH + 80;
}

export function drawFrame(ctx, view) {
  const { world, camX, camY, viewW, viewH, scale, fx } = view;
  const shakeX = fx.shake ? Math.sin(fx.shake * 18) * fx.shake * 0.35 : 0;
  const shakeY = fx.shake ? Math.cos(fx.shake * 14) * fx.shake * 0.2 : 0;
  const paper = world.actId === "act2" ? PAPER2 : PAPER;

  ctx.setTransform(scale, 0, 0, scale, Math.round((-camX + shakeX) * scale), Math.round((-camY + shakeY) * scale));
  ctx.fillStyle = paper;
  ctx.fillRect(camX - 40, camY - 40, viewW + 80, viewH + 80);

  const pat = ctx.createPattern(ensureGrain(), "repeat");
  if (pat) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = pat;
    ctx.fillRect(camX - 40, camY - 40, viewW + 80, viewH + 80);
    ctx.restore();
  }

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(150, 176, 196, 0.28)";
  const y0 = Math.floor(camY / 28) * 28;
  for (let y = y0; y < camY + viewH + 28; y += 28) {
    ctx.beginPath();
    ctx.moveTo(camX - 20, y + 0.5);
    ctx.lineTo(camX + viewW + 20, y + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(180, 51, 42, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(72.5, camY - 20);
  ctx.lineTo(72.5, camY + viewH + 20);
  ctx.stroke();

  if (world.actId === "act2") {
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = RED;
    ctx.font = "120px 'Shippori Mincho', serif";
    ctx.fillText("裏面", world.spawn.x + 40, world.spawn.y - 80);
    ctx.restore();
  }

  for (const z of world.winds) {
    if (!visible(z, camX, camY, viewW, viewH)) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(z.x, z.y, z.w, z.h);
    ctx.clip();
    ctx.strokeStyle = "rgba(70, 58, 46, 0.22)";
    ctx.lineWidth = 1;
    for (let i = -z.h; i < z.w + z.h; i += 12) {
      ctx.beginPath();
      ctx.moveTo(z.x + i, z.y);
      ctx.lineTo(z.x + i - z.h, z.y + z.h);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const s of world.spikes) drawSpikes(ctx, s);
  for (const d of world.decoys) {
    if (!visible(d, camX, camY, viewW, viewH)) continue;
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, d.h - 1);
    ctx.setLineDash([]);
    ctx.restore();
  }

  for (const p of world.platforms) {
    if (p.hidden || !p.alive && p.kind !== "crumble") continue;
    if (!visible(p, camX, camY, viewW, viewH) && p.kind !== "crumble") continue;
    drawPlatform(ctx, p, world.t);
  }
  for (const m of world.movers) drawPlatform(ctx, { ...m, kind: "mover" }, world.t);

  for (const r of world.rulers) drawRuler(ctx, world, r, fx.marks);
  for (const c of world.checkpoints) drawCheckpoint(ctx, c, world.t);
  for (const s of world.signs) {
    ctx.save();
    ctx.fillStyle = RED;
    ctx.font = "16px Yomogi, 'WenQuanYi Micro Hei', sans-serif";
    ctx.translate(s.x, s.y);
    ctx.rotate((hash(s.text) - 0.5) * 0.06);
    ctx.fillText(s.text, 0, 0);
    ctx.restore();
  }

  if (fx.bestY != null) {
    ctx.save();
    ctx.strokeStyle = "rgba(180, 51, 42, 0.55)";
    ctx.setLineDash([5, 7]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(camX, fx.bestY);
    ctx.lineTo(camX + viewW, fx.bestY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = RED;
    ctx.font = "13px Yomogi, sans-serif";
    ctx.fillText("自己記録", camX + 16, fx.bestY - 6);
    ctx.restore();
  }

  for (const mark of fx.marks) {
    ctx.save();
    ctx.fillStyle = RED;
    ctx.font = "15px Yomogi, sans-serif";
    ctx.translate(mark.x, mark.y);
    ctx.rotate(-0.3);
    ctx.fillText(mark.text, 0, 0);
    ctx.restore();
  }

  drawGoal(ctx, world);
  for (const particle of fx.particles) {
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.s, particle.s);
  }
  ctx.globalAlpha = 1;
  drawPlayer(ctx, world.player, world.t, fx);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const calm = Math.max(0, Math.min(1, fx.calm / 100));
  if (calm < 0.98) {
    ctx.fillStyle = `rgba(140, 36, 28, ${(1 - calm) * 0.13})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  for (const bit of fx.confetti) {
    ctx.save();
    ctx.translate(bit.x, bit.y);
    ctx.rotate(bit.r);
    ctx.fillStyle = bit.color;
    ctx.fillRect(-4, -3, 8, 6);
    ctx.restore();
  }
  if (fx.stamp) drawStamp(ctx, fx.stamp);
}

function drawPlatform(ctx, p, t) {
  const fall = p.fall ? Math.min(220, p.fall * p.fall * 500) : 0;
  const shake = p.kind === "crumble" ? Math.sin(t * 36) * Math.min(4, (p.stand || 0) * 7) : 0;
  const x = p.x + shake;
  const y = p.y + fall;
  if (!p.alive && p.kind === "crumble" && fall > 200) return;
  ctx.save();
  ctx.translate(x, y);
  const wob = hash(p.id) * 1.4;
  ctx.beginPath();
  ctx.moveTo(0, wob);
  const steps = Math.max(2, Math.floor(p.w / 18));
  for (let i = 1; i <= steps; i++) {
    const px = (p.w * i) / steps;
    ctx.lineTo(px, hash(p.id + ":" + i) * 1.6);
  }
  ctx.lineTo(p.w, p.h);
  ctx.lineTo(0, p.h);
  ctx.closePath();
  ctx.fillStyle = p.kind === "ice" ? "#2a3138" : INK;
  if (!p.alive) ctx.globalAlpha = 0.45;
  ctx.fill();
  if (p.kind === "ice") {
    ctx.strokeStyle = "rgba(243, 234, 215, 0.55)";
    ctx.lineWidth = 1;
    for (let i = -p.h; i < p.w; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, p.h);
      ctx.lineTo(i + p.h, 0);
      ctx.stroke();
    }
  }
  if (p.kind === "crumble") {
    ctx.fillStyle = PAPER;
    for (let i = 8; i < p.w - 4; i += 14) ctx.fillRect(i, 7, 6, 5);
  }
  if (p.kind === "mover") {
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.moveTo(p.w / 2 - 6, p.h / 2 + 3);
    ctx.lineTo(p.w / 2 + 7, p.h / 2);
    ctx.lineTo(p.w / 2 - 6, p.h / 2 - 3);
    ctx.fill();
  }
  ctx.restore();
}

function drawSpikes(ctx, s) {
  ctx.fillStyle = RED;
  const n = Math.max(1, Math.floor(s.w / 14));
  const dw = s.w / n;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(s.x + i * dw, s.y + s.h);
    ctx.lineTo(s.x + i * dw + dw / 2, s.y);
    ctx.lineTo(s.x + (i + 1) * dw, s.y + s.h);
    ctx.fill();
  }
}

function drawCheckpoint(ctx, c, t) {
  ctx.save();
  ctx.translate(c.x, c.y + c.h);
  ctx.strokeStyle = c.style === "shiny" ? RED : PENCIL;
  ctx.fillStyle = c.style === "shiny" ? RED : PENCIL;
  ctx.lineWidth = c.style === "shiny" ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -c.h + 6);
  ctx.stroke();
  const wave = c.style === "shiny" ? Math.sin(t * 3) * 2 : 0;
  ctx.beginPath();
  ctx.moveTo(0, -c.h + 8);
  ctx.lineTo(c.w - 4, -c.h + 16 + wave);
  ctx.lineTo(0, -c.h + 26);
  ctx.closePath();
  ctx.globalAlpha = c.style === "shiny" ? 0.95 : 0.75;
  ctx.fill();
  if (c.dot) {
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, -10, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (c.official) {
    ctx.globalAlpha = 1;
    ctx.font = "12px Yomogi, sans-serif";
    ctx.fillText("正式", 4, 14);
  }
  ctx.restore();
}

function drawRuler(ctx, world, ruler, marks) {
  const a = [...world.platforms, ...world.movers].find((p) => p.id === ruler.from);
  const b = [...world.platforms, ...world.movers].find((p) => p.id === ruler.to);
  if (!a || !b) return;
  const y = a.y + 10;
  const x1 = a.x + a.w;
  const x2 = b.x;
  ctx.save();
  ctx.strokeStyle = RED;
  ctx.fillStyle = RED;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.moveTo(x1, y - 5);
  ctx.lineTo(x1, y + 5);
  ctx.moveTo(x2, y - 5);
  ctx.lineTo(x2, y + 5);
  ctx.stroke();
  ctx.font = "14px 'Shippori Mincho', serif";
  ctx.textAlign = "center";
  ctx.fillText(ruler.label, (x1 + x2) / 2, y - 8);
  if (ruler.id === "final") {
    marks.forEach((mark, i) => {
      const tick = x2 - 8 - (i % 8) * 4;
      ctx.beginPath();
      ctx.moveTo(tick, y);
      ctx.lineTo(tick, y + 12);
      ctx.stroke();
    });
  }
  ctx.restore();
}

function drawGoal(ctx, world) {
  const gate = world.fakeGoal || world.goal;
  if (!gate) return;
  const label = world.fakeGoal ? "ゴール" : "提出";
  ctx.save();
  ctx.strokeStyle = RED;
  ctx.fillStyle = RED;
  ctx.lineWidth = 3;
  ctx.strokeRect(gate.x, gate.y, gate.w, gate.h);
  ctx.font = "18px 'Shippori Mincho', serif";
  ctx.textAlign = "center";
  ctx.fillText(label, gate.x + gate.w / 2, gate.y + gate.h / 2 + 6);
  ctx.restore();
}

function drawPlayer(ctx, p, t, fx) {
  const jitter = fx.streak > 6 ? Math.sin(t * 32) * 1.15 : 0;
  const x = p.x + p.w / 2 + jitter;
  const foot = p.y + p.h;
  const step = p.onGround ? Math.sin(t * 11) * Math.min(4, Math.abs(p.vx) * 0.02) : 0;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 4, foot - 15);
  ctx.lineTo(x - 6 - step, foot);
  ctx.moveTo(x + 4, foot - 15);
  ctx.lineTo(x + 6 + step, foot);
  ctx.stroke();
  const cy = foot - 26 + (p.vy < -80 ? -1 : 0);
  ctx.beginPath();
  ctx.arc(x, cy, 11, 0, Math.PI * 2);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, cy, 8, 0, Math.PI * 2);
  ctx.stroke();
  const look = Math.max(-2, Math.min(2, p.vx * 0.012));
  ctx.fillStyle = INK;
  ctx.fillRect(x - 4.5 + look, cy - 1.5, 2, 2.4);
  ctx.fillRect(x + 2.5 + look, cy - 1.5, 2, 2.4);
  ctx.beginPath();
  if (fx.calm < 45) {
    ctx.moveTo(x - 4, cy + 4);
    ctx.lineTo(x + 4, cy + 3);
  } else {
    ctx.arc(x, cy + 5, 2.2, 0.15 * Math.PI, 0.85 * Math.PI);
  }
  ctx.stroke();
  if (fx.calm < 35) {
    ctx.beginPath();
    ctx.arc(x + 9, cy - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawStamp(ctx, stamp) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const pop = Math.min(1, stamp.t / 0.16);
  const scale = 1.4 - 0.4 * pop;
  ctx.save();
  ctx.translate(w / 2, h / 2 - 10);
  ctx.rotate(-0.18);
  ctx.scale(scale, scale);
  ctx.strokeStyle = RED;
  ctx.fillStyle = RED;
  ctx.globalAlpha = 0.92;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 108, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 90, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = "64px 'Shippori Mincho', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(stamp.text, 0, 4);
  if (stamp.crossed) {
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-78, 48);
    ctx.lineTo(82, -46);
    ctx.stroke();
  }
  if (stamp.sub) {
    ctx.font = "22px Yomogi, sans-serif";
    ctx.fillText(stamp.sub, 0, 78);
  }
  ctx.restore();
}
