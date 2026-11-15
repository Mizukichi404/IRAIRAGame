import { PHYS, STEP, createWorld, placeOn, step } from "../src/sim.js";

function body(world, id) {
  return world.platforms.find((p) => p.id === id) || world.movers.find((m) => m.id === id);
}

/**
 * Try to jump from one solid platform to another.
 * Returns the first successful control sample.
 */
export function attemptJump(act, fromId, toId, { stepPx = 6, maxTime = 2.4 } = {}) {
  const probe = createWorld(act);
  const from = body(probe, fromId);
  const to = body(probe, toId);
  if (!from || !to) return { ok: false, reason: "missing" };
  const dir = to.x + to.w / 2 >= from.x + from.w / 2 ? 1 : -1;
  const minX = from.x + 2;
  const maxX = from.x + from.w - PHYS.width - 2;
  if (maxX < minX) return { ok: false, reason: "narrow" };

  const starts = unique([minX, (minX + maxX) / 2, Math.max(minX, maxX - 30)]);
  const takeoffs = [];
  for (let x = minX; x <= maxX; x += stepPx) takeoffs.push(x);
  takeoffs.push(maxX);
  const holds = ["full", 5, 9, 14, 22];

  let closest = Infinity;
  for (const startX of starts) {
    for (const takeoff of takeoffs) {
      for (const hold of holds) {
        const result = runJump(act, fromId, toId, { startX, takeoff, hold, dir, maxTime });
        if (result.dist < closest) closest = result.dist;
        if (result.ok) return { ok: true, startX, takeoff, hold, dir, dist: result.dist };
      }
    }
  }
  return { ok: false, reason: "unreachable", closest };
}

function unique(xs) {
  return [...new Set(xs.map((n) => Math.round(n * 10) / 10))];
}

/** Full-hop from the lip, or `earlyPx` short of it. dir > 0 runs right. */
export function jumpAt(act, fromId, toId, earlyPx) {
  const world = createWorld(act);
  const from = body(world, fromId);
  const dir = toDir(world, from, toId);
  const lip = dir > 0 ? from.x + from.w - PHYS.width - 2 : from.x + 2;
  const takeoff = dir > 0 ? lip - earlyPx : lip + earlyPx;
  const startX = dir > 0 ? from.x + 4 : from.x + from.w - PHYS.width - 4;
  return runJump(act, fromId, toId, { startX, takeoff, hold: "full", dir, maxTime: 2.2 });
}

function toDir(world, from, toId) {
  const to = body(world, toId);
  return to.x + to.w / 2 >= from.x + from.w / 2 ? 1 : -1;
}

function runJump(act, fromId, toId, { startX, takeoff, hold, dir, maxTime }) {
  const world = createWorld(act);
  placeOn(world, fromId, startX);
  let airborne = false;
  let heldFrames = 0;
  let jumping = false;
  let closest = Infinity;
  const frames = Math.ceil(maxTime / STEP);
  for (let i = 0; i < frames; i++) {
    const p = world.player;
    const crossed = dir > 0 ? p.x >= takeoff : p.x <= takeoff;
    if (!jumping && !airborne && p.onGround && crossed) jumping = true;
    const jump = jumping && (hold === "full" || heldFrames < hold);
    if (jump) heldFrames++;
    step(world, { dir, jump });
    if (!p.onGround) airborne = true;
    const target = body(world, toId);
    if (target) {
      const dx = p.x + p.w / 2 - (target.x + target.w / 2);
      const dy = p.y + p.h - target.y;
      closest = Math.min(closest, Math.hypot(dx, dy));
    }
    if (world.dead) return { ok: false, dist: closest, cause: world.deathCause };
    if (airborne && p.onGround && p.groundId === toId) return { ok: true, dist: closest };
    if (airborne && (world.reachedGoal || world.reachedFake)) return { ok: false, dist: closest, cause: "trigger" };
  }
  return { ok: false, dist: closest, cause: "timeout" };
}

/** Ride a mover: first prove you can board it, then that some ride can reach `toId`. */
export function attemptRide(act, fromId, moverId, toId) {
  const actMover = (act.movers || []).find((m) => m.id === moverId);
  if (!actMover) return { ok: false, reason: "missing-mover" };
  const board = canBoard(act, fromId, moverId, actMover.period);
  const exit = canExit(act, moverId, toId, actMover.period);
  return { ok: board.ok && exit.ok, board, exit };
}

