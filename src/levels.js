/**
 * 右上へだけ進む試験用紙。足場は重ねない。
 * 届く距離はランニングで約167px、その場で約92px。
 * イライラは乱数ではなく、嘘、偽セーブ、偽ゴール、端の数px。
 */

const H = 22;

function P(id, x, y, w, kind = "solid") {
  return { id, x, y, w, h: H, kind };
}

/** gap と rise は「次の足場まで」。 */
export function chain(rows, origin = { x: 96, y: 2800 }) {
  let x = origin.x;
  let y = origin.y;
  const platforms = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    platforms.push(P(row.id, x, y, row.w, row.kind || "solid"));
    if (i < rows.length - 1) {
      x += row.w + row.gap;
      y -= row.rise;
    }
  }
  return platforms;
}

export function linksOf(rows, moverId = "m1") {
  const links = [];
  for (let i = 0; i < rows.length - 1; i++) {
    if (rows[i].ride) links.push({ type: "ride", from: rows[i].id, mover: moverId, to: rows[i + 1].id });
    else links.push([rows[i].id, rows[i + 1].id]);
  }
  return links;
}

function byId(platforms, id) {
  const p = platforms.find((item) => item.id === id);
  if (!p) throw new Error(`missing ${id}`);
  return p;
}

function sign(platforms, id, text, dx = 10, dy = -96) {
  const p = byId(platforms, id);
  return { x: p.x + dx, y: p.y + dy, text };
}

function checkpoint(platforms, id, opts) {
  const p = byId(platforms, id);
  const shiny = opts.style === "shiny";
  return {
    id: opts.id,
    real: opts.real,
    style: opts.style,
    dot: !!opts.dot,
    official: !!opts.official,
    x: p.x + (shiny ? p.w * 0.55 : 18),
    y: p.y - (shiny ? 92 : 74),
    w: shiny ? 36 : 24,
    h: shiny ? 92 : 74,
    trigger: { x: p.x, y: p.y - 46, w: p.w, h: 46 },
    spawn: { x: p.x + 28, y: p.y - 40 },
  };
}

function gapSpike(platforms, fromId, toId) {
  const a = byId(platforms, fromId);
  const b = byId(platforms, toId);
  const x = a.x + a.w + 12;
  const w = b.x - x - 12;
  return { x, y: Math.max(a.y, b.y) + 46, w: Math.max(24, w), h: 16 };
}

export const ACT1_ROWS = [
  { id: "a0", w: 260, gap: 64, rise: 36 },
  { id: "a1", w: 220, gap: 112, rise: 40 },
  { id: "a2", w: 200, gap: 60, rise: 22 },
  { id: "c1", w: 130, gap: 56, rise: 18, kind: "crumble" },
  { id: "c2", w: 130, gap: 52, rise: 18, kind: "crumble" },
  { id: "c3", w: 140, gap: 48, rise: 32, kind: "crumble" },
  { id: "a3", w: 230, gap: 76, rise: 48 },
  { id: "ice", w: 280, gap: 84, rise: 36, kind: "ice" },
  { id: "preM", w: 200, gap: 250, rise: 0, ride: true },
  { id: "postM", w: 210, gap: 48, rise: 64 },
  { id: "up1", w: 220, gap: 40, rise: 56 },
  { id: "up2", w: 260, gap: 132, rise: 0 },
  { id: "hardR", w: 210, gap: 42, rise: 60 },
  { id: "summit", w: 300, gap: 0, rise: 0 },
];

export const ACT1_LINKS = linksOf(ACT1_ROWS);

