// demos/nightbloom/app.tsx — NIGHTBLOOM: a lane-defense danmaku garden on the
// PocketJS deterministic runtime. One shrine, five lanes, an eternal night;
// plants that ascend by doing their work, a horde that ascends with the hour,
// and a possession mechanic that turns any planted ally into the player's own
// trigger finger.
//
// What it demonstrates, mechanically:
//   - a real-time battle simulated in fixed 1/60 s micro-ticks stepped
//     ticksPerFrame() per host frame, so every simulationHz plays the SAME
//     night (the subsampling theorem, extended to gameplay);
//   - attack/defense matchups (armor vs true petal damage, ranged lobbers vs
//     walls, a support aura worth focusing) driven purely by data.ts tables;
//   - two evolution laws on one clock: plants grow by their own work,
//     foes grow with the night's phase — and on the spot when they feed;
//   - possession + switching (CIRCLE / L / R), a held-button channel, and
//     per-plant spell cards on virtual-clock cooldowns;
//   - the phase augury as an effect-shell driver (backend.ts), so even the
//     forecast is on the virtual clock.
//
// All sprites and backdrops are PixelLab-generated pixel art committed by
// gen-assets.ts. Scene textures are 256x128 (pow2) drawn at 480x240; unit
// sprites are 32x32 drawn at 38px inside 48x42 cells. Every class is a FULL
// literal and all copy is ASCII (Inter has no CJK).

import { For, Show } from "solid-js";
import { Image, Screen, Text, View } from "@pocketjs/framework/components";
import { onFrame } from "@pocketjs/framework/lifecycle";
import {
  BOARD,
  FOES,
  FOE_ORDER,
  PLANTS,
  PLANT_ORDER,
  SCENES,
  SHOTS,
  WAVES,
  cellCX,
  cellX,
  cellY,
  MOTE_SPRITE,
} from "./data.ts";
import { createNightbloom, FX_LIFE, type FloatFx, type Nightbloom } from "./engine.ts";

// ---------------------------------------------------------------------------
// Title / endings
// ---------------------------------------------------------------------------

function TitleScreen() {
  return (
    <View debugName="Title" class="absolute inset-0">
      <Image class="absolute inset-0 w-full h-full" src="bg-title.png" />
      <View class="absolute left-0 right-0 bottom-0 h-24 bg-slate-950 opacity-70" />
      <View class="absolute left-0 right-0 top-8 flex-col items-center gap-1">
        <Text class="text-4xl text-pink-200 font-bold tracking-wide">NIGHTBLOOM</Text>
        <Text class="text-xs text-slate-300 tracking-wide">A GARDEN AGAINST THE ETERNAL NIGHT</Text>
      </View>
      <View class="absolute left-0 right-0 bottom-12 flex-col items-center gap-1">
        <Text class="text-sm text-amber-300 tracking-wide animate-pulse">PRESS START</Text>
        <Text class="text-xs text-slate-400">ARROWS CURSOR   X PLANT / FEED   [] SEED   O POSSESS</Text>
        <Text class="text-xs text-slate-400">{"HOLD O CHANNEL   /\\ SPELL CARD   L R SWITCH   SELECT CODEX"}</Text>
      </View>
      <View class="absolute left-3 right-3 bottom-2 flex-row justify-between">
        <Text class="text-xs text-slate-500">A POCKETJS GARDEN DEFENSE</Text>
        <Text class="text-xs text-slate-500">EVERY NIGHT IS A TAPE</Text>
      </View>
    </View>
  );
}