function canBoard(act, fromId, moverId, period) {
  const slices = 18;
  for (let s = 0; s < slices; s++) {
    const t0 = (period * s) / slices;
    const world0 = createWorld(act);
    const from = body(world0, fromId);
    const dir = 1;
    const minX = from.x + 2;
    const maxX = from.x + from.w - PHYS.width - 2;
    for (let takeoff = minX; takeoff <= maxX; takeoff += 10) {
      const world = createWorld(act);
      world.t = t0;
      syncMovers(world);
      placeOn(world, fromId, minX);
      let jumping = false;
      let airborne = false;
      for (let i = 0; i < 150; i++) {
        const p = world.player;
        if (!jumping && p.onGround && p.x >= takeoff) jumping = true;
        step(world, { dir, jump: jumping });
        if (!p.onGround) airborne = true;
        if (world.dead) break;
        if (airborne && p.onGround && p.groundId === moverId) return { ok: true, t0, takeoff };
      }
    }
  }
  return { ok: false };
}

function canExit(act, moverId, toId, period) {
  const to = createWorld(act);
  const target = body(to, toId);
  const dir = 1;
  if (target.x + target.w / 2 < 360) dir;
  const slices = 20;
  for (let s = 0; s < slices; s++) {
    const t0 = (period * s) / slices;
    for (const offset of [8, 30, 60]) {
      for (const delay of [0, 6, 14, 24, 36, 50]) {
        const world = createWorld(act);
        world.t = t0;
        syncMovers(world);
        const m = body(world, moverId);
        const x = Math.min(m.x + offset, m.x + m.w - PHYS.width - 2);
        placeOn(world, moverId, x);
        let airborne = false;
        for (let i = 0; i < 160; i++) {
          const jump = i >= delay;
          const want = target.x + target.w / 2 >= world.player.x ? 1 : -1;
          step(world, { dir: want, jump });
          if (!world.player.onGround) airborne = true;
          if (world.dead) break;
          if (airborne && world.player.onGround && world.player.groundId === toId) {
            return { ok: true, t0, offset, delay };
          }
        }
      }
    }
  }
  return { ok: false };
}

function syncMovers(world) {
  for (const m of world.movers) {
    const u = 0.5 - 0.5 * Math.cos((Math.PI * 2 * world.t) / m.period + (m.phase || 0));
    m.x = m.minX + (m.maxX - m.minX) * u;
    m.prevX = m.x;
  }
}

/** Farthest same-height gap a full running jump can bridge. Monotonic search. */
export function maxSameHeightGap({ rise = 0, wind = null, standing = false } = {}) {
  let lo = 40;
  let hi = 210;
  let best = 0;
  while (lo <= hi) {
    const gap = Math.round((lo + hi) / 2);
    const act = gapAct(gap, rise, wind);
    const ok = standing ? standingReach(act) : attemptJump(act, "L", "R", { stepPx: 8, maxTime: 1.8 }).ok;
    if (ok) {
      best = Math.max(best, gap);
      lo = gap + 1;
    } else {
      hi = gap - 1;
    }
  }
  return best;
}

function gapAct(gap, rise, wind) {
  const y = 400 - rise;
  const act = {
    id: "gap",
    spawn: { x: 40, y: 400 - PHYS.height },
    spawnGround: "L",
    killY: 900,
    progressBottom: 400,
    progressTop: 0,
    platforms: [
      { id: "L", x: 40, y: 400, w: 280, h: 22, kind: "solid" },
      { id: "R", x: 40 + 280 + gap, y, w: 220, h: 22, kind: "solid" },
    ],
    spikes: [],
    winds: wind ? [{ x: 300, y: 200, w: gap + 80, h: 260, ...wind }] : [],
    movers: [],
  };
  return act;
}

function standingReach(act) {
  const world = createWorld(act);
  const from = body(world, "L");
  placeOn(world, "L", from.x + from.w - PHYS.width - 2);
  let airborne = false;
  for (let i = 0; i < 120; i++) {
    step(world, { dir: 1, jump: true });
    if (!world.player.onGround) airborne = true;
    if (world.dead) return false;
    if (airborne && world.player.onGround && world.player.groundId === "R") return true;
  }
  return false;
}
