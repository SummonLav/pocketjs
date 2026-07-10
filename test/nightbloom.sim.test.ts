// test/nightbloom.sim.test.ts — NIGHTBLOOM under the deterministic sim host.
//
// tidelight proved the architecture on a branching STORY; this one proves it
// on a real-time ACTION game: a 5x9 lane-defense battle simulated in fixed
// 1/60 s micro-ticks (ticksPerFrame() per host frame), with seeded-RNG waves,
// per-tick combat, held-button channeling, and a possession/spell rotation.
//
// Two tapes:
//   THE GARDENER  — a full winning night (170 s): plant, feed, evolve,
//                   possess, channel, switch with L/R, rotate three spell
//                   cards, and hold all five lanes to DAWN with 30 kills.
//   THE SLEEPER   — nobody home (70 s): the horde spends the three wards
//                   and the night goes ETERNAL. Loss mechanics, pinned.
//
// Claims, same as the cafe/tidelight suites but on gameplay:
//   IDENTITY     same tape -> byte-identical pixel trace
//   CHAOS        wall-clock sleeps + GC between frames change nothing
//   SUBSAMPLING  the 4 Hz and 2 Hz worlds are strict subsamples of 60 Hz —
//                the low-rate player plays the SAME battle, gameplay included
//   AUGURY       phase omens ride the effect shell; phase boundaries that
//                fall on the whole-second grid (midnight, witching) land at
//                the same virtual second at every rate; the dusk omen is
//                emitted on battle tick 1 and so lands one frame after the
//                START press at each rate (1 + 1/hz) — the tick-grid
//                quantization, visible and pinned
//   THE NIGHT    the runs actually happened: dawn with the exact kill/ward/
//                bloom ledger, eternal night for the sleeper (tree probes),
//                and the content tables are closed (validateContent)
//
// Tape discipline (cadence rules from the tidelight suite, plus one new one):
//   - event times sit on the 0.5 s grid; same-button events >= 1 s apart;
//   - CIRCLE is pulsed only to possess when NOTHING is possessed (a pulse at
//     2 Hz holds CIRCLE for 30 ticks, which would channel an already-
//     possessed plant differently than at 60 Hz). Switching thereafter uses
//     L/R; sustained fire uses hold events, which are level-triggered and
//     therefore rate-exact.

import { describe, expect, test } from "bun:test";
import { runScenario, treeHasText, type Trace } from "../host-sim/sim.ts";
import { BTN } from "../spec/spec.ts";
import { validateContent } from "../demos/nightbloom/data.ts";

const GARDENER_SECONDS = 170; // dawn settles at 167.1 s
const SLEEPER_SECONDS = 70; // the third ward falls at ~66 s

