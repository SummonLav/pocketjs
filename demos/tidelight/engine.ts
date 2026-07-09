// demos/tidelight/engine.ts — the story engine: a state machine that folds
// story.ts over the virtual clock. No JSX here; app.tsx is a thin renderer
// over these signals, which keeps the whole game logic host-agnostic and
// sim-testable.
//
// Determinism contract (DETERMINISM.md):
//   - every wait is `after()` on the virtual clock (choice timeouts, QTE
//     windows, chapter cards, toast expiry) — never setTimeout;
//   - the Inspector's transmissions arrive through the effect shell
//     (runEffect("wire") -> frame-boundary delivery, see backend.ts);
//   - node transitions bump an epoch, and every scheduled callback checks it,
//     so a disposed beat can never fire into a later one;
//   - there is no randomness anywhere: a playthrough is a pure function of
//     the input tape, which is what makes REPLAY NIGHT byte-honest.

import { createSignal, type Accessor } from "solid-js";
import { after, virtualFrame } from "@pocketjs/framework/clock";
import { runEffect } from "@pocketjs/framework/effects";
import { BTN } from "@pocketjs/framework/input";
import {
  ENDINGS,
  FLOWCHARTS,
  INTEGRITY_START,
  START_NODE,
  STORY,
  TRUST_START,
  type BtnName,
  type ChoiceOption,
  type Cond,
  type EndingDef,
  type FlagName,
  type Flowchart,
  type Fx,
  type NodeId,
  type StoryNode,
} from "./story.ts";

export type Phase = "title" | "card" | "story" | "flowchart" | "verdict";

export interface Toast {
  id: number;
  text: string;
}

interface Snapshot {
  node: NodeId;
  integrity: number;
  trust: number;
  suspicion: number;
  flags: FlagName[];
  history: NodeId[];
}

const BTN_MASK: Record<BtnName, number> = {
  UP: BTN.UP,
  DOWN: BTN.DOWN,
  LEFT: BTN.LEFT,
  RIGHT: BTN.RIGHT,
  CROSS: BTN.CROSS,
  SQUARE: BTN.SQUARE,
  TRIANGLE: BTN.TRIANGLE,
  CIRCLE: BTN.CIRCLE,
};

/** Buttons that can answer (or flub) a QTE. */
const QTE_MASK = BTN.UP | BTN.DOWN | BTN.LEFT | BTN.RIGHT | BTN.CROSS | BTN.SQUARE | BTN.TRIANGLE | BTN.CIRCLE;

export function btnMask(name: BtnName): number {
  return BTN_MASK[name];
}

export interface Tidelight {
  phase: Accessor<Phase>;
  node: Accessor<StoryNode>;
  nodeId: Accessor<NodeId>;
  bg: Accessor<string>;
  integrity: Accessor<number>;
  trust: Accessor<number>;
  metMaren: Accessor<boolean>;
  toasts: Accessor<Toast[]>;
  /** Cond-filtered options of the current choice node. */
  options: Accessor<ChoiceOption[]>;
  scanFocus: Accessor<number>;
  scanned: (spotId: string) => boolean;
  visited: (id: NodeId) => boolean;
  chart: Accessor<Flowchart>;
  chartSeen: Accessor<{ seen: number; total: number }>;
  ending: Accessor<EndingDef | null>;
  hasFlag: (f: FlagName) => boolean;
  /** Route one edge-detected button mask (spec BTN bits). */
  press: (pressed: number) => void;
  choose: (opt: ChoiceOption) => void;
  start: () => void;
  continueStory: () => void;
  replayNight: () => void;
  toTitle: () => void;
}

