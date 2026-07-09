// demos/tidelight/app.tsx — TIDELIGHT: a Detroit-grammar narrative game on
// the PocketJS deterministic runtime. An obsolete lighthouse automaton, three
// nights before decommission, finds a half-drowned deserter on the rocks —
// and protocol says report her.
//
// What it demonstrates, mechanically:
//   - timed choices whose timer is the VIRTUAL clock (silence is a branch);
//   - fail-forward QTEs — a missed press scars the story, never restarts it;
//   - meters as native arcs/transforms (DIRECTIVE ring, TRUST bar) with
//     threshold-gated late options, Detroit's instability idea;
//   - a post-chapter flowchart of visited and locked boxes, with REPLAY
//     NIGHT — honest rewind, because the whole run is a pure fold over the
//     input tape (DETERMINISM.md);
//   - the Authority "wire" as an effect-shell driver (backend.ts), so even
//     the network beat is on the virtual clock.
//
// All backdrops and portraits are PixelLab-generated pixel art committed by
// gen-assets.ts. Scene textures are 256x128 (pow2) drawn at 480x240 — a
// uniform 1.875x, PSP-friendly. Every class is a FULL literal and all copy
// is ASCII (Inter has no CJK).

import { createSignal, For, Index, onMount, Show } from "solid-js";
import {
  ActionHandler,
  FocusScope,
  Image,
  Screen,
  Text,
  View,
  type NodeMirror,
} from "@pocketjs/framework/components";
import { animate } from "@pocketjs/framework/animation";
import { BTN } from "@pocketjs/framework/input";
import { createTidelight, type Tidelight } from "./engine.ts";
import {
  FLEET_NOTES,
  type BtnName,
  type ChoiceOption,
  type Flowchart,
  type PortraitName,
  type ScanSpot,
  type Speaker,
} from "./story.ts";

const ALL_BUTTONS =
  BTN.UP | BTN.DOWN | BTN.LEFT | BTN.RIGHT | BTN.CROSS | BTN.CIRCLE |
  BTN.SQUARE | BTN.TRIANGLE | BTN.START | BTN.SELECT;

// ---------------------------------------------------------------------------
// Speaker presentation
// ---------------------------------------------------------------------------

const SPEAKERS: Record<Speaker, { name: string; cls: string; face: PortraitName | null }> = {
  system: { name: "SYSTEM", cls: "text-xs text-cyan-400 tracking-wide", face: "face-wick.png" },
  wick: { name: "WICK-3", cls: "text-xs text-cyan-300 tracking-wide", face: "face-wick.png" },
  maren: { name: "MAREN", cls: "text-xs text-amber-300 tracking-wide", face: "face-maren.png" },
  halloway: { name: "INSP. HALLOWAY", cls: "text-xs text-red-300 tracking-wide", face: "face-halloway.png" },
  wire: { name: "THE WIRE", cls: "text-xs text-red-300 tracking-wide", face: "face-wire.png" },
  narrator: { name: "", cls: "text-xs text-slate-500 tracking-wide", face: null },
};

const QTE_GLYPH: Record<BtnName, string> = {
  CROSS: "X", CIRCLE: "O", SQUARE: "[]", TRIANGLE: "/\\",
  UP: "UP", DOWN: "DOWN", LEFT: "LEFT", RIGHT: "RIGHT",
};

function qteGlyphClass(btn: BtnName): string {
  if (btn === "CROSS") return "text-2xl text-sky-300 font-bold";
  if (btn === "CIRCLE") return "text-2xl text-red-300 font-bold";
  if (btn === "SQUARE") return "text-2xl text-pink-300 font-bold";
  if (btn === "TRIANGLE") return "text-2xl text-emerald-300 font-bold";
  return "text-2xl text-slate-100 font-bold";
}

// ---------------------------------------------------------------------------
// Title / chapter card / verdict
// ---------------------------------------------------------------------------

function TitleScreen() {
  return (
    <View debugName="Title" class="absolute inset-0">
      <Image class="absolute inset-0 w-full h-full" src="bg-title.png" />
      <View class="absolute left-0 right-0 bottom-0 h-24 bg-slate-950 opacity-70" />
      <View class="absolute left-0 right-0 top-10 flex-col items-center gap-1">
        <Text class="text-4xl text-cyan-100 font-bold tracking-wide">TIDELIGHT</Text>
        <Text class="text-xs text-slate-300 tracking-wide">THE LAST WATCH OF SALTMERE LIGHT</Text>
      </View>
      <View class="absolute left-0 right-0 bottom-9 flex-col items-center">
        <Text class="text-sm text-amber-300 tracking-wide animate-pulse">PRESS START</Text>
      </View>
      <View class="absolute left-3 right-3 bottom-2 flex-row justify-between">
        <Text class="text-xs text-slate-500">A POCKETJS STORY</Text>
        <Text class="text-xs text-slate-500">EVERY RUN IS A TAPE</Text>
      </View>
    </View>
  );
}

