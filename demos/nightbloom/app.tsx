// demos/nightbloom/app.tsx — NIGHTBLOOM: a vertical danmaku shooter on the
// PocketJS deterministic runtime, in the Imperishable Night grammar: the
// player pilots one plant form at the bottom of a portrait playfield, the
// eternal-night horde descends from the treeline above, and the piloted form
// switches mid-fight — five plants, five shot types, five spell cards.
//
// On the 480x272 landscape screen the field is the classic arcade
// adaptation: a portrait column in the center with HUD panels on both
// sides (the night on the left, the roster on the right).
//
// What it demonstrates, mechanically:
//   - a bullet-hell simulated in fixed 1/60 s micro-ticks, subsample-exact
//     at every simulationHz — the 2 Hz world dodges the SAME spiral;
//   - form-switching as the player verb: five plants with distinct
//     attack/defense stats (homing, pierce, true-damage fan, armored tank,
//     moonlight economy), each evolving I -> II -> III by its own work;
//   - enemy danmaku as native dots from a quantized sine table, plus a
//     midboss and a three-card final boss with Touhou-style timeouts;
//   - graze, a point-of-collection line, per-form spell cards that double
//     as bullet clears — all on the virtual clock.
//
// All sprites and backdrops are PixelLab-generated pixel art committed by
// gen-assets.ts. Every class is a FULL literal and all copy is ASCII (Inter
// has no CJK).

import { For, Show } from "solid-js";
import { Image, Screen, Text, View } from "@pocketjs/framework/components";
import { onFrame } from "@pocketjs/framework/lifecycle";
import {
  FIELD,
  FOES,
  FOE_ORDER,
  PANEL_L,
  PANEL_R,
  PLANTS,
  PLANT_ORDER,
  POC_Y,
  SHOTS,
  WAVES,
} from "./data.ts";
import { createNightbloom, FX_LIFE, type FloatFx, type Nightbloom, type PlantState } from "./engine.ts";

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
        <Text class="text-xs text-slate-400">ARROWS FLY   HOLD X FIRE   HOLD [] FOCUS   O SWITCH FORM</Text>
        <Text class="text-xs text-slate-400">{"/\\ SPELL CARD   L R SWITCH   SELECT CODEX"}</Text>
      </View>
      <View class="absolute left-3 right-3 bottom-2 flex-row justify-between">
        <Text class="text-xs text-slate-500">A POCKETJS DANMAKU</Text>
        <Text class="text-xs text-slate-500">EVERY NIGHT IS A TAPE</Text>
      </View>
    </View>
  );
}

