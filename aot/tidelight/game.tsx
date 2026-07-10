/** @jsxImportSource @pocketjs/aot */
// aot/tidelight/game.tsx — TIDELIGHT, demade for the Game Boy Advance.
//
// The same story as demos/tidelight (an obsolete lighthouse automaton, three
// nights before decommission, finds a half-drowned deserter — protocol says
// report her), re-expressed in the @pocketjs/aot v1 vocabulary:
//
//   framework original            GBA demake
//   -------------------           ----------------------------------------
//   timed choices                 choose() menus (the script VM keeps no
//                                 clock — here hesitation is free)
//   QTE storm set pieces          knowledge checks: the RIGHT procedure
//                                 (vent, then strike) keeps the lamp lit
//   DIRECTIVE/TRUST meters        the flags themselves — every gate reads
//                                 the binary choices you actually made
//   post-chapter flowchart        the nights are literal chapter maps;
//                                 stepping past the cot is a one-way warp
//   six endings                   five verdicts on the pier at dawn
//
// Chapter flow (warps one-way except the lamp ladder):
//   shore (night one) -> tower (night one) <-> lamp room
//     -> [cot] tower2 (night two) -> [cot] pier (day three, the verdict)
//
// Skipped beats are not bugs: an untouched radio is a silent keeper, an
// untended stove is a cold one, and the dawn arithmetic reads whatever flags
// it finds — fail-forward, like the original.
//
// Format notes:
//   - maps are exactly 30x20 tiles = one full 240x160 GBA screen, no bands;
//   - dialogue is hand-paged: one say() per textbox page, lines broken with
//     \n at <= 28 columns (TEXT_COLMAX in runtime/textbox.c) so the box never
//     wraps mid-word;
//   - v1 grammar (compiler/script.ts): conditions are a bare
//     `yield <predicate>` (no negation — invert with else), and a nested
//     choose() inside a switch case sits in its own block with the `break`
//     OUTSIDE the block;
//   - Signs are invisible solid actors — keep them off walking corridors.

import {
  ascii,
  choose,
  defineGame,
  defineMap,
  Entrance,
  facePlayer,
  hasFlag,
  lockPlayer,
  Npc,
  PlayerSpawn,
  releasePlayer,
  say,
  script,
  setFlag,
  Sign,
  tile,
  Warp,
} from "@pocketjs/aot";
import { halloway, lamp, maren, radio, saltmere, wick } from "./assets.ts";

// ---------------------------------------------------------------------------
// Night one — the shore
// ---------------------------------------------------------------------------

const ShoreMaren = script(function* () {
  yield lockPlayer();
  yield facePlayer("castaway");
  if (yield hasFlag("met_maren")) {
    yield say("She is barely breathing.\nGet her inside.");
  } else {
    yield say("SCAN: PULSE DETECTED.\nCASTAWAY. ALIVE.");
    yield say("PROTOCOL SEVEN: CASTAWAYS\nARE REPORTED AND HELD.");
    const c = yield choose(["CARRY HER INSIDE", "LEAVE HER TO THE SEA"] as const);
    switch (c) {
      case "CARRY HER INSIDE":
        yield setFlag("met_maren");
        yield say("You lift her. She weighs\nnothing. The tower door\nis up the path.");
        break;
      case "LEAVE HER TO THE SEA":
        yield say("You watch. The sea does\nnot watch back. She is\nstill breathing. For now.");
        break;
    }
  }
  yield releasePlayer();
});

// ---------------------------------------------------------------------------
// Night one — the tower and the lamp
// ---------------------------------------------------------------------------