function ChapterCard(props: { title: string; sub: string }) {
  return (
    <View debugName="ChapterCard" class="absolute inset-0 flex-col items-center justify-center gap-2 bg-slate-950">
      <Text class="text-xs text-slate-500 tracking-wide">SALTMERE LIGHT -- 2049</Text>
      <Text class="text-2xl text-white font-bold tracking-wide">{props.title}</Text>
      <View class="w-14 h-[2] bg-cyan-400" />
      <Text class="text-sm text-slate-400 tracking-wide">{props.sub}</Text>
    </View>
  );
}

function VerdictScreen(props: { game: Tidelight }) {
  const g = props.game;
  const lampLine = () => {
    if (g.hasFlag("fled")) return "THE LAMP: LEFT UNLIT";
    const dark = (g.hasFlag("lamp_dark_1") ? 1 : 0) + (g.hasFlag("lamp_dark_2") ? 1 : 0);
    if (dark === 2) return "THE LAMP: DARK TWO NIGHTS";
    if (dark === 1) return "THE LAMP: DARK ONE NIGHT";
    return "THE LAMP: NEVER DARK";
  };
  const marenLine = () => {
    if (g.hasFlag("maren_dead")) return g.hasFlag("buried") ? "MAREN VOSS: BURIED BY THE ROCKS" : "MAREN VOSS: LOST TO THE FEVER";
    if (g.hasFlag("shielded") || g.hasFlag("skiff")) return "MAREN VOSS: ROWED NORTH, FREE";
    if (g.hasFlag("refused")) return "MAREN VOSS: KEEPS THE LIGHT WITH YOU";
    if (g.hasFlag("fled")) return "MAREN VOSS: GONE INLAND, ALIVE";
    return "MAREN VOSS: TAKEN IN IRONS";
  };
  return (
    <Show when={g.ending()} keyed>
      {(end) => (
        <View debugName="Verdict" class="absolute inset-0 flex-col items-center justify-center gap-2 bg-slate-950">
          <Text class="text-xs text-cyan-400 tracking-wide">{"ENDING " + end.index + " OF 6"}</Text>
          <Text class="text-2xl text-white font-bold tracking-wide">{end.title}</Text>
          <View class="w-14 h-[2] bg-cyan-400" />
          <View class="flex-col items-center gap-1 pt-1">
            <Index each={end.lines}>{(line) => <Text class="text-sm text-slate-300">{line()}</Text>}</Index>
          </View>
          <Text class="text-xs text-amber-300 pt-1">{'"' + end.quote + '"'}</Text>
          <View class="flex-col gap-1 mt-2 p-2 rounded-md border border-slate-800 bg-slate-900">
            <Text class="text-xs text-slate-400">{lampLine()}</Text>
            <Text class="text-xs text-slate-400">{marenLine()}</Text>
            <Text class="text-xs text-slate-400">{"DIRECTIVE INTEGRITY: " + g.integrity() + "%"}</Text>
          </View>
          <View class="absolute left-3 right-3 bottom-2 flex-row justify-between">
            <Text class="text-xs text-slate-500">START  TITLE</Text>
            <Text class="text-xs text-slate-500">{"/\\  REPLAY DAY THREE"}</Text>
          </View>
        </View>
      )}
    </Show>
  );
}

// ---------------------------------------------------------------------------
// Story screen pieces
// ---------------------------------------------------------------------------