export function createTidelight(): Tidelight {
  const [phase, setPhase] = createSignal<Phase>("title");
  const [nodeId, setNodeId] = createSignal<NodeId>(START_NODE);
  const [bg, setBg] = createSignal<string>("bg-title.png");
  const [integrity, setIntegrity] = createSignal(INTEGRITY_START);
  const [trust, setTrust] = createSignal(TRUST_START);
  const [suspicion, setSuspicion] = createSignal(0);
  const [flags, setFlags] = createSignal<ReadonlySet<FlagName>>(new Set());
  const [history, setHistory] = createSignal<readonly NodeId[]>([]);
  const [toasts, setToasts] = createSignal<Toast[]>([]);
  const [scanFocus, setScanFocus] = createSignal(0);
  const [scannedIds, setScannedIds] = createSignal<ReadonlySet<string>>(new Set());
  const [lastChapter, setLastChapter] = createSignal<1 | 2 | 3>(1);
  const [ending, setEnding] = createSignal<EndingDef | null>(null);

  const snapshots = new Map<number, Snapshot>();
  let epoch = 0;
  let disposers: (() => void)[] = [];
  let toastSeq = 0;
  // The frame a choice node mounted on. Within one frame transaction the app
  // hooks run BEFORE the focus system's edge-detection (DETERMINISM.md), so
  // the CIRCLE press that advanced the previous line would otherwise also
  // fire onPress of the freshly auto-focused option — one press, two beats.
  // Confirms are ignored on the mount frame; the guard is frame-counted, so
  // it is exactly as deterministic as everything else here.
  let choiceArmedFrame = -1;

  const node = () => STORY[nodeId()];

  // -- timers ---------------------------------------------------------------

  function disposeTimers(): void {
    epoch++;
    for (const d of disposers) d();
    disposers = [];
  }

  /** Virtual-clock timer scoped to the current node: transition disposes it. */
  function nodeAfter(seconds: number, cb: () => void): void {
    const at = epoch;
    disposers.push(
      after(seconds, () => {
        if (at === epoch) cb();
      }),
    );
  }

  // -- state ----------------------------------------------------------------

  function clamp(v: number): number {
    return Math.max(0, Math.min(100, v));
  }

  function toast(text: string): void {
    const t: Toast = { id: ++toastSeq, text };
    setToasts((prev) => [...prev, t]);
    // Toast expiry outlives node transitions on purpose — not nodeAfter.
    after(2.5, () => setToasts((prev) => prev.filter((x) => x.id !== t.id)));
  }

  function applyFx(fx: Fx[] | undefined): void {
    if (!fx) return;
    for (const f of fx) {
      if (f.integrity) {
        setIntegrity((v) => clamp(v + f.integrity!));
        toast(`DIRECTIVE ${f.integrity > 0 ? "+" : ""}${f.integrity}`);
      }
      if (f.trust) {
        setTrust((v) => clamp(v + f.trust!));
        toast(`TRUST ${f.trust > 0 ? "+" : ""}${f.trust}`);
      }
      if (f.suspicion) setSuspicion((v) => v + f.suspicion!); // silent — his ledger, not yours
      if (f.set) setFlags((prev) => new Set(prev).add(f.set!));
    }
  }

  function evalCond(c: Cond): boolean {
    if (c.flag && !flags().has(c.flag)) return false;
    if (c.not && flags().has(c.not)) return false;
    if (c.minTrust !== undefined && trust() < c.minTrust) return false;
    if (c.minIntegrity !== undefined && integrity() < c.minIntegrity) return false;
    if (c.maxIntegrity !== undefined && integrity() > c.maxIntegrity) return false;
    if (c.minSuspicion !== undefined && suspicion() < c.minSuspicion) return false;
    if (c.maxSuspicion !== undefined && suspicion() > c.maxSuspicion) return false;
    return true;
  }

  function snapshot(chapter: number, at: NodeId): void {
    snapshots.set(chapter, {
      node: at,
      integrity: integrity(),
      trust: trust(),
      suspicion: suspicion(),
      flags: [...flags()],
      history: [...history()],
    });
  }

  // -- the fold -------------------------------------------------------------

  function enter(id: NodeId): void {
    disposeTimers();
    for (;;) {
      const n = STORY[id];
      if (!n) throw new Error(`tidelight: unknown story node "${id}"`);
      setHistory((prev) => [...prev, id]);
      setNodeId(id);

      if (n.t === "scene") {
        setBg(n.bg);
        id = n.next;
        continue;
      }
      if (n.t === "branch") {
        const arm = n.arms.find((a) => evalCond(a.if));
        id = arm ? arm.to : n.else;
        continue;
      }
      if (n.t === "card") {
        snapshot(n.chapter, id);
        setPhase("card");
        nodeAfter(n.hold, () => enter(n.next));
        return;
      }
      if (n.t === "chapter") {
        setLastChapter(n.index);
        setPhase("flowchart");
        return;
      }
      if (n.t === "end") {
        setEnding(ENDINGS.find((e) => e.id === n.ending) ?? null);
        setPhase("verdict");
        return;
      }
      if (n.t === "wire") {
        setPhase("story");
        const at = epoch;
        runEffect("wire", { night: n.night }, () => {
          if (at === epoch) enter(n.next);
        });
        return;
      }
      if (n.t === "line") {
        setPhase("story");
        applyFx(n.fx);
        if (n.hold) nodeAfter(n.hold, () => enter(n.next));
        return;
      }
      if (n.t === "choice") {
        setPhase("story");
        choiceArmedFrame = virtualFrame();
        nodeAfter(n.timeout, () => enter(n.silence));
        return;
      }
      if (n.t === "qte") {
        setPhase("story");
        nodeAfter(n.window, () => {
          applyFx(n.missFx);
          enter(n.miss);
        });
        return;
      }
      if (n.t === "scan") {
        setPhase("story");
        setScanFocus(0);
        setScannedIds(new Set<string>());
        return;
      }
      throw new Error(`tidelight: unhandled node type at "${id}"`);
    }
  }

  // -- input routing ----------------------------------------------------------

  function scanConfirm(): void {
    const n = node();
    if (n.t !== "scan") return;
    const spot = n.spots[scanFocus()];
    if (!spot) return;
    if (scannedIds().has(spot.id)) {
      // Already read — step to the next unread spot so mashing confirm
      // walks the whole sweep.
      const next = n.spots.findIndex((s) => !scannedIds().has(s.id));
      if (next >= 0) setScanFocus(next);
      return;
    }
    setScannedIds((prev) => new Set(prev).add(spot.id));
    applyFx(spot.fx);
    if (spot.final) enter(n.done);
  }

  function scanMove(delta: number): void {
    const n = node();
    if (n.t !== "scan") return;
    const count = n.spots.length;
    setScanFocus((i) => (i + delta + count) % count);
  }

  function qtePress(pressed: number): void {
    const n = node();
    if (n.t !== "qte") return;
    if ((pressed & QTE_MASK) === 0) return;
    if (pressed & btnMask(n.btn)) {
      applyFx(n.okFx);
      enter(n.ok);
    } else {
      applyFx(n.missFx);
      enter(n.miss);
    }
  }

  function choose(opt: ChoiceOption): void {
    const n = node();
    if (n.t !== "choice") return;
    if (virtualFrame() === choiceArmedFrame) return; // same press that mounted us
    applyFx(opt.fx);
    enter(opt.to);
  }

  function advance(): void {
    const n = node();
    if (n.t === "line" && !n.hold) enter(n.next);
  }

  function reset(): void {
    disposeTimers();
    snapshots.clear();
    setIntegrity(INTEGRITY_START);
    setTrust(TRUST_START);
    setSuspicion(0);
    setFlags(new Set<FlagName>());
    setHistory([]);
    setToasts([]);
    setEnding(null);
    setBg("bg-title.png");
  }

  function start(): void {
    reset();
    enter(START_NODE);
  }

  function toTitle(): void {
    reset();
    setPhase("title");
  }

  function replayNight(): void {
    const snap = snapshots.get(phase() === "verdict" ? 3 : lastChapter());
    if (!snap) return;
    disposeTimers();
    setIntegrity(snap.integrity);
    setTrust(snap.trust);
    setSuspicion(snap.suspicion);
    setFlags(new Set(snap.flags));
    setHistory(snap.history);
    setToasts([]);
    setEnding(null);
    enter(snap.node);
  }

  function continueStory(): void {
    const n = node();
    if (n.t === "chapter") enter(n.next);
  }

  function press(pressed: number): void {
    const p = phase();
    if (p === "title") {
      if (pressed & BTN.START) start();
      return;
    }
    if (p === "flowchart") {
      if (pressed & BTN.CIRCLE) continueStory();
      else if (pressed & BTN.TRIANGLE) replayNight();
      return;
    }
    if (p === "verdict") {
      if (pressed & BTN.START) toTitle();
      else if (pressed & BTN.TRIANGLE) replayNight();
      return;
    }
    if (p !== "story") return;
    const n = node();
    if (n.t === "line") {
      if (pressed & BTN.CIRCLE) advance();
    } else if (n.t === "scan") {
      if (pressed & BTN.LEFT) scanMove(-1);
      else if (pressed & BTN.RIGHT) scanMove(1);
      else if (pressed & BTN.CIRCLE) scanConfirm();
    } else if (n.t === "qte") {
      qtePress(pressed);
    }
    // choice nodes are driven by the native focus system (d-pad + CIRCLE
    // onPress on the focused option), not routed here.
  }

  const chart = () => FLOWCHARTS[lastChapter() - 1];
  const visitedSet = () => new Set(history());

  // The lab seam (same spirit as __cafeBackend / __tidelightWire): read-only
  // accessors so harnesses and the sim can assert on story position without
  // parsing the component tree.
  (globalThis as Record<string, unknown>).__tidelight = { nodeId, phase, integrity, trust };

  return {
    phase,
    node,
    nodeId,
    bg,
    integrity,
    trust,
    metMaren: () => {
      const h = flags();
      return h.has("reported") || h.has("hidden") || h.has("watched");
    },
    toasts,
    options: () => {
      const n = node();
      if (n.t !== "choice") return [];
      return n.options.filter((o) => !o.if || evalCond(o.if));
    },
    scanFocus,
    scanned: (spotId) => scannedIds().has(spotId),
    visited: (id) => visitedSet().has(id),
    chart,
    chartSeen: () => {
      const c = chart();
      const seen = c.nodes.filter((n) => visitedSet().has(n.id)).length;
      return { seen, total: c.nodes.length };
    },
    ending,
    hasFlag: (f) => flags().has(f),
    press,
    choose,
    start,
    continueStory,
    replayNight,
    toTitle,
  };
}