function EndScreen(props: { game: Nightbloom; win: boolean }) {
  const g = props.game;
  const survivors = () => g.roster.filter((r) => r.hp() > 0).length;
  return (
    <View debugName="End" class="absolute inset-0">
      <Image class="absolute inset-0 w-full h-full" src={props.win ? "bg-dawn.png" : "bg-eternal.png"} />
      <View class="absolute inset-0 bg-slate-950 opacity-55" />
      <View class="absolute left-0 right-0 top-10 flex-col items-center gap-2">
        <Text class="text-xs text-slate-300 tracking-wide">{props.win ? "THE DIVA FALLS SILENT" : "THE GARDEN FALLS DARK"}</Text>
        <Text class={props.win ? "text-4xl text-amber-200 font-bold tracking-wide" : "text-4xl text-red-300 font-bold tracking-wide"}>
          {props.win ? "DAWN BREAKS" : "ETERNAL NIGHT"}
        </Text>
        <View class="w-14 h-[2] bg-pink-300" />
      </View>
      <View class="absolute left-0 right-0 top-28 flex-col items-center gap-1">
        <View class="flex-col gap-1 p-2 rounded-md border border-slate-700 bg-[#020617cc] items-center">
          <Text class="text-xs text-slate-300">{"SCORE: " + g.score()}</Text>
          <Text class="text-xs text-slate-300">{"GRAZE: " + g.graze()}</Text>
          <Text class="text-xs text-slate-300">{"FOES FELLED: " + g.kills()}</Text>
          <Text class="text-xs text-slate-300">{"GREATEST BLOOM: STAGE " + g.bestStage()}</Text>
          <Text class="text-xs text-slate-300">{"SURVIVING FORMS: " + survivors() + " OF 5"}</Text>
        </View>
      </View>
      <View class="absolute left-0 right-0 bottom-4 flex-col items-center">
        <Text class="text-sm text-amber-300 tracking-wide">START  RETURN TO TITLE</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The field
// ---------------------------------------------------------------------------

/** Two drifting star layers — positions are pure functions of the battle
 *  tick, so the parallax subsamples exactly like everything else. */
const STARS = [
  { x: 22, y: 30, layer: 1 }, { x: 61, y: 120, layer: 1 }, { x: 104, y: 70, layer: 1 },
  { x: 146, y: 180, layer: 1 }, { x: 178, y: 40, layer: 1 }, { x: 35, y: 210, layer: 1 },
  { x: 130, y: 236, layer: 1 }, { x: 88, y: 156, layer: 1 },
  { x: 44, y: 84, layer: 2 }, { x: 96, y: 20, layer: 2 }, { x: 152, y: 130, layer: 2 },
  { x: 14, y: 160, layer: 2 }, { x: 186, y: 220, layer: 2 }, { x: 70, y: 250, layer: 2 },
];

function Starfield(props: { game: Nightbloom }) {
  const g = props.game;
  return (
    <View debugName="Stars" class="absolute inset-0 overflow-hidden">
      <For each={STARS}>
        {(s) => (
          <View
            class={s.layer === 1 ? "absolute w-1 h-1 rounded-full bg-slate-700" : "absolute w-1 h-1 rounded-full bg-slate-500"}
            style={{ insetL: s.x, insetT: (s.y + Math.floor(g.fxTick() * (s.layer === 1 ? 0.35 : 0.7))) % FIELD.h }}
          />
        )}
      </For>
    </View>
  );
}

function PlayerNode(props: { game: Nightbloom }) {
  const g = props.game;
  const sprite = () => {
    const p = g.active();
    return PLANTS[p.kind].sprites[p.stage() - 1];
  };
  const blink = () => (g.invuln() ? ((g.fxTick() >> 2) & 1) === 0 : true);
  return (
    <View
      debugName="Player"
      class="absolute items-center justify-center"
      style={{ insetL: g.px() - FIELD.x0 - 13, insetT: g.py() - FIELD.y0 - 13, width: 26, height: 26, opacity: blink() ? 1 : 0.35 }}
    >
      <Image class="w-[26] h-[26]" src={sprite()} />
      <Show when={g.shield()}>
        <View class="absolute w-[26] h-[26] rounded-full border-2 border-amber-300" />
      </Show>
      <Show when={g.focus()}>
        <View class="absolute w-1 h-1 rounded-full bg-white" style={{ insetL: 11, insetT: 11 }} />
      </Show>
    </View>
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
            class="absolute items-center"
            style={{ insetL: f.x() - FIELD.x0 - 13, insetT: f.y() - FIELD.y0 - 13, width: 26, height: 30 }}
          >
            <Image class="w-[26] h-[26]" src={def.sprites[f.stage - 1]} />
            <View class="absolute left-1 right-1 top-0 h-1 rounded-sm bg-[#02061799]">
              <View
                class="h-1 rounded-sm bg-red-400 origin-left w-full"
                style={{ scaleX: Math.max(0, f.hp() / def.hp[f.stage - 1]) }}
              />
            </View>
          </View>
        );
      }}
    </Show>
  );
}

function BossNode(props: { game: Nightbloom }) {
  const g = props.game;
  return (
    <Show when={g.boss()} keyed>
      {(b) => (
        <View
          debugName="Boss"
          class="absolute items-center justify-center"
          style={{ insetL: b.x() - FIELD.x0 - 26, insetT: b.y() - FIELD.y0 - 26, width: 52, height: 52 }}
        >
          <Image class="w-[52] h-[52]" src={b.def.sprite} />
        </View>
      )}
    </Show>
  );
}