function EndScreen(props: { game: Nightbloom; win: boolean }) {
  const g = props.game;
  return (
    <View debugName="End" class="absolute inset-0">
      <Image class="absolute inset-0 w-full h-full" src={props.win ? "bg-dawn.png" : "bg-eternal.png"} />
      <View class="absolute inset-0 bg-slate-950 opacity-55" />
      <View class="absolute left-0 right-0 top-12 flex-col items-center gap-2">
        <Text class="text-xs text-slate-300 tracking-wide">{props.win ? "THE GARDEN HELD" : "THE SHRINE FALLS DARK"}</Text>
        <Text class={props.win ? "text-4xl text-amber-200 font-bold tracking-wide" : "text-4xl text-red-300 font-bold tracking-wide"}>
          {props.win ? "DAWN BREAKS" : "ETERNAL NIGHT"}
        </Text>
        <View class="w-14 h-[2] bg-pink-300" />
      </View>
      <View class="absolute left-0 right-0 top-32 flex-col items-center gap-1">
        <View class="flex-col gap-1 p-2 rounded-md border border-slate-700 bg-[#020617cc] items-center">
          <Text class="text-xs text-slate-300">{"FOES FELLED: " + g.kills()}</Text>
          <Text class="text-xs text-slate-300">{"WARDS LEFT: " + g.wards() + " OF 3"}</Text>
          <Text class="text-xs text-slate-300">{"GREATEST BLOOM: STAGE " + g.bestStage()}</Text>
        </View>
      </View>
      <View class="absolute left-0 right-0 bottom-4 flex-col items-center">
        <Text class="text-sm text-amber-300 tracking-wide">START  RETURN TO TITLE</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Battle board
// ---------------------------------------------------------------------------

function Lanes() {
  const stripes = [0, 1, 2, 3, 4].map((r) => ({
    y: cellY(r),
    dark: r % 2 === 0,
  }));
  const ticks = [1, 2, 3, 4, 5, 6, 7, 8].map((c) => cellX(c));
  return (
    <View debugName="Lanes" class="absolute inset-0">
      <For each={stripes}>
        {(s) => (
          <View
            class={s.dark ? "absolute bg-[#0f172a66] rounded-sm" : "absolute bg-[#1e293b4d] rounded-sm"}
            style={{ insetL: BOARD.x0, insetT: s.y, width: BOARD.cols * BOARD.cellW, height: BOARD.cellH - 2 }}
          />
        )}
      </For>
      <For each={ticks}>
        {(x) => (
          <View class="absolute bg-[#33415540]" style={{ insetL: x, insetT: BOARD.y0, width: 1, height: BOARD.rows * BOARD.cellH }} />
        )}
      </For>
    </View>
  );
}

function Shrine(props: { game: Nightbloom }) {
  const letters = ["S", "H", "R", "I", "N", "E"];
  return (
    <View debugName="Shrine" class="absolute flex-col items-center gap-1" style={{ insetL: 6, insetT: BOARD.y0 + 12 }}>
      <View class="flex-row gap-1">
        <View class={props.game.wards() >= 1 ? "w-2 h-2 rotate-45 bg-cyan-300" : "w-2 h-2 rotate-45 bg-slate-700"} />
        <View class={props.game.wards() >= 2 ? "w-2 h-2 rotate-45 bg-cyan-300" : "w-2 h-2 rotate-45 bg-slate-700"} />
        <View class={props.game.wards() >= 3 ? "w-2 h-2 rotate-45 bg-cyan-300" : "w-2 h-2 rotate-45 bg-slate-700"} />
      </View>
      <View class="flex-col items-center gap-1 pt-2">
        <For each={letters}>{(ch) => <Text class="text-xs text-slate-500 tracking-wide">{ch}</Text>}</For>
      </View>
    </View>
  );
}

function PlantNode(props: { game: Nightbloom; plantId: number }) {
  const g = props.game;
  const plant = () => g.plants().find((p) => p.id === props.plantId);
  return (
    <Show when={plant()} keyed>
      {(p) => {
        const def = PLANTS[p.kind];
        const isPossessed = () => g.possessed()?.id === p.id;
        return (
          <View
            debugName="Plant"
            class="absolute items-center justify-center"
            style={{ insetL: cellX(p.col), insetT: cellY(p.row), width: BOARD.cellW, height: BOARD.cellH }}
          >
            <Show when={isPossessed()}>
              <View class="absolute inset-0 rounded-md border-2 border-amber-300" />
            </Show>
            <Image class="w-[38] h-[38]" src={def.sprites[p.stage() - 1]} />
            <View class="absolute left-1 right-1 bottom-0 h-1 rounded-sm bg-[#02061799]">
              <View
                class="h-1 rounded-sm bg-emerald-400 origin-left w-full"
                style={{ scaleX: Math.max(0, p.hp() / def.hp[p.stage() - 1]) }}
              />
            </View>
            <Show when={p.stage() >= 2}>
              <View class="absolute top-0 right-1 flex-row gap-[1]">
                <View class="w-1 h-1 rounded-full bg-pink-300" />
                <Show when={p.stage() >= 3}>
                  <View class="w-1 h-1 rounded-full bg-pink-300" />
                </Show>
              </View>
            </Show>
          </View>
        );
      }}
    </Show>
  );
}

function FoeNode(props: { game: Nightbloom; foeId: number }) {
  const g = props.game;
  const foe = () => g.foes().find((f) => f.id === props.foeId);
  return (
    <Show when={foe()} keyed>
      {(f) => {
        const def = FOES[f.kind];
        return (
          <View
            debugName="Foe"
            class="absolute items-center justify-center"
            style={{ insetL: f.x() - 19, insetT: cellY(f.row), width: 38, height: BOARD.cellH }}
          >
            <Image class="w-[38] h-[38]" src={def.sprites[f.stage() - 1]} />
            <View class="absolute left-1 right-1 top-0 h-1 rounded-sm bg-[#02061799]">
              <View
                class="h-1 rounded-sm bg-red-400 origin-left w-full"
                style={{ scaleX: Math.max(0, f.hp() / def.hp[f.stage() - 1]) }}
              />
            </View>
          </View>
        );
      }}
    </Show>
  );
}

function FxNode(props: { game: Nightbloom; fx: FloatFx }) {
  // Drift and fade are pure functions of battle-tick age (FX_LIFE ticks), so
  // the float looks identical at every simulationHz — no wall-clock tween.
  const age = () => Math.min(1, Math.max(0, (props.game.fxTick() - props.fx.born) / FX_LIFE));
  const cls = () => {
    if (props.fx.tone === "lumen") return "text-xs text-amber-300 font-bold";
    if (props.fx.tone === "ward") return "text-xs text-cyan-300 font-bold";
    if (props.fx.tone === "evolve") return "text-xs text-pink-300 font-bold";
    return "text-xs text-red-300 font-bold";
  };
  return (
    <View
      class="absolute"
      style={{ insetL: props.fx.x - 14, insetT: props.fx.y, translateY: -12 * age(), opacity: 1 - age() }}
    >
      <Text class={cls()}>{props.fx.text}</Text>
    </View>
  );
}

function Cursor(props: { game: Nightbloom }) {
  const g = props.game;
  return (
    <View
      debugName="Cursor"
      class="absolute rounded-md border-2 border-cyan-300"
      style={{ insetL: cellX(g.cursorCol()), insetT: cellY(g.cursorRow()), width: BOARD.cellW, height: BOARD.cellH }}
    />
  );
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

function SeedStrip(props: { game: Nightbloom }) {
  const g = props.game;
  return (
    <View class="flex-row gap-1">
      <For each={PLANT_ORDER}>
        {(id) => {
          const def = PLANTS[id];
          const selected = () => g.seed() === id;
          const affordable = () => g.lumen() >= def.cost;
          const chipClass = () => {
            if (selected()) return "flex-row items-center gap-1 px-1 rounded-sm border border-cyan-300 bg-slate-800";
            if (affordable()) return "flex-row items-center gap-1 px-1 rounded-sm border border-slate-700 bg-slate-900";
            return "flex-row items-center gap-1 px-1 rounded-sm border border-slate-800 bg-slate-900 opacity-40";
          };
          return (
            <View class={chipClass()}>
              <Image class="w-[20] h-[20]" src={def.sprites[0]} />
              <Text class="text-xs text-slate-300">{String(def.cost)}</Text>
            </View>
          );
        }}
      </For>
    </View>
  );
}

function TopHud(props: { game: Nightbloom }) {
  const g = props.game;
  const phaseName = () => {
    if (g.phase() === "dusk") return "DUSK";
    if (g.phase() === "midnight") return "MIDNIGHT";
    return "WITCHING HOUR";
  };
  return (
    <View debugName="TopHud" class="absolute left-0 right-0 top-0 h-10 flex-row items-center justify-between px-2 bg-[#020617cc]">
      <View class="flex-row items-center gap-1">
        <Image class="w-[16] h-[16]" src="mote.png" />
        <Text class="text-lg text-amber-200 font-bold">{String(g.lumen())}</Text>
      </View>
      <SeedStrip game={g} />
      <View class="flex-row items-center gap-2">
        <View class="flex-col items-end">
          <Text class="text-xs text-violet-300 tracking-wide">{phaseName()}</Text>
          <Text class="text-xs text-slate-400">{"WAVE " + g.waveIdx() + "/" + WAVES.length}</Text>
        </View>
        <View
          class="w-5 h-5 bg-cyan-200 items-center justify-center"
          style={{ arcStart: 0, arcSweep: Math.max(8, g.progress() * 360), arcWidth: 2 }}
        />
      </View>
    </View>
  );
}

function BottomHud(props: { game: Nightbloom }) {
  const g = props.game;
  return (
    <View debugName="BottomHud" class="absolute left-0 right-0 bottom-0 h-6 flex-row items-center justify-between px-2 bg-[#020617cc]">
      <Show
        when={g.possessed()}
        keyed
        fallback={<Text class="text-xs text-slate-500">X PLANT / FEED   [] SEED   O POSSESS   SELECT CODEX</Text>}
      >
        {(p) => (
          <View class="flex-row items-center gap-2">
            <View
              class="w-4 h-4 bg-amber-300"
              style={{ arcStart: 0, arcSweep: Math.max(8, p.spellReady() * 360), arcWidth: 2 }}
            />
            <Text class="text-xs text-amber-200 tracking-wide">
              {PLANTS[p.kind].name + " -- " + PLANTS[p.kind].spell.name + (p.spellReady() >= 1 ? " READY" : "")}
            </Text>
            <Text class="text-xs text-slate-500">{"HOLD O CHANNEL   /\\ CAST   L R SWITCH"}</Text>
          </View>
        )}
      </Show>
      <Text class="text-xs text-slate-500">{String(g.second()) + "s"}</Text>
    </View>
  );
}

function ToastStack(props: { game: Nightbloom }) {
  return (
    <View debugName="Toasts" class="absolute top-11 right-2 flex-col items-end gap-1">
      <For each={props.game.toasts()}>
        {(t) => (
          <View class="px-2 py-1 rounded-sm bg-slate-900 border border-violet-800">
            <Text class="text-xs text-violet-200 tracking-wide">{t.text}</Text>
          </View>
        )}
      </For>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Codex — the almanac of laws (SELECT)
// ---------------------------------------------------------------------------

function Codex() {
  return (
    <View debugName="Codex" class="absolute inset-0 bg-[#020617e6] flex-col px-4 py-2 gap-1">
      <View class="flex-row justify-between items-end">
        <Text class="text-lg text-pink-200 font-bold tracking-wide">THE GARDEN CODEX</Text>
        <Text class="text-xs text-slate-500">SELECT  CLOSE</Text>
      </View>
      <View class="flex-row gap-4 pt-1">
        <View class="flex-col gap-1 flex-1">
          <Text class="text-xs text-cyan-300 tracking-wide">PLANTS -- GROW BY THEIR OWN WORK</Text>
          <For each={PLANT_ORDER}>
            {(id) => (
              <View class="flex-col">
                <Text class="text-xs text-slate-200">{PLANTS[id].name + "  (" + PLANTS[id].cost + ")"}</Text>
                <Text class="text-xs text-slate-500">{PLANTS[id].law}</Text>
              </View>
            )}
          </For>
        </View>
        <View class="flex-col gap-1 flex-1">
          <Text class="text-xs text-red-300 tracking-wide">FOES -- GROW WITH THE HOUR</Text>
          <For each={FOE_ORDER}>
            {(id) => (
              <View class="flex-col">
                <Text class="text-xs text-slate-200">{FOES[id].name}</Text>
                <Text class="text-xs text-slate-500">{FOES[id].law}</Text>
              </View>
            )}
          </For>
          <Text class="text-xs text-slate-400 pt-1">DUSK SENDS STAGE I. MIDNIGHT II. THE WITCHING HOUR III.</Text>
          <Text class="text-xs text-slate-400">A FOE THAT EATS A PLANT ASCENDS ON THE SPOT.</Text>
        </View>
      </View>
      <Text class="text-xs text-slate-500">FEED A PLANT (X ON IT, 25 LUMEN) TO HURRY ITS BLOOM. WARDS STOP THREE BREACHES.</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Battle screen
// ---------------------------------------------------------------------------

function BattleScreen(props: { game: Nightbloom }) {
  const g = props.game;
  return (
    <View debugName="Battle" class="absolute inset-0 bg-slate-950">
      <Image class="absolute top-0 left-0 w-full h-[240]" src="bg-field.png" />
      <Lanes />
      <Shrine game={g} />
      <For each={g.plants()}>{(p) => <PlantNode game={g} plantId={p.id} />}</For>
      <For each={g.shots()}>
        {(s) => (
          <Image
            class="absolute w-[16] h-[16]"
            src={SHOTS[s.kind].sprite}
            style={{ insetL: s.x() - 8, insetT: cellY(s.row) + 13 }}
          />
        )}
      </For>
      <For each={g.foes()}>{(f) => <FoeNode game={g} foeId={f.id} />}</For>
      <For each={g.fxs()}>{(f) => <FxNode game={g} fx={f} />}</For>
      <Cursor game={g} />
      <TopHud game={g} />
      <Show when={g.augury() !== ""}>
        <View class="absolute left-0 right-0 top-10 flex-row justify-center">
          <Text class="text-xs text-violet-300 tracking-wide">{"AUGURY: " + g.augury()}</Text>
        </View>
      </Show>
      <ToastStack game={g} />
      <BottomHud game={g} />
      <Show when={g.paused()}>
        <View class="absolute inset-0 bg-[#020617b3] items-center justify-center flex-col gap-1">
          <Text class="text-2xl text-slate-100 font-bold tracking-wide">PAUSED</Text>
          <Text class="text-xs text-slate-400">START  RESUME</Text>
        </View>
      </Show>
      <Show when={g.codex()}>
        <Codex />
      </Show>
    </View>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function Nightbloom() {
  const game = createNightbloom();
  onFrame((buttons) => game.frame(buttons));
  return (
    <Screen debugName="NightbloomScreen" class="relative w-full h-full bg-slate-950 overflow-hidden">
      <Show when={game.outcome() === "title"}>
        <TitleScreen />
      </Show>
      <Show when={game.outcome() === "battle"}>
        <BattleScreen game={game} />
      </Show>
      <Show when={game.outcome() === "dawn"}>
        <EndScreen game={game} win={true} />
      </Show>
      <Show when={game.outcome() === "eternal"}>
        <EndScreen game={game} win={false} />
      </Show>
    </Screen>
  );
}
