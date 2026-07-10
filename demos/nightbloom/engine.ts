// demos/nightbloom/engine.ts — the night engine: a fixed-timestep garden
// battle folded over the virtual clock. No JSX here; app.tsx is a thin
// renderer over these signals, which keeps the whole game host-agnostic and
// sim-testable — the tidelight architecture, applied to a real-time game.
//
// Determinism contract (DETERMINISM.md):
//   - the world advances in MICRO-TICKS on the core's fixed 1/60 s grid: a
//     battle frame runs its FULL ticksPerFrame() batch (or none, for pause),
//     with the batch aligned so the tick count at virtual time t is exactly
//     (t - tStart) * 60 at every simulationHz — the 2 Hz world is a strict
//     subsample of the 60 Hz world, gameplay included;
//   - edge-detected input is applied on the FIRST tick of its host frame's
//     batch: a press at second P lands on battle tick (P - tStart) * 60 + 1
//     at every valid hz, which keeps input-driven runs subsample-exact;
//   - held input (d-pad repeat, the CIRCLE channel) acts only after a
//     half-second of held ticks AND a frame boundary (the sustained mask), so
//     a one-frame pulse means the same thing at 2 Hz (a 30-tick hold) as it
//     does at 60 Hz (a 1-tick hold);
//   - float fx drift by battle-tick age, not wall-clock tweens, so cosmetics
//     subsample as exactly as the sim;
//   - randomness is one seeded xorshift32 stream drawn only inside ticks —
//     lane picks are as replayable as everything else;
//   - toasts expire through after() on the virtual clock, epoch-guarded so a
//     reset night can never be touched by the last one;
//   - the phase omen arrives through the effect shell (backend.ts) with a
//     whole-second latency, quantized to frame boundaries per rate.

import { createSignal, type Accessor } from "solid-js";
import { after, ticksPerFrame } from "@pocketjs/framework/clock";
import { runEffect } from "@pocketjs/framework/effects";
import { BTN } from "@pocketjs/framework/input";
import {
  BITE_PERIOD,
  BOARD,
  BREACH_X,
  CHANNEL_RATE,
  DAWN_AT,
  FED_HEAL,
  FEED_COST,
  FEED_GLOW,
  FOES,
  MOONFALL_LUMEN,
  MOONFALL_PERIOD,
  NIGHT_SEED,
  PHASES,
  PLANT_ORDER,
  PLANTS,
  POSSESS_RATE,
  SHOTS,
  SPAWN_X,
  START_LUMEN,
  TPS,
  WARDS,
  WAVES,
  cellCX,
  type FoeId,
  type PhaseId,
  type PlantId,
  type ShotKind,
} from "./data.ts";

export type Outcome = "title" | "battle" | "dawn" | "eternal";

// ---------------------------------------------------------------------------
// Reactive cells — a signal dressed as a readable-callable with .set()
// ---------------------------------------------------------------------------

export interface Cell<T> {
  (): T;
  set: (v: T) => void;
}