function EnemyShotNode(props: { game: Nightbloom; shotId: number }) {
  const g = props.game;
  const shot = () => g.enemyShots().find((s) => s.id === props.shotId);
  return (
    <Show when={shot()} keyed>
      {(s) =>
        s.kind === "mochi" ? (
          <Image
            class="absolute w-[12] h-[12]"
            src="shot-mochi.png"
            style={{ insetL: s.x() - FIELD.x0 - 6, insetT: s.y() - FIELD.y0 - 6 }}
          />
        ) : (
          <View
            class={
              s.kind === "pink"
                ? "absolute w-2 h-2 rounded-full bg-pink-300 border border-pink-100"
                : s.kind === "cyan"
                  ? "absolute w-2 h-2 rounded-full bg-cyan-300 border border-cyan-100"
                  : "absolute w-2 h-2 rounded-full bg-amber-300 border border-amber-100"
            }
            style={{ insetL: s.x() - FIELD.x0 - 4, insetT: s.y() - FIELD.y0 - 4 }}
          />
        )
      }
    </Show>
  );
}

function PlayerShotNode(props: { game: Nightbloom; shotId: number }) {
  const g = props.game;
  const shot = () => g.playerShots().find((s) => s.id === props.shotId);
  return (
    <Show when={shot()} keyed>
      {(s) =>
        s.kind === "petal" ? (
          <View class="absolute w-1 h-2 rounded-full bg-pink-200" style={{ insetL: s.x() - FIELD.x0 - 2, insetT: s.y() - FIELD.y0 - 4 }} />
        ) : (
          <Image
            class={s.kind === "heavy" ? "absolute w-[14] h-[14]" : "absolute w-[12] h-[12]"}
            src={s.kind === "orb" ? SHOTS.orb.sprite : SHOTS.bolt.sprite}
            style={{ insetL: s.x() - FIELD.x0 - 6, insetT: s.y() - FIELD.y0 - 6, rotate: s.kind === "orb" ? 0 : -90 }}
          />
        )
      }
    </Show>
  );
}

function FxNode(props: { game: Nightbloom; fx: FloatFx }) {
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
      style={{ insetL: props.fx.x - FIELD.x0 - 10, insetT: props.fx.y - FIELD.y0, translateY: -12 * age(), opacity: 1 - age() }}
    >
      <Text class={cls()}>{props.fx.text}</Text>
    </View>
  );
}

