// aot/test/tidelight-e2e.ts — end-to-end test for the TIDELIGHT demake: build
// the ROM, drive a full playthrough headlessly in mGBA, and assert story
// state (flags, maps, dialogue) after scripted input.
//
// The tape is the same "obedient machine" as the framework sim test
// (test/tidelight.sim.test.ts): interact and take the TOP option everywhere.
// On the GBA that walks the report path — carry her in, report her, light the
// stove, vent-then-strike, confirm the irons, name kept, coat given, tend the
// lamp — and lands ENDING 1, GOOD ORDER, exactly like the PSP/web original.
//
// Movement calibration (runtime/player.c): 4 frames per tile while held, plus
// 4 frames to turn when the walk changes facing. Legs either use exact frame
// counts or end against a wall/NPC so overshoot cannot drift the route.
//
//   bun aot/test/tidelight-e2e.ts

import { $ } from "bun";
import { compile, debugInfo } from "../compiler/index.ts";
import { buildRom } from "../compiler/rom.ts";
import { DBG, DEBUG_ADDR } from "../spec/pjgb.ts";
import { encodePNG } from "../../test/png.ts";

const ROOT = new URL("../..", import.meta.url).pathname;
const RUNNER = ROOT + "aot/test/harness/mgba_runner";
const ROM = ROOT + "aot/dist/tidelight.gba";
const SHOTS = ROOT + "aot/dist/tidelight-shots";

const addr = (field: keyof typeof DBG): number => DEBUG_ADDR + DBG[field];

type Step =
  | { op: "advance"; frames: number }
  | { op: "press"; buttons: string[]; frames: number; release?: number }
  | { op: "read"; name: string; addr: number; size: 1 | 2 | 4 }
  | { op: "screenshot"; path: string };

async function run(steps: Step[]): Promise<Record<string, number>> {
  const scenario = ROOT + "aot/dist/tidelight-scenario.json";
  await Bun.write(scenario, JSON.stringify({ steps }));
  const out = await $`${RUNNER} ${ROM} ${scenario}`.text();
  const line = out.trim().split("\n").reverse().find((l) => l.trim().startsWith("{"));
  if (!line) throw new Error("runner produced no JSON:\n" + out);
  const parsed = JSON.parse(line);
  if (!parsed.ok) throw new Error("runner error: " + JSON.stringify(parsed));
  return parsed.reads ?? {};
}

let passed = 0;
let failed = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = got === want;
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"} ${name}: got ${got}${ok ? "" : `, want ${want}`}`);
  ok ? passed++ : failed++;
}

const R = {
  X: addr("PLAYER_X"),
  Y: addr("PLAYER_Y"),
  MAP: addr("CUR_MAP"),
  TEXT: addr("TEXT_ACTIVE"),
  SCRIPT: addr("SCRIPT_ACTIVE"),
  CUR: addr("CUR_TEXT"),
  BOOT: addr("BOOTED"),
};
const rd = (name: string, a: number, size: 1 | 2 | 4): Step => ({ op: "read", name, addr: a, size });
/** Hold a direction for `tiles` grid steps. Turning is free (player.c turns
 *  and moves in the same frame; 8px tiles at 2px/frame = 4 frames per tile).
 *  `pad` adds one extra tile's worth of frames — use ONLY when the leg ends
 *  against a wall/NPC, where overshoot is absorbed by the collision. */
const walk = (dir: string, tiles: number, pad = false): Step => ({
  op: "press",
  buttons: [dir],
  frames: tiles * 4 + (pad ? 4 : 0),
  release: 4,
});
const A = (): Step => ({ op: "press", buttons: ["A"], frames: 1, release: 8 });
/** One interaction: interact + dismiss every say + pick the top choice:
 *  n = 1 + says + chooses. */
const talk = (n: number): Step[] => Array.from({ length: n }, A);
const shot = (n: string): Step => ({ op: "screenshot", path: `${SHOTS}/${n}.ppm` });
const settle = (): Step => ({ op: "advance", frames: 12 });