function DialoguePanel(props: { game: Tidelight }) {
  const g = props.game;
  const line = () => {
    const n = g.node();
    return n.t === "line" ? n : null;
  };
  const face = (): PortraitName | null => {
    const n = line();
    if (!n) return null;
    if (n.mood) return n.mood;
    const base = SPEAKERS[n.who].face;
    if (n.who === "maren" && g.trust() >= 25) return "face-maren-warm.png";
    return base;
  };
  return (
    <Show when={line()} keyed>
      {(n) => (
        <View debugName="Dialogue" class="absolute left-2 right-2 bottom-10 flex-row gap-2 p-2 rounded-lg bg-[#020617d9] border border-slate-700">
          <Show when={face()} keyed>
            {(src) => <Image class="w-14 h-14 rounded-md" src={src} />}
          </Show>
          <View class="flex-col gap-1 grow">
            <Show when={SPEAKERS[n.who].name !== ""}>
              <Text class={SPEAKERS[n.who].cls}>{SPEAKERS[n.who].name}</Text>
            </Show>
            <Index each={n.text}>
              {(t) => <Text class="text-sm text-slate-100 leading-5">{t()}</Text>}
            </Index>
            <Show when={!n.hold}>
              <View class="flex-row justify-end">
                <Text class="text-xs text-slate-500">O</Text>
              </View>
            </Show>
          </View>
        </View>
      )}
    </Show>
  );
}

function WirePanel(props: { game: Tidelight }) {
  const isWire = () => props.game.node().t === "wire";
  return (
    <Show when={isWire()}>
      <View debugName="WireWait" class="absolute left-2 right-2 bottom-10 flex-row gap-2 p-2 rounded-lg bg-[#020617d9] border border-slate-700 items-center">
        <Image class="w-14 h-14 rounded-md" src="face-wire.png" />
        <View class="flex-col gap-1">
          <Text class="text-xs text-red-300 tracking-wide">THE WIRE</Text>
          <Text class="text-sm text-slate-400 animate-pulse">. . . the wire crackles . . .</Text>
        </View>
      </View>
    </Show>
  );
}

function ChoiceTimer(props: { seconds: number }) {
  let bar: NodeMirror | undefined;
  onMount(() => {
    if (bar) animate(bar, "scaleX", 0, { dur: props.seconds * 1000, easing: "linear" });
  });
  return (
    <View class="w-full h-1 rounded-sm bg-slate-800">
      <View ref={(n) => (bar = n)} class="w-full h-1 rounded-sm bg-amber-400 origin-left" style={{ scaleX: 1 }} />
    </View>
  );
}

function ChoicePanel(props: { game: Tidelight }) {
  const g = props.game;
  const choice = () => {
    const n = g.node();
    return n.t === "choice" ? n : null;
  };
  return (
    <Show when={choice()} keyed>
      {(n) => (
        <View debugName="Choice" class="absolute right-2 bottom-10 w-[250] flex-col gap-1 p-2 rounded-lg bg-[#020617d9] border border-slate-600">
          <Index each={n.prompt}>
            {(t) => <Text class="text-xs text-slate-300 leading-4">{t()}</Text>}
          </Index>
          <ChoiceTimer seconds={n.timeout} />
          <FocusScope restoreFocus={false} class="flex-col gap-1">
            <For each={g.options()}>
              {(opt: ChoiceOption) => (
                <View
                  class="p-1 rounded-md border border-slate-700 bg-slate-900 focus:border-cyan-300 focus:bg-slate-700 transition-colors duration-100"
                  focusable
                  onPress={() => g.choose(opt)}
                >
                  <Text class="text-xs text-slate-100 tracking-wide">{opt.label}</Text>
                </View>
              )}
            </For>
          </FocusScope>
        </View>
      )}
    </Show>
  );
}

function QteOverlay(props: { game: Tidelight }) {
  const g = props.game;
  const qte = () => {
    const n = g.node();
    return n.t === "qte" ? n : null;
  };
  return (
    <Show when={qte()} keyed>
      {(n) => {
        let ring: NodeMirror | undefined;
        onMount(() => {
          if (ring) animate(ring, "arcSweep", 0, { dur: n.window * 1000, easing: "linear" });
        });
        return (
          <View debugName="Qte" class="absolute inset-0 flex-col items-center justify-center gap-2">
            <View
              ref={(node) => (ring = node)}
              class="w-16 h-16 bg-cyan-300 items-center justify-center"
              style={{ arcStart: 0, arcSweep: 360, arcWidth: 4 }}
            >
              <Text class={qteGlyphClass(n.btn)}>{QTE_GLYPH[n.btn]}</Text>
            </View>
            <Text class="text-sm text-white font-bold tracking-wide">{n.label}</Text>
          </View>
        );
      }}
    </Show>
  );
}

