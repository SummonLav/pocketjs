#!/usr/bin/env bun
// aot/tidelight/imagegen/gen-source.ts — PixelLab source art for the TIDELIGHT
// GBA demake. Same contract as demos/tidelight/gen-assets.ts: every entry is
// seeded, existing files are skipped, and the PNGs land in gen/ as COMMITTED
// source art. The deterministic quantizer (build-assets.ts) turns them into
// GBA 4bpp DSL rows; this script is the only nondeterministic step and runs
// only when an image is missing or --force is passed.
//
//   bun aot/tidelight/imagegen/gen-source.ts [--force] [--only=name.png]
//
// Tiles are generated at 32x32 (pixflux minimum is 16; 32 gives the 8x8 box
// average real texture to chew on). Characters are 32x32 with a transparent
// background, one image per facing (south/north/east; west is mirrored by the
// quantizer), downsampled to 16x16 OBJ sprites.

import { existsSync, readFileSync } from "node:fs";

const HERE = new URL(".", import.meta.url).pathname; // aot/tidelight/imagegen/
const GEN = HERE + "gen/";
const ROOT = new URL("../../..", import.meta.url).pathname; // repo root
const API = "https://api.pixellab.ai/v1";

interface Entry {
  name: string;
  prompt: string;
  size: number;
  seed: number;
  transparent?: boolean;
  direction?: "north" | "south" | "east" | "west";
}

const TILE_STYLE = "pixel art game terrain tile, top-down, flat lighting, seamless, no border, moody night palette of dark slate and teal";
const PROP_STYLE = "pixel art game object tile on its floor, top-down, flat lighting, moody night interior palette, warm amber accents";
const CHAR_STYLE = "tiny pixel art game character, full body, chibi 16-bit handheld RPG style, plain stance";

