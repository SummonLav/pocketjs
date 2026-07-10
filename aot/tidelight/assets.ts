// aot/tidelight/assets.ts — PixelLab-backed tileset + cast declarations for
// the TIDELIGHT GBA demake. Source art: imagegen/gen/ (seeded PixelLab
// generations, committed); DSL rows: imagegen/build-assets.ts (deterministic).

import { defineSprite, defineTileset } from "@pocketjs/aot";
import {
  CAST_PALETTE,
  HALLOWAY_FACINGS,
  LAMP_FACINGS,
  MAREN_FACINGS,
  RADIO_FACINGS,
  TIDE_PALETTE,
  TIDE_TILES,
  WICK_FACINGS,
} from "./assets.generated.ts";

export const saltmere = defineTileset("saltmere", {
  palette: TIDE_PALETTE,
  tiles: TIDE_TILES,
});

export const wick = defineSprite("wick", {
  size: [16, 16],
  palette: CAST_PALETTE,
  facings: WICK_FACINGS,
});

export const maren = defineSprite("maren", {
  size: [16, 16],
  palette: CAST_PALETTE,
  facings: MAREN_FACINGS,
});

export const halloway = defineSprite("halloway", {
  size: [16, 16],
  palette: CAST_PALETTE,
  facings: HALLOWAY_FACINGS,
});

/** The Authority wire — an interactable set piece, not a person. */
export const radio = defineSprite("radio", {
  size: [16, 16],
  palette: CAST_PALETTE,
  facings: RADIO_FACINGS,
});

/** The lamp itself — Saltmere's other keeper. */
export const lamp = defineSprite("lamp", {
  size: [16, 16],
  palette: CAST_PALETTE,
  facings: LAMP_FACINGS,
});
