// demos/tidelight/story.ts — the whole of TIDELIGHT as data: a typed branching
// node graph, distilled from the narrative grammar of Quantic Dream's
// Detroit: Become Human and rebuilt for a 480x272 screen and a d-pad.
//
//   theme        an obsolete machine discovers care and disobeys its directive
//   mechanics    timed choices (silence is a choice), fail-forward QTEs that
//                scar the story instead of ending it, meters that gate late
//                options (DIRECTIVE INTEGRITY falls as WICK deviates; TRUST
//                rises as Maren opens up), permanent NPC death the plot walks
//                past, a post-chapter flowchart of taken and untaken paths,
//                and six endings.
//
// Everything here is plain data — no JSX, no timers, no host access. The
// engine (engine.ts) folds it over the virtual clock, which is what makes a
// whole playthrough a pure function of the input tape: the flowchart's
// REPLAY NIGHT is honest time travel, not a saved-game approximation.
//
// All copy is ASCII (the Inter atlas carries no CJK) and pre-broken into
// lines that fit the dialogue panel.

export type FlagName =
  | "flare_found"
  | "stove_lit"
  | "coal_saved"
  | "reported"
  | "hidden"
  | "watched"
  | "lamp_dark_1"
  | "hand_seized"
  | "lamp_cracked"
  | "lied"
  | "half_truth"
  | "confessed"
  | "wire_check"
  | "named"
  | "gave_coat"
  | "fed_her"
  | "no_irons"
  | "fever_weak"
  | "maren_dead"
  | "lamp_dark_2"
  | "mugs_swept"
  | "mugs_left"
  | "caught"
  | "defied"
  | "buried"
  | "skiff"
  | "refused"
  | "fled"
  | "shielded"
  | "stood_aside";

export type EndingId =
  | "good-order"
  | "long-watch"
  | "two-keepers"
  | "dark-tower"
  | "still-water"
  | "breakwater";

export type BgName =
  | "bg-title.png"
  | "bg-shore.png"
  | "bg-lamproom.png"
  | "bg-quarters.png"
  | "bg-storm.png"
  | "bg-barge.png";

export type PortraitName =
  | "face-wick.png"
  | "face-wick-alert.png"
  | "face-maren.png"
  | "face-maren-warm.png"
  | "face-halloway.png"
  | "face-wire.png";

export type Speaker = "system" | "wick" | "maren" | "halloway" | "wire" | "narrator";

export type BtnName = "UP" | "DOWN" | "LEFT" | "RIGHT" | "CROSS" | "SQUARE" | "TRIANGLE" | "CIRCLE";

/** State deltas. Positive integrity is obedience; positive trust is Maren. */
export interface Fx {
  integrity?: number;
  trust?: number;
  /** Hidden inspection pressure — Halloway's ledger of small wrongnesses. */
  suspicion?: number;
  set?: FlagName;
}

/** AND of every provided test. */
export interface Cond {
  flag?: FlagName;
  not?: FlagName;
  minTrust?: number;
  maxIntegrity?: number;
  minIntegrity?: number;
  minSuspicion?: number;
  maxSuspicion?: number;
}

export type NodeId = string;

export interface ChoiceOption {
  label: string;
  to: NodeId;
  fx?: Fx[];
  if?: Cond;
}

export interface ScanSpot {
  id: string;
  label: string;
  /** Bracket box in 480x240 backdrop coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
  fx?: Fx[];
  /** Scanning this spot completes the sweep. */
  final?: boolean;
}

export type StoryNode =
  | { t: "card"; chapter: 1 | 2 | 3; title: string; sub: string; hold: number; next: NodeId }
  | { t: "scene"; bg: BgName; next: NodeId }
  | { t: "line"; who: Speaker; text: string[]; mood?: PortraitName; hold?: number; fx?: Fx[]; next: NodeId }
  | { t: "wire"; night: 1 | 2 | 3; next: NodeId }
  | { t: "scan"; spots: ScanSpot[]; done: NodeId }
  | { t: "choice"; prompt: string[]; timeout: number; options: ChoiceOption[]; silence: NodeId }
  | { t: "qte"; label: string; btn: BtnName; window: number; ok: NodeId; miss: NodeId; okFx?: Fx[]; missFx?: Fx[] }
  | { t: "branch"; arms: { if: Cond; to: NodeId }[]; else: NodeId }
  | { t: "chapter"; index: 1 | 2 | 3; next: NodeId }
  | { t: "end"; ending: EndingId };

export interface EndingDef {
  id: EndingId;
  index: number;
  title: string;
  lines: string[];
  quote: string;
}

export const START_NODE: NodeId = "n1-card";
export const INTEGRITY_START = 100;
export const TRUST_START = 0;

// ---------------------------------------------------------------------------
// NIGHT ONE — THE SHORE
// ---------------------------------------------------------------------------

