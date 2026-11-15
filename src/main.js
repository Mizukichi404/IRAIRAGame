import { STEP, createWorld, measureMiss, overlaps, step } from "./sim.js";
import { createAct1, createAct2 } from "./levels.js";
import { applyCheckpoint, betterGrade, checkpointLine, gradeFor, pickNote } from "./notes.js";
import { drawFrame } from "./draw.js";
import { createAudio } from "./audio.js";

const SAVE_KEY = "ato1mm-v1";
const VIEW_W = 860;

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const audio = createAudio();

const el = {
  cover: document.querySelector("#cover"),
  result: document.querySelector("#result"),
  desk: document.querySelector("#desk"),
  notes: document.querySelector("#notes"),
  live: document.querySelector("#live"),
  q: document.querySelector("#q-label"),
  deaths: document.querySelector("#stat-deaths"),
  total: document.querySelector("#stat-total"),
  reach: document.querySelector("#stat-reach"),
  best: document.querySelector("#stat-best"),
  calm: document.querySelector("#stat-calm"),
  calmBar: document.querySelector("#calm-bar"),
  time: document.querySelector("#stat-time"),
  quitBar: document.querySelector("#quit-bar"),
  record: document.querySelector("#cover-record"),
  mute: document.querySelector("#btn-mute"),
  resultGrade: document.querySelector("#result-grade"),
  resultLine: document.querySelector("#result-line"),
  resultStats: document.querySelector("#result-stats"),
  resultRetest: document.querySelector("#result-retest"),
  coverRetest: document.querySelector("#cover-retest"),
  coverWipe: document.querySelector("#cover-wipe"),
};

const input = {
  keyL: false,
  keyR: false,
  keyJ: false,
  padL: false,
  padR: false,
  padJ: false,
  pointerJ: false,
};

const ui = {
  mode: "title",
  modeT: 0,
  retest: false,
  act: null,
  world: null,
  spawn: null,
  attemptDeaths: 0,
  totalDeaths: 0,
  clears: 0,
  retestClears: 0,
  bestGrade: null,
  lastGrade: null,
  calm: 100,
  notes: [],
  camX: 0,
  camY: 0,
  scale: 1,
  viewW: VIEW_W,
  viewH: 480,
  lifeBestY: 0,
  bestY: {},
  spotKey: "",
  spotStreak: 0,
  elapsed: 0,
  nearCount: 0,
  quitAsk: false,
  marks: [],
  shake: 0,
  particles: [],
  confetti: [],
  stamp: null,
  waitRelease: false,
  hinted99: false,
  calmWarned: false,
  recordNoted: false,
  announced: new Set(),
  seenReal: new Set(),
  resolved: false,
  reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
};

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    ui.totalDeaths = data.totalDeaths || 0;
    ui.clears = data.clears || 0;
    ui.retestClears = data.retestClears || 0;
    ui.bestGrade = data.bestGrade || null;
    ui.bestY = data.bestY || {};
    if (data.muted) setMuted(true);
  } catch {
    /* 壊れた記録は無視する */
  }
}

function persist() {
  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify({
      totalDeaths: ui.totalDeaths,
      clears: ui.clears,
      retestClears: ui.retestClears,
      bestGrade: ui.bestGrade,
      bestY: ui.bestY,
      muted: el.mute.dataset.muted === "1",
    }),
  );
}

function setMuted(muted) {
  el.mute.dataset.muted = muted ? "1" : "0";
  el.mute.textContent = muted ? "音を出す" : "音を消す";
  audio.setMuted(muted);
}

function addNote(text, tone = "ink") {
  if (!text) return;
  if (ui.notes[0]?.text === text) return;
  ui.notes.unshift({ text, tone });
  if (ui.notes.length > 6) ui.notes.pop();
  el.notes.innerHTML = "";
  for (const note of ui.notes) {
    const li = document.createElement("li");
    li.textContent = note.text;
    li.className = note.tone;
    el.notes.append(li);
  }
  el.live.textContent = text;
}

