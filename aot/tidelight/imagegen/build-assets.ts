#!/usr/bin/env bun
// aot/tidelight/imagegen/build-assets.ts — deterministic GBA 4bpp extraction
// for the TIDELIGHT demake. Reads the committed PixelLab source PNGs in gen/
// (see gen-source.ts) and writes ../assets.generated.ts: a 16-color BG
// palette + 8x8 tiles (box-averaged from 32x32) and a shared 16-color OBJ
// palette + 16x16 character facings (alpha-aware downsample from 32x32).
//
// Walk animation is derived, not generated: frame 2 mirrors the down/up pose
// (arm swing) and shifts the leg rows of the side pose (stride) — the classic
// two-frame handheld trick, deterministic by construction. West is the
// mirrored east facing.
//
//   bun aot/tidelight/imagegen/build-assets.ts

import { join } from "node:path";
import { decodePng, type DecodedImage } from "../../../compiler/pak.ts";

type RGB = [number, number, number];

const HERE = new URL(".", import.meta.url).pathname;
const GEN = join(HERE, "gen");
const OUT = join(HERE, "..", "assets.generated.ts");

// BG palette bank 0 — index 0 is the backdrop; map tiles use 1..15.
// Night coast: slate rock, dark teal sea, warm interior wood and lamp amber.
const TIDE_PALETTE: RGB[] = [
  [10, 12, 20], // 0 backdrop / void
  [24, 30, 46], // 1 deep water
  [38, 58, 82], // 2 water
  [66, 96, 116], // 3 water light
  [140, 176, 184], // 4 foam
  [40, 40, 50], // 5 rock dark
  [76, 74, 86], // 6 rock
  [116, 112, 122], // 7 rock light
  [58, 42, 30], // 8 wood dark
  [104, 76, 46], // 9 wood
  [160, 122, 70], // 10 wood light / brass dark
  [214, 176, 96], // 11 brass / amber
  [242, 224, 164], // 12 lamp light
  [150, 62, 48], // 13 ember red
  [188, 194, 202], // 14 fog grey
  [232, 236, 238], // 15 white
];

// OBJ palette (shared by every character bank) — index 0 transparent.
const CAST_PALETTE: RGB[] = [
  [0, 0, 0], // 0 transparent
  [112, 82, 42], // 1 brass dark
  [192, 142, 62], // 2 brass
  [236, 192, 92], // 3 brass bright
  [120, 232, 232], // 4 lamp-eye cyan
  [40, 44, 56], // 5 dark steel
  [88, 94, 106], // 6 coat grey
  [128, 136, 148], // 7 coat grey light
  [226, 192, 162], // 8 skin
  [42, 38, 42], // 9 hair dark
  [170, 62, 52], // 10 red
  [32, 42, 72], // 11 navy
  [64, 84, 124], // 12 navy light
  [238, 238, 232], // 13 white
  [18, 20, 26], // 14 outline
  [220, 172, 84], // 15 amber
];

interface TileSrc {
  name: string;
  file: string;
  solid?: boolean;
}

const TILES: TileSrc[] = [
  { name: "water", file: "tile-water.png", solid: true },
  { name: "foam", file: "tile-foam.png", solid: true },
  { name: "rock", file: "tile-rock.png", solid: true },
  { name: "cliff", file: "tile-cliff.png", solid: true },
  { name: "sand", file: "tile-sand.png" },
  { name: "pier", file: "tile-pier.png" },
  { name: "floor", file: "tile-floor.png" },
  { name: "wall", file: "tile-wall.png", solid: true },
  { name: "door", file: "tile-door.png", solid: true },
  { name: "stove", file: "tile-stove.png", solid: true },
  { name: "cot", file: "tile-cot.png", solid: true },
  { name: "radio", file: "tile-radio.png", solid: true },
  { name: "lamp", file: "tile-lamp.png", solid: true },
  { name: "crate", file: "tile-crate.png", solid: true },
];

const CAST = ["wick", "maren", "halloway"] as const;

async function load(file: string): Promise<DecodedImage> {
  const bytes = new Uint8Array(await Bun.file(join(GEN, file)).arrayBuffer());
  return decodePng(bytes);
}