export function createAct1() {
  const platforms = chain(ACT1_ROWS);
  const pre = byId(platforms, "preM");
  const post = byId(platforms, "postM");
  const moverW = 112;
  const farGap = 54;
  const summit = byId(platforms, "summit");
  const first = platforms[0];
  const last = platforms[platforms.length - 1];
  return {
    id: "act1",
    title: "第1問",
    platforms,
    movers: [
      {
        id: "m1",
        y: pre.y,
        w: moverW,
        h: H,
        minX: pre.x + pre.w + 8,
        maxX: post.x - farGap - moverW,
        period: 2.5,
        phase: 0,
      },
    ],
    spikes: [
      gapSpike(platforms, "a1", "a2"),
      gapSpike(platforms, "preM", "postM"),
      gapSpike(platforms, "up2", "hardR"),
    ],
    winds: [],
    decoys: [
      {
        id: "decoy",
        x: pre.x + pre.w + 78,
        y: pre.y - 54,
        w: 92,
        h: 16,
      },
    ],
    signs: [
      sign(platforms, "a0", "スペースで跳ぶ。高さは一定。"),
      sign(platforms, "a1", "この下は安全地帯"),
      sign(platforms, "a2", "足場は固定されています"),
      sign(platforms, "preM", "点線の足場を使うこと"),
      sign(platforms, "ice", "凍結は演出です"),
      sign(platforms, "up2", "この幅が基準点です"),
      sign(platforms, "summit", "ゴール。触れれば終了"),
    ],
    checkpoints: [
      checkpoint(platforms, "a3", { id: "cpA3", real: true, style: "humble", dot: true }),
      checkpoint(platforms, "up1", { id: "cpUp1", real: true, style: "humble", dot: true }),
      checkpoint(platforms, "up2", { id: "cpFake", real: false, style: "shiny", dot: false }),
    ],
    fakeGoal: { x: summit.x + summit.w - 96, y: summit.y - 86, w: 52, h: 86 },
    goal: null,
    rulers: [],
    killY: first.y + 260,
    progressBottom: first.y,
    progressTop: last.y,
    spawn: { x: first.x + 36, y: first.y - 40 },
    spawnGround: first.id,
  };
}

export function act2Rows(extra = 0) {
  return [
    { id: "b0", w: 320, gap: 74, rise: 0 },
    { id: "b1", w: 230, gap: 52, rise: 48 },
    { id: "step1", w: 190, gap: 46, rise: 44 },
    { id: "step2", w: 210, gap: 40, rise: 32 },
    { id: "run", w: 340, gap: 150 + extra, rise: 0 },
    { id: "land", w: 220, gap: 46, rise: 52 },
    { id: "goalFloor", w: 240, gap: 0, rise: 0 },
  ];
}

export function createAct2({ retest = false } = {}) {
  const rows = act2Rows(retest ? 8 : 0);
  const platforms = chain(rows, { x: 96, y: 2200 });
  const b0 = byId(platforms, "b0");
  const b1 = byId(platforms, "b1");
  const goalFloor = byId(platforms, "goalFloor");
  const first = platforms[0];
  const last = platforms[platforms.length - 1];
  return {
    id: "act2",
    title: retest ? "再試験" : "追加問題",
    retest,
    platforms,
    movers: [],
    spikes: [gapSpike(platforms, "b0", "b1"), gapSpike(platforms, "run", "land")],
    winds: [
      {
        x: b0.x + b0.w - 150,
        y: b0.y - 150,
        w: b1.x + 36 - (b0.x + b0.w - 150),
        h: 230,
        ax: -220,
        capDelta: -110,
      },
    ],
    decoys: [],
    signs: [
      sign(platforms, "b0", retest ? "同一問題です" : "追加問題。難易度は同一です。"),
      sign(platforms, "b0", "風は印刷のにじみです", 168, -128),
      sign(platforms, "goalFloor", "答案提出"),
    ],
    checkpoints: [
      checkpoint(platforms, "b1", { id: "cpB1", real: true, style: "shiny", dot: true }),
      checkpoint(platforms, "step2", { id: "cpStep", real: true, style: "humble", dot: true }),
      checkpoint(platforms, "run", { id: "cpRun", real: false, style: "humble", dot: false, official: true }),
    ],
    fakeGoal: null,
    goal: { x: goalFloor.x + goalFloor.w - 88, y: goalFloor.y - 84, w: 50, h: 84 },
    rulers: [
      { id: "wind", from: "b0", to: "b1", label: "40px" },
      { id: "final", from: "run", to: "land", label: "1mm" },
    ],
    killY: first.y + 260,
    progressBottom: first.y,
    progressTop: last.y,
    spawn: { x: first.x + 36, y: first.y - 40 },
    spawnGround: first.id,
  };
}

export const ACT2_LINKS = linksOf(act2Rows());