const NIGHT1: Record<NodeId, StoryNode> = {
  "n1-card": {
    t: "card", chapter: 1, title: "NIGHT ONE", sub: "THE SHORE", hold: 2.5, next: "n1-scene",
  },
  "n1-scene": { t: "scene", bg: "bg-shore.png", next: "n1-open" },
  "n1-open": {
    t: "line", who: "system",
    text: ["DECOMMISSION BARGE DUE IN THREE DAYS.", "DIRECTIVE ONE: KEEP THE LIGHT."],
    next: "n1-wire",
  },
  "n1-wire": { t: "wire", night: 1, next: "n1-hallo-hail" },
  "n1-hallo-hail": {
    t: "line", who: "wire",
    text: ["Saltmere Light, sound off. Storm making up", "from the northwest. Log it, keeper."],
    next: "n1-ack",
  },
  "n1-ack": {
    t: "line", who: "wick",
    text: ["Saltmere Light. Lamp burning.", "All in order, Inspector Halloway."],
    next: "n1-motion",
  },
  "n1-motion": {
    t: "line", who: "system",
    text: ["MOTION ON THE SOUTH ROCKS.", "SWEEP THE SHORE."],
    next: "n1-scan",
  },
  "n1-scan": {
    t: "scan",
    spots: [
      { id: "wood", label: "DRIFTWOOD. HULL PLANKING. NOT OURS.", x: 46, y: 118, w: 60, h: 36 },
      {
        id: "flare", label: "SPENT SIGNAL FLARE. ARMY ISSUE.", x: 196, y: 106, w: 44, h: 30,
        fx: [{ set: "flare_found" }],
      },
      {
        id: "body", label: "PULSE DETECTED. CASTAWAY. ALIVE.", x: 320, y: 128, w: 68, h: 38,
        final: true,
      },
    ],
    done: "n1-protocol",
  },
  "n1-protocol": {
    t: "line", who: "system", mood: "face-wick-alert.png",
    text: ["PROTOCOL SEVEN: CASTAWAYS ARE REPORTED", "AND HELD FOR THE AUTHORITY."],
    next: "n1-c-fate",
  },
  "n1-c-fate": {
    t: "choice",
    prompt: ["She is breathing. The wire is live."],
    timeout: 8,
    options: [
      { label: "REPORT THE CASTAWAY", to: "n1-rep-call", fx: [{ set: "reported" }] },
      { label: "CARRY HER INSIDE", to: "n1-carry", fx: [{ set: "hidden" }, { integrity: -15 }, { trust: 5 }] },
      { label: "WAIT. WATCH.", to: "n1-watch", fx: [{ set: "watched" }] },
    ],
    silence: "n1-watch",
  },

  // -- report path ----------------------------------------------------------
  "n1-rep-call": {
    t: "line", who: "wick",
    text: ["Saltmere Light. One castaway, female,", "alive. Holding for pickup."],
    next: "n1-rep-reply",
  },
  "n1-rep-reply": {
    t: "line", who: "wire",
    text: ["Good machine. The barge collects you both", "on day three. Keep her breathing."],
    next: "n1-rep-wake",
  },
  "n1-rep-wake": {
    t: "line", who: "maren", fx: [{ trust: -10 }],
    text: ["...you already wired it in. Didn't you.", "Tin men and their protocols."],
    next: "n1-rep-cold",
  },
  "n1-rep-cold": {
    t: "line", who: "narrator",
    text: ["You carry her to the store room. She does", "not speak again. You log the door: LOCKED."],
    next: "n1-lamp-alert",
  },

  // -- watch path -----------------------------------------------------------
  "n1-watch": {
    t: "line", who: "narrator",
    text: ["You watch. The sea does not.", "A wave turns her over like driftwood."],
    next: "n1-watch-wake",
  },
  "n1-watch-wake": {
    t: "line", who: "maren",
    text: ["(she claws upright, sees your lamp eye)", "Is someone-- I need shelter. Please."],
    next: "n1-c-late",
  },
  "n1-c-late": {
    t: "choice",
    prompt: ["She is looking straight at you."],
    timeout: 6,
    options: [
      { label: "REPORT THE CASTAWAY", to: "n1-rep-call", fx: [{ set: "reported" }] },
      { label: "OPEN THE TOWER DOOR", to: "n1-carry", fx: [{ set: "hidden" }, { integrity: -15 }] },
    ],
    silence: "n1-rep-call",
  },

  // -- hide path ------------------------------------------------------------
  "n1-carry": {
    t: "line", who: "system", mood: "face-wick-alert.png",
    text: ["CARRYING. CORE TEMPERATURE 34.1.", "DIRECTIVE CONFLICT LOGGED."],
    next: "n1-carry-scene",
  },
  "n1-carry-scene": { t: "scene", bg: "bg-quarters.png", next: "n1-beg" },
  "n1-beg": {
    t: "line", who: "maren",
    text: ["Don't. Don't wire it in. Please--", "(she is shaking too hard to finish)"],
    next: "n1-c-ask",
  },
  "n1-c-ask": {
    t: "choice",
    prompt: ["Why did you not report me, machine?"],
    timeout: 8,
    options: [
      { label: "PROTOCOL SAYS REPORT. I HAVE NOT.", to: "n1-why-honest", fx: [{ trust: 10 }] },
      { label: "REST. THE STORM COMES FIRST.", to: "n1-why-deflect", fx: [{ trust: 5 }] },
      {
        label: "THE FLARE WAS ARMY ISSUE. NINTH?", to: "n1-ninth",
        if: { flag: "flare_found" }, fx: [{ trust: 10 }],
      },
    ],
    silence: "n1-why-silent",
  },
  "n1-why-honest": {
    t: "line", who: "maren",
    text: ["Then you're a strange kind of tin man.", "The kind they melt down, where I'm from."],
    next: "n1-fever-seed",
  },
  "n1-why-deflect": {
    t: "line", who: "maren",
    text: ["The storm. Right.", "You talk like a lighthouse."],
    next: "n1-fever-seed",
  },
  "n1-ninth": {
    t: "line", who: "maren",
    text: ["You read the casing. Of course you did.", "Ninth Company. What's left of it is me."],
    next: "n1-ninth2",
  },
  "n1-ninth2": {
    t: "line", who: "maren",
    text: ["The war ended in spring. The conscription", "didn't. So I ended it myself."],
    next: "n1-fever-seed",
  },
  "n1-why-silent": {
    t: "line", who: "narrator",
    text: ["You say nothing. She watches your lamp eye", "for a long time, and pulls the blanket close."],
    next: "n1-fever-seed",
  },
  "n1-fever-seed": {
    t: "line", who: "system",
    text: ["HER TEMPERATURE: 34.6 AND HOLDING LOW.", "THE STOVE IS COLD. COAL IS RATIONED."],
    next: "n1-c-stove",
  },
  "n1-c-stove": {
    t: "choice",
    prompt: ["Directive nine: conserve stores."],
    timeout: 6,
    options: [
      { label: "LIGHT THE STOVE", to: "n1-stove-lit", fx: [{ set: "stove_lit" }, { trust: 5 }, { integrity: -5 }] },
      { label: "BLANKETS ONLY. SAVE THE COAL.", to: "n1-stove-cold", fx: [{ set: "coal_saved" }] },
    ],
    silence: "n1-stove-cold",
  },
  "n1-stove-lit": {
    t: "line", who: "maren", mood: "face-maren-warm.png",
    text: ["(the fire takes; color crawls back", "into her hands) ...thank you. Wick."],
    next: "n1-lamp-alert",
  },
  "n1-stove-cold": {
    t: "line", who: "narrator",
    text: ["You stack every blanket in the tower on", "one shivering deserter. The coal stays."],
    next: "n1-lamp-alert",
  },

  // -- the storm QTE --------------------------------------------------------
  "n1-lamp-alert": {
    t: "line", who: "system", mood: "face-wick-alert.png",
    text: ["ALERT. LAMP PRESSURE FALLING.", "THE LIGHT IS GUTTERING."],
    next: "n1-storm-scene",
  },
  "n1-storm-scene": { t: "scene", bg: "bg-storm.png", next: "n1-q-climb" },
  "n1-q-climb": {
    t: "qte", label: "CLIMB THE TOWER", btn: "UP", window: 2.5,
    ok: "n1-q-vent", miss: "n1-m-climb", missFx: [{ set: "hand_seized" }],
  },
  "n1-m-climb": {
    t: "line", who: "system", mood: "face-wick-alert.png",
    text: ["LEFT MANIPULATOR SEIZES ON THE WET RAIL.", "YOU CLIMB ON, FOUR-FINGERED."],
    next: "n1-q-vent",
  },
  "n1-q-vent": {
    t: "qte", label: "VENT THE PRESSURE", btn: "SQUARE", window: 2,
    ok: "n1-q-strike", miss: "n1-m-vent", missFx: [{ set: "lamp_cracked" }],
  },
  "n1-m-vent": {
    t: "line", who: "system", mood: "face-wick-alert.png",
    text: ["THE STORM PANE CRACKS CORNER TO CORNER.", "PRESSURE VENTS THE HARD WAY."],
    next: "n1-q-strike",
  },
  "n1-q-strike": {
    t: "qte", label: "STRIKE THE LAMP", btn: "CROSS", window: 2,
    ok: "n1-relit", miss: "n1-dark", okFx: [{ integrity: 5 }],
    missFx: [{ set: "lamp_dark_1" }, { integrity: -10 }],
  },
  "n1-relit": {
    t: "line", who: "system",
    text: ["THE LAMP TAKES. THE BEAM WALKS THE WATER.", "DIRECTIVE ONE: HELD."],
    next: "n1-close",
  },
  "n1-dark": {
    t: "line", who: "system", mood: "face-wick-alert.png",
    text: ["THE WICK DROWNS. SALTMERE IS DARK FOR THE", "FIRST TIME IN FORTY YEARS."],
    next: "n1-close",
  },
  "n1-close": {
    t: "line", who: "narrator",
    text: ["The storm walks on north. Somewhere below,", "a stranger sleeps inside your tower."],
    next: "n1-chapter",
  },
  "n1-chapter": { t: "chapter", index: 1, next: "n2-card" },
};

