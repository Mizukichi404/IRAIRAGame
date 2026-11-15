import { test } from "node:test";
import assert from "node:assert/strict";
import { createAct1, createAct2, ACT1_LINKS, ACT2_LINKS } from "../src/levels.js";
import { PHYS, createWorld, placeOn, step } from "../src/sim.js";
import { attemptJump, attemptRide, jumpAt } from "./solve.js";
import { applyCheckpoint, gradeFor, pickNote, betterGrade } from "../src/notes.js";

function assertRoute(act, links) {
  for (const link of links) {
    if (Array.isArray(link)) {
      const r = attemptJump(act, link[0], link[1]);
      assert.ok(r.ok, `${act.id} ${link[0]}→${link[1]} ${r.reason || ""} closest=${r.closest}`);
    } else {
      const r = attemptRide(act, link.from, link.mover, link.to);
      assert.ok(r.ok, `${act.id} ride ${link.from}→${link.to} ${JSON.stringify(r)}`);
    }
  }
}

function standingJump(act, fromId, toId) {
  const world = createWorld(act);
  const from = world.platforms.find((p) => p.id === fromId);
  placeOn(world, fromId, from.x + from.w - PHYS.width - 2);
  let air = false;
  for (let i = 0; i < 140; i++) {
    step(world, { dir: 1, jump: true });
    if (!world.player.onGround) air = true;
    if (world.dead) return false;
    if (air && world.player.onGround && world.player.groundId === toId) return true;
  }
  return false;
}

test("act 1 route is possible", () => {
  assertRoute(createAct1(), ACT1_LINKS);
});

test("act 2 route is possible, including the retest", () => {
  assertRoute(createAct2(), ACT2_LINKS);
  assertRoute(createAct2({ retest: true }), ACT2_LINKS);
});

test("the last gap is a running jump and not a standing one", () => {
  for (const retest of [false, true]) {
    const act = createAct2({ retest });
    const edge = jumpAt(act, "run", "land", 0);
    const early = jumpAt(act, "run", "land", 34);
    assert.ok(edge.ok, `edge should land retest=${retest} ${edge.cause}`);
    assert.equal(early.ok, false, `early takeoff should miss retest=${retest}`);
    assert.equal(standingJump(act, "run", "land"), false);
  }
});

test("the wind gap asks for a run", () => {
  const act = createAct2();
  assert.equal(standingJump(act, "b0", "b1"), false);
  assert.ok(attemptJump(act, "b0", "b1").ok);
});

test("checkpoint lies do not move the spawn", () => {
  const spawn = { x: 1, y: 2 };
  const fake = { real: false, spawn: { x: 9, y: 9 } };
  const real = { real: true, spawn: { x: 4, y: 5 } };
  assert.deepEqual(applyCheckpoint(spawn, fake), spawn);
  assert.deepEqual(applyCheckpoint(spawn, real), { x: 4, y: 5 });
});

test("near misses are worded as a fixable error", () => {
  const note = pickNote({ deaths: 3, shortfall: 7, takeoffGap: 22, cutJump: false, streak: 2 });
  assert.match(note.text, /7px/);
  assert.match(note.text, /22px/);
  const first = pickNote({ deaths: 1, shortfall: null, takeoffGap: null, cutJump: false, streak: 1 });
  assert.match(first.text, /1回目/);
  assert.equal(gradeFor(0).id, "A");
  assert.equal(gradeFor(40).id, "E");
  assert.equal(betterGrade("C", "A"), "A");
  assert.equal(betterGrade("B", "D"), "B");
});