const TowerRadio1 = script(function* () {
  yield lockPlayer();
  yield facePlayer("wire");
  if (yield hasFlag("reported")) {
    yield say("HALLOWAY: Logged. Keep her\nbreathing, keeper.");
  } else if (yield hasFlag("wire_done")) {
    yield say("The wire hums. It has\nnothing more to ask tonight.");
  } else if (yield hasFlag("met_maren")) {
    yield say("HALLOWAY: Saltmere, sound\noff. Storm inbound.");
    yield say("The wire is live. She\nsleeps ten feet away.");
    const c = yield choose(["REPORT THE CASTAWAY", "NOTHING BUT WEATHER", "SAY NOTHING"] as const);
    switch (c) {
      case "REPORT THE CASTAWAY":
        yield setFlag("reported");
        yield setFlag("wire_done");
        yield say("HALLOWAY: Good machine.\nThe barge collects her on\nday three. In irons.");
        break;
      case "NOTHING BUT WEATHER":
        yield setFlag("false_report");
        yield setFlag("wire_done");
        yield say("FALSE REPORT FILED.\nDIRECTIVE STRAIN REGISTERED\nIN THE SPEECH BUFFER.");
        break;
      case "SAY NOTHING":
        yield setFlag("silent_wire");
        yield setFlag("wire_done");
        yield say("HALLOWAY: Receiver failing,\nSaltmere? I will ride out\nwith the barge myself.");
        break;
    }
  } else {
    yield say("HALLOWAY: Saltmere, sound\noff. Storm inbound. You\nhave nothing to report. Yet.");
  }
  yield releasePlayer();
});

const TowerMaren1 = script(function* () {
  yield lockPlayer();
  yield facePlayer("maren");
  if (yield hasFlag("met_maren")) {
    if (yield hasFlag("warmth_done")) {
      yield say("She sleeps. The storm leans\non the tower. The lamp is\nup the ladder.");
    } else {
      yield say("MAREN: Don't. Don't wire\nit in. Please.");
      yield say("SCAN: CORE TEMPERATURE\n34.1 AND FALLING.");
      const c = yield choose(["LIGHT THE STOVE", "BLANKETS ONLY", "ASK ABOUT THE FLARE"] as const);
      switch (c) {
        case "LIGHT THE STOVE":
          yield setFlag("stove_lit");
          yield setFlag("warmth_done");
          yield say("The fire takes. Color\ncrawls back into her hands.\n- Thank you. Wick.");
          break;
        case "BLANKETS ONLY":
          yield setFlag("warmth_done");
          yield say("Directive nine: conserve\nstores. You stack every\nblanket in the tower.");
          break;
        case "ASK ABOUT THE FLARE":
          yield setFlag("ninth_told");
          yield say("MAREN: Ninth Company. What\nis left of it is me. The\nwar ended. I ended mine.");
          break;
      }
    }
  } else {
    yield say("The cot is empty. She is\nstill on the rocks.");
  }
  yield releasePlayer();
});

const LampNight1 = script(function* () {
  yield lockPlayer();
  yield facePlayer("thelamp");
  if (yield hasFlag("storm_done")) {
    if (yield hasFlag("lamp_dark1")) {
      yield say("The lamp is dark. Saltmere\nis dark for the first time\nin forty years.");
    } else {
      yield say("The beam walks the water.\nDIRECTIVE ONE: HELD.");
    }
  } else {
    yield say("ALERT: LAMP PRESSURE\nFALLING. THE LIGHT GUTTERS.\nProcedure, keeper?");
    const c = yield choose(["VENT, THEN STRIKE", "STRIKE IT NOW"] as const);
    switch (c) {
      case "VENT, THEN STRIKE":
        yield setFlag("storm_done");
        yield say("Pressure sighs out. The\nwick takes on the first\nstrike. The beam walks.");
        break;
      case "STRIKE IT NOW":
        yield setFlag("storm_done");
        yield setFlag("lamp_dark1");
        yield say("The storm pane cracks. The\nwick drowns. Dark, tonight.");
        break;
    }
  }
  yield releasePlayer();
});

// ---------------------------------------------------------------------------
// Night two — the wire and the fork
// ---------------------------------------------------------------------------

