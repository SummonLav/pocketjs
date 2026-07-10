// demos/nightbloom/data.ts — NIGHTBLOOM's content tables: every plant, foe,
// wave, spell and sprite prompt in one pure-data module. engine.ts folds
// these tables over the virtual clock; gen-assets.ts reads the same tables
// to drive the PixelLab pipeline, so a creature's stats, its art prompt and
// its committed sprite can never drift apart.
//
// No imports from the framework or solid here: this module is shared by the
// game bundle AND the bun-side asset pipeline, so it stays platform-pure.
//
// All player-facing copy is ASCII (the Inter atlas has no CJK). GLYPHS below
// pins every codepoint dynamic text can produce (numbers, arrows, marks) so
// the font baker always slots them.

export const GLYPHS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 .,:;!?+-x%/<>()[]'\"*=";

// ---------------------------------------------------------------------------
// Board geometry (480x272 screen)
// ---------------------------------------------------------------------------

export const BOARD = {
  x0: 48, // left edge of column 0 (the shrine porch sits left of this)
  y0: 40, // top edge of row 0 (HUD strip above)
  cellW: 48,
  cellH: 42,
  rows: 5,
  cols: 9,
} as const;

/** A foe whose x drops below this line breaches the shrine. */
export const BREACH_X = 30;
/** Foes enter here (just off the right edge). */
export const SPAWN_X = 486;

export const cellX = (col: number): number => BOARD.x0 + col * BOARD.cellW;
export const cellY = (row: number): number => BOARD.y0 + row * BOARD.cellH;
/** Horizontal center of a column. */
export const cellCX = (col: number): number => cellX(col) + BOARD.cellW / 2;

// ---------------------------------------------------------------------------
// Ticks — the sim advances on the core's fixed 1/60 s grid, host hz agnostic
// ---------------------------------------------------------------------------

export const TPS = 60; // ticks per virtual second (spec FIXED_DT)

// ---------------------------------------------------------------------------
// Art manifest types (consumed by gen-assets.ts)
// ---------------------------------------------------------------------------

export interface ArtEntry {
  name: string;
  prompt: string;
  w: number;
  h: number;
  seed: number;
  transparent?: boolean;
  /** pixflux facing hint. Plants face east (they shoot right), foes west. */
  direction?: "north" | "south" | "east" | "west";
  /** Derive from a previous entry — evolution keeps a creature's identity. */
  initFrom?: string;
  /** init_image influence 1..999 (PixelLab default 300). */
  initStrength?: number;
  shading?: string;
  detail?: string;
}

const UNIT = 32; // unit sprites (pow2, drawn at 38px in a 48x42 cell)
const SHOT = 32; // projectile sprites (pixflux minimum canvas; drawn at 16px)
const SCENE_W = 256; // scenes are 256x128 (pow2), drawn at 480x240
const SCENE_H = 128;

const PLANT_STYLE =
  "cute chibi fantasy plant creature for a pixel art garden defense game, glossy big eyes, " +
  "clean thick outline, vivid colors against a dark night, single centered character, full body";
const FOE_STYLE =
  "cute spooky little yokai spirit for a pixel art night defense game, chibi proportions, " +
  "glowing accents, clean silhouette, single centered character, full body, walking";
const SHOT_STYLE = "tiny pixel art game projectile icon, clean silhouette, centered, glowing";

// ---------------------------------------------------------------------------
// Plants
// ---------------------------------------------------------------------------

export type PlantId = "primrose" | "bamboo" | "catnip" | "lantern" | "sakura";

export interface SpellDef {
  name: string;
  hint: string;
  /** Cooldown in virtual seconds. */
  cooldown: number;
}

export interface PlantDef {
  id: PlantId;
  name: string;
  /** Display name of each evolution stage (index 0 = stage I). */
  stageNames: [string, string, string];
  role: "producer" | "shooter" | "wall" | "burst";
  cost: number;
  hp: [number, number, number];
  /** Sprite file per stage — full literals so the pak build collects them. */
  sprites: [string, string, string];
  /** Glow thresholds to reach stage II and stage III. */
  evolveAt: [number, number];
  /** How this plant earns glow — the evolution law, shown in the codex. */
  law: string;
  spell: SpellDef;
  // shooter/burst
  dmg?: [number, number, number];
  /** Seconds between shots/pulses per stage. */
  period?: [number, number, number];
  /** Catnip: how many neighbour lanes each volley reaches per stage. */
  spreadLanes?: [number, number, number];
  /** Sakura: Chebyshev cell radius of the petal burst per stage. */
  radius?: [number, number, number];
  /** Sakura III / PETALFALL: slow factor applied to struck foes. */
  slowFactor?: number;
  // producer
  pulseLumen?: [number, number, number];
  // wall
  thorns?: [number, number, number];
}