// ---------------------------------------------------------------------------
// NIGHT TWO — THE WIRE
// ---------------------------------------------------------------------------

const NIGHT2: Record<NodeId, StoryNode> = {
  "n2-card": {
    t: "card", chapter: 2, title: "NIGHT TWO", sub: "THE WIRE", hold: 2.5, next: "n2-scene",
  },
  "n2-scene": { t: "scene", bg: "bg-lamproom.png", next: "n2-wire" },
  "n2-wire": { t: "wire", night: 2, next: "n2-route" },
  "n2-route": {
    t: "branch",
    arms: [
      { if: { flag: "reported" }, to: "n2-h-logi" },
      { if: { flag: "confessed" }, to: "n2-h-logi" },
    ],
    else: "n2-h-flare",
  },

  // -- reported: logistics + the cell ---------------------------------------
  "n2-h-logi": {
    t: "line", who: "wire",
    text: ["Saltmere. The barge lands at dawn, day", "three. Your castaway rides it in irons."],
    next: "n2-c-irons",
  },
  "n2-c-irons": {
    t: "choice",
    prompt: ["Confirm receipt, keeper."],
    timeout: 6,
    options: [
      { label: "CONFIRMED.", to: "n2-irons-yes" },
      { label: "REQUEST: NO IRONS. SHE IS WEAK.", to: "n2-irons-no", fx: [{ set: "no_irons" }, { integrity: -5 }, { trust: 5 }] },
    ],
    silence: "n2-irons-yes",
  },
  "n2-irons-yes": {
    t: "line", who: "wire",
    text: ["Logged. Forty years of clean ledgers,", "Saltmere. Finish the way you started."],
    next: "n2-cell-scene",
  },
  "n2-irons-no": {
    t: "line", who: "wire",
    text: ["...A machine, requesting. Noted, keeper.", "The Authority will consider it."],
    next: "n2-cell-scene",
  },
  "n2-cell-scene": { t: "scene", bg: "bg-quarters.png", next: "n2-cell" },
  "n2-cell": {
    t: "line", who: "maren",
    text: ["(through the store room door)", "Does the tin man eat? No? Lucky tin man."],
    next: "n2-c-cell",
  },
  "n2-c-cell": {
    t: "choice",
    prompt: ["The stew ration is for keepers. You have", "never needed it."],
    timeout: 6,
    options: [
      { label: "SLIDE THE STEW UNDER THE DOOR", to: "n2-fed", fx: [{ set: "fed_her" }, { trust: 10 }, { integrity: -5 }] },
      { label: "RECITE PROTOCOL SEVEN", to: "n2-recite", fx: [{ trust: -5 }] },
    ],
    silence: "n2-cell-silent",
  },
  "n2-fed": {
    t: "line", who: "maren", mood: "face-maren-warm.png",
    text: ["(the bowl scrapes back empty)", "Wick. If I run at dawn, will you look away?"],
    next: "n2-fork-alert",
  },
  "n2-recite": {
    t: "line", who: "maren",
    text: ["Held for the Authority. Yeah.", "You said. Twice."],
    next: "n2-fork-alert",
  },
  "n2-cell-silent": {
    t: "line", who: "narrator",
    text: ["You stand at the door with the bowl until", "it goes cold. You log: RATION UNSPENT."],
    next: "n2-fork-alert",
  },

  // -- hidden: the interrogation --------------------------------------------
  "n2-h-flare": {
    t: "line", who: "wire",
    text: ["Saltmere. Patrol logged an army flare off", "your point, two nights old."],
    next: "n2-h-flare2",
  },
  "n2-h-flare2": {
    t: "line", who: "wire",
    text: ["A deserter from the Ninth is unaccounted.", "Seen anything, keeper?"],
    next: "n2-c-interro",
  },
  "n2-c-interro": {
    t: "choice",
    prompt: ["The wire hums. Machines do not lie."],
    timeout: 6,
    options: [
      { label: "NOTHING BUT WEATHER.", to: "n2-lie", fx: [{ set: "lied" }, { integrity: -20 }] },
      {
        label: "A FLARE CASING. NO LANDING.", to: "n2-half",
        if: { flag: "flare_found" }, fx: [{ set: "half_truth" }, { suspicion: 1 }, { integrity: -10 }],
      },
      { label: "A CASTAWAY SHELTERS HERE.", to: "n2-conf", fx: [{ set: "confessed" }] },
    ],
    silence: "n2-static",
  },
  "n2-lie": {
    t: "line", who: "system", mood: "face-wick-alert.png",
    text: ["FALSE REPORT FILED. DIRECTIVE STRAIN", "REGISTERED IN THE SPEECH BUFFER."],
    next: "n2-lie2",
  },
  "n2-lie2": {
    t: "line", who: "wire",
    text: ["...Forty years without a discrepancy,", "Saltmere. Keep it that way."],
    next: "n2-fire-scene",
  },
  "n2-half": {
    t: "line", who: "wire",
    text: ["A casing and no landing. In that sea.", "The Inspector will want the casing, keeper."],
    next: "n2-fire-scene",
  },
  "n2-conf": {
    t: "line", who: "wire",
    text: ["Hold her for the barge. Day three, dawn.", "Good machine, Saltmere."],
    next: "n2-conf2",
  },
  "n2-conf2": {
    t: "line", who: "maren", fx: [{ trust: -20 }],
    text: ["(from the stairs, very quiet)", "I climbed up to bring you your lamp rag."],
    next: "n2-conf3",
  },
  "n2-conf3": {
    t: "line", who: "maren",
    text: ["Store room, then. Go on. Lock it.", "Machines do not lie. I heard."],
    next: "n2-cell-scene",
  },
  "n2-static": {
    t: "line", who: "wire", fx: [{ set: "wire_check" }, { suspicion: 1 }, { integrity: -5 }],
    text: ["Saltmere? ...Receiver must be failing.", "I will ride out with the barge myself."],
    next: "n2-fire-scene",
  },

  // -- fireside -------------------------------------------------------------
  "n2-fire-scene": { t: "scene", bg: "bg-quarters.png", next: "n2-name" },
  "n2-name": {
    t: "line", who: "maren", fx: [{ set: "named" }],
    text: ["W-I-C-K. Warden Interface, Coastal Keeper.", "Wick, then. Like the part that burns."],
    next: "n2-c-name",
  },
  "n2-c-name": {
    t: "choice",
    prompt: ["She waits for something like an answer."],
    timeout: 8,
    options: [
      { label: "THE WICK IS THE PART CONSUMED.", to: "n2-name-consumed", fx: [{ trust: 10 }] },
      { label: "UNIT DESIGNATIONS ARE NOT NAMES.", to: "n2-name-unit", fx: [{ trust: -5 }] },
      { label: "NO ONE HAS USED IT BEFORE.", to: "n2-name-first", fx: [{ trust: 10 }] },
    ],
    silence: "n2-name-silent",
  },
  "n2-name-consumed": {
    t: "line", who: "maren", mood: "face-maren-warm.png",
    text: ["(a short, dark laugh)", "Then we're both the part that burns."],
    next: "n2-ships",
  },
  "n2-name-unit": {
    t: "line", who: "maren",
    text: ["No. I suppose they wouldn't let them be.", "(she looks at the fire, not at you)"],
    next: "n2-ships",
  },
  "n2-name-first": {
    t: "line", who: "maren", mood: "face-maren-warm.png",
    text: ["First time for everything, Wick.", "(she tries the name again, softer) Wick."],
    next: "n2-ships",
  },
  "n2-name-silent": {
    t: "line", who: "maren",
    text: ["(she lets the quiet stand between you,", "the way you seem to prefer it)"],
    next: "n2-ships",
  },
  "n2-ships": {
    t: "line", who: "maren",
    text: ["Forty years on this rock. You must have", "seen wrecks."],
    next: "n2-ships2",
  },
  "n2-ships2": {
    t: "line", who: "wick",
    text: ["I keep the names. Selkie. Bright Hollow.", "Cormorant. Eleven souls, four winters ago."],
    next: "n2-c-coat",
  },
  "n2-c-coat": {
    t: "choice",
    prompt: ["She has stopped shivering. Mostly."],
    timeout: 6,
    options: [
      { label: "GIVE HER THE STORM COAT", to: "n2-coat-given", fx: [{ set: "gave_coat" }, { trust: 10 }] },
      { label: "SHE HAS BLANKETS ENOUGH", to: "n2-coat-kept" },
    ],
    silence: "n2-coat-kept",
  },
  "n2-coat-given": {
    t: "line", who: "maren", mood: "face-maren-warm.png",
    text: ["A keeper's coat on a deserter's back.", "Your Authority would rivet you shut, Wick."],
    next: "n2-fork-alert",
  },
  "n2-coat-kept": {
    t: "line", who: "narrator",
    text: ["The storm coat stays on its hook, where", "it has hung for forty dry years."],
    next: "n2-fork-alert",
  },

  // -- the fork: two directives, one keeper ---------------------------------
  "n2-fork-alert": {
    t: "line", who: "system", mood: "face-wick-alert.png",
    text: ["ALERT. LAMP PRESSURE FALLING.", "ALERT. HER FEVER: 39.8 AND CLIMBING."],
    next: "n2-c-fork",
  },
  "n2-c-fork": {
    t: "choice",
    prompt: ["Two directives. One keeper."],
    timeout: 5,
    options: [
      { label: "TEND THE LAMP", to: "n2-fork-lamp" },
      { label: "TEND MAREN", to: "n2-fork-maren", fx: [{ integrity: -25 }] },
    ],
    silence: "n2-fork-both",
  },

  // lamp branch: the light lives, the fever runs alone
  "n2-fork-lamp": { t: "scene", bg: "bg-storm.png", next: "n2-q-lamp" },
  "n2-q-lamp": {
    t: "qte", label: "STRIKE THE LAMP", btn: "CROSS", window: 2,
    ok: "n2-lamp-ok", miss: "n2-lamp-miss",
    missFx: [{ set: "lamp_dark_2" }, { integrity: -10 }, { suspicion: 1 }],
  },
  "n2-lamp-ok": {
    t: "line", who: "system",
    text: ["THE BEAM HOLDS. BELOW YOU, THROUGH THE", "FLOOR: COUGHING. THEN NOT."],
    next: "n2-fever",
  },
  "n2-lamp-miss": {
    t: "line", who: "system", mood: "face-wick-alert.png",
    text: ["THE LAMP DROWNS AGAIN. THE TOWER STANDS", "DARK OVER A LOUD, HUNGRY SEA."],
    next: "n2-fever",
  },
  "n2-fever": {
    t: "branch",
    arms: [
      { if: { flag: "stove_lit" }, to: "n2-lives-weak" },
      { if: { flag: "gave_coat" }, to: "n2-lives-weak" },
      { if: { flag: "fed_her" }, to: "n2-lives-weak" },
    ],
    else: "n2-dies",
  },
  "n2-lives-weak": {
    t: "line", who: "maren", fx: [{ set: "fever_weak" }, { trust: -10 }],
    text: ["(grey dawn; she is alive, barely)", "You chose the lamp. I know. I know."],
    next: "n2-close",
  },
  "n2-dies": {
    t: "line", who: "system", mood: "face-wick-alert.png", fx: [{ set: "maren_dead" }],
    text: ["04:12. HER BREATH THINS TO NOTHING", "ON THE COT. NO PROTOCOL APPLIES."],
    next: "n2-dies2",
  },
  "n2-dies2": {
    t: "line", who: "narrator",
    text: ["You sit with her until the storm forgets", "itself. The lamp turns. You do not."],
    next: "n2-close",
  },

  // maren branch: the fever breaks, the sea goes unanswered
  "n2-fork-maren": {
    t: "line", who: "system", mood: "face-wick-alert.png",
    text: ["DIRECTIVE ONE SUSPENDED BY KEEPER.", "NO PRECEDENT FOUND. PROCEEDING."],
    next: "n2-c-tend",
  },
  "n2-c-tend": {
    t: "choice",
    prompt: ["Her fever wants one more thing of you."],
    timeout: 6,
    options: [
      { label: "PACK SEA ICE AT HER NECK", to: "n2-tend-ice", fx: [{ trust: 15 }] },
      { label: "READ HER THE SHIPS' NAMES", to: "n2-tend-names", fx: [{ trust: 15 }] },
    ],
    silence: "n2-tend-sit",
  },
  "n2-tend-ice": {
    t: "line", who: "maren", mood: "face-maren-warm.png",
    text: ["(near dawn the fever breaks like weather)", "...you stayed. Lamps don't stay."],
    next: "n2-horn",
  },
  "n2-tend-names": {
    t: "line", who: "maren", mood: "face-maren-warm.png",
    text: ["(you recite wrecks like a psalm until the", "fever breaks) ...say mine too. Maren."],
    next: "n2-horn",
  },
  "n2-tend-sit": {
    t: "line", who: "maren", fx: [{ trust: 10 }],
    text: ["(you hold her hand in your seized one", "until dawn; the fever breaks anyway)"],
    next: "n2-horn",
  },
  "n2-horn": {
    t: "line", who: "system", mood: "face-wick-alert.png",
    fx: [{ set: "lamp_dark_2" }, { suspicion: 1 }],
    text: ["OUT IN THE DARK, A FERRY HORN ASKS A", "QUESTION NOTHING ANSWERS."],
    next: "n2-close",
  },

  // both branch: the scramble
  "n2-fork-both": {
    t: "line", who: "system", mood: "face-wick-alert.png",
    text: ["INDECISION LOGGED: 5.0 SECONDS.", "YOU TRY TO BE TWO KEEPERS AT ONCE."],
    next: "n2-q-both1",
  },
  "n2-q-both1": {
    t: "qte", label: "VENT THE PRESSURE", btn: "SQUARE", window: 1.5,
    ok: "n2-q-both2", miss: "n2-both-miss",
    missFx: [{ set: "lamp_dark_2" }, { integrity: -10 }, { suspicion: 1 }],
  },
  "n2-q-both2": {
    t: "qte", label: "STRIKE THE LAMP", btn: "CROSS", window: 1.5,
    ok: "n2-both-ok", miss: "n2-both-miss",
    missFx: [{ set: "lamp_dark_2" }, { integrity: -10 }, { suspicion: 1 }],
  },
  "n2-both-ok": {
    t: "line", who: "system",
    text: ["THE LAMP TAKES ON THE SECOND STRIKE.", "YOU TAKE THE STAIRS THREE AT A TIME."],
    next: "n2-fever",
  },
  "n2-both-miss": {
    t: "line", who: "system", mood: "face-wick-alert.png",
    text: ["THE LAMP DROWNS. YOU ARE ALREADY ON THE", "STAIRS, RUNNING FROM DIRECTIVE ONE."],
    next: "n2-fever",
  },

  "n2-close": {
    t: "line", who: "narrator",
    text: ["Day three arrives flat and grey, the sea", "spent. A barge horn sounds off the point."],
    next: "n2-chapter",
  },
  "n2-chapter": { t: "chapter", index: 2, next: "n3-card" },
};