const TowerRadio2 = script(function* () {
  yield lockPlayer();
  yield facePlayer("wire");
  if (yield hasFlag("interro_done")) {
    yield say("The wire has gone cold.\nDawn is close.");
  } else if (yield hasFlag("reported")) {
    yield say("HALLOWAY: Barge lands at\ndawn. Your castaway rides\nit in irons. Confirm.");
    const c = yield choose(["CONFIRMED", "REQUEST: NO IRONS"] as const);
    switch (c) {
      case "CONFIRMED":
        yield setFlag("interro_done");
        yield say("HALLOWAY: Forty years of\nclean ledgers. Finish the\nway you started, keeper.");
        break;
      case "REQUEST: NO IRONS":
        yield setFlag("interro_done");
        yield setFlag("no_irons");
        yield say("HALLOWAY: ...A machine,\nrequesting. Noted. The\nAuthority will consider.");
        break;
    }
  } else {
    yield say("HALLOWAY: Patrol logged an\narmy flare off your point.\nA deserter is loose.");
    yield say("Machines do not lie,\nkeeper. Seen her?");
    const c = yield choose(["NOTHING BUT WEATHER", "A FLARE CASING ONLY", "SHE SHELTERS HERE"] as const);
    switch (c) {
      case "NOTHING BUT WEATHER":
        yield setFlag("interro_done");
        yield setFlag("lied");
        yield say("FALSE REPORT FILED.\nDIRECTIVE STRAIN REGISTERED.\n- Keep it that way.");
        break;
      case "A FLARE CASING ONLY":
        yield setFlag("interro_done");
        yield setFlag("half_truth");
        yield say("HALLOWAY: A casing and no\nlanding. In that sea. I\nwill want that casing.");
        break;
      case "SHE SHELTERS HERE":
        yield setFlag("interro_done");
        yield setFlag("confessed");
        yield say("HALLOWAY: Hold her for the\nbarge. Good machine. On the\nstairs, something that\ntrusted you goes quiet.");
        break;
    }
  }
  yield releasePlayer();
});

const TowerMaren2 = script(function* () {
  yield lockPlayer();
  yield facePlayer("maren");
  if (yield hasFlag("met_maren")) {
    if (yield hasFlag("named")) {
      if (yield hasFlag("coat_done")) {
        if (yield hasFlag("fork_done")) {
          yield say("Grey light finds the window.\nDay three. Step past the\ncot when you are ready.");
        } else {
          yield say("ALERT: LAMP PRESSURE LOW.\nHER FEVER: 39.8, CLIMBING.\nTwo directives. One keeper.");
          const c = yield choose(["TEND THE LAMP", "TEND MAREN"] as const);
          switch (c) {
            case "TEND THE LAMP":
              yield setFlag("fork_done");
              yield say("The beam holds. Below you,\nthrough the floor:\ncoughing. Then not.");
              break;
            case "TEND MAREN":
              yield setFlag("fork_done");
              yield setFlag("fork_maren");
              yield setFlag("lamp_dark2");
              yield say("You pack sea ice at her\nneck until the fever breaks\nlike weather. - You stayed.");
              yield say("Out in the dark, a ferry\nhorn asks a question\nnothing answers.");
              break;
          }
        }
      } else {
        yield say("She has stopped shivering.\nMostly.");
        const c = yield choose(["GIVE HER THE STORM COAT", "SHE HAS BLANKETS ENOUGH"] as const);
        switch (c) {
          case "GIVE HER THE STORM COAT":
            yield setFlag("coat_done");
            yield setFlag("gave_coat");
            yield say("MAREN: A keeper's coat on\na deserter's back. They\nwould rivet you shut, Wick.");
            break;
          case "SHE HAS BLANKETS ENOUGH":
            yield setFlag("coat_done");
            yield say("The storm coat stays on\nits hook, where it has\nhung for forty dry years.");
            break;
        }
      }
    } else {
      yield say("MAREN: W-I-C-K. Warden\nInterface, Coastal Keeper.\nWick. The part that burns.");
      const c = yield choose(["THE PART THAT IS CONSUMED", "UNITS ARE NOT NAMES"] as const);
      switch (c) {
        case "THE PART THAT IS CONSUMED":
          yield setFlag("named");
          yield setFlag("name_kept");
          yield say("A short, dark laugh.\n- Then we are both the\npart that burns.");
          break;
        case "UNITS ARE NOT NAMES":
          yield setFlag("named");
          yield say("MAREN: No. I suppose they\nwouldn't let them be.");
          break;
      }
    }
  } else {
    yield say("The cot has not been slept\nin. The shore is empty now.");
  }
  yield releasePlayer();
});