export const PLANT_ORDER: PlantId[] = ["primrose", "bamboo", "catnip", "lantern", "sakura"];

export const PLANTS: Record<PlantId, PlantDef> = {
  primrose: {
    id: "primrose",
    name: "MOON PRIMROSE",
    stageNames: ["SPROUT", "FULL BLOOM", "MOONRISEN"],
    role: "producer",
    cost: 50,
    hp: [60, 80, 100],
    sprites: ["p-primrose-1.png", "p-primrose-2.png", "p-primrose-3.png"],
    evolveAt: [120, 360],
    law: "GROWS BY THE LUMEN IT GATHERS",
    spell: { name: "MOONRISE", hint: "GAIN 80 LUMEN NOW", cooldown: 14 },
    pulseLumen: [20, 30, 45],
    period: [7, 6, 5],
  },
  bamboo: {
    id: "bamboo",
    name: "BAMBOO ARBALEST",
    stageNames: ["SHOOT", "ARBALEST", "WARCANE"],
    role: "shooter",
    cost: 100,
    hp: [80, 100, 120],
    sprites: ["p-bamboo-1.png", "p-bamboo-2.png", "p-bamboo-3.png"],
    evolveAt: [220, 660],
    law: "GROWS BY THE WOUNDS IT DEALS",
    spell: { name: "PIERCING GALE", hint: "45 TRUE DMG DOWN THE LANE", cooldown: 14 },
    dmg: [14, 20, 26],
    period: [1.6, 1.4, 1.2],
  },
  catnip: {
    id: "catnip",
    name: "CATNIP KIT",
    stageNames: ["CATNIP KIT", "NEKOMATA", "NINELIVES"],
    role: "shooter",
    cost: 150,
    hp: [70, 90, 110],
    sprites: ["p-catnip-1.png", "p-catnip-2.png", "p-catnip-3.png"],
    evolveAt: [260, 780],
    law: "GROWS BY THE WOUNDS IT DEALS",
    spell: { name: "NINE LIVES", hint: "28 TRUE DMG, NEARBY LANES", cooldown: 14 },
    dmg: [11, 14, 16],
    period: [1.3, 1.2, 1.0],
    spreadLanes: [0, 1, 2],
  },
  lantern: {
    id: "lantern",
    name: "STONE LANTERN",
    stageNames: ["LANTERN", "WARDSTONE", "BULWARK"],
    role: "wall",
    cost: 75,
    hp: [280, 420, 560],
    sprites: ["p-lantern-1.png", "p-lantern-2.png", "p-lantern-3.png"],
    evolveAt: [300, 800],
    law: "GROWS BY THE BLOWS IT ENDURES",
    spell: { name: "STONEHEART", hint: "RESTORE TO FULL", cooldown: 14 },
    thorns: [0, 6, 12],
  },
  sakura: {
    id: "sakura",
    name: "SAKURA SENTINEL",
    stageNames: ["SAPLING", "GUARDIAN", "PETALSTORM"],
    role: "burst",
    cost: 200,
    hp: [70, 90, 110],
    sprites: ["p-sakura-1.png", "p-sakura-2.png", "p-sakura-3.png"],
    evolveAt: [240, 720],
    law: "GROWS BY THE WOUNDS IT DEALS",
    spell: { name: "PETALFALL", hint: "18 TRUE DMG TO ALL, SLOW", cooldown: 14 },
    dmg: [12, 16, 22],
    period: [2.0, 1.9, 1.8],
    radius: [1, 1, 2],
    slowFactor: 0.7,
  },
};

/** Feeding a plant (CROSS on it) costs lumen and grants glow. */
export const FEED_COST = 25;
export const FEED_GLOW = 60;

/** Possession tuning: a channeled plant is the player's own trigger finger. */
export const POSSESS_RATE = 0.8; // period multiplier while possessed
export const CHANNEL_RATE = 0.45; // period multiplier while possessed + CIRCLE held