function clock(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function percentOf(y) {
  const world = ui.world;
  if (!world) return 0;
  const span = world.progressBottom - world.progressTop;
  if (span <= 0) return 0;
  const ratio = (world.progressBottom - y) / span;
  return Math.max(0, Math.min(99, Math.floor(ratio * 100)));
}

function show(mode) {
  el.cover.hidden = mode !== "title";
  el.result.hidden = mode !== "result";
  el.desk.hidden = mode === "title" || mode === "result";
}

function refreshCover() {
  const bits = [];
  if (ui.totalDeaths > 0) bits.push(`通算死亡 ${ui.totalDeaths}`);
  if (ui.clears > 0) bits.push(`前回は合格（評価${ui.bestGrade || "—"}）`);
  el.record.textContent = bits.join("。") + (bits.length ? "。" : "");
  el.coverRetest.hidden = ui.clears < 1;
  el.coverWipe.hidden = ui.totalDeaths < 1 && ui.clears < 1;
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const viewW = Math.max(420, Math.min(VIEW_W, rect.width * (26 / 24)));
  ui.viewW = viewW;
  ui.scale = canvas.width / viewW;
  ui.viewH = canvas.height / ui.scale;
}

function placeCamera(instant) {
  const p = ui.world.player;
  const targetX = p.x - ui.viewW * 0.34 + p.facing * 40;
  const targetY = p.y - ui.viewH * 0.64;
  const maxX = Math.max(ui.world.minX, ui.world.maxX - ui.viewW);
  const maxY = Math.max(ui.world.minY, ui.world.maxY - ui.viewH);
  const x = Math.min(maxX, Math.max(ui.world.minX, targetX));
  const y = Math.min(maxY, Math.max(ui.world.minY, targetY));
  if (instant) {
    ui.camX = x;
    ui.camY = y;
  }
  return { x, y };
}

function damp(current, target, dt, rate) {
  return current + (target - current) * (1 - Math.exp(-dt * rate));
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    ui.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 180,
      vy: -Math.random() * 160,
      s: 2 + Math.random() * 3,
      life: 1,
      color,
    });
  }
}

function readDir() {
  const l = input.keyL || input.padL;
  const r = input.keyR || input.padR;
  if (l && !r) return -1;
  if (r && !l) return 1;
  return 0;
}

function jumpHeld() {
  return input.keyJ || input.padJ || input.pointerJ;
}

function begin(retest) {
  audio.unlock();
  ui.retest = retest;
  ui.act = retest ? createAct2({ retest: true }) : createAct1();
  ui.spawn = null;
  ui.world = createWorld(ui.act);
  ui.attemptDeaths = 0;
  ui.elapsed = 0;
  ui.nearCount = 0;
  ui.calm = retest ? Math.min(ui.calm, 70) : 100;
  ui.notes = [];
  ui.marks = [];
  ui.particles = [];
  ui.confetti = [];
  ui.stamp = null;
  ui.lifeBestY = ui.world.player.y + ui.world.player.h;
  ui.spotKey = "";
  ui.spotStreak = 0;
  ui.quitAsk = false;
  el.quitBar.hidden = true;
  ui.waitRelease = true;
  ui.hinted99 = false;
  ui.calmWarned = false;
  ui.recordNoted = false;
  ui.announced = new Set();
  ui.seenReal = new Set();
  ui.resolved = false;
  ui.mode = "play";
  ui.modeT = 0;
  show("play");
  placeCamera(true);
  addNote(retest ? "再試験です。問題は同一です。" : "受験を開始します。操作に問題はありません。", "ink");
  resize();
}

function enterAct2() {
  lockBest();
  ui.retest = false;
  ui.act = createAct2({ retest: false });
  ui.spawn = null;
  ui.world = createWorld(ui.act);
  ui.marks = [];
  ui.stamp = null;
  ui.confetti = [];
  ui.lifeBestY = ui.world.player.y + ui.world.player.h;
  ui.hinted99 = false;
  ui.recordNoted = false;
  ui.announced = new Set();
  ui.seenReal = new Set();
  ui.calm = Math.max(0, ui.calm - 24);
  ui.mode = "play";
  ui.modeT = 0;
  ui.waitRelease = true;
  placeCamera(true);
  addNote("第1問は練習でした。到達率を戻し、本試験を開始します。", "red");
}

function respawn() {
  ui.world = createWorld(ui.act, ui.spawn || undefined);
  ui.lifeBestY = ui.world.player.y + ui.world.player.h;
  ui.recordNoted = false;
  ui.announced = new Set();
  ui.mode = "play";
  ui.modeT = 0;
  ui.stamp = null;
  ui.waitRelease = true;
  ui.particles = [];
}