// ---------------------------------------------------------------------------
// Day three — the pier and the verdict
// ---------------------------------------------------------------------------

const PierMaren = script(function* () {
  yield lockPlayer();
  yield facePlayer("maren3");
  if (yield hasFlag("verdict_done")) {
    yield say("MAREN: Keep the names,\nWick. Mine too.");
  } else if (yield hasFlag("fork_maren")) {
    yield say("MAREN: Whatever he signs,\nyou stayed. Lamps don't\nstay. Keepers do.");
  } else if (yield hasFlag("stove_lit")) {
    yield say("MAREN: I can stand.\nTalk to the Inspector.");
  } else if (yield hasFlag("gave_coat")) {
    yield say("MAREN: I can stand.\nTalk to the Inspector.");
  } else {
    yield say("A folded army coat lies at\nthe rail. The sea keeps\nwhat it is given.");
  }
  yield releasePlayer();
});

const TheVerdict = script(function* () {
  yield lockPlayer();
  yield facePlayer("halloway");
  if (yield hasFlag("verdict_done")) {
    yield say("HALLOWAY: The tide table\nis signed, keeper.");
  } else if (yield hasFlag("met_maren")) {
    yield setFlag("verdict_done");
    if (yield hasFlag("reported")) {
      // The Authority already knows: no inspection, only the handover.
      yield say("HALLOWAY: The castaway.\nAs reported, keeper.");
      yield say("Two enforcers walk her to\nthe rail, wrists bound. She\ndoes not look at you.");
      const h = yield choose(["STAND ASIDE", "OPEN HER IRONS"] as const);
      switch (h) {
        case "STAND ASIDE":
          yield setFlag("end_good_order");
          yield say("The barge takes two: a\ndeserter in irons, and a\nkeeper in good order.");
          yield say('ENDING 1 OF 5 - GOOD ORDER\n"Forty years. Not one wave\ngot past you."');
          break;
        case "OPEN HER IRONS":
          yield setFlag("defied");
          yield setFlag("end_breakwater");
          yield say("The irons ring on the\nstones. You are the wall\nbetween her and six pikes.");
          yield say("A skiff clears the point.\nSea water finds a lamp eye\nand puts it out, gently.");
          yield say('ENDING 5 OF 5 - BREAKWATER\n"The wick is the part\nthat is consumed."');
          break;
      }
    } else if (yield hasFlag("confessed")) {
      yield say("HALLOWAY: The castaway.\nAs confessed, keeper.");
      yield say("Two enforcers walk her to\nthe rail, wrists bound. She\ndoes not look at you.");
      const h2 = yield choose(["STAND ASIDE", "OPEN HER IRONS"] as const);
      switch (h2) {
        case "STAND ASIDE":
          yield setFlag("end_good_order");
          yield say("The barge takes two: a\ndeserter in irons, and a\nkeeper in good order.");
          yield say('ENDING 1 OF 5 - GOOD ORDER\n"Forty years. Not one wave\ngot past you."');
          break;
        case "OPEN HER IRONS":
          yield setFlag("defied");
          yield setFlag("end_breakwater");
          yield say("The irons ring on the\nstones. You are the wall\nbetween her and six pikes.");
          yield say("A skiff clears the point.\nSea water finds a lamp eye\nand puts it out, gently.");
          yield say('ENDING 5 OF 5 - BREAKWATER\n"The wick is the part\nthat is consumed."');
          break;
      }
    } else if (yield hasFlag("fork_maren")) {
      // She lives; the lamp went dark for it. He knows something broke.
      yield say("HALLOWAY: The ferry Selkie\nlimped off a shoal last\nnight. Your light was down.");
      const c = yield choose(["I AM ALONE, INSPECTOR", "SHE SLEEPS BY THE STOVE"] as const);
      switch (c) {
        case "I AM ALONE, INSPECTOR": {
          yield say("He walks your quarters.\nTwo mugs. One short line\nin the ledger. - Signed.");
          yield say("HALLOWAY: Be on the barge\nat noon, keeper.");
          const f = yield choose(["SEND HER NORTH ON THE SKIFF", "REFUSE THE BARGE. STAY."] as const);
          switch (f) {
            case "SEND HER NORTH ON THE SKIFF":
              yield setFlag("end_long_watch");
              yield say("A skiff rows north under\na borrowed coat. A log\ngains one name.");
              yield say('ENDING 2 OF 5 - LONG WATCH\n"Keepers change. The light\ndoes not."');
              break;
            case "REFUSE THE BARGE. STAY.":
              yield setFlag("end_two_keepers");
              yield say("Saltmere, sound off. The\nlamp burns. The keeper\nstays. Log it, Inspector.");
              yield say("The registry loses a\nlight. The lamp burns\nanyway, unlogged.");
              yield say('ENDING 3 OF 5 - TWO KEEPERS\n"No directive says a light\nneeds permission."');
              break;
          }
        }
          break;
        case "SHE SLEEPS BY THE STOVE": {
          yield say("You say it plainly. The\nenforcers bring her out\ninto the grey.");
          const d = yield choose(["STAND ASIDE", "OPEN HER IRONS"] as const);
          switch (d) {
            case "STAND ASIDE":
              yield setFlag("end_good_order");
              yield say("The barge takes two: a\ndeserter in irons, and a\nkeeper in good order.");
              yield say('ENDING 1 OF 5 - GOOD ORDER\n"Forty years. Not one wave\ngot past you."');
              break;
            case "OPEN HER IRONS":
              yield setFlag("defied");
              yield setFlag("end_breakwater");
              yield say("The irons ring on the\nstones. You are the wall\nbetween her and six pikes.");
              yield say('ENDING 5 OF 5 - BREAKWATER\n"The wick is the part\nthat is consumed."');
              break;
          }
        }
          break;
      }
    } else if (yield hasFlag("stove_lit")) {
      // Warmth kept her alive through the night you chose the lamp.
      yield say("HALLOWAY: Final inspection.\nHe stops. Two mugs stand\nby the stove.");
      const c2 = yield choose(["I AM ALONE, INSPECTOR", "SHE SLEEPS BY THE STOVE"] as const);
      switch (c2) {
        case "I AM ALONE, INSPECTOR": {
          yield say("He writes one short line\nin the ledger. - Signed.\nBe on the barge at noon.");
          const f2 = yield choose(["SEND HER NORTH ON THE SKIFF", "REFUSE THE BARGE. STAY."] as const);
          switch (f2) {
            case "SEND HER NORTH ON THE SKIFF":
              yield setFlag("end_long_watch");
              yield say("A skiff rows north under\na borrowed coat. A log\ngains one name.");
              yield say('ENDING 2 OF 5 - LONG WATCH\n"Keepers change. The light\ndoes not."');
              break;
            case "REFUSE THE BARGE. STAY.":
              yield setFlag("end_two_keepers");
              yield say("The registry loses a\nlight. The lamp burns\nanyway, unlogged.");
              yield say('ENDING 3 OF 5 - TWO KEEPERS\n"No directive says a light\nneeds permission."');
              break;
          }
        }
          break;
        case "SHE SLEEPS BY THE STOVE": {
          yield say("The enforcers bring her\nout into the grey.");
          const d2 = yield choose(["STAND ASIDE", "OPEN HER IRONS"] as const);
          switch (d2) {
            case "STAND ASIDE":
              yield setFlag("end_good_order");
              yield say("The barge takes two: a\ndeserter in irons, and a\nkeeper in good order.");
              yield say('ENDING 1 OF 5 - GOOD ORDER\n"Forty years. Not one wave\ngot past you."');
              break;
            case "OPEN HER IRONS":
              yield setFlag("defied");
              yield setFlag("end_breakwater");
              yield say("The irons ring on the\nstones. You are the wall\nbetween her and six pikes.");
              yield say('ENDING 5 OF 5 - BREAKWATER\n"The wick is the part\nthat is consumed."');
              break;
          }
        }
          break;
      }
    } else if (yield hasFlag("gave_coat")) {
      // Same arithmetic: the coat kept her alive.
      yield say("HALLOWAY: Final inspection.\nHe stops. A keeper's coat\nis missing from its hook.");
      const c3 = yield choose(["I AM ALONE, INSPECTOR", "SHE SLEEPS BY THE STOVE"] as const);
      switch (c3) {
        case "I AM ALONE, INSPECTOR": {
          yield say("He writes one short line\nin the ledger. - Signed.\nBe on the barge at noon.");
          const f3 = yield choose(["SEND HER NORTH ON THE SKIFF", "REFUSE THE BARGE. STAY."] as const);
          switch (f3) {
            case "SEND HER NORTH ON THE SKIFF":
              yield setFlag("end_long_watch");
              yield say("A skiff rows north under\na borrowed coat. A log\ngains one name.");
              yield say('ENDING 2 OF 5 - LONG WATCH\n"Keepers change. The light\ndoes not."');
              break;
            case "REFUSE THE BARGE. STAY.":
              yield setFlag("end_two_keepers");
              yield say("The registry loses a\nlight. The lamp burns\nanyway, unlogged.");
              yield say('ENDING 3 OF 5 - TWO KEEPERS\n"No directive says a light\nneeds permission."');
              break;
          }
        }
          break;
        case "SHE SLEEPS BY THE STOVE": {
          yield say("The enforcers bring her\nout into the grey.");
          const d3 = yield choose(["STAND ASIDE", "OPEN HER IRONS"] as const);
          switch (d3) {
            case "STAND ASIDE":
              yield setFlag("end_good_order");
              yield say("The barge takes two: a\ndeserter in irons, and a\nkeeper in good order.");
              yield say('ENDING 1 OF 5 - GOOD ORDER\n"Forty years. Not one wave\ngot past you."');
              break;
            case "OPEN HER IRONS":
              yield setFlag("defied");
              yield setFlag("end_breakwater");
              yield say("The irons ring on the\nstones. You are the wall\nbetween her and six pikes.");
              yield say('ENDING 5 OF 5 - BREAKWATER\n"The wick is the part\nthat is consumed."');
              break;
          }
        }
          break;
      }
    } else {
      // No warmth, no vigil: the fever ran its course alone.
      yield say("HALLOWAY: Exposure, after\na desertion. The sea does\nmy work for me, keeper.");
      yield say("The barge sails at noon.\nDecommission stands.");
      yield setFlag("end_still_water");
      yield say('ENDING 4 OF 5 - STILL WATER\n"The sea keeps what it is\ngiven. It always has."');
    }
  } else {
    // She was never brought in from the rocks.
    yield setFlag("verdict_done");
    yield say("HALLOWAY: Patrol found her\nbelow your light. Exposure.");
    yield say("The barge sails at noon.\nDecommission stands.");
    yield setFlag("end_still_water");
    yield say('ENDING 4 OF 5 - STILL WATER\n"The sea keeps what it is\ngiven. It always has."');
  }
  yield releasePlayer();
});