// ---------------------------------------------------------------------------
// Foes
// ---------------------------------------------------------------------------

export type FoeId = "wisp" | "kasa" | "usagi" | "uta";

export interface FoeDef {
  id: FoeId;
  name: string;
  stageNames: [string, string, string];
  hp: [number, number, number];
  /** Walk speed in px per virtual second. */
  speed: [number, number, number];
  /** Bite damage per bite (one bite every BITE_PERIOD seconds). */
  bite: [number, number, number];
  /** Flat damage shaved off every non-true hit (armor). */
  armor: [number, number, number];
  /** Lumen dropped on death. */
  bounty: [number, number, number];
  sprites: [string, string, string];
  law: string;
  /** usagi: stops this many cells short and lobs mochi. */
  lobRange?: number;
  lobDmg?: [number, number, number];
  lobPeriod?: [number, number, number];
  /** uta: same-lane allies within this px radius gain hasteFactor speed. */
  auraRange?: [number, number, number];
  hasteFactor?: number;
}

export const FOE_ORDER: FoeId[] = ["wisp", "kasa", "usagi", "uta"];

export const FOES: Record<FoeId, FoeDef> = {
  wisp: {
    id: "wisp",
    name: "LANTERN WISP",
    stageNames: ["WISP", "TWINFLAME", "PYRE WISP"],
    hp: [90, 140, 200],
    speed: [12, 14, 16],
    bite: [6, 8, 10],
    armor: [0, 0, 2],
    bounty: [10, 15, 20],
    sprites: ["f-wisp-1.png", "f-wisp-2.png", "f-wisp-3.png"],
    law: "THE MANY: CHEAP, STEADY, ENDLESS",
  },
  kasa: {
    id: "kasa",
    name: "KASA RONIN",
    stageNames: ["KASA", "IRON KASA", "WARLORD"],
    hp: [200, 260, 330],
    speed: [9, 10, 11],
    bite: [10, 12, 15],
    armor: [6, 9, 12],
    bounty: [20, 28, 36],
    sprites: ["f-kasa-1.png", "f-kasa-2.png", "f-kasa-3.png"],
    law: "ARMOR SHRUGS ARROWS. PETALS DO NOT CARE",
  },
  usagi: {
    id: "usagi",
    name: "MOON RABBIT",
    stageNames: ["RABBIT", "POUNDER", "VANGUARD"],
    hp: [60, 90, 130],
    speed: [22, 25, 28],
    bite: [5, 6, 8],
    armor: [0, 0, 0],
    bounty: [15, 20, 26],
    sprites: ["f-usagi-1.png", "f-usagi-2.png", "f-usagi-3.png"],
    law: "FAST, FRAIL, AND THROWS MOCHI FROM AFAR",
    lobRange: 3,
    lobDmg: [8, 12, 16],
    lobPeriod: [2.6, 2.3, 2.0],
  },
  uta: {
    id: "uta",
    name: "NIGHT SPARROW",
    stageNames: ["SPARROW", "CHANTER", "DIVA"],
    hp: [110, 150, 210],
    speed: [16, 17, 18],
    bite: [5, 7, 9],
    armor: [0, 2, 4],
    bounty: [18, 24, 30],
    sprites: ["f-uta-1.png", "f-uta-2.png", "f-uta-3.png"],
    law: "HER SONG HASTENS THE LANE. SILENCE HER FIRST",
    auraRange: [96, 120, 144],
    hasteFactor: 1.4,
  },
};

/** Seconds between bites once a foe reaches a plant. */
export const BITE_PERIOD = 0.6;
/** A foe that finishes eating a plant ascends one stage and heals this much. */
export const FED_HEAL = 0.3;

// ---------------------------------------------------------------------------
// The night — phases, waves, economy
// ---------------------------------------------------------------------------

export type PhaseId = "dusk" | "midnight" | "witching";

export interface PhaseDef {
  id: PhaseId;
  name: string;
  /** Virtual second the phase begins. */
  at: number;
  /** Foes spawned during this phase arrive at this evolution stage. */
  foeStage: 1 | 2 | 3;
  omen: string;
}

export const PHASES: PhaseDef[] = [
  { id: "dusk", name: "DUSK", at: 0, foeStage: 1, omen: "LANTERNS DRIFT IN FROM THE BAMBOO" },
  { id: "midnight", name: "MIDNIGHT", at: 64, foeStage: 2, omen: "THE HORDE DEEPENS WITH THE NIGHT" },
  { id: "witching", name: "WITCHING HOUR", at: 112, foeStage: 3, omen: "EVERYTHING THE DARK HAS, AT ONCE" },
];

