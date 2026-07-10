# NIGHTBLOOM — a garden against the eternal night

A lane-defense danmaku garden on the PocketJS deterministic runtime: one
shrine, five lanes, an eternal night in the garden-defense grammar of
*Plants vs. Zombies*, flavored after the eternal-night youkai stories of the
Touhou fangame tradition. Plants that ascend by doing their own work, a horde
that ascends with the hour, and a possession mechanic that turns any planted
ally into the player's own trigger finger.

![NIGHTBLOOM mid-battle: the possessed catnip kit holds the middle lane](../../assets/screenshots/nightbloom.png)

*Midnight, wave 8 of 12. The possessed CATNIP KIT (amber ring) volleys three
lanes while a KASA RONIN chews the stone lantern — and ascends to WARLORD for
finishing it.*

## Play it

```bash
bun scripts/dev.ts nightbloom-main    # then open http://127.0.0.1:8130/?demo=nightbloom-main
```

| input | keyboard | does |
| --- | --- | --- |
| d-pad | arrows | move the cell cursor (hold to repeat) |
| CROSS | X | plant the selected seed / feed the plant under the cursor (25 lumen) |
| SQUARE | A | cycle the seed packet |
| CIRCLE | Z / Enter | possess the plant under the cursor; hold to CHANNEL (rapid fire) |
| L / R | Q / E | switch possession across the roster |
| TRIANGLE | S | cast the possessed plant's spell card |
| SELECT | Shift | the garden codex (stats + the laws) |
| START | Space | start / pause |

Survive to dawn (150 virtual seconds, 12 waves, three night phases). The
shrine holds three wards; each breach spends one, and the fourth ends the
night for good.

## The two evolution laws

Everything on the field evolves through stage I -> II -> III, on two clocks:

- **Plants grow by their own work.** Attackers earn glow for damage dealt,
  the producer for lumen gathered, the wall for blows endured — cross the
  thresholds and the plant ascends (new art, new stats, new behavior).
  Feeding (CROSS on a plant) buys glow for lumen and hurries the bloom.
- **Foes grow with the hour.** DUSK sends stage I, MIDNIGHT II, the WITCHING
  HOUR III — and a foe that finishes eating a plant ascends on the spot,
  heals, and keeps walking.

The matchups are data, not scripts (`data.ts`): the KASA RONIN's armor shrugs
bamboo bolts but petals deal true damage; the MOON RABBIT lobs mochi from
three cells out, so walls alone can't answer it; the NIGHT SPARROW's song
hastens her lane until someone silences her.

| plants | | foes | |
| --- | --- | --- | --- |
| MOON PRIMROSE | lumen producer | LANTERN WISP | cheap, steady, endless |
| BAMBOO ARBALEST | lane shooter | KASA RONIN | armored blade wall |
| CATNIP KIT | the cat. spread volleys, NINE LIVES | MOON RABBIT | fast ranged lobber |
| STONE LANTERN | wall; thorns from stage II | NIGHT SPARROW | haste-aura support |
| SAKURA SENTINEL | true-damage petal bursts | | |

## What it demonstrates, mechanically

tidelight proved the deterministic runtime on a branching story; NIGHTBLOOM
proves it on a real-time action game:

- the battle advances in fixed 1/60 s micro-ticks, `ticksPerFrame()` per host
  frame, batches aligned so the tick count at any virtual second is identical
  at every `simulationHz` — **the 2 Hz world plays the same night, gameplay
  included** (`?hz=2` on the web host to watch it);
- edges land on the first tick of a frame's batch; held input (d-pad repeat,
  the channel) gates on a half-second of held ticks plus a frame boundary, so
  a one-frame pulse means the same thing at every rate;
- waves draw lanes from one seeded xorshift32 stream; float fx drift by
  battle-tick age; the phase augury arrives through the effect shell
  (`backend.ts`) — nothing anywhere reads a wall clock.

`test/nightbloom.sim.test.ts` drives two tapes through the headless sim host:
THE GARDENER, a full 170 s winning night (31 kills, one ward spent, a stage
III bloom), and THE SLEEPER, an untouched loss. It asserts repeat-identity,
chaos immunity, strict 4 Hz / 2 Hz subsampling of both tapes, cross-rate
byte-equal outcome screens, augury effect timing, and the exact end-screen
ledger. Wired into `bun run test`.

## Content pipeline

Same contract as the tidelight demo: every sprite and backdrop is generated
by the PixelLab pixel-art API (pixellab.ai) from the seeded manifest in
`data.ts` — `gen-assets.ts` is a no-op unless an asset is deleted or
`--force` is passed, and committed PNGs are re-encoded through the pak-safe
canonical subset.

```bash
bun demos/nightbloom/gen-assets.ts             # generate missing assets
bun demos/nightbloom/gen-assets.ts --only=p-catnip-2.png
```

Evolution stages are `init_image` chains — stage II derives from stage I,
III from II — so a creature keeps its identity as it ascends: the same
identity-preserving trick tidelight uses for portrait moods, applied to a
whole bestiary. Stats, prompts and sprite filenames live in one table, so a
creature's numbers and its art can never drift apart
(`validateContent()` is part of the sim test).

Auth: `PIXELLAB_API_KEY` in the repo root `.env` (gitignored). Units are
32x32 (drawn at 38 px in a 48x42 cell), projectiles 32x32 drawn at 16 px
(the pixflux minimum canvas is 32x32), scenes 256x128 (pow2) drawn at
480x240.
