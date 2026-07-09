// demos/tidelight/backend.ts — the Authority wire: TIDELIGHT's "network",
// built on the effect-shell pattern (DETERMINISM.md), same shape as the
// cafe demo's fake backend.
//
// The DATA is a pure request -> response function; the TIME is the virtual
// clock. A transmission from Inspector Halloway is requested with
// runEffect("wire", { night }) and lands as a frame-boundary delivery a
// fixed number of VIRTUAL seconds later — the same virtual frame in every
// run, on every host, at every simulationHz. The pause while the wire
// crackles is real dramatic latency, and it is still deterministic.
//
// The pure respond() is exposed on globalThis for harnesses that want the
// same data under a different clock (the flake-lab pattern).

import { after } from "@pocketjs/framework/clock";
import { installEffectDriver } from "@pocketjs/framework/effects";

export interface WireRequest {
  night: 1 | 2 | 3;
}

export interface WireResponse {
  night: 1 | 2 | 3;
  channel: string;
}

export function respond(kind: string, payload: unknown): unknown {
  if (kind === "wire") {
    const req = payload as WireRequest;
    return { night: req.night, channel: "HARBOR AUTHORITY 9" } satisfies WireResponse;
  }
  throw new Error(`tidelight backend: unknown effect kind "${kind}"`);
}

/** Latency per request kind, in VIRTUAL seconds (0.5 s grid — exact at every
 *  valid simulationHz). The wire always takes a beat to warm up. */
export function latencySeconds(kind: string): number {
  return kind === "wire" ? 1.0 : 0.5;
}

export function installTidelightWire(): void {
  installEffectDriver((cmd, deliver) => {
    after(latencySeconds(cmd.kind), () => deliver(respond(cmd.kind, cmd.payload)));
  });
  // The lab seam: same data, bring your own clock.
  (globalThis as Record<string, unknown>).__tidelightWire = { respond, latencySeconds };
}