/** P6 PPM -> PNG (viewable/committable without ImageMagick). */
async function ppmToPng(dir: string): Promise<void> {
  const glob = new Bun.Glob("*.ppm");
  for await (const name of glob.scan(dir)) {
    const raw = new Uint8Array(await Bun.file(`${dir}/${name}`).arrayBuffer());
    const header = new TextDecoder().decode(raw.subarray(0, 64));
    const m = header.match(/^P6\s+(\d+)\s+(\d+)\s+255\s/);
    if (!m) continue;
    const w = Number(m[1]);
    const h = Number(m[2]);
    const off = m[0].length;
    const rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      rgba[i * 4] = raw[off + i * 3];
      rgba[i * 4 + 1] = raw[off + i * 3 + 1];
      rgba[i * 4 + 2] = raw[off + i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }
    await Bun.write(`${dir}/${name.replace(/\.ppm$/, ".png")}`, encodePNG(rgba, w, h));
  }
}

// ---------------------------------------------------------------------------
// Route legs (each scenario is a fresh boot; later scenarios replay earlier
// legs). Coordinates in comments; facings tracked by hand.
// ---------------------------------------------------------------------------

// Shore: spawn (15,8) facing down -> talk to the castaway -> tower door warp.
const LEG_SHORE: Step[] = [
  settle(),
  walk("DOWN", 2), // (15,8) -> (15,10)
  walk("LEFT", 1, true), // -> (14,10), blocked-facing her at (13,10)
  ...talk(5), // interact, scan page, protocol page, CARRY, result page
  walk("RIGHT", 1), // -> (15,10)
  walk("UP", 4), // -> (15,6) = warp
  settle(), // arrive tower (14,12) facing up
];

// Tower night one: radio (15,6), Maren (10,9), ladder warp (20,6).
const LEG_TOWER1: Step[] = [
  walk("UP", 5), // (14,12) -> (14,7)
  walk("RIGHT", 1), // -> (15,7)
  walk("UP", 0, true), // face the wire (blocked by it)
  ...talk(5), // interact, hail, live-wire, REPORT, result
  walk("DOWN", 2), // -> (15,9)
  walk("LEFT", 4, true), // -> (11,9), blocked-facing Maren
  ...talk(5), // interact, plea, scan, LIGHT THE STOVE, result
  walk("RIGHT", 9, true), // -> (20,9), blocked by the wall
  walk("UP", 3), // -> (20,6) = ladder warp
  settle(), // arrive lamp room (14,10) facing up
];

// Lamp room: the storm beat, then back down and past the cot into night two.
const LEG_LAMP: Step[] = [
  walk("UP", 1, true), // -> (14,9), blocked-facing the lamp
  ...talk(4), // interact, alert page, VENT THEN STRIKE, result
  walk("DOWN", 2), // (14,9) -> (14,11) = warp back to tower ladder (20,7)
  settle(),
  walk("DOWN", 3), // (20,7) -> (20,10) = the cot warp
  settle(), // arrive tower2 (18,10) facing left
];

// Tower night two: radio, then Maren's three beats, then the dawn warp.
const LEG_TOWER2: Step[] = [
  walk("UP", 3), // (18,10) -> (18,7)
  walk("LEFT", 3), // -> (15,7)
  walk("UP", 0, true), // face the wire
  ...talk(4), // interact, barge page, CONFIRMED, result
  walk("DOWN", 2), // -> (15,9)
  walk("LEFT", 4, true), // -> (11,9), blocked-facing Maren
  ...talk(4), // name: interact, page, TOP, result
  ...talk(4), // coat: interact, page, TOP, result
  ...talk(4), // fork: interact, page, TEND THE LAMP, result
  walk("RIGHT", 9, true), // -> (20,9), blocked by the wall
  walk("DOWN", 1), // -> (20,10) = dawn warp
  settle(), // arrive pier (6,10) facing right
];