function nearest(rgb: RGB, pal: RGB[], start: number): number {
  let best = start;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = start; i < pal.length; i++) {
    const dr = rgb[0] - pal[i][0];
    const dg = rgb[1] - pal[i][1];
    const db = rgb[2] - pal[i][2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Box-average an axis-aligned block; returns [r,g,b,aSum,count]. */
function block(img: DecodedImage, x0: number, y0: number, k: number): [number, number, number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let n = 0;
  let opaque = 0;
  for (let y = y0; y < y0 + k; y++) {
    for (let x = x0; x < x0 + k; x++) {
      const i = (y * img.width + x) * 4;
      const alpha = img.rgba[i + 3];
      a += alpha;
      n++;
      if (alpha >= 128) {
        r += img.rgba[i];
        g += img.rgba[i + 1];
        b += img.rgba[i + 2];
        opaque++;
      }
    }
  }
  if (opaque === 0) return [0, 0, 0, a / n, 0];
  return [Math.round(r / opaque), Math.round(g / opaque), Math.round(b / opaque), a / n, opaque];
}

function tileRows(img: DecodedImage): string[] {
  const k = img.width / 8; // 32 -> 4
  // First pass: box-averaged 8x8 RGB.
  const px: RGB[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const [r, g, b] = block(img, x * k, y * k, k);
      px.push([r, g, b]);
    }
  }
  // Gentle contrast expansion per tile: box averaging flattens a 32px
  // texture, so widen each pixel's distance from the tile's mean luma by a
  // fixed factor. Full-range stretching turns terrain into salt-and-pepper
  // noise at 8px; 1.5x around the mean keeps a tile's identity (dark cliff
  // stays dark) while giving the quantizer enough separation to work with.
  const luma = (c: RGB) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const mean = px.reduce((n, c) => n + luma(c), 0) / px.length;
  const stretch = (c: RGB): RGB => {
    const l = luma(c);
    const target = Math.max(12, Math.min(240, mean + (l - mean) * 1.5));
    const gain = l > 0 ? target / l : 1;
    return [
      Math.max(0, Math.min(255, Math.round(c[0] * gain))),
      Math.max(0, Math.min(255, Math.round(c[1] * gain))),
      Math.max(0, Math.min(255, Math.round(c[2] * gain))),
    ];
  };
  const rows: string[] = [];
  for (let y = 0; y < 8; y++) {
    let row = "";
    for (let x = 0; x < 8; x++) {
      row += nearest(stretch(px[y * 8 + x]), TIDE_PALETTE, 1).toString(16);
    }
    rows.push(row);
  }
  return rows;
}

function spriteFrame(img: DecodedImage): string[] {
  const k = img.width / 16; // 32 -> 2
  const rows: string[] = [];
  for (let y = 0; y < 16; y++) {
    let row = "";
    for (let x = 0; x < 16; x++) {
      const [r, g, b, alpha] = block(img, x * k, y * k, k);
      row += alpha < 96 ? "0" : nearest([r, g, b], CAST_PALETTE, 1).toString(16);
    }
    rows.push(row);
  }
  return rows;
}

const mirror = (rows: string[]): string[] => rows.map((r) => [...r].reverse().join(""));

/** Stride pose: shift the leg rows (bottom quarter) one pixel forward. */
function stride(rows: string[], dx: 1 | -1): string[] {
  return rows.map((row, y) => {
    if (y < 12) return row;
    return dx === 1 ? "0" + row.slice(0, 15) : row.slice(1) + "0";
  });
}

async function main(): Promise<void> {
  const tiles: string[] = [];
  for (const t of TILES) {
    const img = await load(t.file);
    const rows = tileRows(img);
    tiles.push(
      `  ${JSON.stringify(t.name)}: {\n    "px": ${JSON.stringify(rows, null, 6).replace(/\n/g, "\n    ")}${t.solid ? `,\n    "solid": true` : ""}\n  }`,
    );
  }

  const casts: string[] = [];
  for (const who of CAST) {
    const south = spriteFrame(await load(`${who}-south.png`));
    const north = spriteFrame(await load(`${who}-north.png`));
    const east = spriteFrame(await load(`${who}-east.png`));
    const west = mirror(east);
    const facings = {
      down: [south, mirror(south)],
      up: [north, mirror(north)],
      right: [east, stride(east, 1)],
      left: [west, stride(west, -1)],
    };
    casts.push(`export const ${who.toUpperCase()}_FACINGS: Record<Direction, string[][]> = ${JSON.stringify(facings, null, 2)};`);
  }

  // Interactable set pieces (the wire, the lamp): static OBJ sprites built
  // from their prop tiles — same frame on every facing, opaque on purpose.
  for (const prop of ["radio", "lamp"] as const) {
    const frame = spriteFrame(await load(`tile-${prop}.png`));
    const facings = { down: [frame, frame], up: [frame, frame], right: [frame, frame], left: [frame, frame] };
    casts.push(`export const ${prop.toUpperCase()}_FACINGS: Record<Direction, string[][]> = ${JSON.stringify(facings, null, 2)};`);
  }

  const out = `// GENERATED by aot/tidelight/imagegen/build-assets.ts from the PixelLab
// source art in imagegen/gen/ (seeded; see gen-source.ts).
// Do not edit by hand; adjust the source art or palettes and rerun.

import type { Direction } from "@pocketjs/aot";

export const TIDE_PALETTE: [number, number, number][] = ${JSON.stringify(TIDE_PALETTE)};

export const TIDE_TILES = {
${tiles.join(",\n")}
} as const;

export const CAST_PALETTE: [number, number, number][] = ${JSON.stringify(CAST_PALETTE)};

${casts.join("\n\n")}
`;
  await Bun.write(OUT, out);
  console.log(`tidelight-gba: wrote ${OUT} (${TILES.length} tiles, ${CAST.length} cast sprites)`);
}

await main();