function climbed() {
  return ui.world.progressBottom - ui.lifeBestY > 8;
}

function onDeath() {
  const world = ui.world;
  ui.attemptDeaths += 1;
  ui.totalDeaths += 1;
  const miss = measureMiss(world);
  const key = `${world.actId}:${Math.round(world.player.x / 90)}:${Math.round(world.player.y / 80)}`;
  ui.spotStreak = key === ui.spotKey ? ui.spotStreak + 1 : 1;
  ui.spotKey = key;
  const bestKey = world.actId;
  const prevBest = ui.bestY[bestKey];
  const record = climbed() && (prevBest == null || ui.lifeBestY < prevBest - 1);
  if (record) ui.bestY[bestKey] = ui.lifeBestY;
  const inWind = world.trail.some((s) =>
    world.winds.some((z) => overlaps({ x: s.x, y: s.y, w: world.player.w, h: world.player.h }, z)),
  );
  const note = pickNote({
    deaths: ui.attemptDeaths,
    shortfall: miss ? miss.px : null,
    takeoffGap: world.player.takeoffGap,
    cutJump: world.player.cutJump,
    streak: ui.spotStreak,
    record,
    cause: inWind ? "wind" : world.deathCause,
  });
  addNote(note.text, note.tone);
  if (miss) {
    ui.nearCount += 1;
    ui.marks.push({ x: miss.x, y: miss.y - 18, text: `${miss.px}px` });
    if (ui.marks.length > 10) ui.marks.shift();
    ui.calm = Math.max(0, ui.calm - (miss.px <= 12 ? 9 : 5));
    audio.near();
  } else {
    ui.calm = Math.max(0, ui.calm - 4);
  }
  if (ui.calm < 40 && !ui.calmWarned) {
    ui.calmWarned = true;
    addNote("平静を保ってください。", "red");
  }
  audio.die();
  ui.shake = ui.reduced ? 0 : 8;
  burst(world.player.x + 8, world.player.y + 16, "#1c140f", 12);
  ui.stamp = { text: "不合格", t: 0, crossed: false, sub: "" };
  ui.mode = "dead";
  ui.modeT = 0;
  persist();
}

function lockBest() {
  if (!ui.world || !climbed()) return;
  const id = ui.world.actId;
  if (ui.bestY[id] == null || ui.lifeBestY < ui.bestY[id]) ui.bestY[id] = ui.lifeBestY;
}

function commitClear() {
  lockBest();
  const grade = gradeFor(ui.attemptDeaths);
  ui.lastGrade = grade;
  ui.bestGrade = betterGrade(grade.id, ui.bestGrade);
  if (ui.retest) ui.retestClears += 1;
  else ui.clears += 1;
  persist();
}

function openResult() {
  const grade = ui.lastGrade || gradeFor(ui.attemptDeaths);
  el.resultGrade.textContent = `評価 ${grade.id}`;
  const best = ui.bestGrade;
  el.resultLine.textContent =
    best && best !== grade.id ? `今回は評価${grade.id}。最良の評価は${best}のままです。` : grade.line;
  el.resultStats.innerHTML = "";
  const rows = [
    ["この回の死亡", String(ui.attemptDeaths)],
    ["通算死亡", String(ui.totalDeaths)],
    ["経過", clock(ui.elapsed)],
    ["あと16px以内", String(ui.nearCount)],
  ];
  for (const [k, v] of rows) {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = k;
    dd.textContent = v;
    row.append(dt, dd);
    el.resultStats.append(row);
  }
  el.resultRetest.textContent = ui.retest ? "もう一度、評価を取りにいく" : "評価を取りにいく";
  ui.mode = "result";
  show("result");
}

function updateHud() {
  if (!ui.world) return;
  const pct =
    ui.mode === "fakewin" && ui.modeT < 1.45
      ? 100
      : ui.mode === "realwin" || ui.mode === "result"
        ? 100
        : percentOf(ui.lifeBestY);
  el.q.textContent = ui.act?.title || "";
  el.deaths.textContent = String(ui.attemptDeaths);
  el.total.textContent = String(ui.totalDeaths);
  el.reach.textContent = `${pct}%`;
  const bestY = ui.bestY[ui.world.actId];
  el.best.textContent = bestY == null ? "—" : `${percentOf(bestY)}%`;
  el.calm.textContent = String(Math.round(ui.calm));
  el.calmBar.style.transform = `scaleX(${Math.max(0, ui.calm) / 100})`;
  el.time.textContent = clock(ui.elapsed);
  if (pct >= 99 && ui.mode === "play" && !ui.hinted99) {
    ui.hinted99 = true;
    addNote("残り1%です。", "red");
  }
}