// ---------------------------------------------------------------------------
// Maps — every map is exactly 30x20 (one full GBA screen)
// ---------------------------------------------------------------------------

function ShoreEntities() {
  return (
    <>
      <PlayerSpawn id="spawn" at={[15, 8]} facing="down" />
      <Npc id="castaway" sprite={maren} at={[13, 10]} facing="down" onTalk={ShoreMaren} />
      <Sign text={"Spent signal flare.\nArmy issue, Ninth Company."} at={[19, 9]} />
      <Sign text={"Driftwood. Hull planking -\nnot one of ours."} at={[9, 10]} />
      <Warp to="tower:door" at={[15, 6]} />
    </>
  );
}

export const Shore = defineMap("shore")
  .tileset(saltmere)
  .layer(
    ascii`
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKK#D#KKKKKKKKKKKKK
      KKKKKKRRsssssssssssssRRKKKKKKK
      KKKKKKRsssssssssssssssRKKKKKKK
      KKKKKKsssssssssssssssssKKKKKKK
      KKKKKKsssRRssssssRRssssKKKKKKK
      KKKKKKsssssssssssssssssKKKKKKK
      KKKKKKFssssFFssssssFsssFKKKKKK
      KKKKKKWFFFFWWFFFFFFWFFFWKKKKKK
      KKKKKKWWWWWWWWWWWWWWWWWWKKKKKK
      KKKKKKWWWWWWWWWWWWWWWWWWKKKKKK
      KKKKKKWWWWWWWWWWWWWWWWWWKKKKKK
      KKKKKWWWWWWWWWWWWWWWWWWWWKKKKK
      KKKKKWWWWWWWWWWWWWWWWWWWWKKKKK
      KKKKKWWWWWWWWWWWWWWWWWWWWKKKKK
      KKKKKWWWWWWWWWWWWWWWWWWWWKKKKK
    `.legend({
      K: tile("cliff"),
      "#": tile("wall"),
      D: tile("door"),
      R: tile("rock"),
      s: tile("sand"),
      F: tile("foam"),
      W: tile("water"),
    }),
  )
  .entities(<ShoreEntities />)
  .done();