async function main(): Promise<void> {
  console.log("Building TIDELIGHT ROM...");
  const built = await compile(ROOT + "aot/tidelight/game.tsx");
  const di = debugInfo(built) as {
    flags: Record<string, { byteAddr: number; bit: number }>;
    texts: string[];
    maps: Record<string, number>;
  };
  const rom = await buildRom(built.blob, ROM);
  await $`mkdir -p ${SHOTS}`.quiet();
  console.log(`ROM: ${rom.size} bytes\n`);

  const tid = (s: string): number => {
    const i = di.texts.indexOf(s);
    if (i < 0) throw new Error("text not found: " + s);
    return i;
  };
  const flag = (name: string): { byteAddr: number; bit: number } => {
    const f = di.flags[name];
    if (!f) throw new Error("flag not found: " + name);
    return f;
  };
  const bit = (r: Record<string, number>, key: string, f: { bit: number }): number => (r[key] >> f.bit) & 1;

  const fMet = flag("met_maren");
  const fReported = flag("reported");
  const fStove = flag("stove_lit");
  const fStorm = flag("storm_done");
  const fDark1 = flag("lamp_dark1");
  const fInterro = flag("interro_done");
  const fNamed = flag("named");
  const fCoat = flag("gave_coat");
  const fFork = flag("fork_done");
  const fForkMaren = flag("fork_maren");
  const fVerdict = flag("verdict_done");
  const fGoodOrder = flag("end_good_order");
  const fStillWater = flag("end_still_water");
  const fBreakwater = flag("end_breakwater");

  // === Night one: the shore ===
  console.log("Night one — the shore: find her, carry her in");
  {
    const r = await run([
      settle(),
      rd("boot", R.BOOT, 1),
      rd("map0", R.MAP, 1),
      rd("x0", R.X, 2),
      rd("y0", R.Y, 2),
      shot("01_shore"),
      walk("DOWN", 2),
      walk("LEFT", 1, true),
      rd("x1", R.X, 2),
      rd("y1", R.Y, 2),
      A(),
      rd("d_text", R.TEXT, 1),
      rd("d_cur", R.CUR, 2),
      shot("02_scan"),
      ...talk(4),
      rd("met", fMet.byteAddr, 1),
      rd("script_done", R.SCRIPT, 1),
      walk("RIGHT", 1),
      walk("UP", 4),
      settle(),
      rd("map1", R.MAP, 1),
      rd("x2", R.X, 2),
      rd("y2", R.Y, 2),
    ]);
    check("booted", r.boot, 1);
    check("starts on the shore", r.map0, di.maps["shore"]);
    check("spawn x", r.x0, 15);
    check("spawn y", r.y0, 8);
    check("stands beside the castaway", r.x1, 14);
    check("  (level with her, y=10)", r.y1, 10);
    check("scan line shows", r.d_cur, tid("SCAN: PULSE DETECTED.\nCASTAWAY. ALIVE."));
    check("textbox up", r.d_text, 1);
    check("CARRY sets met_maren", bit(r, "met", fMet), 1);
    check("script ended", r.script_done, 0);
    check("door warps into the tower", r.map1, di.maps["tower"]);
    check("tower entrance x", r.x2, 14);
    check("tower entrance y", r.y2, 12);
  }

  // === Night one: the tower — report her, light the stove, hold the lamp ===
  console.log("Night one — the wire, the stove, the lamp");
  {
    const r = await run([
      ...LEG_SHORE,
      rd("met", fMet.byteAddr, 1),
      walk("UP", 5),
      walk("RIGHT", 1),
      walk("UP", 0, true),
      A(),
      rd("w_cur", R.CUR, 2),
      shot("03_wire"),
      ...talk(4),
      rd("reported", fReported.byteAddr, 1),
      walk("DOWN", 2),
      walk("LEFT", 4, true),
      ...talk(5),
      rd("stove", fStove.byteAddr, 1),
      rd("script2", R.SCRIPT, 1),
      walk("RIGHT", 9, true),
      walk("UP", 3),
      settle(),
      rd("mapL", R.MAP, 1),
      rd("xL", R.X, 2),
      walk("UP", 1, true),
      A(),
      rd("l_cur", R.CUR, 2),
      shot("04_lamp"),
      ...talk(3),
      rd("storm", fStorm.byteAddr, 1),
      rd("dark1", fDark1.byteAddr, 1),
      walk("DOWN", 2),
      settle(),
      rd("mapT", R.MAP, 1),
      walk("DOWN", 3),
      settle(),
      rd("map2", R.MAP, 1),
      rd("x3", R.X, 2),
      shot("05_nighttwo"),
    ]);
    check("carried her in (prelude)", bit(r, "met", fMet), 1);
    check("wire opens with the hail", r.w_cur, tid("HALLOWAY: Saltmere, sound\noff. Storm inbound."));
    check("REPORT THE CASTAWAY sets reported", bit(r, "reported", fReported), 1);
    check("LIGHT THE STOVE sets stove_lit", bit(r, "stove", fStove), 1);
    check("script ended", r.script2, 0);
    check("ladder warps to the lamp room", r.mapL, di.maps["lamp"]);
    check("lamp room entrance x", r.xL, 14);
    check("lamp opens with the alert", r.l_cur, tid("ALERT: LAMP PRESSURE\nFALLING. THE LIGHT GUTTERS.\nProcedure, keeper?"));
    check("VENT THEN STRIKE sets storm_done", bit(r, "storm", fStorm), 1);
    check("  and the lamp did NOT go dark", bit(r, "dark1", fDark1), 0);
    check("ladder returns to the tower", r.mapT, di.maps["tower"]);
    check("the cot lets night one go (tower2)", r.map2, di.maps["tower2"]);
    check("wakes beside the cot", r.x3, 18);
  }

  // === Night two + day three: interrogation, fireside, fork, verdict ===
  console.log("Night two and day three — the fork, the pier, the verdict");
  {
    const r = await run([
      ...LEG_SHORE,
      ...LEG_TOWER1,
      ...LEG_LAMP,
      walk("UP", 3),
      walk("LEFT", 3),
      walk("UP", 0, true),
      ...talk(4),
      rd("interro", fInterro.byteAddr, 1),
      walk("DOWN", 2),
      walk("LEFT", 4, true),
      ...talk(4),
      rd("named", fNamed.byteAddr, 1),
      ...talk(4),
      rd("coat", fCoat.byteAddr, 1),
      shot("06_fireside"),
      ...talk(4),
      rd("fork", fFork.byteAddr, 1),
      rd("forkm", fForkMaren.byteAddr, 1),
      walk("RIGHT", 9, true),
      walk("DOWN", 1),
      settle(),
      rd("map3", R.MAP, 1),
      shot("07_pier"),
      walk("RIGHT", 9, true), // (6,10) -> blocked at (15,10) before Halloway
      rd("px", R.X, 2),
      A(),
      rd("v_cur", R.CUR, 2),
      shot("08_verdict"),
      ...talk(5),
      rd("verdict", fVerdict.byteAddr, 1),
      rd("good", fGoodOrder.byteAddr, 1),
      rd("still", fStillWater.byteAddr, 1),
      rd("breaker", fBreakwater.byteAddr, 1),
      shot("09_ending"),
      A(),
      rd("again_cur", R.CUR, 2),
    ]);
    check("CONFIRMED sets interro_done", bit(r, "interro", fInterro), 1);
    check("the name beat sets named", bit(r, "named", fNamed), 1);
    check("the coat beat sets gave_coat", bit(r, "coat", fCoat), 1);
    check("the fork resolves (fork_done)", bit(r, "fork", fFork), 1);
    check("  top option chose the LAMP", bit(r, "forkm", fForkMaren), 0);
    check("the cot warps to the pier (day three)", r.map3, di.maps["pier"]);
    check("stands before the Inspector", r.px, 15);
    check("the handover opens as reported", r.v_cur, tid("HALLOWAY: The castaway.\nAs reported, keeper."));
    check("verdict_done set", bit(r, "verdict", fVerdict), 1);
    check("ENDING 1: end_good_order set", bit(r, "good", fGoodOrder), 1);
    check("  still water NOT set", bit(r, "still", fStillWater), 0);
    check("  breakwater NOT set", bit(r, "breaker", fBreakwater), 0);
    check("re-talk: the tide table is signed", r.again_cur, tid("HALLOWAY: The tide table\nis signed, keeper."));
  }

  await ppmToPng(SHOTS);
  console.log(`\n${failed === 0 ? "\x1b[32m" : "\x1b[31m"}${passed} passed, ${failed} failed\x1b[0m`);
  process.exit(failed === 0 ? 0 : 1);
}

await main();