let jumpWasHeld = false;

function tick(dt) {
  const heldNow = jumpHeld();
  const pressed = heldNow && !jumpWasHeld;
  jumpWasHeld = heldNow;
  ui.modeT += dt;
  ui.shake *= Math.exp(-dt * 8);
  for (const particle of ui.particles) {
    particle.vy += 700 * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt * 1.6;
  }
  ui.particles = ui.particles.filter((particle) => particle.life > 0);
  for (const bit of ui.confetti) {
    bit.vy += 280 * dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
    bit.r += dt * 4;
  }

  if (ui.mode === "play" || ui.mode === "dead") ui.elapsed += dt;

  if (ui.mode === "fakewin") {
    ui.stamp.t = ui.modeT;
    ui.stamp.crossed = ui.modeT > 1.45;
    ui.stamp.sub = ui.modeT > 1.45 ? "練習問題でした" : "";
    if (ui.modeT > 2.45) enterAct2();
    return;
  }
  if (ui.mode === "realwin") {
    ui.stamp.t = ui.modeT;
    ui.stamp.sub = ui.modeT > 1.7 ? "採点は有効です" : "";
    if (!ui.resolved && ui.modeT > 1.7) {
      ui.resolved = true;
      audio.resolve();
    }
    if (ui.modeT > 2.7) openResult();
    return;
  }
  if (ui.mode === "dead") {
    if (ui.stamp) ui.stamp.t = ui.modeT;
    if (pressed && ui.modeT > 0.24) respawn();
    return;
  }
  if (ui.mode !== "play") {
    if (ui.stamp) ui.stamp.t = ui.modeT;
    return;
  }

  const held = jumpHeld();
  if (ui.waitRelease) {
    if (!held) ui.waitRelease = false;
  }
  const world = ui.world;
  const before = world.platforms.filter((p) => p.kind === "crumble" && p.alive).length;
  step(world, { dir: readDir(), jump: ui.waitRelease ? false : held });
  const after = world.platforms.filter((p) => p.kind === "crumble" && p.alive).length;
  if (after < before) audio.crumble();
  if (world.jumped) audio.jump();
  if (world.landed) {
    audio.land();
    burst(world.player.x + 8, world.player.y + world.player.h, "#1c140f", 3);
  }

  const feet = world.player.y + world.player.h;
  if (world.player.onGround && feet < ui.lifeBestY) ui.lifeBestY = feet;
  const bestKey = world.actId;
  if (ui.bestY[bestKey] == null || ui.lifeBestY < ui.bestY[bestKey]) {
    if (!ui.recordNoted && ui.bestY[bestKey] != null && ui.lifeBestY < ui.bestY[bestKey] - 8) {
      ui.recordNoted = true;
      addNote("自己記録を更新しました。まだ不合格です。", "ink");
    }
  }

  for (const cp of world.checkpoints) {
    const hit = overlaps(world.player, cp.trigger);
    if (hit && !ui.announced.has(cp.id)) {
      ui.announced.add(cp.id);
      ui.spawn = applyCheckpoint(ui.spawn || { x: world.spawn.x, y: world.spawn.y }, cp);
      if (cp.real && ui.seenReal.has(cp.id)) continue;
      if (cp.real) ui.seenReal.add(cp.id);
      addNote(checkpointLine(cp), cp.real ? "ink" : "red");
      if (cp.real) audio.realSave();
      else {
        audio.fakeSave();
        ui.calm = Math.max(0, ui.calm - 6);
      }
    }
  }

  if (world.dead) onDeath();
  else if (world.reachedFake) {
    ui.mode = "fakewin";
    ui.modeT = 0;
    ui.stamp = { text: "合格", t: 0, crossed: false, sub: "" };
    audio.fakeWin();
    for (let i = 0; i < 28; i++) {
      ui.confetti.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 80,
        vy: 40 + Math.random() * 80,
        r: Math.random() * 3,
        color: i % 2 ? "#b4332a" : "#1c140f",
      });
    }
  } else if (world.reachedGoal) {
    commitClear();
    ui.mode = "realwin";
    ui.modeT = 0;
    ui.stamp = { text: "合格", t: 0, crossed: false, sub: "" };
    audio.realWin();
  }
}