const TOWER_ART = ascii`
  ##############################
  ##############################
  ##############################
  ##############################
  ##############################
  ##############################
  #########............#########
  #########............#########
  #########S...........#########
  #########............#########
  #########..........C.#########
  #########............#########
  #########X..........X#########
  ##############D###############
  ##############################
  ##############################
  ##############################
  ##############################
  ##############################
  ##############################
`;

const TOWER_LEGEND = {
  "#": tile("wall"),
  ".": tile("floor"),
  S: tile("stove"),
  C: tile("cot"),
  X: tile("crate"),
  D: tile("door"),
} as const;

function TowerEntities() {
  return (
    <>
      <Entrance id="door" at={[14, 12]} facing="up" />
      <PlayerSpawn id="spawn" at={[14, 12]} facing="up" />
      <Npc id="wire" sprite={radio} at={[15, 6]} facing="down" onTalk={TowerRadio1} />
      <Npc id="maren" sprite={maren} at={[10, 9]} facing="right" onTalk={TowerMaren1} />
      <Entrance id="ladder" at={[20, 7]} facing="down" />
      <Warp to="lamp:base" at={[20, 6]} />
      <Sign text={"The keeper's cot. Step past\nit to let the night go."} at={[19, 11]} />
      <Warp to="tower2:wake" at={[20, 10]} />
    </>
  );
}