const ENTRIES: Entry[] = [
  // --- terrain tiles (32x32 -> 8x8) ---------------------------------------
  { name: "tile-water.png", prompt: `dark night sea water, small waves, ${TILE_STYLE}`, size: 32, seed: 501 },
  { name: "tile-foam.png", prompt: `storm surf foam over dark water, white crests, ${TILE_STYLE}`, size: 32, seed: 502 },
  { name: "tile-rock.png", prompt: `wet coastal boulder rock, grey slate, ${TILE_STYLE}`, size: 32, seed: 503 },
  { name: "tile-cliff.png", prompt: `dark basalt cliff face, near black stone, ${TILE_STYLE}`, size: 32, seed: 504 },
  { name: "tile-sand.png", prompt: `wet grey shingle beach sand at night, ${TILE_STYLE}`, size: 32, seed: 505 },
  { name: "tile-pier.png", prompt: `stone pier paving slabs, cold grey, ${TILE_STYLE}`, size: 32, seed: 506 },
  { name: "tile-floor.png", prompt: `worn wooden plank floor, dark warm wood, ${TILE_STYLE}`, size: 32, seed: 507 },
  { name: "tile-wall.png", prompt: `lighthouse interior stone wall block, pale mortar lines, ${TILE_STYLE}`, size: 32, seed: 508 },
  // --- prop tiles (32x32 -> 8x8) -------------------------------------------
  { name: "tile-door.png", prompt: `heavy wooden door with iron bands, seen from above, ${PROP_STYLE}`, size: 32, seed: 509 },
  { name: "tile-stove.png", prompt: `small iron stove with ember glow through the grate, ${PROP_STYLE}`, size: 32, seed: 510 },
  { name: "tile-cot.png", prompt: `narrow wooden cot with wool blanket, ${PROP_STYLE}`, size: 32, seed: 511 },
  { name: "tile-radio.png", prompt: `brass marine radio set on a desk, glowing amber dial, ${PROP_STYLE}`, size: 32, seed: 512 },
  { name: "tile-lamp.png", prompt: `giant lighthouse fresnel lens lamp, brass and glowing glass, ${PROP_STYLE}`, size: 32, seed: 513 },
  { name: "tile-crate.png", prompt: `weathered wooden supply crate with rope, ${PROP_STYLE}`, size: 32, seed: 514 },
  // --- characters (32x32 transparent -> 16x16 OBJ) --------------------------
  { name: "wick-south.png", prompt: `weathered brass lighthouse automaton, glowing cyan lamp eye, ${CHAR_STYLE}`, size: 32, seed: 601, transparent: true, direction: "south" },
  { name: "wick-north.png", prompt: `weathered brass lighthouse automaton seen from behind, ${CHAR_STYLE}`, size: 32, seed: 602, transparent: true, direction: "north" },
  { name: "wick-east.png", prompt: `weathered brass lighthouse automaton in profile walking, glowing cyan eye, ${CHAR_STYLE}`, size: 32, seed: 603, transparent: true, direction: "east" },
  { name: "maren-south.png", prompt: `young woman with wet dark hair in a long grey army greatcoat, exhausted, ${CHAR_STYLE}`, size: 32, seed: 604, transparent: true, direction: "south" },
  { name: "maren-north.png", prompt: `young woman with dark hair in a long grey army greatcoat, seen from behind, ${CHAR_STYLE}`, size: 32, seed: 605, transparent: true, direction: "north" },
  { name: "maren-east.png", prompt: `young woman in a long grey army greatcoat in profile walking, ${CHAR_STYLE}`, size: 32, seed: 606, transparent: true, direction: "east" },
  { name: "halloway-south.png", prompt: `stern old harbor inspector, dark uniform cap and black oilskin coat, grey mustache, ${CHAR_STYLE}`, size: 32, seed: 607, transparent: true, direction: "south" },
  { name: "halloway-north.png", prompt: `harbor inspector in dark uniform and cap, seen from behind, ${CHAR_STYLE}`, size: 32, seed: 608, transparent: true, direction: "north" },
  { name: "halloway-east.png", prompt: `harbor inspector in dark uniform cap and oilskin coat in profile, ${CHAR_STYLE}`, size: 32, seed: 609, transparent: true, direction: "east" },
];

function apiKey(): string {
  const env = process.env.PIXELLAB_API_KEY;
  if (env) return env;
  const envPath = ROOT + ".env";
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, "utf8").match(/^PIXELLAB_API_KEY=["']?([^"'\n]+)["']?$/m);
    if (m) return m[1];
  }
  throw new Error("tidelight-gba: PIXELLAB_API_KEY not set (repo .env or environment)");
}

async function generate(key: string, e: Entry): Promise<Uint8Array> {
  const body: Record<string, unknown> = {
    description: e.prompt,
    image_size: { width: e.size, height: e.size },
    text_guidance_scale: 8,
    no_background: e.transparent ?? false,
    seed: e.seed,
  };
  if (e.direction) body.direction = e.direction;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/generate-image-pixflux`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429 && attempt <= 3) {
      console.log(`  rate limited, retry ${attempt}/3 in 5s ...`);
      await Bun.sleep(5000);
      continue;
    }
    if (!res.ok) throw new Error(`tidelight-gba: pixellab ${res.status} for ${e.name}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { image: { base64: string } };
    return Uint8Array.from(Buffer.from(json.image.base64, "base64"));
  }
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
  const key = apiKey();
  let generated = 0;
  let kept = 0;
  for (const e of ENTRIES) {
    const path = GEN + e.name;
    if (only && e.name !== only) continue;
    if (existsSync(path) && !force && !only) {
      kept++;
      continue;
    }
    const png = await generate(key, e);
    await Bun.write(path, png);
    generated++;
    console.log(`  generated ${e.name}  ${e.size}x${e.size} seed ${e.seed}`);
  }
  console.log(`tidelight-gba: ${generated} generated, ${kept} kept`);
}

await main();