export interface WaveDef {
  /** Virtual second the wave crosses the treeline. */
  at: number;
  /** Foe kinds; lanes are drawn from the seeded night RNG. */
  spawn: FoeId[];
}

export const WAVES: WaveDef[] = [
  { at: 10, spawn: ["wisp"] },
  { at: 26, spawn: ["wisp", "wisp"] },
  { at: 40, spawn: ["wisp", "usagi"] },
  { at: 52, spawn: ["kasa", "wisp"] },
  { at: 64, spawn: ["wisp", "wisp", "usagi"] },
  { at: 76, spawn: ["kasa", "uta"] },
  { at: 88, spawn: ["usagi", "usagi", "wisp"] },
  { at: 100, spawn: ["kasa", "uta", "wisp"] },
  { at: 112, spawn: ["wisp", "wisp", "usagi", "kasa"] },
  { at: 120, spawn: ["uta", "usagi", "usagi"] },
  { at: 128, spawn: ["kasa", "usagi", "uta"] },
  { at: 136, spawn: ["wisp", "wisp", "usagi", "kasa", "uta"] },
];

/** Dawn breaks at this virtual second, once the field is clear. */
export const DAWN_AT = 150;

export const START_LUMEN = 125;
/** Ambient moonfall: passive lumen income. */
export const MOONFALL_LUMEN = 10;
export const MOONFALL_PERIOD = 10;

/** The shrine holds this many wards; each breach spends one. */
export const WARDS = 3;

/** The night RNG seed — one night, one seed, one tape. */
export const NIGHT_SEED = 0x9e3779b9;

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------

export interface ShotDef {
  sprite: string;
  /** px per virtual second (positive = rightward). */
  speed: number;
}

export const SHOTS = {
  bolt: { sprite: "shot-bolt.png", speed: 150 },
  orb: { sprite: "shot-orb.png", speed: 130 },
  mochi: { sprite: "shot-mochi.png", speed: -90 },
} as const satisfies Record<string, ShotDef>;

export type ShotKind = keyof typeof SHOTS;

// ---------------------------------------------------------------------------
// Scenes + icons
// ---------------------------------------------------------------------------

export const SCENES = {
  title: "bg-title.png",
  field: "bg-field.png",
  dawn: "bg-dawn.png",
  eternal: "bg-eternal.png",
} as const;

export const MOTE_SPRITE = "mote.png";

// ---------------------------------------------------------------------------
// PixelLab manifest — every committed asset, seeded. Order matters: initFrom
// chains (stage II from I, III from II) require the base to exist first.
// ---------------------------------------------------------------------------

function plantArt(def: PlantDef, stagePrompts: [string, string, string], baseSeed: number): ArtEntry[] {
  return stagePrompts.map((p, i) => ({
    name: def.sprites[i],
    prompt: `${p}, ${PLANT_STYLE}`,
    w: UNIT,
    h: UNIT,
    seed: baseSeed + i,
    transparent: true,
    direction: "east" as const,
    ...(i > 0 ? { initFrom: def.sprites[i - 1], initStrength: 320 } : {}),
  }));
}

function foeArt(def: FoeDef, stagePrompts: [string, string, string], baseSeed: number): ArtEntry[] {
  return stagePrompts.map((p, i) => ({
    name: def.sprites[i],
    prompt: `${p}, ${FOE_STYLE}`,
    w: UNIT,
    h: UNIT,
    seed: baseSeed + i,
    transparent: true,
    direction: "west" as const,
    ...(i > 0 ? { initFrom: def.sprites[i - 1], initStrength: 320 } : {}),
  }));
}

