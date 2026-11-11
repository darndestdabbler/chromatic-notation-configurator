# The key-signature designer — cross-provider design consult

**Date:** 2026-11-11 (session 47).
**Subject:** the design in
[`key-signature-designer-design.md`](key-signature-designer-design.md),
before the operator approves it (session plan, session 47 item 3), in two
rounds: GPT and Gemini on the draft (below), then Sol and Argon on the
revised design and its mock-ups (Round 2, after the first round's record).

## How it was run

One identical brief went to two models, in one call each, at the same time,
from a script kept outside the tracked tree (the session's scratch
directory), with the API keys from the environment:

- **GPT:** `gpt-5.6-terra` (OpenAI Responses API, reasoning effort high).
- **Gemini:** `gemini-3.1-pro-preview` (Google Generative Language API,
  `generateContent`).

The brief (reproduced in full at the end) gave the project's context, the
key signature as built today, the operator's outline verbatim, Clairnote's
signatures as clairnote.org describes them, the whole draft design as it
stood after step `design-doc`, and seven questions. Both replies are
reproduced verbatim below.

## Synthesis

### Where they agree, and what is taken

| # | Point | Taken into the design |
|---|---|---|
| 1 | **Double sharps and flats.** Spelling keys from LilyPond's `keyAlterations` is right, and both enharmonic spellings of a black-key tonic are needed, but some spellings (D♯ major, G♯ major, A♯ major…) need double sharps or flats, which the design had no look or sign for. GPT also found the picker's 17 spellings and the export's 15 inconsistent. | Yes. The supported keys are the 105 whose signature has at most seven sharps or flats: for each mode, the 15 spellings LilyPond's circle of fifths gives. The picker offers exactly those for the mode chosen, so no double accidental can arise, and the export covers exactly the keys the picker offers (§3, §9). |
| 2 | **The exporter resolves marks; the engine only draws them** (the 2026 consult's advice, the backlog's mark-list hook). About 100 entries are no size problem. | Yes, as designed (§9). |
| 3 | **Q1:** the shared root of a repeated signature is two heads side by side, touching. GPT: independent of the upper-tonic setting. | Yes (§4.5). |
| 4 | **Q3:** drop "near the notes"; the music cannot be read ahead, and the middle of the staff stands for it. | Yes: "In the middle of the staff", as designed; Q3 is closed. |
| 5 | **The engine comes too late** in the program: its contract and spacing should be settled before the exporter is written, and preferably before much canvas work. | Yes. Session 48 now also plans the engine's hook session from the mark list it defines, and the scale notes reach LilyPond in session 49, before the panel and the accidentals (§11). |
| 6 | **Placement by counting marks is brittle** (Gemini) or **undefined for staves whose lines do not repeat by octave** (GPT). | Yes, with a simpler rule than either proposed: the places are defined on the staff's range, the 24 semitones centred on its middle that the export already engraves (LY spec §5.1a), not on line groups. The bottom place puts the signature's lowest note as low as it can go in that range, the top place its highest note as high as it can go, and every-group draws every note of the key over the whole range. No marks are counted (§4.5). |

### Where they differ, or one alone spoke

| Point | GPT | Gemini | Taken |
|---|---|---|---|
| **Q2, accidentals' height** | At the letter altered (F♯'s sign at F): otherwise it is not a traditional signature. | At the altered pitch (F♯): on a chromatic staff the letter's position is the wrong line or space. | Left to the operator, with both arguments (§10, Q2). |
| **Alternating every second column** | Keep, but as one partial look rather than three mechanisms. | Cut: Clairnote's noteheads already alternate, so the signature's take it from the notehead rules. | Kept, because the operator asked for it ("optionally alternating fill, colour or shape"), as GPT proposes: one partial look, the same kind of look as the naturals', flats' and sharps' (§4.4, §6). Gemini's point stands for Clairnote itself, whose gallery files need no alternation. |
| **The Clairnote-style button** | Misleading without the tailed-dot shapes; make Clairnote a gallery example instead. | — | Yes: the Start from row is cut. The kind is one choice (Draw), the defaults are the scale stack, and the Clairnote SN and DN gallery files carry Clairnote-style signatures (§7). |
| **A missing key in the table** | Must not fall back silently to the scale stack: warn and draw none. | — | Yes (§9). |
| **Key identity in the engine** | Verify that the engine can recover the tonic's spelling and the mode from `\key`. | Keying by tonic spelling and pitch classes is robust. | The engine session confirms it first (§9). |
| **`style` renamed** to `"scale-notes"`, `"notehead-chords"` an alias | Yes. | — | No: keeping the stored value means nothing is migrated, and no designer sees it. |
| **Cut `placement.rule`, the separator's styling and the tonic-octave control** | Yes, keep reading them. | — | Partly: they are existing, exported settings and stay in the config; the panel shows no control for `placement.rule` or the tonic octave, and the gold stem is one checkbox (§6, §7). |
| **The round trip for every choice is too many** | Pure tests for the combinations; a representative engine matrix. | — | Yes (§11). |

---

## GPT (gpt-5.6-terra), verbatim

1. **Requirements coverage**

   Mostly, but not cleanly.

   - **A:** supported, provided “traditional” means conventional accidental glyphs *and conventional letter positions*.
   - **B1:** supported if the natural/flat/sharp override is applied *after* ordinary notehead-rule resolution. That preserves pitch-specific notehead rules when a field is unset.
   - **B2–B4:** supported.
   - **B5:** not yet well defined. The design assumes staff lines repeat in octave groups; that is not guaranteed by “staff lines placed on semitones.” “Every visible group” also depends on the rendered staff extent, which the fixed mark list cannot know.
   - The “one design for all keys” goal is met in principle. It must not become “one generated table for a poorly defined subset of keys.”

2. **Too much design / cuts**

   Cut or simplify:

   - `placement.rule: "scale-from-tonic"`: it has one value; remove it.
   - Configurable separator colour, thickness, and extent from the main product. The requirement is an optional gold stem, not a stem designer. Use fixed gold geometry. Continue reading old fields for compatibility if necessary.
   - The **Clairnote-style** button is misleading unless it also supplies the required imported tailed-dot shapes. As specified, it is only a partial geometry preset. Keep “Scale stack” and “Traditional,” or make Clairnote a documented gallery/template rather than a panel control.
   - Do not expose `tonicOctave` as a normal control. Retain it as an advanced/imported override for compatibility.
   - Do not add a second vocabulary for style. Migrate internally to `"scale-notes"` and `"accidentals"`; accept `"notehead-chords"` on load as a legacy alias.
   - “Every second column” needs only one partial alternate look override, not three conceptually separate mechanisms. It may contain optional `hollow`, `color`, and `shape` fields.

   Keep the notes subset, upper tonic, stack choice, alternate appearance, direction, and four placement choices: those directly answer B1–B5.

3. **Spelling**

   Using the exact spelling represented by LilyPond’s `keyAlterations` is sound, and is preferable to independently guessing spellings. Both enharmonic black-key picker entries are necessary.

   However, the stated domains conflict. The picker has **17** tonic spellings after adding both black-key names; the export claims **15**. Moreover, D♯, G♯, and A♯ major-style spellings can require double accidentals, while the design permits only natural/flat/sharp looks and marks.

   Define and validate the supported domain: keys whose LilyPond alteration vector contains only natural, flat, and sharp alterations. Either exclude unsupported spellings/modes from the picker or add double-sharp/double-flat support. Do not silently substitute a different spelling.

4. **Export**

   Choose the **exporter-resolved mark-list hook**, not Scheme rule evaluation. That follows the prior consult, keeps notehead-rule semantics in one place, and makes preview/engraving testable.

   But the proposed table is flawed:

   - `15 × 7 = 105` is inconsistent with the picker and may not cover all supported `\key` inputs.
   - Sorted pitch classes are redundant and weak as identity. Key by the exact LilyPond tonic spelling plus an explicit mode/alteration-vector identity. Verify that the engine can actually recover that identity from `\key`; do not assume it can.
   - A missing table entry must not silently fall back to the old scale stack. That produces the wrong signature. It should produce no custom signature plus a diagnostic, or be impossible through validation.
   - Absolute marks cannot express “every visible group.” Export a resolved per-key **relative mark template** plus an explicit repeat directive. The engine may repeat and place that template; it must not reimplement notehead-rule or scale-generation logic.

   A hundred entries is not itself a size problem; tens of kilobytes is acceptable. Incomplete or ambiguous lookup is the problem.

5. **Placement and groups**

   Section 4.5 is not defined for arbitrary staffs. “A group’s octave is from its lowest line” fails when lines are irregular, absent in an octave, or do not repeat.

   Use the existing absolute pitch axis instead: octave bands are `[12n, 12n+12)`, anchored at C = 0. Bottom/top groups are the lowest/highest such bands containing staff lines. “Most marks” means the selected signature marks within that band; specify whether a double root counts as one pitch or two marks—use one pitch.

   “Every group” means every octave band intersecting the rendered staff’s vertical extent. This necessarily requires the engine renderer to know staff extent. If that is not available, defer repeated signatures; do not fake it with a finite fixed list.

6. **Open questions**

   - **Q1:** Interpret a repeated root as exactly two side-by-side heads at each shared octave boundary, not an octave pair and never three heads. Define this independently of `upperTonic`; repetition owns the boundary rendering.
   - **Q2:** Put traditional accidentals at the **letter they alter**: F♯ at F’s staff position, B♭ at B’s position. Otherwise this is not a traditional accidental signature, merely sharp/flat glyphs placed on chromatic pitches.
   - **Q3:** Do not inspect future music. The preview cannot, and a key signature should not move by register. Interpret “near the notes” as the existing automatic centre placement, but label it “near the staff centre,” not “near the notes.”

7. **Program**

   The engine hook is far too late. Before sessions 48–50 build substantial canvas-only behaviour, do a small engine spike: prove key identity lookup, relative mark templates, accidental glyph positioning, column spacing, and repeated-group feasibility. Resolve Q1, Q2, supported spelling domain, and group semantics before implementation.

   Then build one vertical slice: non-default scale signature → export → engine → round trip. Add accidentals next. The current “every choice” engine test plan is combinatorially excessive; use pure-function coverage for combinations and a representative engine matrix. Session 52 is appropriate; session 53 is release administration, not part of this feature design.

