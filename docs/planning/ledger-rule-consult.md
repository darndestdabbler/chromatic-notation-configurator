# The default ledger rule — cross-provider consult

**Date:** 2026-11-14 (session 69).
**Subject:** the operator's try-out (`docs/uat-status.md`, session 69,
items 3 and 4). On the 3–5–7–9 staff the C between the octaves is drawn
with the C♯ ledger alone, though it lies midway between the C♯ and B
ledgers. The operator first proposed: "a ledger is shown when the note is
closer to the ledger than to a staff line. Period." Then, on second
thought, a two-step rule: "a. Identify the staff line that is closest to
the note. b. Then all ledger lines that fall between the center of that
note and the nearest staff line would be shown." They asked to check how
`clairnote.ly` does it and to consult Sol and Argon. They also asked that
the ledgers follow the ledger rule when the staff is changed, since the
default notation's 4-8 ledgers persist on another staff.

## How it was run

`clairnote.ly` was read from Paul Morris's repository
(`PaulMorris/LilyPond-Clairnote` on GitHub, its LEDGER LINES section): its
rule is the operator's two-step one with a per-notation recipe that may
also draw ledgers a little beyond the note (described in the brief). A
script outside the tracked tree computed what each rule draws on six
staves (the tables in the brief). One identical brief (reproduced at the
end) then went to two models, in one call each, at the same time, with the
API keys from the environment:

- **Sol:** `gpt-6.1-sol` (OpenAI, reasoning effort high).
- **Argon:** `gemini-4-argon` (Google).

Both replies are reproduced verbatim below.

## Synthesis

They agree on every point:

| # | Point | Recommendation |
|---|---|---|
| 1 | **Rule A is the default**: a ledger spot is shown when the note is strictly closer to it than to every staff line, and it lies on the note or between the note and a staff line. Rule B leaves C♯ and B on the 4–8 and 3–6–9 staves with no ledger in a wide space (Argon: under A every note in a wide gap touches a line or a ledger); Clairnote's further-add 2 clutters 2-semitone staves (C♯ beside the D line on 2-4-6-8-10 would get a ledger). A and B agree on every 2-semitone staff. | Rule A, the operator's first proposal. |
| 2 | **A note equidistant from two lines takes both directions' ledgers** (C on 3–5–7–9: B and C♯), not the lower one by list order. | Both. |
| 3 | **Ledgers beyond the note** only as far as rule A already draws them (inside a wide gap); Clairnote's further-add is a per-notation choice, for My own rules or a later setting. | No setting now. |
| 4 | **No octave-region gate** for the distance rule: it makes a discontinuity at C with no geometric reason. | Dropped (it stays for rules matched by pitch class). |
| 5 | **Reset the ledgers on a staff change only when they are inherited, not edited**: the previous staff's defaults go, a designer's own rules stay (Sol: track their origin, or compare against the previous preset's; Argon: a flag set by editing My own rules). | The ledgers follow the staff unless they are the designer's own work. |
| 6 | **Edges:** measure in drawn (axis) positions under a pitch axis, and deduplicate coincident spots; a note on a line takes no ledger; near the top and bottom of the drawn range, ledger spots must exist beyond the range so a note there is treated as one in the middle (Argon). | Taken into the fix. |

The operator chose rule A, and a reset of the ledgers on a staff change
only while they are still the defaults (2026-11-14). Both are fixed in
session 69. The operator's next screenshot (`docs/uat-status.md`, item 5)
showed a rule's ledger answering a note across four staff lines; the fix
there (no staff line between a ledger and its note) removes the octave
gate's last purpose, so it goes for rules matched by pitch class too.

## Sol (`gpt-6.1-sol`)

1. **Use A as the general-purpose Automatic default, as defined by your tables.** There is no universal chromatic-staff convention, but A is a good readability compromise: it supplies a nearby reference when the note is closer to a ledger spot than to any staff line. B leaves B and C♯ on 4-8 relatively unanchored; Clairnote’s fixed further-add introduces more marks than every notation needs.

   The traditional D4 example does not rule out A: D4 is equally distant from C4 and E4, so A’s **strict** comparison omits the C ledger. For a stabilisation release, A also preserves today’s automatic marks while correcting their octave-boundary asymmetry.

2. **Both directions, when their spots qualify.** Thus C on 3-5-7-9 gets B and C♯. Choosing the lower line merely because it occurs first in a list introduces an unnecessary directional preference. Distinguish this from a *ledger-versus-staff-line* distance tie: under A, that tie gets no ledger.

3. **Allow A’s limited extension inside a staff gap; make Clairnote-style further-add a per-notation choice.** The C ledger for C♯ on 4-8 is beyond the note relative to its **nearest** line, E, but lies toward staff lines on the other side. That is different from extending a ledger beyond an exterior note, away from the whole staff.

   The wording therefore needs care: A does **not** mean “never beyond the note relative to its nearest line.” Keep the exterior no-overshoot constraint. Do not impose a universal further-add of 2; its effect varies substantially with spacing.

4. **No octave-region gate is needed.** Neither distance nor the between-note-and-line test requires octave labels. The gate creates an engraving discontinuity at C without a corresponding geometric reason.

5. **Reset inherited defaults, not genuine custom work.** Switching unchanged rules belonging to the previous staff’s preset to Automatic is sensible. Silently replacing a designer’s edited rules is not. Prefer tracking their origin; comparing against the previous preset’s rules is a workable fallback. Preserve edited rules, even though the designer may need to revise them after changing the staff.

6. **Check geometry, candidate generation, and staff boundaries.**
   - Measure distances in **rendered staff coordinates**, not pitch-class numbers, once the pitch axis can collapse or otherwise remap pitches.
   - Coincident pitches necessarily get identical automatic geometry; ledger placement alone cannot distinguish them. Deduplicate coincident spots.
   - Unequal spacing needs an explicitly defined automatic-spot generator; the selection rule cannot resolve ambiguity about where spots belong.
   - For a finite staff, use its **actual drawn lines**, not invisible octave repetitions, when finding the nearest line. Ensure exterior candidates and long ledger stacks are generated without an octave cutoff.
   - A note on an actual staff line should receive no automatic ledger.

### Recommendation

**Ship A, remove the octave gate, and retain the side constraint as your tables interpret it.** Define it using actual positions:

> Show a candidate ledger when it is strictly closer to the note than every actual staff line, and it lies on the note or between the note and an actual staff line.

This gives symmetric treatment of wide gaps without adopting a notation-specific Clairnote recipe. Keep deliberate exceptions in **My own rules**, and switch to Automatic on staff changes only when replacing unchanged inherited rules.

## Argon (`gemini-4-argon`)

**1. Which default rule is right?**
**Rule A** is the best general default, with **Rule B** a close second depending on how you weight convention vs. wide-space readability.
*   **Clairnote (`further-add 2`) fails on 2-semitone staves:** On 3-5-7-9, 6-6, and A-B, Clairnote gives three consecutive notes the exact same pair of ledgers (e.g. C♯4, D4, and D♯4 on 6-6 all get `C♯4 D♯4`: one sits on the bottom ledger, one between them, one on the top). Worse, on 2-4-6-8-10, C♯4 is directly adjacent to the D4 staff line (1 semitone away—a standard "note sitting against a line"), yet Clairnote draws a ledger beneath it. That is visual clutter.
*   **Rule A vs. Rule B:** They are identical on 2-semitone staves (where both match traditional notation). They differ only on 3- and 4-semitone staves (3-6-9 and 4-8). In a 4-semitone space (where noteheads are 2 semitones tall), there are 3 non-line notes between C4 and E4: C♯4, D4, D♯4. Under Rule B, none of them get a ledger; a reader must distinguish 3 floating positions in open space. Under Rule A, C♯4 and B4 get the C ledger (because they touch it, and are 3 semitones from the staff line), leaving only D4 and A♯4 (which touch the staff lines) without ledgers. This guarantees every note in a wide gap touches * either* a staff line *or* a ledger line.

**2. Notes equidistant from two staff lines**
**Both directions' ledgers** (as shown in your tables for A and B on 3-5-7-9).
If a note is dead-centre in an inter-octave gap and does not sit on a ledger itself (like C4 between B3 and C♯4), drawing only one ledger makes it look asymmetric and visually identical to a note sitting just outside a single ledger. Drawing both frames the note as a "sandwich" in the exact centre of the gap, preserving vertical symmetry.

**3. Ledgers drawn beyond the note (`further-add`)**
This should be a **per-notation choice** (left to "My own rules" or a future `further-add` setting), not the universal default, *except* to the natural extent that Rule A already does it.
In traditional notation (and 2-semitone chromatic staves), a note 1 step outside a line touches that line; it needs no ledger beyond it. In wide-spaced staves (4-8), a note 2 semitones from a line is already floating in space, which is why Clairnote uses `further-add`. Rule A captures the essential part of this automatically: because a ledger only triggers when $|N - L| < |N - S|$, a ledger *beyond* the note only ever appears when the gap between the ledger and the nearest staff line is at least 3 semitones wide.

**4. The octave-region gate**
**No.** Drop it completely. A staff is a continuous vertical grid; arbitrary pitch-class octave boundaries (like C) have no visual meaning if the staff's gap doesn't align with C. Defining the rule purely by local geometry (distance to nearest staff lines and spots) is invariant under transposition and works for any staff rotation (e.g. A-B vs. 6-6).

**5. Switching ledgers to Automatic when the staff changes**
**Only reset if the rules haven't been manually edited by the user** (use a `dirty` flag, or check if the current rules still match the preset/default).
Switching from the initial 4-8 preset to 3-5-7-9 *must* clear the preset's custom 4-8 rules. However, if a user is actively designing a custom ledger scheme and clicks a different staff pattern by mistake (or to test how their rules look when shifting a single staff line), silently wiping out their manual work without undo is frustrating UX.

**6. Edge cases not shown in the tables**
*   **Notes far above or below the staff (the outer regions):** Both Rule A's condition (2) and Rule B rely on a staff line being on the *other* side of the ledger ("between $N$ and a staff line"). Outside the top and bottom of the entire staff, there is only a staff line in *one* direction.
    *   *Under Rule B:* Works naturally. The nearest staff line for any high note is the top line of the staff; every ledger spot between that top line and the note is drawn, stacking outward just like traditional notation.
    *   *Under Rule A:* Watch out for two things outside the staff. First, for a note high above the staff, *every* ledger spot between it and the top line is closer to the note than the top line is, so they will all draw (good). Second, a ledger spot 1 semitone *further out* than the note is *also* closer to the note than the staff line is! If your condition (2) says "L lies between N and a staff line *in that direction*", it will prevent ledgers beyond the note outside the staff—which means C♯4 (in the middle gap of 4-8) gets a C4 ledger, while C♯6 (above the staff) does *not* get a C6 ledger, and B1 (below the staff) does *not* get a C2 ledger. To make outer octaves match inner octaves under Rule A, the rule must evaluate pitch classes modulo 12 (treating the staff as an infinite repeating grid first, then clipping the actual drawn staff lines to the staff's ambitus).
*   **Unequal spacing within the staff:** If a user designs a staff with an internal wide gap *and* places a ledger spot inside it, Rule A and B will both handle it cleanly, whereas an octave-gated rule would break.
*   **Empty staff (0 lines):** Guard against division by zero / empty minimum when finding the nearest staff line.

---

### Recommendation

Implement **Rule B** (evaluated across all staff lines, with ties taking both directions) as the cleanest, most conventional geometric rule—**or Rule A** if you want 4-8 and 3-6-9 to remain readable out-of-the-box without custom rules.

Specifically, **Rule A is the better pragmatic choice for your tool**, provided you solve the outer-octave issue by computing the ledger triggers **modulo 12** (i.e. as if the staff lines repeated across all octaves):
1. Project the staff lines and ledger spots across all octaves.
2. For a note $N$, find the nearest projected staff line(s) $S$ (if tied, keep both).
3. Draw a ledger at spot $L$ if:
   * $L$ lies on the segment between $N$ and $S$ (Rule B), **OR**
   * $|N - L| < |N - S|$ and $S$ and $L$ are not on the same side of $N$ without $L$ being between them (Rule A: $L$ is closer to $N$ than $S$ is, and $S$ is not strictly between $N$ and $L$).
4. In addition, if $N$ is outside the actual drawn staff, draw all ledger spots(and projected staff-line positions!) that lie between $N$ and the nearest *actual* staff boundary.

For the UI state: track a boolean `hasCustomLedgerEdits = false`. Set it to `true` only when the user manually edits the "My own rules" section. When the staff pattern changes, switch to Automatic if `!hasCustomLedgerEdits`.

## The brief

### Consult: the default rule for which ledger lines a note gets on a chromatic staff

#### Context

A browser tool designs chromatic staff notations (one staff position per
semitone) and exports them to LilyPond. A notation's staff is a set of
pitch classes that carry a line, repeated every octave: 4-8 has lines on E
and G♯; 3-6-9 on D♯, F♯ and A; 3-5-7-9 on D♯, F, G and A; 2-4-6-8-10 on
D, E, F♯, G♯ and A♯. The lines within a group are one staff space apart
(4, 3, 2 and 2 semitones respectively), and between the octaves' groups is
a wider gap: 4-8 has E and G♯ (4 apart), then 8 semitones to the next E;
3-5-7-9 has 6 semitones from A to the next D♯. Middle C is semitone 12,
the staff's middle.

**Ledger spots.** Ledger lines may only appear at "spots". By default (the
editor's "Automatic" ledgers) the spots continue the staff's own spacing
into the gap: 4-8 → a spot on C; 3-6-9 → C; 3-5-7-9 → C♯ and B (C falls in
a space between them); 2-4-6-8-10 → C. A notation designer may instead
write their own rules ("My own rules"): spots with explicit trigger pitch
classes (for example "the C ledger for C, C♯ and D"), which are not in
question here.

**Today's default rule** (for automatic spots): a ledger at spot L is
shown for a note at N when (1) N is strictly closer to L than to any staff
line, (2) L lies on N or between N and a staff line in that direction, and
(3) L and N are in the same octave region, octaves starting at C. Rule (3)
is the problem: on 3-5-7-9, the C between the octaves sits midway between
the B and C♯ ledgers (one semitone from each, three from the nearest
lines, A and D♯), yet it gets only the C♯ ledger, because the B spot is in
the octave below. On 4-8, C♯ gets the C ledger but B, one semitone on the
other side of it, does not.

**The operator's first proposal (rule A):** a ledger is shown when the
note is closer to it than to a staff line. Period. So a note midway
between two ledgers takes both. Rule (2) is kept so that a ledger never
appears beyond a note on the side away from the staff.

**The operator's second thought (rule B):** a two-step process. (a) Find
the staff line closest to the note. (b) Show every ledger spot between the
centre of the note and that line, including one on the note itself.

**Clairnote** (Paul Morris's `clairnote.ly`, the LilyPond implementation
of Clairnote DN and SN, both 4-8-like staves) does this, per note: find
the nearest staff line (on a tie, the one first in the staff's line list,
i.e. the lower); measure the note's distance d from it in staff positions
(semitones); then from that line toward the note, draw each ledger of a
per-notation "recipe" whose distance from the line is at most d +
further-add and at least d − nearer-drop (nearer-drop may be off). The
default recipe ("gradual") for DN is `(4 2 5) (8 2 #f) (12 2 #f)`:
ledgers at 4, 8 and 12 semitones from the nearest line, each with
further-add 2, the first with nearer-drop 5. So a ledger up to 2
semitones BEYOND the note is drawn: on DN the C ledger is drawn for C♯
and D as well as for C. Other recipes: "less-gradual" (further-add 5 on
the octave ledger, nearer-drop 2 on the first) and "keep-c-ledgers"
(no nearer-drop). Ledgers that would fall on staff lines are removed.

#### What each rule draws

A staff whose lines repeat every octave; only notes that get a ledger
under some rule are listed; octave numbers C4 = middle C. "Clairnote" is
its algorithm with further-add 2 and no nearer-drop applied to the
automatic spots. (Brennink's A-B notation is assumed to have lines on F♯,
G♯, A♯ and C.)

```
4-8 (E, G♯): spots C
note  today   A       B       Clairnote
C4    C4      C4      C4      C4
C♯4   C4      C4      –       C4
D4    –       –       –       C4
A♯4   –       –       –       C5
B4    –       C5      –       C5

3-6-9 (D♯, F♯, A): spots C          (same as 4-8)

3-5-7-9 (D♯, F, G, A): spots C♯, B
note  today   A       B       Clairnote
C4    C♯4     B3 C♯4  B3 C♯4  B3 C♯4
C♯4   C♯4     C♯4     C♯4     B3 C♯4
D4    –       –       –       C♯4
A♯4   –       –       –       B4
B4    B4      B4      B4      B4 C♯5

2-4-6-8-10: spots C
note  today   A       B       Clairnote
C4    C4      C4      C4      C4
C♯4   –       –       –       C4
B4    –       –       –       C5

Parncutt's 6-6 Tetragram (F, G, A, B): spots C♯, D♯
note  today   A       B       Clairnote
C4    –       –       –       C♯4
C♯4   C♯4     C♯4     C♯4     C♯4 D♯4
D4    C♯4 D♯4 C♯4 D♯4 C♯4 D♯4 C♯4 D♯4
D♯4   D♯4     D♯4     D♯4     C♯4 D♯4
E4    –       –       –       D♯4

Brennink's A-B (F♯, G♯, A♯, C): spots D, E
note  today   A       B       Clairnote
C♯4   –       –       –       D4
D4    D4      D4      D4      D4 E4
D♯4   D4 E4   D4 E4   D4 E4   D4 E4
E4    E4      E4      E4      D4 E4
F4    –       –       –       E4
```

Rule B on a tie (a note equidistant from two lines, C on 3-5-7-9) takes
both lines here; Clairnote takes the lower, and with further-add reaches
the other ledger anyway.

#### Facts that bear on it

- The export writes, for every pitch, exactly the ledgers the preview
  draws, so any rule costs no engine change.
- The default notation (4-8) ships "My own rules" written for Clairnote-like
  reading: the C ledger for C, C♯ and D, a D ledger for D, an A♯ ledger for
  A♯. When the designer picks another staff, those rules stay, which the
  operator finds confusing; the plan is to switch the ledgers to Automatic
  whenever the staff pattern changes.
- This release is a stabilisation pass: no new settings. A further-add or
  nearer-drop setting would be a later feature; the question now is the
  default.

#### Questions (answer each, numbered, briefly; then a recommendation)

1. Which default rule is right for chromatic staves in general: A, B,
   Clairnote's (with what further-add), or another? Judge by readability
   (can a reader tell a note in a wide space from its neighbours?) and by
   convention (traditional notation draws no ledger beyond a note, e.g. no
   C4 ledger for D4 under the treble staff).
2. A note equidistant from two staff lines (C on 3-5-7-9, between the A
   and D♯ lines): both directions' ledgers, one direction (which?), or
   something else?
3. Should a ledger ever be drawn beyond the note (Clairnote's further-add),
   and if so is that a default or a per-notation choice? Note that rule A
   already draws one for C♯ on 4-8 (the C ledger lies beyond C♯, away from
   the E line), while rule B does not.
4. The octave-region gate: is there any case where the default rule needs
   it, once the rule is defined by distance to the nearest line?
5. Is switching the ledgers to Automatic whenever the staff pattern
   changes right, or should a designer's own rules survive a staff change
   in some cases (for example, only reset when the rules are still the
   previous staff's defaults)?
6. Anything in these rules likely to go wrong that the tables do not show
   (pitch axes where several pitch classes share a position, staves with
   unequal spacing, notes far above or below the staff)?