function ScanOverlay(props: { game: Tidelight }) {
  const g = props.game;
  const scan = () => {
    const n = g.node();
    return n.t === "scan" ? n : null;
  };
  const spotClass = (spot: ScanSpot, index: number): string => {
    if (g.scanFocus() === index) return "absolute border-2 border-cyan-300";
    if (g.scanned(spot.id)) return "absolute border border-slate-600";
    return "absolute border border-cyan-700";
  };
  return (
    <Show when={scan()} keyed>
      {(n) => (
        <View debugName="Scan" class="absolute inset-0">
          <For each={n.spots}>
            {(spot, i) => (
              <View
                class={spotClass(spot, i())}
                style={{ insetL: spot.x, insetT: spot.y, width: spot.w, height: spot.h }}
              />
            )}
          </For>
          <View class="absolute left-2 right-2 bottom-10 flex-col gap-1 p-2 rounded-lg bg-[#020617d9] border border-cyan-800">
            <View class="flex-row justify-between">
              <Text class="text-xs text-cyan-400 tracking-wide">SWEEP MODE</Text>
              <Text class="text-xs text-slate-400">{"< >  MOVE    O  SCAN"}</Text>
            </View>
            <Text class="text-sm text-slate-100">
              {g.scanned(n.spots[g.scanFocus()].id) ? n.spots[g.scanFocus()].label : "UNREAD RETURN. SCAN TO RESOLVE."}
            </Text>
          </View>
        </View>
      )}
    </Show>
  );
}

function ToastStack(props: { game: Tidelight }) {
  return (
    <View debugName="Toasts" class="absolute top-2 right-2 flex-col items-end gap-1">
      <For each={props.game.toasts()}>
        {(t) => (
          <View class="px-2 py-1 rounded-sm bg-slate-900 border border-cyan-800">
            <Text class="text-xs text-cyan-300 tracking-wide">{t.text}</Text>
          </View>
        )}
      </For>
    </View>
  );
}

function ConsoleStrip(props: { game: Tidelight }) {
  const g = props.game;
  const ledClass = () => {
    if (g.integrity() > 66) return "w-5 h-5 bg-cyan-400";
    if (g.integrity() > 33) return "w-5 h-5 bg-amber-400";
    return "w-5 h-5 bg-red-400";
  };
  const hint = () => {
    const n = g.node();
    if (n.t === "choice") return "D-PAD MOVE   O CHOOSE";
    if (n.t === "qte") return "ANSWER THE PROMPT";
    if (n.t === "scan") return "SWEEP THE SHORE";
    if (n.t === "wire") return "STAND BY";
    return "O CONTINUE";
  };
  return (
    <View debugName="Console" class="absolute left-0 right-0 bottom-0 h-8 flex-row items-center justify-between px-3 bg-slate-950">
      <View class="flex-row items-center gap-2">
        <View class={ledClass()} style={{ arcStart: 0, arcSweep: Math.max(8, g.integrity() * 3.6), arcWidth: 2 }} />
        <Text class="text-xs text-slate-500 tracking-wide">WICK-3</Text>
        <Text class="text-xs text-slate-400">{"DIRECTIVE " + g.integrity() + "%"}</Text>
        <Show when={g.metMaren()}>
          <View class="flex-row items-center gap-1">
            <Text class="text-xs text-slate-500 tracking-wide">TRUST</Text>
            <View class="w-10 h-1 rounded-sm bg-slate-800">
              <View class="w-10 h-1 rounded-sm bg-amber-400 origin-left" style={{ scaleX: props.game.trust() / 100 }} />
            </View>
          </View>
        </Show>
      </View>
      <Text class="text-xs text-slate-500">{hint()}</Text>
    </View>
  );
}