---

## Gemini (gemini-3.1-pro-preview), verbatim

Here is the review of the design.

**1. Meets operator's points?**
Yes, it covers A and B1–B5, but it misses **double sharps and double flats**. By relying on traditional spelling (which is correct), keys like G♯ major or A♭ minor will generate double sharps (F𝄪) or double flats (F𝄫). Section 4.1 only defines `natural`, `flat`, and `sharp`. You must add `doubleSharp` and `doubleFlat` to the `looks` config, or explicitly define a fallback.

**2. Simplest design? (Over-engineering check)**
The design is mostly sound, but the `alternate` object (hollow/color/shape per alternating column) is **over-engineered and must be cut**. 
The operator requested Clairnote support, which alternates solid/hollow based on a 3-4 or 2-3-2 column pattern. However, Clairnote's noteheads *already* alternate solid/hollow based on their whole-tone pitch class. Because your signature resolves marks using the existing notehead rules (§4.1), the solid/hollow alternation will happen automatically based on the pitches in those columns. Duplicating this logic as a structural toggle in the key signature config violates the single source of truth. 

**3. Spelling rules and the picker**
Deriving accidentals from LilyPond's `keyAlterations` is completely sound. The traditional circle of fifths is the only reliable way to know if a black key acts as a sharp or flat in a given mode. Adding both enharmonic tonics to the picker is necessary and correct. What breaks: as noted in #1, scales that generate double accidentals will crash the look-resolver unless handled.

**4. The export strategy**
The mark table of 105 entries is the correct architectural choice. **Keep Scheme dumb.** The 2026 consult was right: do not teach the LilyPond engine how to resolve notehead rules or calculate half-step columns. 105 entries is a trivial amount of JSON data (a few kilobytes). 
*Keying:* Keying by `(tonic-name/alt . sorted-pitch-classes)` is robust, preventing collisions between enharmonically equivalent scales that require different spellings.

**5. Placement and repetition (Section 4.5)**
The rules are overly complex. Counting which octave has "the most marks" to define the bottom group is brittle and hard to compute predictively. 
*Simpler rule:* A staff defines its drawable range. "Bottom group" simply means anchoring the signature's tonic to the lowest available semitone for that pitch class on the drawn staff. "Top group" anchors to the highest. "Every group" anchors to all of them. Do not count marks.

**6. Open questions (Q1–Q3)**
*   **Q1 (Double notehead root):** Draw it as two standard noteheads side-by-side, touching. This visually weights the root, matching Clairnote's explicit key signature design language.
*   **Q2 (Accidentals' height):** At the note they alter (F♯'s sign at the F♯ semitone). On a chromatic staff, putting an accidental at the diatonic letter (F) places it physically on the wrong line/space, divorcing it from the pitch it modifies.
*   **Q3 ("Near the notes"):** Drop it. You cannot fulfill this without lookahead, and the preview canvas has no music to look ahead at. Today's default (middle of the staff) or manual `tonicOctave` placement suffices. 

**7. Session program (48–53)**
The order is wrong. You cannot confidently write the JS exporter or the round-trip tests in Session 51 if the engine's mark-list hook (Engine Session 30) isn't designed and merged.
*   **Move Engine Session 30 to Session 48.** Define the exact LilyPond data contract and spacing geometry first. Mock it in JS.
*   Session 48: Canvas Scale Notes + Engine Mark-list hook definition.
*   Session 49: Panel UI.
*   Session 50: Accidentals.
*   Session 51: Engine integration, round-trip tests, and Engine 1.4.0 release. 
This prevents rewriting the JS exporter if LilyPond layout constraints force a change to the data structure.

---

## The brief, verbatim