// The gardener's tape — a full clear of the night, tuned against the seeded
// lanes (r3 opens, r1 is the dusk pressure lane, the kasa walk r4/r0 late).
const GARDENER = [
  { at: 1.0, press: BTN.START },
  { at: 1.5, press: BTN.CROSS }, //  primrose (2,2)
  { at: 2.0, press: BTN.UP },
  { at: 3.0, press: BTN.UP },
  { at: 3.5, press: BTN.CROSS }, //  primrose (0,2) — r0 is quiet all dusk
  { at: 4.5, press: BTN.DOWN },
  { at: 5.5, press: BTN.DOWN },
  { at: 6.5, press: BTN.DOWN },
  { at: 14.5, press: BTN.SQUARE }, // seed: bamboo
  { at: 15.0, press: BTN.CROSS }, //  bamboo1 (3,2) vs the opening wisp
  { at: 16.0, hold: BTN.CIRCLE }, //  possess bamboo1 + channel it
  { at: 21.0, hold: 0 }, //           release the trigger (stay possessed)
  { at: 27.0, press: BTN.UP },
  { at: 28.0, press: BTN.UP },
  { at: 28.5, press: BTN.CROSS }, //  bamboo2 (1,2) vs the r1 press
  { at: 41.0, press: BTN.DOWN },
  { at: 42.0, press: BTN.RIGHT },
  { at: 43.0, press: BTN.SQUARE }, // seed: catnip
  { at: 54.5, press: BTN.CROSS }, //  catnip (2,3) — the kitten takes the field
  { at: 55.5, press: BTN.LTRIGGER }, // switch possession to the catnip
  { at: 57.0, press: BTN.TRIANGLE }, // NINE LIVES
  { at: 58.0, press: BTN.CROSS }, //  feed catnip
  { at: 59.5, press: BTN.CROSS }, //  feed catnip
  { at: 60.0, press: BTN.SQUARE }, // seed: lantern
  { at: 61.0, press: BTN.DOWN },
  { at: 62.0, press: BTN.DOWN },
  { at: 63.0, press: BTN.RIGHT },
  { at: 71.5, press: BTN.TRIANGLE }, // NINE LIVES #2
  { at: 75.0, press: BTN.CROSS }, //  lantern1 (4,4) meets the kasa
  { at: 77.0, press: BTN.CROSS }, //  feed lantern1
  { at: 78.5, press: BTN.CROSS }, //  feed lantern1
  { at: 80.0, press: BTN.CROSS }, //  feed lantern1 -> wardstone (thorns)
  { at: 79.0, press: BTN.SQUARE },
  { at: 80.5, press: BTN.SQUARE },
  { at: 81.5, press: BTN.SQUARE }, // seed: bamboo
  { at: 81.0, press: BTN.LEFT },
  { at: 82.5, press: BTN.LEFT },
  { at: 83.5, press: BTN.CROSS }, //  bamboo3 (4,2) backs the lantern
  { at: 84.5, press: BTN.UP },
  { at: 85.5, press: BTN.RIGHT },
  { at: 86.5, press: BTN.RIGHT },
  { at: 85.0, press: BTN.SQUARE },
  { at: 86.0, press: BTN.SQUARE },
  { at: 87.0, press: BTN.SQUARE }, // seed: sakura
  { at: 88.0, press: BTN.CROSS }, //  sakura1 (3,4) — petals over r2-r4
  { at: 89.0, press: BTN.RTRIGGER },
  { at: 90.0, press: BTN.RTRIGGER },
  { at: 91.0, press: BTN.RTRIGGER },
  { at: 92.0, press: BTN.RTRIGGER }, // cycle to lantern1
  { at: 93.0, press: BTN.TRIANGLE }, // STONEHEART — the r4 wall stands
  { at: 94.0, press: BTN.LTRIGGER },
  { at: 95.0, press: BTN.LTRIGGER },
  { at: 96.0, press: BTN.LTRIGGER },
  { at: 97.0, press: BTN.LTRIGGER }, // back to the catnip
  { at: 98.0, press: BTN.TRIANGLE }, // NINE LIVES #3
  { at: 99.0, press: BTN.CROSS }, //  feed catnip
  { at: 100.5, press: BTN.CROSS },
  { at: 102.0, press: BTN.CROSS },
  { at: 99.5, press: BTN.SQUARE },
  { at: 101.0, press: BTN.SQUARE },
  { at: 102.5, press: BTN.SQUARE },
  { at: 104.0, press: BTN.SQUARE }, // seed: lantern
  { at: 103.5, press: BTN.UP },
  { at: 104.5, press: BTN.UP },
  { at: 106.0, press: BTN.CROSS }, // lantern2 (0,3) — the kasa III trap
  { at: 107.5, press: BTN.CROSS },
  { at: 109.0, press: BTN.CROSS },
  { at: 110.5, press: BTN.CROSS },
  { at: 112.0, press: BTN.CROSS }, // feed lantern2 -> wardstone
  { at: 108.0, press: BTN.RTRIGGER },
  { at: 109.5, press: BTN.RTRIGGER },
  { at: 110.5, press: BTN.RTRIGGER },
  { at: 111.5, press: BTN.RTRIGGER }, // cycle to lantern1
  { at: 112.5, press: BTN.TRIANGLE }, // STONEHEART #2
  { at: 113.5, press: BTN.LTRIGGER },
  { at: 114.5, press: BTN.LTRIGGER },
  { at: 115.5, press: BTN.LTRIGGER },
  { at: 116.5, press: BTN.LTRIGGER }, // back to the catnip
  { at: 118.0, press: BTN.TRIANGLE }, // NINE LIVES #4
  { at: 117.0, press: BTN.SQUARE }, // seed: sakura
  { at: 118.5, press: BTN.UP },
  { at: 119.5, press: BTN.RIGHT },
  { at: 121.0, press: BTN.CROSS }, // sakura2 (1,4) — petals over r0-r2
  { at: 122.5, press: BTN.CROSS },
  { at: 124.0, press: BTN.CROSS },
  { at: 125.5, press: BTN.CROSS }, // feed sakura2
  { at: 126.5, press: BTN.DOWN },
  { at: 127.5, press: BTN.DOWN },
  { at: 129.0, press: BTN.CROSS }, // feed sakura1
  { at: 130.5, press: BTN.CROSS },
  { at: 133.0, press: BTN.TRIANGLE }, // NINE LIVES #5
  { at: 134.0, press: BTN.RTRIGGER },
  { at: 135.0, press: BTN.RTRIGGER }, // cycle to sakura1
  { at: 136.5, press: BTN.TRIANGLE }, // PETALFALL — slow the surge
  { at: 137.5, press: BTN.LTRIGGER },
  { at: 138.5, press: BTN.LTRIGGER },
  { at: 139.5, press: BTN.LTRIGGER },
  { at: 140.5, press: BTN.LTRIGGER }, // cycle to sakura2
  { at: 142.0, press: BTN.TRIANGLE }, // PETALFALL #2
  { at: 143.0, press: BTN.RTRIGGER },
  { at: 144.0, press: BTN.RTRIGGER }, // back to the catnip
  { at: 147.5, press: BTN.TRIANGLE }, // NINE LIVES #6
  { at: 149.0, press: BTN.RTRIGGER },
  { at: 150.0, press: BTN.RTRIGGER }, // cycle to sakura1
  { at: 151.5, press: BTN.TRIANGLE }, // PETALFALL #3
  { at: 153.0, press: BTN.LTRIGGER },
  { at: 154.0, press: BTN.LTRIGGER },
  { at: 156.0, press: BTN.LTRIGGER },
  { at: 157.0, press: BTN.LTRIGGER }, // cycle to sakura2
  { at: 158.5, press: BTN.TRIANGLE }, // PETALFALL #4
  { at: 159.5, press: BTN.RTRIGGER },
  { at: 160.5, press: BTN.RTRIGGER }, // back to the catnip
  { at: 162.0, press: BTN.TRIANGLE }, // NINE LIVES #7
  { at: 163.5, press: BTN.RTRIGGER },
  { at: 164.5, press: BTN.RTRIGGER }, // cycle to sakura1
  { at: 166.0, press: BTN.TRIANGLE }, // PETALFALL #5 — the last petal falls
  { at: 167.0, press: BTN.LTRIGGER },
  { at: 168.0, press: BTN.LTRIGGER },
];

