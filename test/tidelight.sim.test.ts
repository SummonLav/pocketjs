// test/tidelight.sim.test.ts — TIDELIGHT under the deterministic sim host.
//
// The cafe journey (test/sim.test.ts) proves the architecture on an app-shaped
// app; this one proves it on a GAME: timed choices, QTE windows, an effect-
// shell "wire", meter arithmetic, and a branching story that ends somewhere
// specific. The tape is the obedient-machine run — press confirm on every
// half-second beat and never answer a prompt correctly — which walks the
// report path, fails every QTE forward (fail-forward: misses scar the story,
// they never stop it), and arrives at ENDING 1, GOOD ORDER, with the exact
// meter values asserted below.
//
// Same claims as the cafe suite, on a much longer trajectory:
//   IDENTITY     same tape -> byte-identical pixel trace
//   CHAOS        wall-clock sleeps + GC between frames change nothing
//   SUBSAMPLING  the 4 Hz and 2 Hz worlds are strict subsamples of 60 Hz
//   ALIGNMENT    wire commands/deliveries land at the same virtual second
//                at every rate
//   STORY        the run actually reached the asserted ending (tree probe),
//                and the story graph itself is closed (validateStory).

import { describe, expect, test } from "bun:test";
import { runScenario, treeHasText, type Trace } from "../host-sim/sim.ts";
import { BTN } from "../spec/spec.ts";
import { validateStory } from "../demos/tidelight/engine.ts";

const SECONDS = 54; // verdict settles at 49.0 s; the tail is static screen

// The obedient-machine tape: START, then confirm once every second. Extra
// confirms are no-ops on waiting nodes; on choices they take the top option
// (by design always the one the Authority would pick); during QTEs the
// confirm is the WRONG button, so every set piece fails forward.
//
// Cadence note: a sim press is a one-frame pulse, so at 2 Hz two same-button
// events half a second apart occupy CONSECUTIVE frames and merge into a hold
// — edge detection then sees one press. Same-button events must sit >= 1
// virtual second apart to stay distinct pulses at every rate down to 2 Hz
// (the cafe journey solves this by alternating buttons instead).
const JOURNEY = (() => {
  const script: { at: number; press: number }[] = [{ at: 1.0, press: BTN.START }];
  for (let at = 2.0; at < SECONDS - 0.5; at += 1.0) script.push({ at, press: BTN.CIRCLE });
  return script;
})();

const scenario = (hz: number) => ({ app: "tidelight-main", hz, seconds: SECONDS, script: JOURNEY });

const t60: Trace = await runScenario(scenario(60));
const t4: Trace = await runScenario(scenario(4));
const t2: Trace = await runScenario(scenario(2));

describe("tidelight: story data", () => {
  test("the node graph is closed, reachable, and chart-consistent", () => {
    expect(validateStory()).toEqual([]);
  });
});

describe("tidelight: determinism", () => {
  test("same tape, same night: repeat runs are hash-identical", async () => {
    const again = await runScenario(scenario(60));
    expect(again.hashes).toEqual(t60.hashes);
    expect(again.effects).toEqual(t60.effects);
  });

  test("chaos cannot reach the tower: sleeps + garbage + GC change nothing", async () => {
    const chaos = await runScenario(scenario(4), { maxSleepMs: 6, gcEvery: 32 });
    expect(chaos.hashes).toEqual(t4.hashes);
    expect(chaos.effects).toEqual(t4.effects);
  });

  test("the low-rate worlds are strict subsamples of the 60 Hz world", () => {
    for (const t of [t4, t2]) {
      const k = 60 / t.hz;
      for (let m = 0; m < t.frames; m++) {
        expect(t.hashes[m]).toBe(t60.hashes[k * (m + 1) - 1]);
      }
    }
  });

  test("the wire lands at the same virtual second at every rate", () => {
    const seconds = (t: Trace) => t.effects.map((e) => ({ t: e.t as string, kind: e.kind, sec: e.frame / t.hz }));
    // Two transmissions: night one and night two. Night three has no wire —
    // the Inspector arrives in person.
    const want = [
      { t: "command", kind: "wire", sec: 4.0 },
      { t: "delivery", kind: "wire", sec: 5.0 },
      { t: "command", kind: "wire", sec: 29.5 },
      { t: "delivery", kind: "wire", sec: 30.5 },
    ];
    expect(seconds(t60)).toEqual(want);
    expect(seconds(t4)).toEqual(want);
    expect(seconds(t2)).toEqual(want);
  });

  test("the settled ending screen is byte-equal across rates", () => {
    expect(Buffer.from(t4.finalFrame).equals(Buffer.from(t60.finalFrame))).toBe(true);
    expect(Buffer.from(t2.finalFrame).equals(Buffer.from(t60.finalFrame))).toBe(true);
  });
});

describe("tidelight: the night actually happened", () => {
  test("the obedient run reports her, fails the storms, ends in good order", () => {
    for (const t of [t60, t2]) {
      expect(treeHasText(t.tree, "ENDING 1 OF 6")).toBe(true);
      expect(treeHasText(t.tree, "GOOD ORDER")).toBe(true);
      // Every QTE missed: the lamp drowned both storm nights.
      expect(treeHasText(t.tree, "THE LAMP: DARK TWO NIGHTS")).toBe(true);
      expect(treeHasText(t.tree, "MAREN VOSS: TAKEN IN IRONS")).toBe(true);
      // 100, -5 the stew, -10 each drowned lamp: the ledger price of mercy.
      expect(treeHasText(t.tree, "DIRECTIVE INTEGRITY: 75%")).toBe(true);
    }
  });
});