Sent identically to both models. Its "design under review" is the draft design as it stood after step design-doc.

    You are a senior software architect reviewing a design before it is built. Answer as an independent reviewer: say plainly what is wrong, what is missing and what is more than it needs to be. Over-engineering is strictly forbidden on this project: prefer the simplest design that meets the stated requirements.

    ## Context

    The Chromatic Notation Configurator is a browser tool (vanilla JavaScript ES modules, no framework, no build step) for designing chromatic music notations: staff lines placed on semitones, notehead shapes/fill/colour/size given per pitch class through priority-ordered "notehead rules", and a live preview of the 13 pitches C..C' as cards. One JSON config drives both the preview and an export to a LilyPond (.ly) settings file, which a separate LilyPond/Scheme "engine" repository engraves. The preview and the engraving are held to each other by engine round-trip tests within 0.001 staff spaces. Pitches are absolute semitones (C = 0); the staff's middle is `staff.midpoint` (12 by default); the default staff has lines at semitones 4, 8, 16, 20 (a "4-8" staff, 4 semitones per staff space).

    Key signatures today:
    - `keys.keySignature = { enabled, style: "notehead-chords" (the only value), placement: { rule: "scale-from-tonic", tonicOctave: null|int }, separator: { enabled, color "#ffd42a", thicknessPct 160, extentSemis 12 } }`.
    - The "scale stack": the key's 7 notes ascending from the tonic plus the tonic an octave up, drawn as real noteheads (resolved through the notehead rules at crotchet duration), alternating between two columns (even-indexed notes left, odd right), each column's ledger lines beneath, and a gold vertical stem between the columns. Automatic placement centres the tonic's octave on staff.midpoint.
    - The displayed key is example data, not config: the canvas has a key-and-mode picker (12 tonics, one spelling each: C C# D Eb E F F# G Ab A Bb B; and LilyPond's 7 modes major, minor, dorian, phrygian, lydian, mixolydian, locrian).
    - `keys.definitions` (named pitch-class sets) exist only so notehead rules can apply in particular keys.
    - The engine (keysig.ly) draws the same scale stack from the score's `\key`, via the exported notehead procedure. Its settings: `cnb:keysig-style` ('chord | 'none), bar colour/thickness/extent, tonic octave. The engine has a pitch-axis hook and a ledger table keyed by semitone. A prior design consult (2026) on custom-symbol signatures recommended: keep it narrow and declarative; never infer mode from a pitch-class set alone; and have the exporter resolve rules to explicit per-key mark lists that the engine simply draws (a "mark-list hook"), rather than teaching Scheme a rule vocabulary.

    The operator's requirements (verbatim outline):
    - Fewer options, so a designer does not have to define every key in every mode. A signature should be as easy to design as the noteheads, and reach Clairnote's, traditional ones and the scale stack alike.
    - A. Accidentals: traditional accidentals, which may help pianists.
    - B. Scale notes, with:
      1. the shape, colour and size of the signature's noteheads, for naturals, flats and sharps across all pitches;
      2. the upper tonic (the octave) shown or hidden;
      3. only the tonic and the notes a half step apart;
      4. the vertical stacking: two stacks of odd and even notes, optionally with the gold stem between them; or two or three stacks, a new one to the right at each half step, optionally alternating fill, colour or shape (enough for Clairnote's signatures);
      5. how the signature repeats across the staff's line groups: not repeated, placed so most noteheads fall on the bottom group, on the top group, or near the notes on the staff; or repeated across every visible group, the root as a double notehead.

    Clairnote's signatures (clairnote.org/key-signatures): a stack of solid and hollow dots (solid/hollow as Clairnote's noteheads are, by whole-tone set), the lowest dot the tonic; sharps and flats shown by a tail rising or falling into the dot; the stack ascends to the right in flat keys and to the left in sharp keys so tails do not collide; major keys show a 3-4 solid/hollow pattern, minor 2-3-2.

    ## The design under review

    # The key-signature designer — design

    **Session:** 47 (2026-11-11). A design only: no code changes with it.
    **Source:** the operator's outline in [`docs/uat-status.md`](../uat-status.md),
    "Trying sessions 36–41" item 7 (session 42), and the session plan's
    session 47.
    **Status:** draft, for the cross-provider consult and then the operator's
    approval.

    ## 1. What a designer wants

    A designer should design a signature the way they design noteheads: by
    choosing how it looks once, not by defining every key in every mode
    (operator, session 42). One design should reach a traditional signature,
    the scale stack the engine draws today, and Clairnote's signatures
    (operator, 2026-11-08).

    So a signature is **one rule over every key.** The designer picks a kind and
    a handful of options. The canvas draws the result for whatever key and mode
    the staff's picker shows, and the engraving draws it for whatever `\key` the
    score sets. Key definitions (`keys.definitions`) stay what they are today:
    names for notehead rules that apply in particular keys. A signature never
    needs one.

    ## 2. What is built today

    - **`keys.keySignature`** (architecture plan §4.9): `enabled`, `style`
      (one value, `"notehead-chords"`), `placement` (`rule:
      "scale-from-tonic"`, `tonicOctave`, `null` for automatic) and `separator`
      (the gold stem: `enabled`, `color`, `thicknessPct`, `extentSemis`).
    - **The scale stack** (`cnb/src/cnb-key-signature.js`): the key's seven
      notes from the tonic, and the tonic an octave up, as real noteheads
      resolved through the notehead rules at crotchet duration. They alternate
      between two columns (even-numbered notes left, odd right), with each
      column's ledgers, and the gold stem runs between the columns beneath
      them. Automatic placement centres the octave on `staff.midpoint`.
    - **The key** is example data: the staff's key and mode picker (session 36)
      offers the twelve tonics (`C`, `C♯`, `D`, `E♭`, `E`, `F`, `F♯`, `G`, `A♭`,
      `A`, `B♭`, `B`) and LilyPond's seven modes (`CNBMusic.MODES`).
    - **The engine** (`cnb/keysig.ly` in the engine repository) draws the same
      stack from the score's `\key`, through the exported notehead procedure.
      Its settings are `cnb:keysig-style` (`'chord` or `'none`), the bar's
      colour, thickness and extent, and the tonic octave (LY spec §5.6).
    - **Not built:** any other style. Set 010 rejected simple built-in marks
      (dots, interval blocks, staggered ledgers) and deferred custom-symbol
      signatures (`docs/session-sets/010-custom-key-signatures/s2-design-consult.md`).
      The engine backlog §2.3 says such signatures need a **mark-list hook**:
      the engine drawing an explicit list of marks for each key.

    ## 3. Two kinds of signature

    | Kind | What it draws | For |
    |---|---|---|
    | **Scale notes** | the key's notes as noteheads | the scale stack, Clairnote, and most chromatic notations |
    | **Accidentals** | the traditional sharps or flats | readers who know traditional notation, such as pianists |

    **Spelling.** Both kinds need to know whether each note of the key is a
    natural, a flat or a sharp: scale notes to give each its look, accidentals
    to choose a sign. A key's spelling is the traditional one: its seven notes
    on the seven letters, starting from the tonic's spelling (LilyPond's
    `keyAlterations` for its `\key`). The tonic's spelling matters (F♯ major has
    six sharps, G♭ major six flats), so the staff's picker offers both
    spellings of each black-key tonic: C♯ and D♭, D♯ and E♭, F♯ and G♭, G♯ and
    A♭, A♯ and B♭. The picker keeps its seven modes.

    ## 4. Scale notes

    Each point of the operator's outline, B1 to B5, is one setting.

    ### 4.1 The look of naturals, flats and sharps (B1)

    By default each mark looks like its notehead: the shape, fill, colour and
    size the notehead rules give that pitch at crotchet duration, as today.
    The designer may give **naturals**, **flats** and **sharps** each their own
    shape, fill, colour or size, for every pitch of that kind. Each field left
    unset keeps the notehead's own.

    Clairnote is an example. Its signature is small dots, filled or hollow as
    its noteheads are, with a tail rising to a sharp and falling to a flat. A
    designer imports a dot, a dot with a rising tail and a dot with a falling
    tail as shapes, gives naturals the dot, sharps and flats the tailed dots,
    and sets their size. The fill then follows the noteheads.

    ### 4.2 The upper tonic (B2)

    **Show the tonic an octave up** is on by default, as today. Off, the
    signature has the key's seven notes only.

    ### 4.3 Only the tonic and the half steps (B3)

    **Notes: all of the scale** (the default), or **the tonic and the half
    steps**: the tonic, and both notes of each half step in the scale. In C
    major that is C, E and F, B and C′ (the upper tonic only when shown). In A
    minor it is A, B and C, E and F.

    ### 4.4 Stacking (B4)

    Two choices:

    - **Two stacks** (the default): odd and even notes alternate between a
      left and a right column, as today. **The gold stem** between them is the
      existing separator setting.
    - **A new stack at each half step**: the notes rise in one column, and a
      half step between two neighbouring notes of the scale starts a new column
      to the right. C major is C D E | F G A B | C′, three columns (two without
      the upper tonic), which is Clairnote's 3–4 pattern for major. A minor is
      A B | C D E | F G | A′. With only the tonic and the half steps, the
      columns are the same and only some notes are drawn. There is no gold stem.

    Either way two more options apply:

    - **Every second column** may change, so the columns tell apart: its marks
      hollow (when the look is solid) or solid (when hollow), a second colour,
      or a second shape. Each of the three is set or not.
    - **Columns go to the right** (the default), or **to the left in sharp
      keys**, as Clairnote's do: its stacks rise to the right in flat keys and
      to the left in sharp keys, so a tail never meets the next dot. A key with
      no sharps or flats goes right.

    ### 4.5 Where the signature sits, and repeats (B5)

    The staff's lines repeat every octave, so a staff is a set of **line
    groups**: the lines of one octave of the pattern (on the default 4-8 staff,
    the bottom group is E and G♯ at semitones 4 and 8, the top group 16 and
    20). A group's octave is the 12 semitones from its lowest line up. Four
    choices:

    | Choice | The signature's tonic is the one that puts… |
    |---|---|
    | **In the middle of the staff** (the default) | the octave centred on the staff's middle, as today's automatic rule |
    | **On the bottom group** | the most marks in the bottom group's octave, ties going down |
    | **On the top group** | the most marks in the top group's octave, ties going up |
    | **On every group** | one copy on each group of the engraved staff, each placed as for the bottom group |

    An explicit tonic octave (`placement.tonicOctave`) still overrides the
    first three.

    **The root as a double notehead.** When the signature repeats, one copy's
    upper tonic is the next copy's tonic, at the same semitone. It is drawn
    once, as a **double notehead**: two of its marks side by side, touching, so
    the root stands out in every group. *(This is the design's reading of the
    outline; see question Q1.)*

    ## 5. Accidentals

    The traditional signature: a sharp for each sharp of the key, in the order
    F C G D A E B, or a flat for each flat, in the order B E A D G C F, each in
    its own column, left to right, and nothing for a key with neither. The
    signs are LilyPond's own (Emmentaler `accidentals.sharp` and
    `accidentals.flat`, SIL OFL 1.1, as the treble, bass and alto clefs are),
    black, at LilyPond's size in staff spaces.

    **Height.** Each sign sits at the semitone of the note it alters: F♯'s sign
    at F♯, where an F♯ is drawn on this staff. Its octave is the one the
    signature's place (§4.5) gives that note in the scale; **on every group**
    draws a sign in each copy. *(The alternative is at the letter it alters:
    F♯'s sign at F, as a traditional staff reads it. See question Q2.)*

    The scale-note settings (§4.1–§4.4) do not apply. The place (§4.5) does.

    ## 6. The config

    `keys.keySignature` gains the settings below. Each default is today's
    behaviour, so a config saved today loads, previews and exports exactly as
    before. `style` keeps its stored value `"notehead-chords"` for scale notes,
    so nothing is moved on load.

    ```javascript
    keySignature: {
      enabled: false,
      style: "notehead-chords",        // scale notes | "accidentals"
      notes: "all",                    // | "tonic-and-half-steps"
      upperTonic: true,
      looks: {                         // each field unset = the notehead's own
        natural: {},                   // { shape, hollow, color, heightSemis, widthSemis }
        flat: {},
        sharp: {}
      },
      stacking: "two",                 // | "half-steps"
      alternate: { hollow: false, color: null, shape: null },   // every second column
      columns: "right",                // | "left-in-sharp-keys"
      placement: {
        rule: "scale-from-tonic",
        tonicOctave: null,
        position: "middle"             // | "bottom-group" | "top-group" | "every-group"
      },
      separator: { enabled: true, color: "#ffd42a", thicknessPct: 160, extentSemis: 12 }
                                       // the gold stem: two stacks only
    }
    ```

    **Validation** checks each vocabulary, that a named shape exists, that a
    colour is `#RRGGBB`, and sizes as it checks a notehead rule's (§4.5 of the
    architecture plan). The settings that do not apply to the chosen kind or
    stacking are kept and ignored, so switching back restores them.

    ## 7. The panel

    The Key signature section, in a designer's words. The key definitions
    stay below it, under "Keys for notehead rules".

    ```
    Key signature   [x] Show the key signature
      Start from    [ Scale stack ] [ Clairnote-style ] [ Traditional ]

      Draw          (o) The key's notes   ( ) Sharps or flats

      Notes         (o) The whole scale   ( ) The tonic and the half steps
                    [x] The tonic an octave up
      Stacks        (o) Two, alternating      [x] Gold stem between them
                    ( ) A new stack at each half step
                    Every second stack:  [ ] hollow  [ ] colour [■]  [ ] shape [▾]
                    Stacks go  (o) to the right  ( ) to the left in sharp keys
      Looks         Naturals  [as the noteheads ▾]
                    Flats     [as the noteheads ▾]
                    Sharps    [as the noteheads ▾]

      Place         (o) In the middle of the staff  ( ) On the bottom group
                    ( ) On the top group            ( ) On every group
    ```

    - **Start from** sets the kind and the options at once: **Scale stack** is
      today's default; **Clairnote-style** is the half-step stacks going left in
      sharp keys, no upper tonic, smaller marks; **Traditional** is sharps or
      flats. Looks and shapes are left as they are.
    - A look's menu opens the notehead panel's own controls (shape, fill,
      colour, height and width) for that kind, with "as the noteheads" to clear
      a field.
    - Settings that do not apply are hidden: the scale-note rows for
      accidentals, and the gold stem for half-step stacks.
    - The canvas draws the signature for the picked key as each setting
      changes, as it does today.

    ## 8. The preview

    One pure function computes what is drawn:

    ```
    CNBKeySignature.marks(config, key) → [{ semi, column, mark, double }]
    ```

    `key` is the picker's tonic (with its spelling) and mode. `mark` is a
    resolved notehead look (shape, hollow, colour, size) or an accidental
    (`"sharp"` or `"flat"`). `render` draws the marks column by column, each
    column's ledgers beneath, and the gold stem between the two columns of a
    two-stack signature. The gutter widens to the columns. The exporter writes
    the same list (§9), so the preview and the engraving cannot disagree about
    which marks a key has.

    ## 9. LilyPond, and the engine's work

    **The export stays the same for a default signature.** A scale stack with
    every new setting at its default exports as today (`'chord`, or `'none`
    when off), byte for byte. Any other signature exports a **mark table**:

    ```lilypond
    #(set! cnb:keysig-style 'marks)
    #(define cnb:keysig-marks
       '((((0 . 0) . (0 2 4 5 7 9 11))       ; C major: tonic C natural, its pitch classes
          . ((12 0 head crotchet-minim #f black-000000)
             (14 0 head crotchet-minim #t black-000000)
             …))
         …))
    ```

    - **One entry per key** LilyPond can name with up to seven sharps or
      flats: 15 spellings of the tonic × 7 modes, 105 entries. The key is the
      tonic's note name and alteration (as `\key` gives them) and the key's
      sorted pitch classes, so C major and A minor are told apart by their
      tonic, and F♯ major and G♭ major by their spelling.
    - **Each mark** is its engine semitone (the §5.7 numbering), its column,
      and either `head` with the shape, fill and colour names Section A
      registers (a sized variant where it has a size, §4.1c) or `sharp` or
      `flat`; a double notehead carries `double`. A two-stack entry also says
      `bar`.
    - A key not in the table keeps the engine's scale stack.

    **Engine work** (the engine repository's sessions, planned by Configurator
    session 51 into its plan, as session 46 planned engine session 28):

    1. **The mark-list hook** (engine backlog §2.3): `cnb:keysig-style 'marks`
       and `cnb:keysig-marks`, drawn by the key-signature engraver from the
       score's `\key`: heads through the registered stencils, accidentals from
       Emmentaler, each column's ledgers, a double notehead as two heads side by
       side, and the gold bar between columns 0 and 1 when the entry says so.
       Columns are spaced as the stack's two are today, so a two-column table
       engraves like `'chord`.
    2. **Its spacing**: the signature's width and the space after it, measured
       and given in the handoff, so the preview spaces columns as the engine
       does (today's 0.75, 3.5 and 4.8636 staff spaces are measured for two
       columns).
    3. Goldens and integration specs on LilyPond 2.24 and 2.26, the handoff
       (`configurator-handoff.md`), and a minor release, **engine 1.4.0**, since
       it adds a setting and changes no existing output.

    The LY spec gains §5.6a (1.3.15) for the table.

    ## 10. Questions for the operator

    - **Q1. The root as a double notehead.** Does "repeated across every
      visible group, the root as a double notehead" mean the shared root drawn
      once as two heads side by side (this design), or each copy's root drawn
      as an octave pair, or something else?
    - **Q2. Accidentals' height.** At the note they alter (F♯'s sign at F♯,
      this design) or at the letter (at F, as a traditional staff reads)?
    - **Q3. "Near the notes on the staff".** This design reads it as the
      middle of the staff, today's rule. Did it mean following the register of
      the music after the signature? That would need the engine to look ahead
      at the notes, and the preview has no music, so this design leaves it out.

    ## 11. The program

    Each UI session ends with the browser UAT and screenshots at 1440 and
    1280 px, as sessions 25 onward do.

    ### Session 48: Scale notes on the canvas

    1. Register.
    2. The config fields of §6 with their defaults, validation, and the
       architecture plan's §4.9.
    3. `CNBKeySignature.marks` and `render` for every scale-note choice (§4),
       with tests in `cnb/tests/cnb-key-signature-tests.js`: each of the
       operator's points, C major and A minor and a sharp and a flat key, and
       every fixture and gallery file drawing exactly as before.
       *Engine work:* none.

    ### Session 49: The Key signature panel

    1. Register.
    2. The panel of §7 and its Start from buttons; the picker's two spellings
       of each black-key tonic.
    3. The Clairnote SN and DN gallery files take Clairnote-style signatures.
    4. A UAT driver: each choice on the canvas; screenshots at 1440 and
       1280 px. *Engine work:* none.

    ### Session 50: Accidentals on the canvas

    1. Register.
    2. `CNBKeySignature.marks` for accidentals (§5), with Emmentaler's sharp
       and flat (SIL OFL 1.1; its licence is already in `cnb/assets/fonts/`).
    3. The panel's "Sharps or flats" and the Traditional button; tests and the
       UAT. *Engine work:* none.

    ### Session 51: The signature reaches LilyPond

    1. Register.
    2. Insert the engine's sessions 30 (the mark-list hook, §9) and 31
       (release 1.4.0) into its plan, with the geometry and the handoff.
    3. Once engine session 30 has landed, the exporter writes the mark table
       for any signature not at its defaults; LY spec 1.3.15 §5.6a, the
       architecture plan, the README.
    4. An engine round trip, for the default, Kite and Clairnote DN fixtures
       and every choice of §4 and §5, holds each engraved mark's height,
       column and look, and the signature's width, to the preview's within
       0.001 staff spaces. The five export baselines stay byte-identical.

    ### Session 52: The UI is stable

    The operator tries sessions 43–51 and declares the UI stable, or plans what
    is left before the release.

    ### Session 53: Release 1.1.0 (release: 1.1.0)

    As the session plan has it: the withdrawn 1.0.2 entry renamed, the
    notehead-first editor, the clef and key-signature export and sessions 36
    onward added, and the site's first deploy confirmed.


    ## Questions

    1. Does the design meet each of the operator's points (A, B1-B5) and the "fewer options / no defining every key" goal? Name any point it misses or misreads.
    2. Is it the simplest design that does? Name each setting, field, control or mechanism you would cut or merge, and why.
    3. Spelling: is deriving natural/flat/sharp from the key's traditional spelling (LilyPond's keyAlterations), with both enharmonic spellings of black-key tonics in the picker, sound? What breaks?
    4. The export: a mark table of 105 entries (15 tonic spellings x 7 modes) keyed by tonic note name/alteration plus sorted pitch classes, each mark {engine semitone, column, head look | sharp | flat, double}, versus the engine computing the marks from the settings. Which, and why? Any keying or size problem?
    5. Placement and repetition across line groups (section 4.5): are the rules well defined for any staff pattern (including staves whose pattern has one line group per octave, or lines that do not repeat evenly)? Simpler rules?
    6. Your answer to the three open questions Q1-Q3 (the double-notehead root, the accidentals' height, "near the notes").
    7. The session program (48-53): right order and size? Anything that should move earlier (for example the engine hook) or be cut?

    Be concrete and brief: numbered answers, under about 900 words in total.


---

# Round 2: Sol and Argon, with the mock-ups

**Date:** 2026-11-11, after the operator's review of the mock-ups
([`key-signature-mockups/`](key-signature-mockups/index.html)). The
operator asked for "some input from Sol and Argon" on the stacking rules,
custom symbols and repetition.

## How it was run

As round 1: one identical brief, one call each, at the same time, from a
script outside the tracked tree, with the API keys from the environment.

- **Sol:** `gpt-6.1-sol` (OpenAI Responses API, reasoning effort high).
- **Argon:** `gemini-4-argon` (Google Generative Language API,
  `generateContent`).

The brief (reproduced in full at the end) gave the same context as round 1,
the operator's message after the mock-ups verbatim, their earlier choices,
the revised design as it then stood, six questions, and **ten images**: the
mock-up page's ten sections, screenshotted at 1440 px, device scale 2 (the
committed `shots/key-signatures-1440.png` shows the same page whole).