const SLEEPER = [{ at: 1.0, press: BTN.START }];

const gardener = (hz: number) => ({ app: "nightbloom-main", hz, seconds: GARDENER_SECONDS, script: GARDENER });
const sleeper = (hz: number) => ({ app: "nightbloom-main", hz, seconds: SLEEPER_SECONDS, script: SLEEPER });

const g60: Trace = await runScenario(gardener(60));
const g4: Trace = await runScenario(gardener(4));
const g2: Trace = await runScenario(gardener(2));
const s60: Trace = await runScenario(sleeper(60));
const s2: Trace = await runScenario(sleeper(2));

describe("nightbloom: content data", () => {
  test("the tables are closed: art, stats, waves, phases, scenes", () => {
    expect(validateContent()).toEqual([]);
  });
});

describe("nightbloom: determinism", () => {
  test("same tape, same night: repeat runs are hash-identical", async () => {
    const again = await runScenario(gardener(60));
    expect(again.hashes).toEqual(g60.hashes);
    expect(again.effects).toEqual(g60.effects);
  });

  test("chaos cannot reach the garden: sleeps + garbage + GC change nothing", async () => {
    const chaos = await runScenario(gardener(4), { maxSleepMs: 6, gcEvery: 32 });
    expect(chaos.hashes).toEqual(g4.hashes);
    expect(chaos.effects).toEqual(g4.effects);
  });

  test("the low-rate worlds are strict subsamples of the 60 Hz world", () => {
    for (const t of [g4, g2]) {
      const k = 60 / t.hz;
      for (let m = 0; m < t.frames; m++) {
        expect(t.hashes[m]).toBe(g60.hashes[k * (m + 1) - 1]);
      }
    }
  });

  test("the sleeper's night subsamples too — losing is just as deterministic", () => {
    const k = 60 / s2.hz;
    for (let m = 0; m < s2.frames; m++) {
      expect(s2.hashes[m]).toBe(s60.hashes[k * (m + 1) - 1]);
    }
  });

  test("the settled outcome screens are byte-equal across rates", () => {
    expect(Buffer.from(g4.finalFrame).equals(Buffer.from(g60.finalFrame))).toBe(true);
    expect(Buffer.from(g2.finalFrame).equals(Buffer.from(g60.finalFrame))).toBe(true);
    expect(Buffer.from(s2.finalFrame).equals(Buffer.from(s60.finalFrame))).toBe(true);
  });
});