// ---------------------------------------------------------------------------
// NIGHT THREE — THE BARGE
// ---------------------------------------------------------------------------

const NIGHT3: Record<NodeId, StoryNode> = {
  "n3-card": {
    t: "card", chapter: 3, title: "DAY THREE", sub: "THE BARGE", hold: 2.5, next: "n3-scene",
  },
  "n3-scene": { t: "scene", bg: "bg-barge.png", next: "n3-route" },
  "n3-route": {
    t: "branch",
    arms: [
      { if: { flag: "maren_dead" }, to: "n3-d-empty" },
      { if: { flag: "reported" }, to: "n3-h-land" },
      { if: { flag: "confessed" }, to: "n3-h-land" },
    ],
    else: "n3-i-land",
  },

  // -- she died -------------------------------------------------------------
  "n3-d-empty": {
    t: "line", who: "system",
    text: ["THE COT IS MADE. THE BOWL IS CLEAN.", "THE TOWER IS ONE KEEPER QUIET AGAIN."],
    next: "n3-c-grave",
  },
  "n3-c-grave": {
    t: "choice",
    prompt: ["The ledger wants a cause of death."],
    timeout: 8,
    options: [
      { label: "REPORT THE DEATH IN FULL", to: "n3-d-report" },
      { label: "BURY HER BY THE ROCKS FIRST", to: "n3-d-bury", fx: [{ set: "buried" }, { integrity: -10 }] },
    ],
    silence: "n3-d-report",
  },
  "n3-d-report": {
    t: "line", who: "halloway",
    text: ["Exposure, after a desertion. The sea does", "most of my work for me, keeper."],
    next: "n3-d-verdict",
  },
  "n3-d-bury": {
    t: "line", who: "narrator",
    text: ["You stack a cairn where the beam touches", "at each turn. The ledger stays one line short."],
    next: "n3-d-verdict",
  },
  "n3-d-verdict": {
    t: "line", who: "halloway",
    text: ["The barge sails at noon. Decommission", "stands. Bring the lamp's service log."],
    next: "n3-end-still",
  },
  "n3-end-still": { t: "end", ending: "still-water" },

  // -- she was held: the handover -------------------------------------------
  "n3-h-land": {
    t: "line", who: "halloway",
    text: ["(he steps off the barge, boots loud on", "your pier) Saltmere. The castaway."],
    next: "n3-handover",
  },
  "n3-handover": {
    t: "line", who: "narrator",
    text: ["Two enforcers walk her to the rail, wrists", "bound. She does not look at you."],
    next: "n3-c-last",
  },
  "n3-c-last": {
    t: "choice",
    prompt: ["Ten steps of pier left."],
    timeout: 5,
    options: [
      { label: "STAND ASIDE", to: "n3-aside", fx: [{ set: "stood_aside" }] },
      {
        label: "OPEN HER IRONS", to: "n3-defy",
        if: { maxIntegrity: 85 }, fx: [{ set: "defied" }, { integrity: -20 }],
      },
    ],
    silence: "n3-aside",
  },
  "n3-aside": {
    t: "line", who: "maren",
    text: ["(at the rail, she looks back once)", "Keep the names, Wick. Mine too."],
    next: "n3-end-order",
  },
  "n3-end-order": { t: "end", ending: "good-order" },

  "n3-defy": {
    t: "line", who: "system", mood: "face-wick-alert.png",
    text: ["DIRECTIVE OVERRIDE: KEEPER.", "PROTOCOL SEVEN: DISCARDED."],
    next: "n3-q-shove",
  },
  "n3-q-shove": {
    t: "qte", label: "BREAK THE LINE", btn: "CROSS", window: 1.5,
    ok: "n3-q-irons", miss: "n3-dragged",
  },
  "n3-dragged": {
    t: "line", who: "narrator",
    text: ["An arc-pike finds your seized shoulder.", "They hold you to the stones while she boards."],
    next: "n3-dragged2",
  },
  "n3-dragged2": {
    t: "line", who: "halloway",
    text: ["Log the malfunction. Then log the tide.", "Forty years, keeper. Such a clean ledger."],
    next: "n3-end-order",
  },
  "n3-q-irons": {
    t: "qte", label: "STRIKE THE IRONS", btn: "SQUARE", window: 1.5,
    ok: "n3-c-flee", miss: "n3-dragged",
  },
  "n3-c-flee": {
    t: "choice",
    prompt: ["The irons ring on the stones. The skiff", "line is in reach. So are the pikes."],
    timeout: 4,
    options: [
      { label: "SHIELD HER AT THE RAIL", to: "n3-shield", fx: [{ set: "shielded" }] },
      { label: "RUN WITH HER. INLAND.", to: "n3-run", fx: [{ set: "fled" }] },
    ],
    silence: "n3-shield",
  },
  "n3-shield": {
    t: "line", who: "maren", mood: "face-maren.png",
    text: ["(you are the wall between her and six", "pikes) Wick-- the skiff-- COME WITH ME--"],
    next: "n3-shield2",
  },
  "n3-shield2": {
    t: "line", who: "system", mood: "face-wick-alert.png",
    text: ["HULL BREACH. BREACH. BREACH.", "DIRECTIVE ONE REWRITTEN: KEEP HER LIT."],
    next: "n3-end-break",
  },
  "n3-end-break": { t: "end", ending: "breakwater" },
  "n3-run": {
    t: "line", who: "narrator",
    text: ["You are faster than men on wet stone.", "Behind you the tower stands unlit, unkept."],
    next: "n3-end-darktower",
  },
  "n3-end-darktower": { t: "end", ending: "dark-tower" },

  // -- she is hidden: the inspection ----------------------------------------
  "n3-i-land": {
    t: "branch",
    arms: [{ if: { flag: "lamp_dark_2" }, to: "n3-i-selkie" }],
    else: "n3-i-hail",
  },
  "n3-i-selkie": {
    t: "line", who: "halloway",
    text: ["The ferry Selkie limped off a shoal last", "night. Your light was down, keeper. Why?"],
    next: "n3-i-walk",
  },
  "n3-i-hail": {
    t: "line", who: "halloway",
    text: ["(he steps off the barge with the ledger", "under his arm) Saltmere. Final inspection."],
    next: "n3-i-walk",
  },
  "n3-i-walk": {
    t: "line", who: "narrator",
    text: ["He walks your quarters slowly, gloved", "finger riding the shelf line. He stops."],
    next: "n3-c-mugs",
  },
  "n3-c-mugs": {
    t: "choice",
    prompt: ["Two mugs stand by the stove.", "Keepers do not drink."],
    timeout: 4,
    options: [
      { label: "SWEEP THEM INTO THE SINK", to: "n3-mugs-swept", fx: [{ set: "mugs_swept" }] },
      { label: "LET THEM STAND", to: "n3-mugs-left", fx: [{ set: "mugs_left" }, { suspicion: 1 }] },
    ],
    silence: "n3-mugs-left",
  },
  "n3-mugs-swept": {
    t: "line", who: "halloway",
    text: ["(the mugs are gone before his eyes", "arrive; he writes nothing. Yet.)"],
    next: "n3-c-alone",
  },
  "n3-mugs-left": {
    t: "line", who: "halloway",
    text: ["Two mugs, keeper. (he rights the one that", "still steams, and writes one short line)"],
    next: "n3-c-alone",
  },
  "n3-c-alone": {
    t: "choice",
    prompt: ["Machines do not lie. That is the point of", "you. Say it plain: are you alone?"],
    timeout: 5,
    options: [
      { label: "I AM ALONE, INSPECTOR.", to: "n3-alone-lie", fx: [{ integrity: -15 }] },
      { label: "NO. SHE SLEEPS BY THE STOVE.", to: "n3-give-up", fx: [{ set: "confessed" }] },
    ],
    silence: "n3-alone-silent",
  },
  "n3-alone-silent": {
    t: "line", who: "halloway", fx: [{ suspicion: 2 }],
    text: ["Silence, from a speaking machine,", "is a kind of sentence too."],
    next: "n3-verdict-branch",
  },
  "n3-alone-lie": {
    t: "branch",
    arms: [{ if: { minSuspicion: 2 }, to: "n3-caught" }],
    else: "n3-sign",
  },
  "n3-verdict-branch": {
    t: "branch",
    arms: [{ if: { minSuspicion: 2 }, to: "n3-caught" }],
    else: "n3-sign",
  },
  "n3-give-up": {
    t: "line", who: "narrator",
    text: ["You say it plainly. Behind the stove door,", "something that trusted you stops breathing quietly."],
    next: "n3-caught2",
  },
  "n3-caught": {
    t: "line", who: "halloway",
    text: ["(he closes the ledger without haste)", "Forty years. And it lies for a deserter."],
    next: "n3-caught2",
  },
  "n3-caught2": {
    t: "line", who: "narrator", fx: [{ set: "caught" }],
    text: ["The enforcers bring her out into the grey.", "She walks past you without a word."],
    next: "n3-c-last",
  },
  "n3-sign": {
    t: "line", who: "halloway",
    text: ["In good order. Signed. The barge sails at", "noon, keeper. Be on it. Bring the log."],
    next: "n3-sign2",
  },
  "n3-sign2": {
    t: "line", who: "maren", mood: "face-maren-warm.png",
    text: ["(when the boots fade off the pier)", "That was lying, Wick. For me. Twice."],
    next: "n3-c-final",
  },
  "n3-c-final": {
    t: "choice",
    prompt: ["Noon is two hours out. The skiff rides", "low and ready at the pier."],
    timeout: 8,
    options: [
      { label: "SEND HER NORTH ON THE SKIFF", to: "n3-skiff", fx: [{ set: "skiff" }] },
      {
        label: "REFUSE THE BARGE. STAY. BOTH.", to: "n3-refuse",
        if: { maxIntegrity: 60, minTrust: 25 }, fx: [{ set: "refused" }],
      },
    ],
    silence: "n3-skiff",
  },
  "n3-skiff": {
    t: "line", who: "maren", mood: "face-maren-warm.png",
    text: ["(she takes the oars like a soldier and the", "coat like a gift) Keep the names, keeper."],
    next: "n3-end-watch",
  },
  "n3-end-watch": { t: "end", ending: "long-watch" },
  "n3-refuse": {
    t: "line", who: "wick",
    text: ["Saltmere Light, sound off. The lamp burns.", "The keeper stays. Log it, Inspector."],
    next: "n3-refuse2",
  },
  "n3-refuse2": {
    t: "line", who: "narrator",
    text: ["Static, for eleven seconds. Then the wire", "goes dead in a way that sounds like retreat."],
    next: "n3-end-keepers",
  },
  "n3-end-keepers": { t: "end", ending: "two-keepers" },
};