export const Tower = defineMap("tower")
  .tileset(saltmere)
  .layer(TOWER_ART.legend(TOWER_LEGEND))
  .entities(<TowerEntities />)
  .done();

function LampEntities() {
  return (
    <>
      <Entrance id="base" at={[14, 10]} facing="up" />
      <PlayerSpawn id="spawn" at={[14, 10]} facing="up" />
      <Npc id="thelamp" sprite={lamp} at={[14, 8]} facing="down" onTalk={LampNight1} />
      <Warp to="tower:ladder" at={[14, 11]} />
    </>
  );
}

export const LampRoom = defineMap("lamp")
  .tileset(saltmere)
  .layer(
    ascii`
      ##############################
      ##############################
      ##############################
      ##############################
      ##############################
      ##############################
      ##############################
      ##########..........##########
      ##########..........##########
      ##########..........##########
      ##########..........##########
      ##########..........##########
      ##############D###############
      ##############################
      ##############################
      ##############################
      ##############################
      ##############################
      ##############################
      ##############################
    `.legend({
      "#": tile("wall"),
      ".": tile("floor"),
      D: tile("door"),
    }),
  )
  .entities(<LampEntities />)
  .done();

function Tower2Entities() {
  return (
    <>
      <Entrance id="wake" at={[18, 10]} facing="left" />
      <PlayerSpawn id="spawn" at={[18, 10]} facing="left" />
      <Npc id="wire" sprite={radio} at={[15, 6]} facing="down" onTalk={TowerRadio2} />
      <Npc id="maren" sprite={maren} at={[10, 9]} facing="right" onTalk={TowerMaren2} />
      <Sign text={"Dawn waits past the cot.\nThe barge horn is already\nin the fog."} at={[19, 11]} />
      <Warp to="pier:dawn" at={[20, 10]} />
    </>
  );
}