function frame(now) {
  if (!canvas.width) resize();
  const dt = Math.min(0.05, (now - frame.last) / 1000 || 0);
  frame.last = now;
  if (ui.mode === "play" || ui.mode === "dead" || ui.mode === "fakewin" || ui.mode === "realwin") {
    frame.acc += dt;
    let guard = 0;
    while (frame.acc >= STEP && guard++ < 5) {
      frame.acc -= STEP;
      tick(STEP);
    }
    if (guard >= 5) frame.acc = 0;
    if (ui.world && ui.mode !== "result") {
      const target = placeCamera(false);
      ui.camX = damp(ui.camX, target.x, dt, 8);
      ui.camY = damp(ui.camY, target.y, dt, 8);
      updateHud();
      drawFrame(ctx, {
        world: ui.world,
        camX: ui.camX,
        camY: ui.camY,
        viewW: ui.viewW,
        viewH: ui.viewH,
        scale: ui.scale,
        fx: {
          shake: ui.shake,
          calm: ui.calm,
          marks: ui.marks,
          particles: ui.particles,
          confetti: ui.confetti,
          stamp: ui.stamp,
          bestY: ui.bestY[ui.world.actId] ?? null,
          streak: ui.spotStreak,
        },
      });
    }
  }
  requestAnimationFrame(frame);
}
frame.last = performance.now();
frame.acc = 0;

function bindHold(button, key) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    input[key] = true;
    button.setPointerCapture(event.pointerId);
  });
  const release = () => {
    input[key] = false;
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
}

function askQuit(open) {
  ui.quitAsk = open;
  el.quitBar.hidden = !open;
}

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) event.preventDefault();
  if (event.code === "ArrowLeft" || event.code === "KeyA") input.keyL = true;
  if (event.code === "ArrowRight" || event.code === "KeyD") input.keyR = true;
  if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyZ" || event.code === "KeyW") {
    input.keyJ = true;
  }
  if (event.code === "Escape") askQuit(!ui.quitAsk);
});
window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") input.keyL = false;
  if (event.code === "ArrowRight" || event.code === "KeyD") input.keyR = false;
  if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyZ" || event.code === "KeyW") input.keyJ = false;
});

canvas.addEventListener("pointerdown", () => {
  audio.unlock();
  input.pointerJ = true;
});
window.addEventListener("pointerup", () => {
  input.pointerJ = false;
});

bindHold(document.querySelector("#btn-left"), "padL");
bindHold(document.querySelector("#btn-right"), "padR");
bindHold(document.querySelector("#btn-jump"), "padJ");

document.querySelector("#start").addEventListener("click", () => begin(false));
el.coverRetest.addEventListener("click", () => begin(true));
el.resultRetest.addEventListener("click", () => begin(true));
document.querySelector("#result-cover").addEventListener("click", () => {
  ui.mode = "title";
  refreshCover();
  show("title");
});
el.coverWipe.addEventListener("click", () => {
  localStorage.removeItem(SAVE_KEY);
  ui.totalDeaths = 0;
  ui.clears = 0;
  ui.retestClears = 0;
  ui.bestGrade = null;
  ui.bestY = {};
  refreshCover();
});
el.mute.addEventListener("click", () => {
  setMuted(el.mute.dataset.muted !== "1");
  persist();
});
document.querySelector("#btn-quit").addEventListener("click", () => askQuit(true));
document.querySelector("#quit-no").addEventListener("click", () => askQuit(false));
document.querySelector("#quit-yes").addEventListener("click", () => {
  persist();
  ui.mode = "title";
  ui.world = null;
  askQuit(false);
  refreshCover();
  show("title");
});

window.addEventListener("resize", resize);
loadSave();
refreshCover();
resize();
requestAnimationFrame(frame);

window.__IRAIRA = {
  ui,
  begin,
  respawn,
  teleport(x, y) {
    const p = ui.world.player;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.onGround = true;
  },
};