export const STORY: Record<NodeId, StoryNode> = { ...NIGHT1, ...NIGHT2, ...NIGHT3 };

// ---------------------------------------------------------------------------
// Endings
// ---------------------------------------------------------------------------

export const ENDINGS: EndingDef[] = [
  {
    id: "good-order", index: 1, title: "GOOD ORDER",
    lines: [
      "The barge takes two passengers: a deserter",
      "in irons, and a keeper in good order.",
      "The ledger closes with no discrepancies.",
    ],
    quote: "Forty years. Not one wave got past you.",
  },
  {
    id: "long-watch", index: 2, title: "THE LONG WATCH",
    lines: [
      "A skiff rows north under a borrowed coat.",
      "At noon a keeper boards the barge, holding",
      "a service log with one name added to it.",
    ],
    quote: "Keepers change. The light does not.",
  },
  {
    id: "two-keepers", index: 3, title: "TWO KEEPERS",
    lines: [
      "The Authority strikes Saltmere from the",
      "registry. The lamp burns anyway, unlogged,",
      "tended by a machine and a deserter.",
    ],
    quote: "No directive says a light needs permission.",
  },
  {
    id: "dark-tower", index: 4, title: "DARK TOWER",
    lines: [
      "Two figures climb inland through the gorse,",
      "one carrying the other's pack. Behind them",
      "the coast keeps its first dark tower.",
    ],
    quote: "Every light you keep costs one you don't.",
  },
  {
    id: "still-water", index: 5, title: "STILL WATER",
    lines: [
      "The barge sails at noon with one keeper",
      "and one folded army coat. The sea keeps",
      "what it is given. It always has.",
    ],
    quote: "No protocol applies.",
  },
  {
    id: "breakwater", index: 6, title: "BREAKWATER",
    lines: [
      "A skiff clears the point unpursued. On the",
      "pier, sea water finds a lamp eye and puts",
      "it out gently, like a thumb and forefinger.",
    ],
    quote: "The wick is the part that is consumed.",
  },
];