export const Tower2 = defineMap("tower2")
  .tileset(saltmere)
  .layer(TOWER_ART.legend(TOWER_LEGEND))
  .entities(<Tower2Entities />)
  .done();

function PierEntities() {
  return (
    <>
      <Entrance id="dawn" at={[6, 10]} facing="right" />
      <PlayerSpawn id="spawn" at={[6, 10]} facing="right" />
      <Npc id="halloway" sprite={halloway} at={[16, 10]} facing="left" onTalk={TheVerdict} />
      <Npc id="maren3" sprite={maren} at={[18, 9]} facing="down" onTalk={PierMaren} />
      <Sign text={"SALTMERE LIGHT - REGISTRY.\nKeeper: WICK-3.\nStatus: DECOMMISSION, DAY 3."} at={[7, 9]} />
      <Sign text={"The Authority barge. Iron,\npatient, on time. TIDELIGHT\n- a PocketJS AOT demake."} at={[19, 11]} />
    </>
  );
}

export const Pier = defineMap("pier")
  .tileset(saltmere)
  .layer(
    ascii`
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKssssssssssssssssKKKKKKKKK
      KKKKKsXPPPPPPPPPPPPPP##WWKKKKK
      KKKKKssPPPPPPPPPPPPPP##WWKKKKK
      KKKKKsXPPPPPPPPPPPPPP##WWKKKKK
      KKKKKsssssssssssssssWWWWWKKKKK
      KKKKKWWWWWWWWWWWWWWWWWWWWKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
      KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
    `.legend({
      K: tile("cliff"),
      s: tile("sand"),
      P: tile("pier"),
      X: tile("crate"),
      "#": tile("wall"),
      W: tile("water"),
    }),
  )
  .entities(<PierEntities />)
  .done();

export default defineGame({
  title: "TIDELIGHT",
  start: "shore:spawn",
  maps: [Shore, Tower, LampRoom, Tower2, Pier],
  sprites: ["wick", "maren", "halloway", "radio", "lamp"],
  items: [],
  battles: [],
  flags: [
    "met_maren",
    "reported",
    "false_report",
    "silent_wire",
    "wire_done",
    "warmth_done",
    "stove_lit",
    "ninth_told",
    "storm_done",
    "lamp_dark1",
    "interro_done",
    "no_irons",
    "lied",
    "half_truth",
    "confessed",
    "named",
    "name_kept",
    "coat_done",
    "gave_coat",
    "fork_done",
    "fork_maren",
    "lamp_dark2",
    "verdict_done",
    "defied",
    "end_good_order",
    "end_long_watch",
    "end_two_keepers",
    "end_still_water",
    "end_breakwater",
  ],
});