export const ART: ArtEntry[] = [
  // --- plants (32x32, transparent, face east) -----------------------------
  ...plantArt(PLANTS.primrose, [
    "small silver-blue moonflower sprout in a mossy clay pot, petals half open, drowsy gentle smile",
    "the same moonflower in radiant full bloom, silver petals wide, serene smile, soft moonlight halo",
    "the same moonflower ascended, ring of floating petals, bright crescent halo crown, tiny stars",
  ], 1010),
  ...plantArt(PLANTS.bamboo, [
    "young jade bamboo shoot with a determined face, leaf arms holding one tiny dart",
    "the same bamboo grown into an archer, crossbow-like leaf arms drawn, focused eyes, jade green",
    "the same bamboo as an elite arbalest, twin dart launchers, gold trim, battle-worn leaf cape",
  ], 1020),
  ...plantArt(PLANTS.catnip, [
    "tiny catnip sprout shaped like a sitting kitten, leaf ears, huge adorable eyes, pink nose, curled leaf tail",
    "the same kitten plant grown into a two-tailed cat blossom, playful grin, pink flower bell collar, two swishing leaf tails",
    "the same cat flower as a regal spirit cat, many glowing petal tails fanned out, tiny golden crown, sparkling whiskers",
  ], 1030),
  ...plantArt(PLANTS.lantern, [
    "small stone garden lantern with a mossy cap and a gentle warm glowing face",
    "the same stone lantern grown stout, ivy strap armor, brighter amber glow, sturdy stance",
    "the same stone lantern as a little fortress, carved guardian face, blazing gold light, thorned ivy plates",
  ], 1040),
  ...plantArt(PLANTS.sakura, [
    "small cherry blossom sapling with a shy blushing face, a few pink petals drifting",
    "the same cherry tree grown into a blossom guardian, swirl of pink petals, calm smile",
    "the same tree as a great sakura spirit in storm bloom, petal vortex, ancient serene face",
  ], 1050),
  // --- foes (32x32, transparent, walk west) --------------------------------
  ...foeArt(FOES.wisp, [
    "floating paper lantern ghost with a tiny flame heart and a mischievous grin, ragged paper skirt",
    "the same lantern ghost with twin flames and a wilder grin, scorched paper edges",
    "the same lantern ghost as a burning wraith, blue-white pyre flames, fierce bright eyes",
  ], 2010),
  ...foeArt(FOES.kasa, [
    "one-eyed umbrella yokai swordsman, tongue out, straw sandals, small wooden blade",
    "the same umbrella yokai in iron-ribbed armor with a war fan, one glowing eye",
    "the same umbrella yokai as a lacquer-armored warlord, crimson eye, twin blades",
  ], 2020),
  ...foeArt(FOES.usagi, [
    "small white moon rabbit spirit hopping with a tiny mochi mallet, round pink eyes",
    "the same moon rabbit as a drummer-warrior, red headband, bigger mochi hammer, determined",
    "the same moon rabbit as a royal vanguard, crescent banner on the back, great mallet, glowing fur",
  ], 2030),
  ...foeArt(FOES.uta, [
    "little night sparrow songstress spirit holding a tiny lantern staff, beak open in song",
    "the same night sparrow with a feathered cloak, brighter music notes swirling",
    "the same night sparrow as a radiant diva, plume crown, spiral of glowing song light",
  ], 2040),
  // --- projectiles + mote (16x16, transparent) ------------------------------
  { name: "shot-bolt.png", prompt: `slim jade bamboo dart flying sideways, ${SHOT_STYLE}`, w: SHOT, h: SHOT, seed: 3001, transparent: true },
  { name: "shot-orb.png", prompt: `round pink energy orb with a tiny paw print, ${SHOT_STYLE}`, w: SHOT, h: SHOT, seed: 3002, transparent: true },
  { name: "shot-mochi.png", prompt: `small round white mochi rice cake, ${SHOT_STYLE}`, w: SHOT, h: SHOT, seed: 3003, transparent: true },
  { name: "mote.png", prompt: `small silver-blue moonlight droplet, sparkling, ${SHOT_STYLE}`, w: SHOT, h: SHOT, seed: 3004, transparent: true },
  // --- scenes (256x128 opaque, drawn at 480x240) ----------------------------
  {
    name: "bg-title.png",
    prompt:
      "stone shrine in a night garden under an enormous full moon, sakura tree and bamboo grove, " +
      "fireflies, deep indigo sky, dreamy detailed pixel art seascape of grass",
    w: SCENE_W, h: SCENE_H, seed: 4001, shading: "detailed shading", detail: "highly detailed",
  },
  {
    name: "bg-field.png",
    prompt:
      "empty night garden battlefield seen from above, five horizontal mossy lawn rows between " +
      "a small stone shrine on the far left and a dark bamboo treeline on the far right, " +
      "full moon glow, deep indigo and teal palette, subdued flat pixel art, no creatures",
    w: SCENE_W, h: SCENE_H, seed: 4002, shading: "medium shading", detail: "highly detailed",
  },
  {
    name: "bg-dawn.png",
    prompt:
      "the same stone shrine garden at the first golden dawn, sun rising over the bamboo grove, " +
      "warm amber light washing the grass, hopeful detailed pixel art",
    w: SCENE_W, h: SCENE_H, seed: 4003, shading: "detailed shading", detail: "highly detailed",
    initFrom: "bg-title.png", initStrength: 300,
  },
  {
    name: "bg-eternal.png",
    prompt:
      "the same stone shrine garden under a huge ominous crimson moon, black bamboo silhouettes, " +
      "red mist over the grass, grim detailed pixel art",
    w: SCENE_W, h: SCENE_H, seed: 4004, shading: "detailed shading", detail: "highly detailed",
    initFrom: "bg-title.png", initStrength: 300,
  },
];