// ---------------------------------------------------------------------------
// Story validation — a data-integrity contract the sim test runs: every
// target id resolves, every node is reachable from the start, every ending
// and every flowchart box points at a real node.
// ---------------------------------------------------------------------------

export function validateStory(): string[] {
  const problems: string[] = [];
  const ids = new Set(Object.keys(STORY));

  const targets = (n: StoryNode): NodeId[] => {
    switch (n.t) {
      case "card": return [n.next];
      case "scene": return [n.next];
      case "line": return [n.next];
      case "wire": return [n.next];
      case "scan": return [n.done];
      case "choice": return [...n.options.map((o) => o.to), n.silence];
      case "qte": return [n.ok, n.miss];
      case "branch": return [...n.arms.map((a) => a.to), n.else];
      case "chapter": return [n.next];
      case "end": return [];
    }
  };

  for (const [id, n] of Object.entries(STORY)) {
    for (const t of targets(n)) {
      if (!ids.has(t)) problems.push(`node "${id}" targets missing "${t}"`);
    }
  }

  const reachable = new Set<NodeId>();
  const queue: NodeId[] = [START_NODE];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const n = STORY[id];
    if (n) queue.push(...targets(n));
  }
  for (const id of ids) {
    if (!reachable.has(id)) problems.push(`node "${id}" is unreachable`);
  }

  const endNodes = Object.values(STORY).filter((n) => n.t === "end");
  for (const e of ENDINGS) {
    if (!endNodes.some((n) => n.t === "end" && n.ending === e.id)) {
      problems.push(`ending "${e.id}" has no end node`);
    }
  }

  for (const chart of FLOWCHARTS) {
    for (const n of chart.nodes) {
      if (!ids.has(n.id)) problems.push(`chart ${chart.night} box "${n.id}" is not a story node`);
    }
    for (const [a, b] of chart.edges) {
      const has = (x: NodeId) => chart.nodes.some((n) => n.id === x);
      if (!has(a) || !has(b)) problems.push(`chart ${chart.night} edge ${a} -> ${b} misses a box`);
    }
  }

  return problems;
}
