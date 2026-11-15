/** Fixed-step platform physics. Deterministic: same inputs, same result. */

export const PHYS = {
  gravity: 2100,
  jumpV: -700,
  maxRun: 250,
  accel: 1100,
  airAccel: 420,
  friction: 1600,
  iceAccel: 460,
  iceFriction: 240,
  coyote: 0.06,
  jumpBuffer: 0.09,
  jumpCut: 0.45,
  maxFall: 1050,
  width: 26,
  height: 40,
};

export const WORLD_W = 720;
export const STEP = 1 / 60;

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function createWorld(act, spawnOverride) {
  const spawn = spawnOverride || act.spawn;
  const platforms = act.platforms.map((p) => ({
    ...p,
    h: p.h ?? 22,
    alive: true,
    stand: 0,
    life: p.life ?? 0.85,
    fall: 0,
  }));
  let minX = 0;
  let maxX = 480;
  let minY = 0;
  let maxY = 800;
  for (const p of platforms) {
    minX = Math.min(minX, p.x - 160);
    maxX = Math.max(maxX, p.x + p.w + 160);
    minY = Math.min(minY, p.y - 520);
    maxY = Math.max(maxY, p.y + 480);
  }
  platforms.push(
    { id: "wallL", x: minX, y: minY - 4000, w: 32, h: maxY - minY + 8000, kind: "solid", hidden: true, alive: true, stand: 0, life: 0, fall: 0 },
    { id: "wallR", x: maxX - 32, y: minY - 4000, w: 32, h: maxY - minY + 8000, kind: "solid", hidden: true, alive: true, stand: 0, life: 0, fall: 0 },
  );
  const movers = (act.movers || []).map((m) => {
    const phase = m.phase || 0;
    const u = 0.5 - 0.5 * Math.cos(phase);
    const x = m.minX + (m.maxX - m.minX) * u;
    return {
      ...m,
      h: m.h ?? 22,
      kind: "mover",
      alive: true,
      x,
      prevX: x,
      y: m.y,
    };
  });
  return {
    actId: act.id,
    title: act.title,
    platforms,
    movers,
    spikes: (act.spikes || []).map((s) => ({ ...s })),
    winds: (act.winds || []).map((w) => ({ ...w })),
    checkpoints: (act.checkpoints || []).map((c) => ({ ...c, inside: false })),
    signs: act.signs || [],
    decoys: (act.decoys || []).map((d) => ({ ...d })),
    rulers: (act.rulers || []).map((r) => ({ ...r })),
    goal: act.goal ? { ...act.goal } : null,
    fakeGoal: act.fakeGoal ? { ...act.fakeGoal } : null,
    ruler: act.ruler || null,
    killY: act.killY,
    progressBottom: act.progressBottom,
    progressTop: act.progressTop,
    minX,
    maxX,
    minY,
    maxY,
    spawn: { x: spawn.x, y: spawn.y },
    player: {
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      w: PHYS.width,
      h: PHYS.height,
      onGround: true,
      groundId: act.spawnGround || null,
      coyote: PHYS.coyote,
      jumpBuffer: 0,
      jumpHeld: false,
      facing: 1,
      rising: false,
      cutJump: false,
      takeoffGap: null,
      lastGroundId: act.spawnGround || null,
    },
    t: 0,
    dead: false,
    deathCause: null,
    reachedGoal: false,
    reachedFake: false,
    trail: [],
    jumped: false,
    landed: false,
  };
}

function findBody(world, id) {
  if (!id) return null;
  return world.platforms.find((p) => p.id === id) || world.movers.find((m) => m.id === id) || null;
}

function windAt(world, player) {
  let ax = 0;
  let capDelta = 0;
  const box = player;
  for (const z of world.winds) {
    if (overlaps(box, z)) {
      ax += z.ax || 0;
      capDelta += z.capDelta || 0;
    }
  }
  return { ax, capDelta };
}

/**
 * @param {ReturnType<typeof createWorld>} world
 * @param {{ dir?: number, jump?: boolean }} input
 * @param {number} dt
 */
