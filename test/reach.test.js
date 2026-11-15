import { test } from "node:test";
import assert from "node:assert/strict";
import { maxSameHeightGap } from "./solve.js";

test("running jump reach is a tight but human window", () => {
  const run = maxSameHeightGap({ rise: 0 });
  const stand = maxSameHeightGap({ rise: 0, standing: true });
  const wind = maxSameHeightGap({
    rise: 0,
    wind: { ax: -220, capDelta: -110 },
  });
  console.log(JSON.stringify({ run, stand, wind }));
  assert.ok(run >= 120 && run <= 190, `run reach ${run}`);
  assert.ok(stand < run - 30, `standing ${stand} should lose to running ${run}`);
  assert.ok(wind < run - 15, `wind ${wind} should shorten ${run}`);
});