function Field(props: { game: Nightbloom }) {
  const g = props.game;
  return (
    <View
      debugName="Field"
      class="absolute rounded-sm border border-slate-800 bg-[#0b1023] overflow-hidden"
      style={{ insetL: FIELD.x0 - 1, insetT: FIELD.y0 - 1, width: FIELD.w + 2, height: FIELD.h + 2 }}
    >
      <Starfield game={g} />
      <View class="absolute left-0 right-0 h-[1] bg-[#33415566]" style={{ insetT: POC_Y - FIELD.y0 }} />
      <Show when={g.fxTick() - g.beam() < 20 && g.beam() > 0}>
        <View
          class="absolute w-[40] bg-emerald-200 opacity-50 rounded-sm"
          style={{ insetL: g.px() - FIELD.x0 - 20, insetT: 0, height: FIELD.h }}
        />
      </Show>
      <For each={g.motes()}>
        {(m) => (
          <Image class="absolute w-[10] h-[10]" src="mote.png" style={{ insetL: m.x() - FIELD.x0 - 5, insetT: m.y() - FIELD.y0 - 5 }} />
        )}
      </For>
      <For each={g.foes()}>{(f) => <FoeNode game={g} foeId={f.id} />}</For>
      <BossNode game={g} />
      <For each={g.playerShots()}>{(s) => <PlayerShotNode game={g} shotId={s.id} />}</For>
      <PlayerNode game={g} />
      <For each={g.enemyShots()}>{(s) => <EnemyShotNode game={g} shotId={s.id} />}</For>
      <For each={g.fxs()}>{(f) => <FxNode game={g} fx={f} />}</For>
      <Show when={g.boss()} keyed>
        {(b) => (
          <View class="absolute left-1 right-1 top-1 flex-col gap-1">
            <View class="h-1 rounded-sm bg-[#02061799]">
              <View
                class="h-1 rounded-sm bg-red-400 origin-left w-full"
                style={{ scaleX: Math.max(0, b.hp() / b.def.phases[b.phase()].hp) }}
              />
            </View>
          </View>
        )}
      </Show>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Side panels
// ---------------------------------------------------------------------------

function LeftPanel(props: { game: Nightbloom }) {
  const g = props.game;
  const phaseName = () => {
    if (g.phase() === "dusk") return "DUSK";
    if (g.phase() === "midnight") return "MIDNIGHT";
    return "WITCHING HOUR";
  };
  return (
    <View
      debugName="LeftPanel"
      class="absolute flex-col gap-1 px-2 py-2"
      style={{ insetL: PANEL_L.x0, insetT: 0, width: PANEL_L.w, height: 272 }}
    >
      <Text class="text-lg text-pink-200 font-bold tracking-wide">NIGHTBLOOM</Text>
      <Text class="text-xs text-slate-500 tracking-wide">THE ETERNAL NIGHT</Text>
      <View class="flex-col gap-1 mt-2 p-2 rounded-md border border-slate-800 bg-[#020617aa]">
        <Text class="text-xs text-violet-300 tracking-wide">{phaseName()}</Text>
        <Text class="text-xs text-slate-400">{"WAVE " + g.waveIdx() + "/" + WAVES.length}</Text>
        <Text class="text-xs text-slate-400">{String(g.second()) + "s TO DAWN?"}</Text>
      </View>
      <Show when={g.augury() !== ""}>
        <View class="flex-col gap-1 p-2 rounded-md border border-violet-900 bg-[#020617aa]">
          <Text class="text-xs text-violet-300 tracking-wide">AUGURY</Text>
          <Text class="text-xs text-slate-400 leading-4">{g.augury()}</Text>
        </View>
      </Show>
      <Show when={g.boss()} keyed>
        {(b) => (
          <View class="flex-col gap-1 p-2 rounded-md border border-red-900 bg-[#020617aa]">
            <Text class="text-xs text-red-300 tracking-wide">{b.def.name}</Text>
            <Text class="text-xs text-slate-300 leading-4">{b.def.phases[b.phase()].card}</Text>
            <Text class="text-xs text-slate-500">{"TIMEOUT " + g.bossCardSeconds() + "s"}</Text>
          </View>
        )}
      </Show>
      <View class="grow" />
      <Text class="text-xs text-slate-600">HOLD X FIRE  [] FOCUS</Text>
      <Text class="text-xs text-slate-600">{"O / L / R SWITCH  /\\ SPELL"}</Text>
      <Text class="text-xs text-slate-600">SELECT CODEX</Text>
    </View>
  );
}

function RosterCard(props: { game: Nightbloom; idx: number; plant: PlantState }) {
  const g = props.game;
  const p = props.plant;
  const def = PLANTS[p.kind];
  const isActive = () => g.activeIdx() === props.idx;
  const wilted = () => p.hp() <= 0;
  const cardClass = () => {
    if (wilted()) return "flex-row items-center gap-1 p-1 rounded-md border border-slate-800 bg-slate-900 opacity-40";
    if (isActive()) return "flex-row items-center gap-1 p-1 rounded-md border border-amber-300 bg-slate-800";
    return "flex-row items-center gap-1 p-1 rounded-md border border-slate-700 bg-slate-900";
  };
  return (
    <View class={cardClass()}>
      <Image class="w-[20] h-[20]" src={def.sprites[p.stage() - 1]} />
      <View class="flex-col gap-1 grow">
        <View class="flex-row justify-between items-center">
          <Text class="text-xs text-slate-200">{def.stageNames[p.stage() - 1]}</Text>
          <View class="flex-row gap-[1]">
            <View class={p.stage() >= 1 ? "w-1 h-1 rounded-full bg-pink-300" : "w-1 h-1 rounded-full bg-slate-700"} />
            <View class={p.stage() >= 2 ? "w-1 h-1 rounded-full bg-pink-300" : "w-1 h-1 rounded-full bg-slate-700"} />
            <View class={p.stage() >= 3 ? "w-1 h-1 rounded-full bg-pink-300" : "w-1 h-1 rounded-full bg-slate-700"} />
          </View>
        </View>
        <View class="h-1 rounded-sm bg-[#02061799]">
          <View
            class="h-1 rounded-sm bg-emerald-400 origin-left w-full"
            style={{ scaleX: Math.max(0, p.hp() / def.hp[p.stage() - 1]) }}
          />
        </View>
      </View>
    </View>
  );
}

function RightPanel(props: { game: Nightbloom }) {
  const g = props.game;
  return (
    <View
      debugName="RightPanel"
      class="absolute flex-col gap-1 px-2 py-2"
      style={{ insetL: PANEL_R.x0, insetT: 0, width: PANEL_R.w, height: 272 }}
    >
      <View class="flex-row justify-between items-end">
        <Text class="text-xs text-slate-500 tracking-wide">SCORE</Text>
        <Text class="text-sm text-amber-200 font-bold">{String(g.score())}</Text>
      </View>
      <View class="flex-row justify-between items-end">
        <Text class="text-xs text-slate-500 tracking-wide">GRAZE</Text>
        <Text class="text-xs text-cyan-300">{String(g.graze())}</Text>
      </View>
      <View class="flex-col gap-1 pt-1">
        <For each={g.roster}>{(p, i) => <RosterCard game={g} idx={i()} plant={p} />}</For>
      </View>
      <View class="grow" />
      <View class="flex-row items-center gap-2 p-1 rounded-md border border-slate-800 bg-[#020617aa]">
        <View
          class="w-4 h-4 bg-amber-300"
          style={{ arcStart: 0, arcSweep: Math.max(8, g.active().spellReady() * 360), arcWidth: 2 }}
        />
        <View class="flex-col">
          <Text class="text-xs text-amber-200 tracking-wide">{PLANTS[g.active().kind].spell.name}</Text>
          <Text class="text-xs text-slate-500">{g.active().spellReady() >= 1 ? "READY" : "CHARGING"}</Text>
        </View>
      </View>
    </View>
  );
}

function ToastStack(props: { game: Nightbloom }) {
  return (
    <View debugName="Toasts" class="absolute flex-col items-center gap-1" style={{ insetL: FIELD.x0, insetT: 24, width: FIELD.w }}>
      <For each={props.game.toasts()}>
        {(t) => (
          <View class="px-2 py-1 rounded-sm bg-[#0f172acc] border border-violet-800">
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
          <Text class="text-xs text-cyan-300 tracking-wide">FORMS -- GROW BY THEIR OWN WORK</Text>
          <For each={PLANT_ORDER}>
            {(id) => (
              <View class="flex-col">
                <Text class="text-xs text-slate-200">{PLANTS[id].name}</Text>
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
        </View>
      </View>
      <Text class="text-xs text-slate-400">MOTES FEED THE PILOTED FORM. GRAZE FEEDS IT TOO. CLIMB PAST THE HIGH LINE AND EVERY MOTE COMES TO YOU.</Text>
      <Text class="text-xs text-slate-500">WHEN A FORM WILTS THE NEXT ONE TAKES THE STICK. LOSE ALL FIVE AND THE NIGHT IS ETERNAL.</Text>
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
      <LeftPanel game={g} />
      <Field game={g} />
      <RightPanel game={g} />
      <ToastStack game={g} />
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