## Synthesis

### Where they agree, and what is taken

| # | Point | Taken into the design |
|---|---|---|
| 1 | **Keep the four stacking rules**; they cover the operator's and Clairnote's. Odd-left and the zigzag mirror each other for even tonics, so test odd and even tonics. | Yes (§4.4). |
| 2 | **Warn, do not shrink or move marks**, when marks in a stack run together. | Yes; the warning comes from the marks' actual heights and semitones, seams included (Sol) (§4.4, §7). |
| 3 | **Offer repetition, as its own choice**: do not switch the notes setting when it is chosen; the tonic and the half steps visibly declutter it. | Yes; the help suggests it (§4.5). |
| 4 | **The shared-root rule is sound**; marks at one semitone in one stack are drawn once. | Yes (§4.5, §8). |
| 5 | **Centred on a line set, with no setting** (Q4): rising runs into the top set, falling below the staff. | Yes; `placement.octave` is cut (§4.5). |
| 6 | **The export must carry the geometry**: more than two columns, small dots and wide signs cannot share the engine's fixed two-column step. | Yes: each entry gives column offsets and bars (§8, §9). |

### Where one spoke, or they differ

| Point | Sol | Argon | Taken |
|---|---|---|---|
| **The gold stem with three or four stacks** | Optional stems between adjacent columns are reasonable; keep them off for Clairnote. | Two or three bars overwhelm small dots: limit it to two-stack rules or columns 0 and 1. | Kept between every pair, as the operator asked ("in between the stacks"); the Clairnote files turn it off (§4.4). |
| **A naturals look** | Keep the controls the operator asked for. | Replace it with one look for all marks, flats and sharps over it: one place to shrink every mark. | Argon's: `looks.all`, `flat`, `sharp` (§4.1, §6). |
| **"Both sets"** | Say "every line set": a staff may have more than two; one set draws one copy. | — | Yes (§4.5). |
| **A stored tonic octave** | Must not make the place controls seem broken. | — | It overrides the middle only (§4.5). |
| **Precedence of looks** | Notehead, then spelling look, then alternate. | — | Yes (§4.1). |
| **A symbol's anchor** | A tailed dot must sit at the pitch by its dot. | Make the gallery's tails thicker and steeper. | Both, in session 50 (§4.1, §11). |
| **Proving the key's identity** | From real `\key` events before the canvas is built. | — | Session 48 starts with a LilyPond probe (§11). |
| **Engine tests** | Key changes, enharmonic spellings, transposition, system starts, no cancelling naturals. | Each copy's accidentals restart at column 0. | Both (§5, §9). |
| **Export path** | Chosen from the effective settings, not inactive stored ones. | — | Yes (§9). |
| **Corrections** | A minor with the upper tonic is A B \| C D E \| F G A′; G centred on the bottom set runs G to G. | — | Fixed (§4.4, §4.5). |

## Sol (gpt-6.1-sol), verbatim

1. **Stacking: keep the four rules, but correct their definitions.** They cover the operator’s alternatives and Clairnote’s column membership. Absolute parity and zigzag differ only by reflection when the tonic is even; share their implementation, but retain the distinction because one fixes pitch sides and the other fixes the tonic’s side.

   There is a concrete error: A minor with the upper tonic is **A B | C D E | F G A′**, not four stacks. G–A is a whole step. Major with the octave is 3–4–1; Clairnote’s 3–4 and 2–3–2 require hiding it.

   Assign columns from the complete scale **before filtering notes**. Apply alternate looks by logical column index, consistently under reflection.

   Optional stems between adjacent columns are reasonable, but multiple stems are not needed for Clairnote. Keep them off in those gallery examples and define their per-copy endpoints explicitly.

2. **Legibility: warn; do not silently redesign the signature.** Automatic shrinking changes the chosen look; offsets change the stacking rule; forbidding overlap is inappropriate in a notation-design tool.

   However, the warning cannot simply mean “parity rule plus height above two semitones.” Use resolved bounds and actual neighbouring-mark separations, including repetition boundaries. A conservative bounding-box warning is enough; do not build collision avoidance.

   The tailed dots distinguish solid/hollow patterns much better than alteration direction in these images. That is a real concern, but enlarged screenshots cannot establish concert-size readability. Require an actual-size engraved print check.

   **Verify the custom-shape anchor:** the dot must sit at the pitch, not the centre of the dot-and-tail bounding box. Adding a tail must not inadvertently move or shrink the dot.