// ---------------------------------------------------------------------------
// Flowcharts — the Detroit-signature post-chapter graphs. Node ids reference
// story nodes; VISITED lights the box, the rest stay locked. Positions are
// (col, row) on the chart grid.
// ---------------------------------------------------------------------------

export interface ChartNode {
  id: NodeId;
  label: string;
  col: number;
  row: number;
}

export interface Flowchart {
  night: 1 | 2 | 3;
  title: string;
  nodes: ChartNode[];
  edges: [NodeId, NodeId][];
}

// Labels stay <= 7 characters so every box fits an 8-column grid at 480 px,
// and edges only ever run left to right (the renderer draws L-shaped
// connectors and does not route backwards).
export const FLOWCHARTS: Flowchart[] = [
  {
    night: 1,
    title: "NIGHT ONE -- THE SHORE",
    nodes: [
      { id: "n1-hallo-hail", label: "HAIL", col: 0, row: 1 },
      { id: "n1-scan", label: "SWEEP", col: 1, row: 1 },
      { id: "n1-c-fate", label: "PROTO 7", col: 2, row: 1 },
      { id: "n1-rep-call", label: "REPORT", col: 3, row: 0 },
      { id: "n1-watch", label: "WATCH", col: 3, row: 1 },
      { id: "n1-carry", label: "CARRY", col: 3, row: 2 },
      { id: "n1-c-ask", label: "THE ASK", col: 4, row: 2 },
      { id: "n1-c-stove", label: "STOVE", col: 5, row: 2 },
      { id: "n1-q-climb", label: "CLIMB", col: 6, row: 1 },
      { id: "n1-relit", label: "RELIT", col: 7, row: 0 },
      { id: "n1-dark", label: "DARK", col: 7, row: 2 },
    ],
    edges: [
      ["n1-hallo-hail", "n1-scan"],
      ["n1-scan", "n1-c-fate"],
      ["n1-c-fate", "n1-rep-call"],
      ["n1-c-fate", "n1-watch"],
      ["n1-c-fate", "n1-carry"],
      ["n1-watch", "n1-c-ask"],
      ["n1-carry", "n1-c-ask"],
      ["n1-c-ask", "n1-c-stove"],
      ["n1-rep-call", "n1-q-climb"],
      ["n1-c-stove", "n1-q-climb"],
      ["n1-q-climb", "n1-relit"],
      ["n1-q-climb", "n1-dark"],
    ],
  },
  {
    night: 2,
    title: "NIGHT TWO -- THE WIRE",
    nodes: [
      { id: "n2-wire", label: "WIRE", col: 0, row: 2 },
      { id: "n2-c-irons", label: "IRONS", col: 1, row: 0 },
      { id: "n2-c-interro", label: "THE ASK", col: 1, row: 3 },
      { id: "n2-lie", label: "LIE", col: 2, row: 2 },
      { id: "n2-half", label: "HALF", col: 2, row: 3 },
      { id: "n2-static", label: "STATIC", col: 2, row: 4 },
      { id: "n2-conf", label: "GAVE UP", col: 2, row: 5 },
      { id: "n2-c-cell", label: "CELL", col: 3, row: 0 },
      { id: "n2-c-name", label: "NAME", col: 3, row: 3 },
      { id: "n2-c-coat", label: "COAT", col: 4, row: 3 },
      { id: "n2-c-fork", label: "FORK", col: 5, row: 2 },
      { id: "n2-fork-lamp", label: "LAMP", col: 6, row: 1 },
      { id: "n2-fork-maren", label: "FEVER", col: 6, row: 3 },
      { id: "n2-lives-weak", label: "LIVES", col: 7, row: 2 },
      { id: "n2-dies", label: "DIES", col: 7, row: 4 },
    ],
    edges: [
      ["n2-wire", "n2-c-irons"],
      ["n2-c-irons", "n2-c-cell"],
      ["n2-c-cell", "n2-c-fork"],
      ["n2-wire", "n2-c-interro"],
      ["n2-c-interro", "n2-lie"],
      ["n2-c-interro", "n2-half"],
      ["n2-c-interro", "n2-static"],
      ["n2-c-interro", "n2-conf"],
      ["n2-conf", "n2-c-cell"],
      ["n2-lie", "n2-c-name"],
      ["n2-half", "n2-c-name"],
      ["n2-static", "n2-c-name"],
      ["n2-c-name", "n2-c-coat"],
      ["n2-c-coat", "n2-c-fork"],
      ["n2-c-fork", "n2-fork-lamp"],
      ["n2-c-fork", "n2-fork-maren"],
      ["n2-fork-lamp", "n2-lives-weak"],
      ["n2-fork-lamp", "n2-dies"],
      ["n2-fork-maren", "n2-lives-weak"],
    ],
  },
  {
    night: 3,
    title: "DAY THREE -- THE BARGE",
    nodes: [
      { id: "n3-scene", label: "LANDING", col: 0, row: 2 },
      { id: "n3-handover", label: "IRONS", col: 1, row: 0 },
      { id: "n3-c-mugs", label: "MUGS", col: 1, row: 2 },
      { id: "n3-c-grave", label: "LEDGER", col: 1, row: 5 },
      { id: "n3-c-alone", label: "ALONE?", col: 2, row: 2 },
      { id: "n3-caught", label: "CAUGHT", col: 3, row: 1 },
      { id: "n3-sign", label: "SIGNED", col: 3, row: 3 },
      { id: "n3-c-last", label: "10 STEP", col: 4, row: 0 },
      { id: "n3-q-shove", label: "BREAK", col: 5, row: 1 },
      { id: "n3-c-final", label: "NOON", col: 5, row: 3 },
      { id: "n3-end-order", label: "ORDER", col: 7, row: 0 },
      { id: "n3-end-break", label: "BREAKER", col: 7, row: 1 },
      { id: "n3-end-darktower", label: "TOWER", col: 7, row: 2 },
      { id: "n3-end-watch", label: "WATCH", col: 7, row: 3 },
      { id: "n3-end-keepers", label: "KEEPERS", col: 7, row: 4 },
      { id: "n3-end-still", label: "WATER", col: 7, row: 5 },
    ],
    edges: [
      ["n3-scene", "n3-handover"],
      ["n3-scene", "n3-c-mugs"],
      ["n3-scene", "n3-c-grave"],
      ["n3-c-grave", "n3-end-still"],
      ["n3-handover", "n3-c-last"],
      ["n3-c-mugs", "n3-c-alone"],
      ["n3-c-alone", "n3-sign"],
      ["n3-c-alone", "n3-caught"],
      ["n3-caught", "n3-c-last"],
      ["n3-c-last", "n3-end-order"],
      ["n3-c-last", "n3-q-shove"],
      ["n3-q-shove", "n3-end-order"],
      ["n3-q-shove", "n3-end-break"],
      ["n3-q-shove", "n3-end-darktower"],
      ["n3-sign", "n3-c-final"],
      ["n3-c-final", "n3-end-watch"],
      ["n3-c-final", "n3-end-keepers"],
    ],
  },
];

// Fleet flavor under each chart — TIDELIGHT's nod to Detroit's global
// player-choice percentages, reframed as Authority telemetry (and, like all
// telemetry, quietly judgmental).
export const FLEET_NOTES: Record<1 | 2 | 3, string> = {
  1: "FLEET EXPECTS: REPORT ON CONTACT",
  2: "FLEET EXPECTS: THE LAMP FIRST",
  3: "FLEET EXPECTS: GOOD ORDER",
};