export function step(world, input, dt = STEP) {
  const player = world.player;
  const dir = input.dir || 0;
  const jump = !!input.jump;
  world.jumped = false;
  world.landed = false;
  if (world.dead || world.reachedGoal || world.reachedFake) return world;

  world.t += dt;
  for (const m of world.movers) {
    m.prevX = m.x;
    const u = 0.5 - 0.5 * Math.cos((Math.PI * 2 * world.t) / m.period + (m.phase || 0));
    m.x = m.minX + (m.maxX - m.minX) * u;
  }
  const riding = world.movers.find((m) => m.id === player.groundId);
  if (riding && player.onGround) player.x += riding.x - riding.prevX;

  const pressed = jump && !player.jumpHeld;
  if (pressed) player.jumpBuffer = PHYS.jumpBuffer;
  else player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

  const canJump = player.onGround || player.coyote > 0;
  if (player.jumpBuffer > 0 && canJump) {
    const ground = findBody(world, player.groundId);
    if (ground) {
      if (player.vx >= 0) player.takeoffGap = ground.x + ground.w - (player.x + player.w);
      else player.takeoffGap = player.x - ground.x;
    } else {
      player.takeoffGap = null;
    }
    player.vy = PHYS.jumpV;
    player.onGround = false;
    player.groundId = null;
    player.jumpBuffer = 0;
    player.coyote = 0;
    player.rising = true;
    player.cutJump = false;
    player.jumped = true;
    world.jumped = true;
  }
  player.jumpHeld = jump;

  if (player.rising && !jump && player.vy < 0) {
    player.vy *= PHYS.jumpCut;
    player.rising = false;
    player.cutJump = true;
  }

  if (dir !== 0) player.facing = dir > 0 ? 1 : -1;
  const groundNow = player.onGround ? findBody(world, player.groundId) : null;
  const ice = groundNow?.kind === "ice";
  const accel = player.onGround ? (ice ? PHYS.iceAccel : PHYS.accel) : PHYS.airAccel;

  if (dir !== 0) {
    const target = dir * PHYS.maxRun;
    if (player.vx < target) player.vx = Math.min(target, player.vx + accel * dt);
    else player.vx = Math.max(target, player.vx - accel * dt);
  } else if (player.onGround) {
    const f = ice ? PHYS.iceFriction : PHYS.friction;
    if (player.vx > 0) player.vx = Math.max(0, player.vx - f * dt);
    else player.vx = Math.min(0, player.vx + f * dt);
  }

  const wind = windAt(world, player);
  if (wind.ax) player.vx += wind.ax * dt;
  const cap = PHYS.maxRun + Math.min(0, wind.capDelta);
  if (player.vx > cap) player.vx = cap;
  if (player.vx < -PHYS.maxRun + Math.min(0, wind.capDelta)) {
    player.vx = -PHYS.maxRun + Math.min(0, wind.capDelta);
  }

  player.x += player.vx * dt;
  for (const p of world.platforms) {
    if (!p.alive) continue;
    if (!overlaps(player, p)) continue;
    if (player.vx > 0) player.x = p.x - player.w;
    else if (player.vx < 0) player.x = p.x + p.w;
    else {
      const pushLeft = player.x + player.w - p.x;
      const pushRight = p.x + p.w - player.x;
      player.x += pushLeft < pushRight ? -pushLeft : pushRight;
    }
    player.vx = 0;
  }

  const prevY = player.y;
  player.vy = Math.min(PHYS.maxFall, player.vy + PHYS.gravity * dt);
  player.y += player.vy * dt;
  const prevBottom = prevY + player.h;
  const wasGround = player.onGround;
  player.onGround = false;
  let landedId = null;

  const bodies = [...world.platforms.filter((p) => p.alive), ...world.movers];
  for (const p of bodies) {
    if (!overlaps(player, p)) continue;
    const oneWay = p.kind === "mover";
    if (player.vy >= 0 && prevBottom <= p.y + 5) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
      landedId = p.id;
      player.rising = false;
    } else if (!oneWay && player.vy < 0 && prevY >= p.y + p.h - 5) {
      player.y = p.y + p.h;
      player.vy = 0;
      player.rising = false;
    }
  }
  if (landedId) {
    player.groundId = landedId;
    player.lastGroundId = landedId;
    if (!wasGround) world.landed = true;
  } else {
    player.groundId = null;
  }

  if (player.onGround) player.coyote = PHYS.coyote;
  else player.coyote = Math.max(0, player.coyote - dt);

  const stood = player.onGround ? player.groundId : null;
  for (const p of world.platforms) {
    if (p.kind !== "crumble" || !p.alive) continue;
    if (p.id === stood) {
      p.stand += dt;
      if (p.stand >= p.life) {
        p.alive = false;
        p.fall = 0;
        player.onGround = false;
        player.groundId = null;
        player.coyote = 0;
      }
    } else {
      p.stand = 0;
    }
  }
  for (const p of world.platforms) {
    if (p.kind === "crumble" && !p.alive) p.fall += dt;
  }

  for (const s of world.spikes) {
    if (overlaps(player, s)) {
      world.dead = true;
      world.deathCause = "spike";
    }
  }
  if (player.y > world.killY) {
    world.dead = true;
    world.deathCause = world.deathCause || "void";
  }
  if (player.onGround && world.goal && overlaps(player, world.goal)) world.reachedGoal = true;
  if (player.onGround && world.fakeGoal && overlaps(player, world.fakeGoal)) world.reachedFake = true;

  world.trail.push({ x: player.x, y: player.y });
  if (world.trail.length > 48) world.trail.shift();
  return world;
}

export function measureMiss(world) {
  const player = world.player;
  let best = null;
  const bodies = [...world.platforms.filter((p) => p.alive && !p.hidden), ...world.movers];
  for (const s of world.trail) {
    for (const p of bodies) {
      const feet = s.y + player.h;
      const vGap = p.y - feet;
      if (vGap < -8 || vGap > 46) continue;
      let hGap = 0;
      if (s.x + player.w < p.x) hGap = p.x - (s.x + player.w);
      else if (s.x > p.x + p.w) hGap = s.x - (p.x + p.w);
      else continue;
      if (hGap > 40) continue;
      if (best == null || hGap < best.hGap) best = { hGap, x: s.x, y: s.y };
    }
  }
  if (!best) return null;
  return { px: Math.max(1, Math.round(best.hGap)), x: best.x, y: best.y };
}

export function placeOn(world, platformId, x) {
  const p = findBody(world, platformId);
  if (!p) throw new Error(`missing platform ${platformId}`);
  const player = world.player;
  player.x = x;
  player.y = p.y - player.h;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.groundId = p.id;
  player.lastGroundId = p.id;
  player.coyote = PHYS.coyote;
  player.rising = false;
  return p;
}