3. **Repetition: offer it, explicitly opt-in.** The subset visibly reduces clutter, but it does not cure collisions. Do not silently switch `notes` when repetition is selected; keep these independent settings. Recommend the subset in explanatory text rather than making it a conditional default.

   The double-root rule is consistent with independently restarting each copy, but the full-size examples are not acceptable as clean output. In repeated C major, the lower B and the next tonic C occupy the same column only **one semitone apart**. The tonic-and-half-steps subset retains both, so that collision remains.

   Keep the requested double root, with a size/overlap warning. Describe this as restarting copies, not continuous alternation.

   Also, a shared root exists only when neighbouring copies are exactly an octave apart. Arbitrary line groups do not guarantee that.

4. **Octave placement: centred, with no new control.** In section 2, “rising” can move a bottom-set signature substantially into the upper region; “falling” can push it unnecessarily below the staff. Centred is the most predictable compromise.

   Specify: choose the tonic octave whose **fixed twelve-semitone span** has its centre nearest the group’s centre; settle ties deterministically. Hiding the upper tonic or filtering notes must not change placement.

   Correct “G … runs from the D below it up to G”: a tonic-led G scale must run G-to-G.

5. **Cuts and omissions.** Cut the proposed `placement.octave` vocabulary now: implement centred only. Most other visible controls directly answer the operator’s requests; removing them merely to reduce the count would lose requirements.

   What is missing:

   - A deterministic line-group definition, including zero groups and singleton lines. With one group, repetition must not duplicate the signature.
   - Accurate naming: **“Every line set”**, not “both sets,” if there can be more than two.
   - A visible indication and **clear override** action when a stored `tonicOctave` overrides the selected placement. A hidden setting must not make visible controls appear broken.
   - One explicit precedence order: resolved notehead → spelling look → alternate-column look.

   Do not add presets, a signature-specific rule language, or a general-purpose layout system.

6. **Export: the table is the right architecture; its drawing contract is incomplete.** The 105-entry enumeration is modest. Keep Scheme drawing explicit results rather than interpreting designer rules.

   But `{semi, column, mark}` does not specify bars, their endpoints, or sufficient horizontal geometry. Return marks plus explicit bars and column offsets/bounds from the pure computation. Wide imported shapes, tails and accidentals cannot safely inherit fixed two-column spacing. Shared mark membership alone does **not** guarantee matching layout. Specify that accidentals do not acquire notehead ledger lines.

   Prove tonic spelling and pitch-set recovery from real `\key` events **before** building the canvas implementation—not merely before scheduling the engine work.

   Exercise one real Emmentaler accidental through the engine hook before freezing that contract; the panel can still wait until session 51. Add tests for key changes, enharmonic spellings, transposition, system-start repetition and suppression of unwanted conventional cancellation signs.

   Keep the legacy export path, selecting it from normalized **effective** settings, not inactive stored options. Test all 105 identities cheaply in JavaScript and representative geometries through LilyPond.

---

## Argon (gemini-4-argon), verbatim

**1. Stacking rules and the gold stem**
The four rules cover both Clairnote and the operator’s signatures, and the operator explicitly asked for all four—keep them. However, observe in Section 3 that for every key with an even-semitone tonic (C, D, E, F♯, G♯, B♭), `"parity-zigzag"` and `"parity"` (odd-left, even-right) produce identical layouts—though inverted left-to-right because C=0 (even) starts on the left in zigzag and on the right in odd-left-even-right. They only differ on odd-semitone tonics (C♯, E♭, F, G, A, B). Make sure your unit tests cover both odd and even tonics so they don't accidentally pass on identical outputs.
**Gold stem bug:** Drawing a vertical stem between *each pair of neighbouring stacks* works for 2-column rules, but under `"parity-stacks"` with an upper tonic (4 columns in A minor) it will draw **three** parallel vertical gold bars across the key signature. Even with no upper tonic (3 columns), two vertical bars will overwhelm small Clairnote-style dots. Also, in Section 9 ("both sets"), a 7-sharp accidental signature will have **14 columns** if each copy gets its own columns, or if they share columns they need careful indexing. For the gold stem: either restrict the separator to 2-column layouts, or draw it only between columns 0 and 1.

**2. Legibility of parity stacks and custom tailed dots**
- **Parity stacks with full-size noteheads:** Leaving the size to the designer and showing a panel warning when mark height > 2 semitones is the right architectural choice. Auto-shrinking adds hidden magic that fights user overrides; offsetting alternate notes horizontally just recreates a 4-column layout. Keep the warning and let the designer adjust size in `looks`.
- **Tailed dots at concert size (Section 6):** As both the operator and mock-ups note, the tiny diagonal tails are nearly illegible at concert scale, especially on hollow dots or when crossing staff lines (e.g., E major and C minor in Section 6). Because they are user-imported SVGs rather than hardcoded engine primitives, this is a graphic design issue in the gallery assets, not a software design flaw. For the Clairnote gallery files (Session 50), make the tails thicker, longer, and steeper than standard Clairnote so they survive concert-size rendering.

**3. Repetition on both sets and the shared root**
- **Offer it?** Yes. The operator wants to experiment with it, and in the mark-table architecture (`CNBKeySignature.marks`), `"both-sets"` is just a loop over the line sets before deduplicating/emitting marks—almost zero extra engine complexity.
- **Tonic and half steps:** Section 7 proves the operator's intuition: full scales on both sets are a wall of ink (15–16 noteheads), whereas `"tonic-and-half-steps"` on both sets is clean and readable. However, **do not** make it auto-switch when `"both-sets"` is selected. Coupling two independent radio groups in the UI creates confusing state transitions. Let the user click both radio buttons.
- **Shared root rule:** Having each copy draw its own tonic/octave in its own column—creating a side-by-side double notehead at the seam under `"degrees"` and reversing the octave's column polarity—is mathematically sound and visually clear (Section 4). In `"parity"` or `"parity-zigzag"`, where both copies put the shared root in the exact same `(semi, column)`, `CNBKeySignature.marks` **must deduplicate** identical `(semi, column)` pairs so LilyPond and the canvas do not overdraw two stencils and two ledger lines on the exact same spot.

**4. Which octave on a line set (Q4)**
Hardcode **`"centred"`** and **cut `placement.octave` from the config and UI**. Looking at Section 2:
- `"rising"` on the bottom set pushes G major and A major all the way into the top line set, defeating the purpose of choosing "bottom set" and colliding with the upper copy if `"both-sets"` is used.
- `"falling"` pushes G major and A major down into two ledger lines below the staff.
- `"centred"` keeps the center of gravity squarely on the chosen line set and splits ledger reach evenly (at most one ledger line above/below). It is visually superior in every case; making it a setting is unnecessary clutter.