// ---------------------------------------------------------------------------
// Content contract — engine.validateContent() asserts this in the sim test
// ---------------------------------------------------------------------------

export function validateContent(): string[] {
  const problems: string[] = [];
  const artNames = new Set<string>();
  const pow2 = (n: number) => n >= 16 && n <= 512 && (n & (n - 1)) === 0;

  for (const a of ART) {
    if (artNames.has(a.name)) problems.push(`duplicate art entry "${a.name}"`);
    artNames.add(a.name);
    if (!pow2(a.w) || !pow2(a.h)) problems.push(`art "${a.name}" is ${a.w}x${a.h}, not pow2 16..512`);
    if (a.initFrom && !artNames.has(a.initFrom)) {
      problems.push(`art "${a.name}" initFrom "${a.initFrom}" is not defined earlier in the manifest`);
    }
  }

  for (const id of PLANT_ORDER) {
    const p = PLANTS[id];
    if (p.id !== id) problems.push(`plant "${id}" has mismatched id "${p.id}"`);
    if (p.cost <= 0) problems.push(`plant "${id}" has non-positive cost`);
    if (!(p.evolveAt[0] < p.evolveAt[1])) problems.push(`plant "${id}" evolve thresholds not ascending`);
    for (const s of p.sprites) if (!artNames.has(s)) problems.push(`plant "${id}" sprite "${s}" missing from ART`);
    if ((p.role === "shooter" || p.role === "burst") && (!p.dmg || !p.period)) {
      problems.push(`plant "${id}" is a ${p.role} without dmg/period`);
    }
    if (p.role === "producer" && (!p.pulseLumen || !p.period)) problems.push(`plant "${id}" is a producer without pulse`);
  }

  for (const id of FOE_ORDER) {
    const f = FOES[id];
    if (f.id !== id) problems.push(`foe "${id}" has mismatched id "${f.id}"`);
    for (const s of f.sprites) if (!artNames.has(s)) problems.push(`foe "${id}" sprite "${s}" missing from ART`);
    for (let i = 0; i < 3; i++) {
      if (f.hp[i] <= 0 || f.speed[i] <= 0) problems.push(`foe "${id}" stage ${i + 1} has non-positive hp/speed`);
    }
    if (f.lobRange && (!f.lobDmg || !f.lobPeriod)) problems.push(`foe "${id}" lobs without lob tables`);
  }

  let prev = -1;
  for (const w of WAVES) {
    if (w.at <= prev) problems.push(`wave at ${w.at}s is not strictly after ${prev}s`);
    prev = w.at;
    if (w.at >= DAWN_AT) problems.push(`wave at ${w.at}s spawns after dawn (${DAWN_AT}s)`);
    for (const foe of w.spawn) if (!FOES[foe]) problems.push(`wave at ${w.at}s spawns unknown foe "${foe}"`);
  }

  for (let i = 1; i < PHASES.length; i++) {
    if (PHASES[i].at <= PHASES[i - 1].at) problems.push(`phase "${PHASES[i].id}" does not start after "${PHASES[i - 1].id}"`);
  }

  for (const key of Object.keys(SCENES) as (keyof typeof SCENES)[]) {
    if (!artNames.has(SCENES[key])) problems.push(`scene "${key}" sprite "${SCENES[key]}" missing from ART`);
  }
  if (!artNames.has(MOTE_SPRITE)) problems.push(`mote sprite missing from ART`);

  return problems;
}