function cell<T>(v: T): Cell<T> {
  const [get, set] = createSignal<T>(v);
  const f = (() => get()) as Cell<T>;
  f.set = (nv: T) => void set(() => nv);
  return f;
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface PlantInst {
  id: number;
  kind: PlantId;
  row: number;
  col: number;
  /** Evolution stage 1..3. */
  stage: Cell<number>;
  hp: Cell<number>;
  glow: Cell<number>;
  /** 0..1 — how ready the spell is (drives the HUD arc). */
  spellReady: Cell<number>;
  cdTicks: number;
  spellCdTicks: number;
}

export interface FoeInst {
  id: number;
  kind: FoeId;
  row: number;
  stage: Cell<number>;
  x: Cell<number>;
  hp: Cell<number>;
  slowUntil: number;
  biteCd: number;
  lobCd: number;
}

export interface ShotInst {
  id: number;
  kind: ShotKind;
  row: number;
  x: Cell<number>;
  dmg: number;
  /** True damage ignores armor (petals, spells). */
  pierce: boolean;
  /** Owning plant id for the glow ledger (friendly shots only). */
  owner?: number;
}

export interface FloatFx {
  id: number;
  x: number;
  y: number;
  text: string;
  tone: "lumen" | "hurt" | "ward" | "evolve";
  /** Battle tick the float was born — its drift is a pure function of age. */
  born: number;
}

/** Float fx live this many ticks (0.9 s), pruned by the tick itself. */
export const FX_LIFE = 54;

export interface Toast {
  id: number;
  text: string;
}

export interface Nightbloom {
  outcome: Accessor<Outcome>;
  paused: Accessor<boolean>;
  codex: Accessor<boolean>;
  lumen: Accessor<number>;
  wards: Accessor<number>;
  kills: Accessor<number>;
  phase: Accessor<PhaseId>;
  augury: Accessor<string>;
  /** Night progress 0..1 (toward dawn). */
  progress: Accessor<number>;
  second: Accessor<number>;
  waveIdx: Accessor<number>;
  cursorRow: Accessor<number>;
  cursorCol: Accessor<number>;
  seed: Accessor<PlantId>;
  possessed: Accessor<PlantInst | null>;
  plants: Accessor<PlantInst[]>;
  foes: Accessor<FoeInst[]>;
  shots: Accessor<ShotInst[]>;
  fxs: Accessor<FloatFx[]>;
  /** The battle tick, for age-deriving float fx drift. */
  fxTick: Accessor<number>;
  toasts: Accessor<Toast[]>;
  bestStage: Accessor<number>;
  /** Route one host frame: held button mask in, ticksPerFrame() ticks out. */
  frame: (buttons: number) => void;
  start: () => void;
  toTitle: () => void;
}

const DIRS = [
  { mask: BTN.UP, dr: -1, dc: 0 },
  { mask: BTN.DOWN, dr: 1, dc: 0 },
  { mask: BTN.LEFT, dr: 0, dc: -1 },
  { mask: BTN.RIGHT, dr: 0, dc: 1 },
] as const;

// Held-input gates. A held button acts only once it has been down for a full
// half second of ticks AND across a frame boundary (the `sustained` mask):
// a one-frame pulse at 2 Hz holds a button for 30 ticks, and without the
// sustained gate it would repeat/channel where a 60 Hz pulse would not —
// the gate makes pulses and holds mean the same thing at every rate.
/** Held d-pad starts repeating after this many held ticks (> one 2 Hz batch). */
const REPEAT_DELAY = 31;
/** ...and then steps once per this many ticks. */
const REPEAT_EVERY = 9;
/** The CIRCLE channel spins up after the same half-second squeeze. */
const CHANNEL_DELAY = 31;

const BITE_TICKS = Math.round(BITE_PERIOD * TPS);
/** How close (px) a walking foe must get to a plant's center to latch on. */
const BITE_REACH = 14;

export function createNightbloom(): Nightbloom {
  const outcome = cell<Outcome>("title");
  const paused = cell(false);
  const codex = cell(false);
  const lumen = cell(START_LUMEN);
  const wards = cell(WARDS);
  const kills = cell(0);
  const phase = cell<PhaseId>("dusk");
  const augury = cell("");
  const second = cell(0);
  const waveIdx = cell(0);
  const cursorRow = cell(2);
  const cursorCol = cell(2);
  const seedIdx = cell(0);
  const possessedId = cell<number | null>(null);
  const plants = cell<PlantInst[]>([]);
  const foes = cell<FoeInst[]>([]);
  const shots = cell<ShotInst[]>([]);
  const fxs = cell<FloatFx[]>([]);
  const toasts = cell<Toast[]>([]);
  const bestStage = cell(1);

  let tick = 0;
  let prevButtons = 0;
  let rng = NIGHT_SEED >>> 0;
  let idSeq = 0;
  let epoch = 0;
  let nextWave = 0;
  let nextPhase = 0;
  let chanTicks = 0;
  const dirHeld: number[] = [0, 0, 0, 0];
  const fxTick = cell(0);

  // -- deterministic helpers ------------------------------------------------

  function rnd(n: number): number {
    rng ^= (rng << 13) >>> 0;
    rng = rng >>> 0;
    rng ^= rng >>> 17;
    rng ^= (rng << 5) >>> 0;
    rng = rng >>> 0;
    return rng % n;
  }

  function toast(text: string): void {
    const t: Toast = { id: ++idSeq, text };
    toasts.set([...toasts(), t]);
    const at = epoch;
    after(2.5, () => {
      if (at === epoch) toasts.set(toasts().filter((x) => x.id !== t.id));
    });
  }

  function fx(x: number, y: number, text: string, tone: FloatFx["tone"]): void {
    fxs.set([...fxs(), { id: ++idSeq, x, y, text, tone, born: tick }]);
  }

  // -- lookups ----------------------------------------------------------------

  const plantAt = (row: number, col: number): PlantInst | undefined =>
    plants().find((p) => p.row === row && p.col === col);

  const possessed = (): PlantInst | null => {
    const id = possessedId();
    if (id === null) return null;
    return plants().find((p) => p.id === id) ?? null;
  };

  const plantMaxHp = (p: PlantInst): number => PLANTS[p.kind].hp[p.stage() - 1];

  /** Row-major possession order. */
  const roster = (): PlantInst[] => [...plants()].sort((a, b) => a.row * BOARD.cols + a.col - (b.row * BOARD.cols + b.col));

  // -- state churn -------------------------------------------------------------

  function reset(): void {
    epoch++;
    tick = 0;
    rng = NIGHT_SEED >>> 0;
    nextWave = 0;
    nextPhase = 0;
    chanTicks = 0;
    fxTick.set(0);
    dirHeld.fill(0);
    lumen.set(START_LUMEN);
    wards.set(WARDS);
    kills.set(0);
    phase.set("dusk");
    augury.set("");
    second.set(0);
    waveIdx.set(0);
    cursorRow.set(2);
    cursorCol.set(2);
    seedIdx.set(0);
    possessedId.set(null);
    plants.set([]);
    foes.set([]);
    shots.set([]);
    fxs.set([]);
    toasts.set([]);
    bestStage.set(1);
    paused.set(false);
    codex.set(false);
  }

  function start(): void {
    reset();
    outcome.set("battle");
  }

  function toTitle(): void {
    reset();
    outcome.set("title");
  }

  // -- combat ------------------------------------------------------------------

  function grantGlow(p: PlantInst, amount: number): void {
    const def = PLANTS[p.kind];
    p.glow.set(p.glow() + amount);
    const s = p.stage();
    if (s < 3) {
      const need = def.evolveAt[s - 1];
      if (p.glow() >= need) {
        const frac = p.hp() / plantMaxHp(p);
        p.stage.set(s + 1);
        p.hp.set(Math.round(frac * plantMaxHp(p)));
        if (p.stage() > bestStage()) bestStage.set(p.stage());
        toast(`${def.name} ASCENDS: ${def.stageNames[p.stage() - 1]}`);
        fx(cellCX(p.col), BOARD.y0 + p.row * BOARD.cellH + 4, "UP!", "evolve");
      }
    }
  }

  function hitFoe(f: FoeInst, dmg: number, pierce: boolean, owner?: number): void {
    if (!foes().some((x) => x.id === f.id)) return; // already died this tick
    const def = FOES[f.kind];
    const eff = pierce ? dmg : Math.max(1, dmg - def.armor[f.stage() - 1]);
    f.hp.set(f.hp() - eff);
    if (owner !== undefined) {
      const p = plants().find((pl) => pl.id === owner);
      if (p && PLANTS[p.kind].law === "GROWS BY THE WOUNDS IT DEALS") grantGlow(p, eff);
    }
    if (f.hp() <= 0) killFoe(f);
  }

  function killFoe(f: FoeInst): void {
    const def = FOES[f.kind];
    const bounty = def.bounty[f.stage() - 1];
    lumen.set(lumen() + bounty);
    kills.set(kills() + 1);
    fx(f.x(), BOARD.y0 + f.row * BOARD.cellH + 2, `+${bounty}`, "lumen");
    foes.set(foes().filter((x) => x.id !== f.id));
  }

  function killPlant(p: PlantInst, eater?: FoeInst): void {
    plants.set(plants().filter((x) => x.id !== p.id));
    if (possessedId() === p.id) possessedId.set(null);
    if (eater) {
      const def = FOES[eater.kind];
      if (eater.stage() < 3) {
        eater.stage.set(eater.stage() + 1);
        toast(`IT FED: ${def.name} IS NOW ${def.stageNames[eater.stage() - 1]}`);
      }
      eater.hp.set(Math.min(def.hp[eater.stage() - 1], eater.hp() + Math.round(def.hp[eater.stage() - 1] * FED_HEAL)));
      fx(eater.x(), BOARD.y0 + eater.row * BOARD.cellH + 4, "FED", "hurt");
    }
  }

  function fireShot(p: PlantInst, row: number, kind: ShotKind, dmg: number, pierce: boolean): void {
    shots.set([
      ...shots(),
      { id: ++idSeq, kind, row, x: cell(cellCX(p.col) + 12), dmg, pierce, owner: p.id },
    ]);
  }

  function foesAhead(row: number, x: number): boolean {
    return foes().some((f) => f.row === row && f.x() > x);
  }

  function lanesOf(p: PlantInst, spread: number): number[] {
    const rows: number[] = [];
    for (let r = p.row - spread; r <= p.row + spread; r++) {
      if (r >= 0 && r < BOARD.rows) rows.push(r);
    }
    return rows;
  }

  // -- spells --------------------------------------------------------------------

  function castSpell(p: PlantInst): void {
    const def = PLANTS[p.kind];
    if (p.spellCdTicks > 0 || lumenSpellBlocked(p)) return;
    const cx = cellCX(p.col);
    const cy = BOARD.y0 + p.row * BOARD.cellH + 4;
    if (p.kind === "primrose") {
      lumen.set(lumen() + 80);
      fx(cx, cy, "+80", "lumen");
    } else if (p.kind === "bamboo") {
      for (const f of [...foes()]) if (f.row === p.row) hitFoe(f, 45, true, p.id);
      fx(cx, cy, "GALE!", "evolve");
    } else if (p.kind === "catnip") {
      const rows = new Set(lanesOf(p, p.stage() >= 3 ? BOARD.rows : 1));
      for (const f of [...foes()]) if (rows.has(f.row)) hitFoe(f, 28, true, p.id);
      fx(cx, cy, "NINE LIVES!", "evolve");
    } else if (p.kind === "lantern") {
      p.hp.set(plantMaxHp(p));
      fx(cx, cy, "STONEHEART", "evolve");
    } else if (p.kind === "sakura") {
      for (const f of [...foes()]) {
        hitFoe(f, 18, true, p.id);
        f.slowUntil = tick + 2 * TPS;
      }
      fx(cx, cy, "PETALFALL", "evolve");
    }
    toast(`SPELL CARD: ${def.spell.name}`);
    p.spellCdTicks = def.spell.cooldown * TPS;
  }

  // Spells are free by design; the hook stays for future costed cards.
  function lumenSpellBlocked(_p: PlantInst): boolean {
    return false;
  }

  // -- player actions (applied on the last tick of a frame) -----------------------

  function actPlantOrFeed(): void {
    const row = cursorRow();
    const col = cursorCol();
    const existing = plantAt(row, col);
    if (existing) {
      const def = PLANTS[existing.kind];
      if (existing.stage() >= 3) {
        toast(`${def.name} IS FULLY GROWN`);
        return;
      }
      if (lumen() < FEED_COST) {
        toast("NOT ENOUGH LUMEN TO FEED");
        return;
      }
      lumen.set(lumen() - FEED_COST);
      grantGlow(existing, FEED_GLOW);
      fx(cellCX(col), BOARD.y0 + row * BOARD.cellH + 4, "FED +GLOW", "lumen");
      return;
    }
    const kind = PLANT_ORDER[seedIdx()];
    const def = PLANTS[kind];
    if (lumen() < def.cost) {
      toast(`NEED ${def.cost} LUMEN FOR ${def.name}`);
      return;
    }
    lumen.set(lumen() - def.cost);
    plants.set([
      ...plants(),
      {
        id: ++idSeq,
        kind,
        row,
        col,
        stage: cell(1),
        hp: cell(def.hp[0]),
        glow: cell(0),
        spellReady: cell(1),
        cdTicks: Math.round((def.period?.[0] ?? 1) * TPS * 0.5),
        spellCdTicks: 0,
      },
    ]);
  }

  function actPossess(): void {
    const target = plantAt(cursorRow(), cursorCol());
    if (!target) return;
    if (possessedId() === target.id) {
      possessedId.set(null);
      toast("RELEASED");
      return;
    }
    possessedId.set(target.id);
    toast(`POSSESSED: ${PLANTS[target.kind].name}`);
  }

  function actCycle(delta: number): void {
    const list = roster();
    if (list.length === 0) return;
    const cur = possessed();
    let idx = cur ? list.findIndex((p) => p.id === cur.id) : -1;
    idx = idx < 0 ? (delta > 0 ? 0 : list.length - 1) : (idx + delta + list.length) % list.length;
    const next = list[idx];
    possessedId.set(next.id);
    cursorRow.set(next.row);
    cursorCol.set(next.col);
    toast(`POSSESSED: ${PLANTS[next.kind].name}`);
  }

  function moveCursor(dr: number, dc: number): void {
    cursorRow.set(Math.max(0, Math.min(BOARD.rows - 1, cursorRow() + dr)));
    cursorCol.set(Math.max(0, Math.min(BOARD.cols - 1, cursorCol() + dc)));
  }

  // -- the tick ---------------------------------------------------------------------

  function applyEdges(pressed: number): void {
    if (pressed & BTN.SQUARE) seedIdx.set((seedIdx() + 1) % PLANT_ORDER.length);
    if (pressed & BTN.CROSS) actPlantOrFeed();
    if (pressed & BTN.CIRCLE) actPossess();
    if (pressed & BTN.LTRIGGER) actCycle(-1);
    if (pressed & BTN.RTRIGGER) actCycle(1);
    if (pressed & BTN.TRIANGLE) {
      const p = possessed();
      if (p) castSpell(p);
      else toast("POSSESS A PLANT FIRST (O)");
    }
  }

  function tickCursor(pressed: number, held: number, sustained: number): void {
    for (let d = 0; d < DIRS.length; d++) {
      const dir = DIRS[d];
      if (held & dir.mask) {
        dirHeld[d]++;
        if (pressed & dir.mask) moveCursor(dir.dr, dir.dc);
        else if (
          sustained & dir.mask &&
          dirHeld[d] >= REPEAT_DELAY &&
          (dirHeld[d] - REPEAT_DELAY) % REPEAT_EVERY === 0
        ) {
          moveCursor(dir.dr, dir.dc);
        }
      } else {
        dirHeld[d] = 0;
      }
    }
  }

  function tickWaves(): void {
    while (nextPhase < PHASES.length && tick >= PHASES[nextPhase].at * TPS) {
      const p = PHASES[nextPhase];
      phase.set(p.id);
      if (nextPhase > 0) toast(`THE NIGHT DEEPENS: ${p.name}`);
      const at = epoch;
      runEffect<{ omen: string }>("augury", { phase: p.id }, (res) => {
        if (at === epoch) augury.set(res.omen);
      });
      nextPhase++;
    }
    while (nextWave < WAVES.length && tick >= WAVES[nextWave].at * TPS) {
      const wave = WAVES[nextWave];
      const stage: number = PHASES[Math.max(0, nextPhase - 1)].foeStage;
      wave.spawn.forEach((kind, i) => {
        const def = FOES[kind];
        foes.set([
          ...foes(),
          {
            id: ++idSeq,
            kind,
            row: rnd(BOARD.rows),
            stage: cell(stage),
            x: cell(SPAWN_X + i * 14),
            hp: cell(def.hp[stage - 1]),
            slowUntil: 0,
            biteCd: 0,
            lobCd: Math.round((def.lobPeriod?.[stage - 1] ?? 1) * TPS * 0.6),
          },
        ]);
      });
      waveIdx.set(nextWave + 1);
      nextWave++;
    }
  }

  function tickPlants(channeling: boolean): void {
    const chan = possessedId();
    for (const p of [...plants()]) {
      const def = PLANTS[p.kind];
      // spell cooldown + HUD arc
      if (p.spellCdTicks > 0) p.spellCdTicks--;
      const cdMax = def.spell.cooldown * TPS;
      p.spellReady.set(1 - p.spellCdTicks / cdMax);
      if (!def.period) continue;
      // fire/pulse cadence — possession and the channel speed the cycle up
      let period = def.period[p.stage() - 1] * TPS;
      if (chan === p.id) period *= channeling ? CHANNEL_RATE : POSSESS_RATE;
      p.cdTicks--;
      if (p.cdTicks > 0) continue;
      if (def.role === "producer") {
        const gain = def.pulseLumen![p.stage() - 1];
        lumen.set(lumen() + gain);
        grantGlow(p, gain);
        fx(cellCX(p.col), BOARD.y0 + p.row * BOARD.cellH + 4, `+${gain}`, "lumen");
        p.cdTicks = Math.round(period);
      } else if (def.role === "shooter") {
        const spread = def.spreadLanes ? def.spreadLanes[p.stage() - 1] : 0;
        const rows = lanesOf(p, spread);
        if (rows.some((r) => foesAhead(r, cellCX(p.col)))) {
          const dmg = def.dmg![p.stage() - 1];
          for (const r of rows) fireShot(p, r, p.kind === "catnip" ? "orb" : "bolt", dmg, false);
          p.cdTicks = Math.round(period);
        } else {
          p.cdTicks = 1; // re-check next tick without drifting the cadence
        }
      } else if (def.role === "burst") {
        const r = def.radius![p.stage() - 1];
        const cx = cellCX(p.col);
        const reach = (r + 0.5) * BOARD.cellW;
        const targets = foes().filter((f) => Math.abs(f.row - p.row) <= r && Math.abs(f.x() - cx) <= reach);
        if (targets.length > 0) {
          const dmg = def.dmg![p.stage() - 1];
          for (const f of targets) {
            hitFoe(f, dmg, true, p.id);
            if (p.stage() >= 3 && def.slowFactor) f.slowUntil = tick + Math.round(1.5 * TPS);
          }
          fx(cx, BOARD.y0 + p.row * BOARD.cellH + 4, "BLOOM", "evolve");
          p.cdTicks = Math.round(period);
        } else {
          p.cdTicks = 1;
        }
      }
    }
  }

  function tickShots(): void {
    for (const s of [...shots()]) {
      const speed = SHOTS[s.kind].speed / TPS;
      s.x.set(s.x() + speed);
      if (s.x() < BOARD.x0 - 20 || s.x() > SPAWN_X + 30) {
        shots.set(shots().filter((x) => x.id !== s.id));
        continue;
      }
      if (speed > 0) {
        // friendly shot: hit the nearest foe it has reached in this lane
        const target = foes()
          .filter((f) => f.row === s.row && s.x() >= f.x() - 12 && s.x() <= f.x() + 22)
          .sort((a, b) => a.x() - b.x())[0];
        if (target) {
          shots.set(shots().filter((x) => x.id !== s.id));
          hitFoe(target, s.dmg, s.pierce, s.owner);
        }
      } else {
        // mochi: hit the first plant it passes over
        const target = plants()
          .filter((p) => p.row === s.row && Math.abs(cellCX(p.col) - s.x()) < 12)
          .sort((a, b) => b.col - a.col)[0];
        if (target) {
          shots.set(shots().filter((x) => x.id !== s.id));
          damagePlant(target, s.dmg, undefined);
        }
      }
    }
  }

  function damagePlant(p: PlantInst, dmg: number, eater?: FoeInst): void {
    const def = PLANTS[p.kind];
    p.hp.set(p.hp() - dmg);
    if (def.law === "GROWS BY THE BLOWS IT ENDURES") grantGlow(p, dmg);
    if (p.hp() <= 0) killPlant(p, eater);
  }

  function tickFoes(): void {
    const all = foes();
    for (const f of [...all]) {
      if (!foes().includes(f)) continue; // already vaporized this tick
      const def = FOES[f.kind];
      const stage = f.stage() - 1;
      // uta's song: same-lane allies within range are hastened
      let speed = def.speed[stage] / TPS;
      const hasted = all.some((u) => {
        if (u.id === f.id || u.row !== f.row) return false;
        const uDef = FOES[u.kind];
        if (!uDef.auraRange) return false;
        return Math.abs(u.x() - f.x()) <= uDef.auraRange[u.stage() - 1];
      });
      if (hasted) speed *= FOES.uta.hasteFactor!;
      if (tick < f.slowUntil) speed *= PLANTS.sakura.slowFactor!;

      // the plant directly ahead (largest cx <= just past the foe)
      const lane = plants().filter((p) => p.row === f.row && cellCX(p.col) <= f.x() + BITE_REACH);
      const front = lane.sort((a, b) => b.col - a.col)[0];
      const dist = front ? f.x() - cellCX(front.col) : Infinity;

      if (front && dist <= BITE_REACH) {
        // latched on: bite
        f.biteCd--;
        if (f.biteCd <= 0) {
          f.biteCd = BITE_TICKS;
          damagePlant(front, def.bite[stage], f);
          const thorns = PLANTS[front.kind].thorns?.[front.stage() - 1] ?? 0;
          if (thorns > 0 && foes().includes(f)) hitFoe(f, thorns, true, front.id);
        }
        continue;
      }

      // moon rabbits stop short and lob mochi at the front plant
      if (def.lobRange && front && dist <= def.lobRange * BOARD.cellW) {
        f.lobCd--;
        if (f.lobCd <= 0) {
          f.lobCd = Math.round(def.lobPeriod![stage] * TPS);
          shots.set([
            ...shots(),
            { id: ++idSeq, kind: "mochi", row: f.row, x: cell(f.x() - 10), dmg: def.lobDmg![stage], pierce: false },
          ]);
        }
        continue;
      }

      f.x.set(f.x() - speed);
      if (f.x() < BREACH_X) {
        if (wards() > 0) {
          wards.set(wards() - 1);
          fx(BOARD.x0 + 6, BOARD.y0 + f.row * BOARD.cellH + 4, "WARD!", "ward");
          toast("A WARD FLARES AND SPENDS ITSELF");
          foes.set(foes().filter((x) => x.id !== f.id));
        } else {
          outcome.set("eternal");
          return;
        }
      }
    }
  }

  function stepTick(pressed: number, held: number, sustained: number): void {
    // player intent lands first, then the world advances one fixed step
    if (pressed) applyEdges(pressed);
    tickCursor(pressed, held, sustained);
    chanTicks = held & BTN.CIRCLE ? chanTicks + 1 : 0;
    const channeling = Boolean(sustained & BTN.CIRCLE) && chanTicks >= CHANNEL_DELAY;
    tick++;
    second.set(Math.floor(tick / TPS));
    fxTick.set(tick);
    if (fxs().length > 0) {
      const cutoff = tick - FX_LIFE;
      if (fxs().some((f) => f.born <= cutoff)) fxs.set(fxs().filter((f) => f.born > cutoff));
    }
    tickWaves();
    if (tick % (MOONFALL_PERIOD * TPS) === 0) {
      lumen.set(lumen() + MOONFALL_LUMEN);
      fx(BOARD.x0 + rnd(BOARD.cols) * BOARD.cellW + 18, BOARD.y0 - 6, `+${MOONFALL_LUMEN}`, "lumen");
    }
    tickPlants(channeling);
    tickShots();
    tickFoes();
    if (outcome() !== "battle") return;
    if (tick >= DAWN_AT * TPS && nextWave >= WAVES.length && foes().length === 0) {
      outcome.set("dawn");
    }
  }

  // -- frame routing -----------------------------------------------------------------

  // Frame-boundary rule (the subsampling contract): a battle frame either
  // runs its FULL ticksPerFrame() batch or none of it. The frame that starts
  // the night ticks immediately, a pause begins with a 0-tick frame, and an
  // unpause frame runs its whole batch — so the tick count at any shared
  // virtual second is (t - tStart) * 60 at every rate, never off by a batch.
  function frame(buttons: number): void {
    const pressed = buttons & ~prevButtons;
    const sustained = buttons & prevButtons;
    prevButtons = buttons;

    const o = outcome();
    let started = false;
    if (o === "title") {
      if (!(pressed & BTN.START)) return;
      start();
      started = true; // fall through: the first batch ticks this same frame
    } else if (o === "dawn" || o === "eternal") {
      if (pressed & BTN.START) toTitle();
      return;
    }
    if (!started && pressed & BTN.START) paused.set(!paused());
    if (paused()) return;
    if (pressed & BTN.SELECT) codex.set(!codex());
    if (codex()) return;

    const k = ticksPerFrame();
    for (let i = 0; i < k; i++) {
      if (outcome() !== "battle") return;
      // Edges apply on the FIRST tick of the frame's batch: with batches
      // aligned to (t - tStart) * 60, that is tick (P - tStart) * 60 + 1 for
      // a press at second P — the same tick at every simulationHz.
      stepTick(i === 0 ? pressed : 0, buttons, sustained);
    }
  }

  // The lab seam (same spirit as __tidelight): read-only accessors so the sim
  // can assert on the battle without parsing the component tree.
  (globalThis as Record<string, unknown>).__nightbloom = {
    outcome,
    lumen,
    wards,
    kills,
    phase,
    second,
    waveIdx,
    bestStage,
    foesAlive: () => foes().length,
    foeList: () => foes().map((f) => ({ kind: f.kind, row: f.row, x: Math.round(f.x()), stage: f.stage(), hp: f.hp() })),
    plantCount: () => plants().length,
    plantList: () =>
      plants().map((p) => ({ kind: p.kind, row: p.row, col: p.col, stage: p.stage(), hp: p.hp(), glow: p.glow() })),
    possessedKind: () => {
      const p = possessed();
      return p ? p.kind : null;
    },
  };

  return {
    outcome,
    paused,
    codex,
    lumen,
    wards,
    kills,
    phase,
    augury,
    progress: () => Math.min(1, second() / DAWN_AT),
    second,
    waveIdx,
    cursorRow,
    cursorCol,
    seed: () => PLANT_ORDER[seedIdx()],
    possessed,
    plants,
    foes,
    shots,
    fxs,
    fxTick,
    toasts,
    bestStage,
    frame,
    start,
    toTitle,
  };
}