**5. Over-engineering to cut, and what is missing**
- **Cut `placement.octave`:** Hardcode `"centred"` (see #4).
- **Cut `looks.natural`:** Notice the operator’s prompt: *"either displaying noteheads or custom symbols for the notes"*. In §7, you have four compound "look" popovers (`natural`, `flat`, `sharp`, `alternate`), each with 5 fields (20 inputs). If a user just wants to shrink noteheads to 70% for parity stacks (like Section 5), they have to open three menus (`natural`, `flat`, `sharp`) and type `70%` three times! Instead, replace `looks.natural` with a base **`markLook`** (applies to all marks in the signature, defaulting to the notehead's own look), and keep `flat`, `sharp`, and `alternate` as overrides on top of `markLook`.
- **Missing — Accidental columns on `"both-sets"`:** Section 5 says each accidental is in its own column, left to right. On `"both-sets"` (Section 9, bottom row: D major and E♭ major), the upper and lower copies share columns 0..N-1 (2 columns for D major, 3 for E♭ major). Make sure §5 explicitly states that on `"both-sets"`, each copy restarts at column 0 rather than continuing into columns N..2N-1.

**6. Export (mark table) and session program**
- **Column spacing for >2 columns (Session 48/49 risk):** Today's engine only knows how to space 2 columns. `"parity-stacks"` has up to 4 columns; `"accidentals"` has up to 7 columns. Furthermore, tight parity dots (Section 5/6) need much narrower horizontal column spacing than wide Emmentaler accidentals (Section 9) or full noteheads with a gold bar between them. A single fixed column step in the engine will either clip accidentals or leave huge gaps between Clairnote dots. The mark table entry (or a top-level keysig setting) needs a **`column-step` (in staff spaces)** exported by the Configurator so the preview and engine space multi-column signatures identically within the 0.001 ss round-trip tolerance.
- **Deduplication:** Ensure `CNBKeySignature.marks` deduplicates `(semi, column)` when `"both-sets"` is active before exporting to `cnb:keysig-marks`.

---

## The round-2 brief, verbatim

Sent identically to both models, with the ten section images. Its "design under review" is the design as it stood before round 2.

    You are a senior software architect reviewing a design before it is built. Answer as an independent reviewer: say plainly what is wrong, what is missing and what is more than it needs to be. Over-engineering is strictly forbidden on this project: prefer the simplest design that meets the stated requirements.

    ## Context

    The Chromatic Notation Configurator is a browser tool (vanilla JavaScript ES modules, no framework, no build step) for designing chromatic music notations: staff lines placed on semitones, notehead shapes/fill/colour/size given per pitch class through priority-ordered "notehead rules", and a live preview of the 13 pitches C..C' as cards. One JSON config drives both the preview and an export to a LilyPond (.ly) settings file, which a separate LilyPond/Scheme "engine" repository engraves. The preview and the engraving are held to each other by engine round-trip tests within 0.001 staff spaces. Pitches are absolute semitones (C = 0); the staff's middle is `staff.midpoint` (12 by default); the default staff has lines at semitones 4, 8, 16, 20 (a "4-8" staff, 4 semitones per staff space).

    Key signatures today:
    - `keys.keySignature = { enabled, style: "notehead-chords" (the only value), placement: { rule: "scale-from-tonic", tonicOctave: null|int }, separator: { enabled, color "#ffd42a", thicknessPct 160, extentSemis 12 } }`.
    - The "scale stack": the key's 7 notes ascending from the tonic plus the tonic an octave up, drawn as real noteheads (resolved through the notehead rules at crotchet duration), alternating between two columns (even-indexed notes left, odd right), each column's ledger lines beneath, and a gold vertical stem between the columns. Automatic placement centres the tonic's octave on staff.midpoint.
    - The displayed key is example data, not config: the canvas has a key-and-mode picker (12 tonics, one spelling each: C C# D Eb E F F# G Ab A Bb B; and LilyPond's 7 modes major, minor, dorian, phrygian, lydian, mixolydian, locrian).
    - `keys.definitions` (named pitch-class sets) exist only so notehead rules can apply in particular keys.
    - The engine (keysig.ly) draws the same scale stack from the score's `\key`, via the exported notehead procedure. Its settings: `cnb:keysig-style` ('chord | 'none), bar colour/thickness/extent, tonic octave. The engine has a pitch-axis hook and a ledger table keyed by semitone. A prior design consult (2026) on custom-symbol signatures recommended: keep it narrow and declarative; never infer mode from a pitch-class set alone; and have the exporter resolve rules to explicit per-key mark lists that the engine simply draws (a "mark-list hook"), rather than teaching Scheme a rule vocabulary.

    The operator's requirements (verbatim outline):
    - Fewer options, so a designer does not have to define every key in every mode. A signature should be as easy to design as the noteheads, and reach Clairnote's, traditional ones and the scale stack alike.
    - A. Accidentals: traditional accidentals, which may help pianists.
    - B. Scale notes, with:
      1. the shape, colour and size of the signature's noteheads, for naturals, flats and sharps across all pitches;
      2. the upper tonic (the octave) shown or hidden;
      3. only the tonic and the notes a half step apart;
      4. the vertical stacking: two stacks of odd and even notes, optionally with the gold stem between them; or two or three stacks, a new one to the right at each half step, optionally alternating fill, colour or shape (enough for Clairnote's signatures);
      5. how the signature repeats across the staff's line groups: not repeated, placed so most noteheads fall on the bottom group, on the top group, or near the notes on the staff; or repeated across every visible group, the root as a double notehead.

    Clairnote's signatures (clairnote.org/key-signatures): a stack of solid and hollow dots (solid/hollow as Clairnote's noteheads are, by whole-tone set), the lowest dot the tonic; sharps and flats shown by a tail rising or falling into the dot; the stack ascends to the right in flat keys and to the left in sharp keys so tails do not collide; major keys show a 3-4 solid/hollow pattern, minor 2-3-2.

    ## Since the first consult

    A first round (two other models) reviewed an earlier draft; the design below has been revised from it and then from the operator's review of static mock-ups. The ten attached images are those mock-ups, one per section, drawn with the Configurator's real staff, notehead and ledger code and a prototype of the design's mark list (sharps and flats there use a serif font; the build would use LilyPond's Emmentaler glyphs). Sections: 1 placement (middle, bottom set, top set, both sets); 2 a tonic midway up a line set under three octave rules (centred, rising, falling); 3 the four stacking rules; 4 the shared root on both sets; 5 parity stacks with small noteheads on the Clairnote DN staff; 6 Clairnote-like custom symbols (dots with tails); 7 repetition on both sets, all notes vs only the tonic and half steps, and a restyled stem; 8 alternate look per stack and the tonic-and-half-steps subset; 9 traditional accidentals at the pitch they make; 10 the Kite 3-6-9 staff.

    The operator's message after seeing the mock-ups, verbatim:

    > Also, I can't remember whether I talked about an approach to having multiple stacks -- similar to Clairnote.  Clairnote adds a new stack when there is a change in the parity of the semitone (either from odd to even or even to odd).  It doesn't keep odd semitones on the left and even on the right -- but I think that would be equally viable.  My approach with the stacked seventh chords puts odd scale tones on the left and even on the right (with the tonic pitch on the left and the octave pitch on the right).  If this were repeated continuously on a staff, it would have to reverse.  In terms of notehead (or pitch placemarker symbol) stacking, I could see presenting different options for determining symbol stack membership (odd semitones always on the left, even semitones always on the right; the tonic semitone on the left, and a new stack occurs to the right when there is a change in parity; the tonic semitone on the left, and a new stack occurs first to the right and then back to the left when there is a change in parity; root, 3rd, 5th, and 7th scale notes on the left, and 2nd, 4th, 6th, and octave scale notes on the right.  If we then had the options of either displaying noteheads or custom symbols for the notes, as well as showing my special golden stem in between the stacks (possibly with the ability to change the color and thickness), then I believe that would cover both my and Clairnote's key signatures.  Clairnote has small solid or hollow circles with diagonal lines up or down (almost like old mechanical switches).  I don't want to criticize this approach, but those markings a pretty difficult to see when the staff is a standard size for concert music. (Mine isn't that great at a small scale either, so I'm not judging.)  In general, I think that flexibility here is helpful.  In terms of repeating the key signature, I am conflicted.  On the one hand, I think that it would be too busy.  On the other hand, it might be helpful to new musicians.  That is one reason why I have suggested possibly only showing where the tonic and half-tones are.  That would probably render in a less cluttered way as a repeated set of symbols on multiple staffs or staff parts (bottom and top).  Again, we could probably use some input from Sol and Argon on this.

    Earlier in the same review the operator chose: traditional accidentals sit at the pitch they make (F-sharp's sign at F-sharp), not at the letter they alter; and placement should be offered as the bottom line set, the top line set, or both (Clairnote, they believe, uses the bottom set), asking how a signature whose tonic is midway up a set should extend.

    ## The design under review (revised)

    # The key-signature designer — design

    **Session:** 47 (2026-11-11). A design only: no code changes with it.
    **Source:** the operator's outline in [`docs/uat-status.md`](../uat-status.md),
    "Trying sessions 36–41" item 7 (session 42), and the session plan's
    session 47.
    **Status:** revised from the cross-provider consult
    ([`key-signature-designer-consult.md`](key-signature-designer-consult.md),
    §12 below), for the operator's approval.

    ## 1. What a designer wants

    A designer should design a signature the way they design noteheads: by
    choosing how it looks once, not by defining every key in every mode
    (operator, session 42). One design should reach a traditional signature,
    the scale stack the engine draws today, and Clairnote's signatures
    (operator, 2026-11-08).

    So a signature is **one rule over every key.** The designer picks a kind and
    a handful of options. The canvas draws the result for whatever key and mode
    the staff's picker shows, and the engraving draws it for whatever `\key` the
    score sets. Key definitions (`keys.definitions`) stay what they are today:
    names for notehead rules that apply in particular keys. A signature never
    needs one.

    ## 2. What is built today

    - **`keys.keySignature`** (architecture plan §4.9): `enabled`, `style`
      (one value, `"notehead-chords"`), `placement` (`rule:
      "scale-from-tonic"`, `tonicOctave`, `null` for automatic) and `separator`
      (the gold stem: `enabled`, `color`, `thicknessPct`, `extentSemis`).
    - **The scale stack** (`cnb/src/cnb-key-signature.js`): the key's seven
      notes from the tonic, and the tonic an octave up, as real noteheads
      resolved through the notehead rules at crotchet duration. They alternate
      between two columns (even-numbered notes left, odd right), with each
      column's ledgers, and the gold stem runs between the columns beneath
      them. Automatic placement centres the octave on `staff.midpoint`.
    - **The key** is example data: the staff's key and mode picker (session 36)
      offers the twelve tonics (`C`, `C♯`, `D`, `E♭`, `E`, `F`, `F♯`, `G`, `A♭`,
      `A`, `B♭`, `B`) and LilyPond's seven modes (`CNBMusic.MODES`).
    - **The engine** (`cnb/keysig.ly` in the engine repository) draws the same
      stack from the score's `\key`, through the exported notehead procedure.
      Its settings are `cnb:keysig-style` (`'chord` or `'none`), the bar's
      colour, thickness and extent, and the tonic octave (LY spec §5.6).
    - **Not built:** any other style. Set 010 rejected simple built-in marks
      (dots, interval blocks, staggered ledgers) and deferred custom-symbol
      signatures (`docs/session-sets/010-custom-key-signatures/s2-design-consult.md`).
      The engine backlog §2.3 says such signatures need a **mark-list hook**:
      the engine drawing an explicit list of marks for each key.

    ## 3. Two kinds of signature

    | Kind | What it draws | For |
    |---|---|---|
    | **Scale notes** | the key's notes as noteheads | the scale stack, Clairnote, and most chromatic notations |
    | **Accidentals** | the traditional sharps or flats | readers who know traditional notation, such as pianists |

    **Spelling.** Both kinds need to know whether each note of the key is a
    natural, a flat or a sharp: scale notes to give each its look, accidentals
    to choose a sign. A key's spelling is the traditional one: its seven notes
    on the seven letters, starting from the tonic's spelling (LilyPond's
    `keyAlterations` for its `\key`). The tonic's spelling matters (F♯ major has
    six sharps, G♭ major six flats).

    **The keys.** The supported keys are those whose signature has at most
    seven sharps or flats: for each of the seven modes, the 15 tonic spellings
    of LilyPond's circle of fifths, 105 keys. For the mode chosen, the staff's
    picker offers exactly those 15: in major, C G D A E B F♯ C♯ and F B♭ E♭ A♭
    D♭ G♭ C♭; in minor, A E B F♯ C♯ G♯ D♯ A♯ and D G C F B♭ E♭ A♭. Three pitch
    classes therefore have two spellings in each mode, and no key needs a
    double sharp or double flat. The picker keeps its seven modes.

    ## 4. Scale notes

    Each point of the operator's outline, B1 to B5, is one setting.

    ### 4.1 The look of naturals, flats and sharps (B1)

    By default each mark looks like its notehead: the shape, fill, colour and
    size the notehead rules give that pitch at crotchet duration, as today.
    The designer may give **naturals**, **flats** and **sharps** each their own
    shape, fill, colour or size, for every pitch of that kind. Each field left
    unset keeps the notehead's own.

    **Noteheads or custom symbols** (operator, 2026-11-11). A look's shape may
    be any imported shape, so the marks can be the noteheads themselves or
    symbols imported for the signature alone (through the same SVG importer).
    A shape only the signature uses is exported like any other (Section A).

    Clairnote is an example. Its signature is small dots, filled or hollow as
    its noteheads are, with a tail rising to a sharp and falling to a flat. A
    designer imports a dot, a dot with a rising tail and a dot with a falling
    tail as shapes, gives naturals the dot, sharps and flats the tailed dots,
    and sets their size. The fill then follows the noteheads (mock-ups section
    6). The operator finds such tails hard to see at a concert staff's size, as
    the mock-ups bear out; that is the designer's choice to make.

    ### 4.2 The upper tonic (B2)

    **Show the tonic an octave up** is on by default, as today. Off, the
    signature has the key's seven notes only.

    ### 4.3 Only the tonic and the half steps (B3)

    **Notes: all of the scale** (the default), or **the tonic and the half
    steps**: the tonic, and both notes of each half step in the scale. In C
    major that is C, E and F, B and C′ (the upper tonic only when shown). In A
    minor it is A, B and C, E and F.

    ### 4.4 Stacking (B4)

    *(Revised from the operator's four rules, 2026-11-11; mock-ups section 3.)*
    Which stack (column) a note joins is one of four rules:

    | Rule | Stacks |
    |---|---|
    | **Stacked sevenths** (the default) | scale degrees 1, 3, 5, 7 left; 2, 4, 6 and the octave right; today's two stacked seventh chords |
    | **Odd semitones left, even right** | by the note's semitone; a pitch is always on the same side |
    | **A new stack at each change of parity** | the tonic's stack first; a note whose semitone's parity differs from the note below it starts a new stack to the right (Clairnote's). C major is C D E \| F G A B \| C′, Clairnote's 3–4; A minor is A B \| C D E \| F G \| A′ |
    | **Zigzag at each change of parity** | the tonic left; a change of parity moves to the other stack, right then back left |

    A whole step keeps the semitone's parity and a half step changes it, so in
    the seven modes the parity changes exactly at the half steps. With only the
    tonic and the half steps (§4.3) the stacks are the same and some notes are
    not drawn.

    **Mark size under the parity rules.** Their stacks hold notes a whole step,
    two semitones, apart. A mark taller than that runs into its neighbour, as
    the default 2.7-semitone notehead does in the mock-ups; Clairnote's dots
    are small for this reason. Stacked sevenths keep a third between
    neighbours. The design does not shrink marks itself: the panel says so
    beside a parity rule when the marks are taller than two semitones, and the
    size of §4.1 is the remedy.

    **The gold stem** stands between each pair of neighbouring stacks, beneath
    the marks, under any rule. Whether it shows, its colour and its thickness
    are the designer's: the existing separator settings, on and gold by
    default, as today (operator, 2026-11-11).

    Two more options apply under every rule:

    - **Every second column** may take a look of its own, so the columns tell
      apart: a fill, a colour or a shape, each set or left as it is. It is the
      same kind of look as the naturals', flats' and sharps' (§4.1), laid over
      them. Clairnote's own noteheads already alternate, so its gallery files
      leave it unset.
    - **Columns go to the right** (the default), or **to the left in sharp
      keys**, as Clairnote's do: its stacks rise to the right in flat keys and
      to the left in sharp keys, so a tail never meets the next dot. A key with
      no sharps or flats goes right. Under odd-left-even-right, which fixes
      each side, it does not apply.

    ### 4.5 Where the signature sits, and repeats (B5)

    *(Revised after the operator's first review, 2026-11-11: the places are
    the staff's line sets, and the mock-ups show them;
    [`key-signature-mockups/`](key-signature-mockups/index.html).)*

    A **line set** is a run of staff lines one staff space apart, on the
    engraved staff: the 24 semitones centred on its middle, `staff.midpoint −
    12` to `staff.midpoint + 12` (LY spec §5.1a), which the canvas draws too.
    The default 4-8 staff has two sets, either side of middle C: the bottom set
    (E and G♯, semitones 4 and 8) and the top set (16 and 20). Kite's 3-6-9
    staff has two of three lines each. A staff with one set (a five-line staff)
    has the same set at the bottom and the top. Four choices:

    | Choice | The signature sits… |
    |---|---|
    | **In the middle of the staff** (the default) | its octave centred on the staff's middle, today's automatic rule |
    | **On the bottom set** | on the lowest line set (as Clairnote's do) |
    | **On the top set** | on the highest line set |
    | **On both sets** | on every line set, one copy each |

    An explicit tonic octave (`placement.tonicOctave`) still overrides the
    first three.

    **Which octave, on a set.** A signature spans an octave, which on the 4-8
    staff is three staff spaces taller than a set of two lines, so it reaches
    past its set; and a tonic midway up the set (G, A) has no octave that sits
    neatly in it. The mock-ups (section 2) compare three rules:

    - **Centred**: the octave whose middle is nearest the set's middle. The
      reach is split either side; G on the bottom set runs from the D below it
      up to G.
    - **Rising**: the tonic at or above a staff space below the set's lowest
      line. The signature starts in the set and extends up; G on the bottom set
      runs from G up into the top set.
    - **Falling**: the top note at or below a staff space above the set's
      highest line. The signature ends in the set and extends down.

    This design proposes **centred** (question Q4). With both sets, each copy
    is placed by the same rule.

    **The gold stem** runs over the staff's middle ± its extent in the middle,
    as today, and over the signature's own notes on a set.

    **The root as a double notehead.** *(Revised from the operator's note that
    stacked sevenths repeated up the staff "would have to reverse".)* On both
    sets, one copy's upper tonic is the next copy's tonic, at the same
    semitone. Each copy draws it in its own stack: the lower copy's octave and
    the upper copy's tonic. Under stacked sevenths the octave is on the right
    and the tonic on the left, so the root is two marks side by side, a
    **double notehead**, and the stacks reverse there. Under a rule that puts
    both in one stack (odd left, even right; the zigzag in these modes) it is
    one mark. Without the upper tonic it is the upper copy's tonic alone
    (mock-ups section 4).

    **Repeating is busy.** On both sets the whole scale twice is a lot of
    marks; the tonic and the half steps alone (§4.3) carry the key in fewer,
    which may help a new reader without the clutter (operator, 2026-11-11;
    mock-ups section 7). Both are offered.

    ## 5. Accidentals

    The traditional signature: a sharp for each sharp of the key, in the order
    F C G D A E B, or a flat for each flat, in the order B E A D G C F, each in
    its own column, left to right, and nothing for a key with neither. The
    signs are LilyPond's own (Emmentaler `accidentals.sharp` and
    `accidentals.flat`, SIL OFL 1.1, as the treble, bass and alto clefs are),
    black, at LilyPond's size in staff spaces.

    **Height.** Each sign sits at the semitone of the note it alters: F♯'s sign
    at F♯, where an F♯ is drawn on this staff. Its octave is the one the
    signature's place (§4.5) gives that note in the scale; **on both sets**
    draws a sign in each copy. *(The consult split here, and the operator chose
    the note it makes over the letter it alters; question Q2.)* At LilyPond's
    size a sign is about 2.5 staff spaces tall, ten semitones on the 4-8 staff,
    so neighbouring signs overlap in height; each has its own column (mock-ups
    section 6).

    The scale-note settings (§4.1–§4.4) do not apply. The place (§4.5) does.

    ## 6. The config

    `keys.keySignature` gains the settings below. Each default is today's
    behaviour, so a config saved today loads, previews and exports exactly as
    before. `style` keeps its stored value `"notehead-chords"` for scale notes,
    so nothing is moved on load.

    ```javascript
    keySignature: {
      enabled: false,
      style: "notehead-chords",        // scale notes | "accidentals"
      notes: "all",                    // | "tonic-and-half-steps"
      upperTonic: true,
      looks: {                         // each field unset = the notehead's own
        natural: {},                   // { shape, hollow, color, heightSemis, widthSemis }
        flat: {},
        sharp: {}
      },
      stacking: "degrees",             // | "parity" | "parity-stacks" | "parity-zigzag"
      alternate: {},                   // every second column: { shape, hollow, color }
      columns: "right",                // | "left-in-sharp-keys"
      placement: {
        rule: "scale-from-tonic",      // kept as it is; no control
        tonicOctave: null,             // kept as it is; no control
        position: "middle",            // | "bottom-set" | "top-set" | "both-sets"
        octave: "centred"              // on a set: | "rising" | "falling" (Q4)
      },
      separator: { enabled: true, color: "#ffd42a", thicknessPct: 160, extentSemis: 12 }
                                       // the gold stem, between neighbouring stacks
    }
    ```

    **Validation** checks each vocabulary, that a named shape exists, that a
    colour is `#RRGGBB`, and sizes as it checks a notehead rule's (§4.5 of the
    architecture plan). The settings that do not apply to the chosen kind or
    stacking are kept and ignored, so switching back restores them.

    ## 7. The panel

    The Key signature section, in a designer's words. The key definitions
    stay below it, under "Keys for notehead rules".

    ```
    Key signature   [x] Show the key signature

      Draw          (o) The key's notes   ( ) Sharps or flats

      Notes         (o) The whole scale   ( ) The tonic and the half steps
                    [x] The tonic an octave up
      Stacks        (o) Stacked sevenths: 1 3 5 7 left, 2 4 6 8 right
                    ( ) Odd semitones left, even right
                    ( ) A new stack at each change of odd and even
                    ( ) Zigzag at each change of odd and even
                    Stacks go  (o) to the right  ( ) to the left in sharp keys
                    [x] Gold stem between the stacks   colour [■]  thickness [0.4] staff spaces
      Looks         Naturals           [as the noteheads ▾]
                    Flats              [as the noteheads ▾]
                    Sharps             [as the noteheads ▾]
                    Every second stack [as the others ▾]

      Place         (o) In the middle of the staff  ( ) On the bottom set
                    ( ) On the top set              ( ) On both sets
    ```

    - The defaults are today's scale stack, so a new signature starts there.
      There are no presets: a Clairnote-style signature needs its own dot
      shapes, so it is shown by the Clairnote SN and DN gallery files rather
      than by a button that could only set half of it.
    - A look's menu opens the notehead panel's own controls (shape, fill,
      colour, height and width) for that kind, with "as the noteheads" (or "as
      the others") to clear a field.
    - The panel has no control for the placement rule or the tonic octave,
      which stay in the config as they are. The gold stem's extent keeps its
      stored value.
    - Settings that do not apply are hidden: the scale-note rows for
      accidentals, and the direction under odd-left-even-right.
    - Under a parity rule, when the marks are taller than two semitones, a note
      beside the stacks says they will run together and points to the looks'
      size (§4.4).
    - The canvas draws the signature for the picked key as each setting
      changes, as it does today.

    ## 8. The preview

    One pure function computes what is drawn:

    ```
    CNBKeySignature.marks(config, key) → [{ semi, column, mark }]
    ```

    `key` is the picker's tonic (with its spelling) and mode. `mark` is a
    resolved notehead look (shape, hollow, colour, size) or an accidental
    (`"sharp"` or `"flat"`). `render` draws the marks column by column, each
    column's ledgers beneath, and the gold stem, when on, between each pair of
    neighbouring columns. A double notehead is two marks at one semitone in
    neighbouring columns, so it needs nothing of its own. The gutter widens to the columns. The exporter writes
    the same list (§9), so the preview and the engraving cannot disagree about
    which marks a key has.

    ## 9. LilyPond, and the engine's work

    **The export stays the same for a default signature.** A scale stack with
    every new setting at its default exports as today (`'chord`, or `'none`
    when off), byte for byte. Any other signature exports a **mark table**:

    ```lilypond
    #(set! cnb:keysig-style 'marks)
    #(define cnb:keysig-marks
       '((((0 . 0) . (0 2 4 5 7 9 11))       ; C major: tonic C natural, its pitch classes
          . ((12 0 head crotchet-minim #f black-000000)
             (14 0 head crotchet-minim #t black-000000)
             …))
         …))
    ```

    - **One entry per supported key** (§3): 15 spellings of the tonic × 7
      modes, 105 entries, the keys the picker offers. The key is the tonic's
      note name and alteration (as `\key` gives them) and the key's sorted
      pitch classes, so C major and A minor are told apart by their tonic, and
      F♯ major and G♭ major by their spelling.
    - **The marks are absolute**, on the staff's range (§4.5), which the export
      already fixes, so "on both sets" needs nothing from the engine but the
      marks.
    - **Each mark** is its engine semitone (the §5.7 numbering), its column,
      and either `head` with the shape, fill and colour names Section A
      registers (a sized variant where it has a size, §4.1c) or `sharp` or
      `flat`. A double notehead is two marks at one semitone. An entry whose
      gold stem is on says `bars`, with its colour and thickness.
    - **A key not in the table** (a score's `\key dis \major`, say) draws no
      signature, and the engine warns naming it. It does not fall back to the
      scale stack, which would be the wrong signature.

    **Engine work** (the engine repository's sessions, planned by Configurator
    session 48 into its plan, as session 46 planned engine session 28):

    1. **First, the key's identity**: confirm, from the `\key` event, that the
       engine recovers the tonic's note name and alteration and the key's pitch
       classes, as the table's keys need.
    2. **The mark-list hook** (engine backlog §2.3): `cnb:keysig-style 'marks`
       and `cnb:keysig-marks`, drawn by the key-signature engraver from the
       score's `\key`: heads through the registered stencils, accidentals from
       Emmentaler, each column's ledgers, and the gold bar between each pair of
       neighbouring columns when the entry says so.
       Columns are spaced as the stack's two are today, so a two-column table
       engraves like `'chord`.
    3. **Its spacing**: the signature's width and the space after it, measured
       and given in the handoff, so the preview spaces columns as the engine
       does (today's 0.75, 3.5 and 4.8636 staff spaces are measured for two
       columns).
    4. Goldens and integration specs on LilyPond 2.24 and 2.26, the handoff
       (`configurator-handoff.md`), and a minor release, **engine 1.4.0**, since
       it adds a setting and changes no existing output.

    The LY spec gains §5.6a (1.3.15) for the table.

    ## 10. Questions for the operator

    - **Q1. The root as a double notehead.** *Settled with the operator*
      (2026-11-11): on both sets, each copy draws the shared root in its own
      stack, which under stacked sevenths is two heads side by side (§4.5).
    - **Q2. Accidentals' height.** *Settled by the operator* (2026-11-11),
      where the consult split: at the note they make (F♯'s sign at F♯), not at
      the letter they alter (§5).
    - **Q3. "Near the notes on the staff".** *Settled by the consult*: the
      middle of the staff stands for it. Following the music's register would
      need the engine to read ahead, and the canvas has no music (§4.5).
    - **Q4. Which octave on a set.** *Open*, raised at the operator's review:
      centred (this design), rising or falling (§4.5; mock-ups section 2). Or
      should the designer choose, as `placement.octave` would allow?

    ## 11. The program

    Each UI session ends with the browser UAT and screenshots at 1440 and
    1280 px, as sessions 25 onward do. The engine's contract is settled first
    (session 48) and the scale notes reach LilyPond (49) before the panel and
    the accidentals are built on them.

    ### Session 48: Scale notes on the canvas, and the engine's hook planned

    1. Register.
    2. The config fields of §6 with their defaults, validation, and the
       architecture plan's §4.9.
    3. `CNBKeySignature.marks` for every scale-note choice (§4), `render`
       drawing from it, and the picker's 15 spellings per mode (§3), with tests
       in `cnb/tests/cnb-key-signature-tests.js` and
       `cnb/tests/cnb-preview-display-tests.js`: each of the operator's points,
       C major, A minor, a sharp key and a flat key, and every fixture and
       gallery file drawing exactly as before.
    4. *Engine work:* insert the engine's session 30, the mark-list hook (§9,
       with the mark format `marks` produces, sharps and flats included, and
       the key-identity check first), and session 31, its release 1.4.0, into
       the engine's plan.

    ### Session 49: Scale notes reach LilyPond

    1. Register.
    2. Once engine session 30 has landed (else the step is blocked): the
       exporter writes the mark table for any signature not at its defaults
       (§9); LY spec 1.3.15 §5.6a, the architecture plan, the README.
    3. An engine round trip on a representative set, the default and Clairnote
       DN fixtures, each stacking, upper tonic on and off, the half steps
       alone, and the bottom set, the top set and both sets, holds each engraved mark's height,
       column and look, and the signature's width, to the preview's within
       0.001 staff spaces; the combinations are covered by the pure tests. A
       key the table lacks engraves no signature and warns. The five export
       baselines stay byte-identical.

    ### Session 50: The Key signature panel

    1. Register.
    2. The panel of §7, in a designer's words.
    3. The Clairnote SN and DN gallery files take Clairnote-style signatures:
       dot shapes, half-step stacks going left in sharp keys, no upper tonic.
    4. A UAT driver for each choice on the canvas; screenshots at 1440 and
       1280 px. *Engine work:* none.

    ### Session 51: Accidentals

    1. Register.
    2. `CNBKeySignature.marks` for accidentals (§5, at the height Q2 settles),
       with Emmentaler's sharp and flat (SIL OFL 1.1; its licence is already in
       `cnb/assets/fonts/`); the panel's "Sharps or flats".
    3. The export writes them through the table; an engine round trip for C,
       a sharp key and a flat key, on the bottom set and on both sets; tests and the UAT.
       *Engine work:* none beyond session 30, which draws sharps and flats.

    ### Session 52: The UI is stable

    The operator tries sessions 43–51 and declares the UI stable, or plans what
    is left before the release.

    ### Session 53: Release 1.1.0 (release: 1.1.0)

    As the session plan has it: the withdrawn 1.0.2 entry renamed, the
    notehead-first editor, the clef and key-signature export and sessions 36
    onward added, and the site's first deploy confirmed.

    ## 12. What the consult changed

    GPT (`gpt-5.6-terra`) and Gemini (`gemini-3.1-pro-preview`) reviewed the
    draft on 2026-11-11 ([the record](key-signature-designer-consult.md)).
    From their synthesis:

    - **The keys** are the 105 with at most seven sharps or flats, and the
      picker offers each mode's 15 spellings, so no key needs a double sharp or
      flat (§3). The draft offered 17 spellings in every mode, some needing
      double accidentals it could not draw, and the export covered 15.
    - **The places** are defined on the staff's range rather than on line
      groups, without counting marks (§4.5). *(Revised again at the operator's review: the places are the line sets, bottom, top or both.)*
    - **The root on both sets** is two heads side by side, whatever the
      upper-tonic setting (Q1). "Near the notes" is the middle of the staff
      (Q3).
    - **Every second column** takes one look, like the others, instead of
      three separate switches (§4.4).
    - **No Start from presets**: Clairnote's signature is shown by its gallery
      files, since a button could not supply its dot shapes (§7).
    - **A key the table lacks** engraves no signature and warns, rather than
      the scale stack (§9); the engine session first confirms that it can read
      the key's identity from `\key`.
    - **The program** settles the engine's hook in session 48 and exports the
      scale notes in 49, before the panel and accidentals; the engine round
      trip covers a representative set (§11).

    Kept against one model's advice: the stored `style` value
    `"notehead-chords"` (no migration is needed to keep it), and the
    alternating look (the operator asked for it). Left to the operator: Q2.


    ## Questions

    1. The four stacking rules: does the set cover the operator's and Clairnote's signatures? Is any rule redundant or misdefined (look at sections 3 and 4)? Is "the gold stem between each pair of neighbouring stacks" right?
    2. Legibility, from the images: the parity rules put notes a whole step (2 semitones) apart in one stack, and full-size noteheads (2.7 semitones tall) run together (section 3). The design leaves the size to the designer and has the panel warn. Is that right, or should the design do something else (shrink automatically, offset alternate notes, forbid)? And what do you make of the custom tailed dots' legibility at concert size (section 6)?
    3. Repetition on both sets (sections 4 and 7): offer it at all? Is "only the tonic and the half steps" the right answer to the clutter the operator fears, and should it be the default when repeated? Is the shared root rule (each copy draws it in its own stack, so stacked sevenths reverse there and show a double notehead) sound?
    4. Which octave on a line set for a tonic midway up it (section 2): centred, rising, falling, or a designer's choice? Say which reads best and why.
    5. Over-engineering: name any setting, control or mechanism you would cut now that the operator asks for flexibility; and anything missing.
    6. Any problem with the export (the mark table) or the session program that the revisions introduce.

    Be concrete and brief: numbered answers, under about 900 words in total.