function StoryScreen(props: { game: Tidelight }) {
  const g = props.game;
  return (
    <View debugName="Story" class="absolute inset-0 bg-slate-950">
      <Image class="absolute top-0 left-0 w-full h-[240]" src={g.bg()} />
      <DialoguePanel game={g} />
      <WirePanel game={g} />
      <ChoicePanel game={g} />
      <QteOverlay game={g} />
      <ScanOverlay game={g} />
      <ToastStack game={g} />
      <ConsoleStrip game={g} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Flowchart — the post-chapter map of taken and locked paths
// ---------------------------------------------------------------------------

interface Seg {
  x: number;
  y: number;
  w: number;
  h: number;
  lit: boolean;
}

function chartLayout(chart: Flowchart) {
  const cols = Math.max(...chart.nodes.map((n) => n.col)) + 1;
  const rows = Math.max(...chart.nodes.map((n) => n.row)) + 1;
  const gapX = 6;
  const boxW = Math.floor((480 - 16 - (cols - 1) * gapX) / cols);
  const boxH = 20;
  const areaTop = 46;
  const areaH = 272 - areaTop - 40;
  const gapY = rows > 1 ? Math.max(4, Math.min(14, Math.floor((areaH - rows * boxH) / (rows - 1)))) : 0;
  const x = (col: number) => 8 + col * (boxW + gapX);
  const y = (row: number) => areaTop + row * (boxH + gapY);
  return { boxW, boxH, x, y };
}

function FlowchartScreen(props: { game: Tidelight }) {
  const g = props.game;
  return (
    <Show when={g.chart()} keyed>
      {(chart) => {
        const { boxW, boxH, x, y } = chartLayout(chart);
        const byId = new Map(chart.nodes.map((n) => [n.id, n]));
        const segs: Seg[] = [];
        for (const [from, to] of chart.edges) {
          const a = byId.get(from)!;
          const b = byId.get(to)!;
          const lit = g.visited(a.id) && g.visited(b.id);
          const ax = x(a.col) + boxW;
          const ay = y(a.row) + Math.floor(boxH / 2);
          const bx = x(b.col);
          const by = y(b.row) + Math.floor(boxH / 2);
          if (ay === by) {
            segs.push({ x: ax, y: ay - 1, w: bx - ax, h: 2, lit });
          } else {
            const mx = ax + Math.max(2, Math.floor((bx - ax) / 2));
            segs.push({ x: ax, y: ay - 1, w: mx - ax, h: 2, lit });
            segs.push({ x: mx - 1, y: Math.min(ay, by) - 1, w: 2, h: Math.abs(by - ay) + 2, lit });
            segs.push({ x: mx, y: by - 1, w: bx - mx, h: 2, lit });
          }
        }
        const seen = g.chartSeen();
        return (
          <View debugName="Flowchart" class="absolute inset-0 bg-slate-950">
            <View class="absolute left-3 right-3 top-2 flex-row items-end justify-between">
              <View class="flex-col">
                <Text class="text-xs text-slate-500 tracking-wide">KEEPER'S LOG -- PATHS TAKEN</Text>
                <Text class="text-lg text-white font-bold tracking-wide">{chart.title}</Text>
              </View>
              <Text class="text-xs text-cyan-400">{seen.seen + " / " + seen.total + " SEEN"}</Text>
            </View>
            <For each={segs}>
              {(s) => (
                <View
                  class={s.lit ? "absolute bg-cyan-700" : "absolute bg-slate-800"}
                  style={{ insetL: s.x, insetT: s.y, width: s.w, height: s.h }}
                />
              )}
            </For>
            <For each={chart.nodes}>
              {(n) => (
                <View
                  class={
                    g.visited(n.id)
                      ? "absolute rounded-sm items-center justify-center bg-slate-800 border border-cyan-400"
                      : "absolute rounded-sm items-center justify-center bg-slate-900 border border-slate-800"
                  }
                  style={{ insetL: x(n.col), insetT: y(n.row), width: boxW, height: boxH }}
                >
                  <Text class={g.visited(n.id) ? "text-xs text-cyan-100" : "text-xs text-slate-600"}>
                    {g.visited(n.id) ? n.label : "?????"}
                  </Text>
                </View>
              )}
            </For>
            <View class="absolute left-3 right-3 bottom-2 flex-row items-center justify-between">
              <Text class="text-xs text-slate-600">{FLEET_NOTES[chart.night]}</Text>
              <Text class="text-xs text-slate-400">{"O NEXT   /\\ REPLAY"}</Text>
            </View>
          </View>
        );
      }}
    </Show>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function Tidelight() {
  const game = createTidelight();
  const cardNode = () => {
    const n = game.node();
    return game.phase() === "card" && n.t === "card" ? n : null;
  };
  return (
    <Screen debugName="TidelightScreen" class="relative w-full h-full bg-slate-950 overflow-hidden">
      <ActionHandler button={ALL_BUTTONS} onPress={(pressed) => game.press(pressed)} />
      <Show when={game.phase() === "title"}>
        <TitleScreen />
      </Show>
      <Show when={cardNode()} keyed>
        {(n) => <ChapterCard title={n.title} sub={n.sub} />}
      </Show>
      <Show when={game.phase() === "story"}>
        <StoryScreen game={game} />
      </Show>
      <Show when={game.phase() === "flowchart"}>
        <FlowchartScreen game={game} />
      </Show>
      <Show when={game.phase() === "verdict"}>
        <VerdictScreen game={game} />
      </Show>
    </Screen>
  );
}