describe("nightbloom: the augury rides the effect shell", () => {
  test("three omens, delivered exactly one virtual second after they are asked", () => {
    for (const t of [g60, g4, g2]) {
      const cmds = t.effects.filter((e) => e.t === "command" && e.kind === "augury");
      const dels = t.effects.filter((e) => e.t === "delivery" && e.kind === "augury");
      expect(cmds.length).toBe(3);
      expect(dels.length).toBe(3);
      for (let i = 0; i < 3; i++) {
        expect(dels[i].frame - cmds[i].frame).toBe(t.hz); // 1.0 virtual second
      }
    }
  });

  test("the omens are emitted on the tick grid, quantized per rate as designed", () => {
    // Dusk is asked on battle tick 1, which runs INSIDE the START press frame
    // (the first batch ticks immediately), so its command lands at exactly
    // 1.0 s at every rate. Midnight (tick 64*60) and witching (tick 112*60)
    // run on the last tick of their batch, i.e. during the frame that ENDS at
    // 65 s / 113 s — the command is logged at the frame's start: 65 - 1/hz.
    // The world itself subsamples exactly (the hash tests above); this pins
    // how tick-grid events quantize onto each host's frame grid.
    for (const t of [g60, g4, g2]) {
      const secs = t.effects.filter((e) => e.t === "command" && e.kind === "augury").map((e) => e.frame / t.hz);
      expect(secs[0]).toBeCloseTo(1.0, 10);
      expect(secs[1]).toBeCloseTo(65 - 1 / t.hz, 10);
      expect(secs[2]).toBeCloseTo(113 - 1 / t.hz, 10);
    }
  });
});

describe("nightbloom: the night actually happened", () => {
  test("the gardener holds all five lanes to dawn, and the ledger is exact", () => {
    for (const t of [g60, g2]) {
      expect(treeHasText(t.tree, "DAWN BREAKS")).toBe(true);
      expect(treeHasText(t.tree, "THE GARDEN HELD")).toBe(true);
      expect(treeHasText(t.tree, "FOES FELLED: 31")).toBe(true);
      // Two breaches slipped through the witching surge: one ward remains.
      expect(treeHasText(t.tree, "WARDS LEFT: 1 OF 3")).toBe(true);
      // The catnip reached NINELIVES (stage III) on spell glow alone.
      expect(treeHasText(t.tree, "GREATEST BLOOM: STAGE 3")).toBe(true);
    }
  });

  test("the sleeper's shrine falls dark with nothing planted", () => {
    for (const t of [s60, s2]) {
      expect(treeHasText(t.tree, "ETERNAL NIGHT")).toBe(true);
      expect(treeHasText(t.tree, "THE SHRINE FALLS DARK")).toBe(true);
      expect(treeHasText(t.tree, "FOES FELLED: 0")).toBe(true);
      expect(treeHasText(t.tree, "WARDS LEFT: 0 OF 3")).toBe(true);
      expect(treeHasText(t.tree, "GREATEST BLOOM: STAGE 1")).toBe(true);
    }
  });
});
