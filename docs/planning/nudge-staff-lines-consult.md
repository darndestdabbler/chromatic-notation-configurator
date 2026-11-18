# Nudges and staff lines — cross-provider consult

**Date:** 2026-11-12 (session 57).
**Subject:** the operator's try-out (`docs/uat-status.md`, session 57, item
1): "Nudging sometimes (but not always) results in a staff line moving.
That shouldn't happen." Asked how to fix it, the operator asked for a
consult, adding: "I was thinking that some shapes may lend themselves more
to a center-of-mass positioning, rather than vertical center. If that's the
case, then we would need to be able to nudge noteheads independent of staff
lines."

## How it was run

One identical brief (reproduced at the end) went to two models, in one call
each, at the same time, from a script kept outside the tracked tree, with
the API keys from the environment:

- **Sol:** `gpt-6.1-sol` (OpenAI, reasoning effort high).
- **Argon:** `gemini-4-argon` (Google).

Both replies are reproduced verbatim below.

## Synthesis

They agree on every point:

| # | Point | Decision |
|---|---|---|
| 1 | **Where a pitch sits and where its notehead is drawn are two concepts.** The pitch axis is staff geometry: lines, ledgers, stems and collisions follow it. Optical centring is the glyph's registration on its pitch: nothing else moves. | Kept apart. |
| 2 | **The Pitch section's nudge is the pitch-axis editor**, and a staff line on a nudged pitch rightly follows it: `staff.semitonePattern` names the pitches that carry a line, and Twinline needs its lines on its nudged notes. Locking line notes would forbid Twinline-like staves; leaving lines behind needs a second coordinate system. What surprised the operator is the word. | Today's behaviour is kept. Session 57 says in the nudges' hint that a nudge moves the pitch, and a staff line on it. |
| 3 | **Optical centring belongs on the shape**, through the reference point the key signature already has (`shapes[name].reference`), applied to noteheads, so one setting fixes the shape everywhere. Not a per-rule `yOffset` until a notation needs one shape centred two ways. | Planned as a session before the 1.1.0 release. |
| 4 | **Export a vertically translated shape variant**, as sized variants are, with no engine change: the stem follows the stencil's extent and the ledgers stay at the pitch. The key signature must not apply the reference twice; stems, dots and repeat groups with an asymmetric head need checking. | Taken into the planned session. |
| 5 | **The reference point should be editable after import** (Argon). | Taken into the planned session. |

The operator chose to relabel here and plan the centring (2026-11-12).

## Sol (`gpt-6.1-sol`)

1. **Yes: pitch placement and optical centring are separate concepts.** The pitch axis defines where the pitch lives; an optical adjustment positions the drawing around that anchor.

   Keep the Pitch section and its canvas drag as **pitch-axis editing**, but rename “nudge” to something explicit, such as **“Pitch position — also moves staff lines.”** Put optical-centre editing in the shape editor. Do not give the existing drag a different meaning depending on whether that pitch carries a line.

2. **Use the shape’s reference point; do not add a rule-level offset yet.** An asymmetric shape generally needs the same optical correction wherever it appears. Reusing the vertical component of `shapes[name].reference` covers that need without another config field. Keep the SVG origin as the default reference.

   This makes the reference a shared pitch anchor for signatures and noteheads. Review existing nonzero references: applying previously signature-only settings to noteheads changes their appearance. Add a rule-level override only if someone actually needs *the same shape* positioned differently in different rules.

3. **Export a translated notehead variant first.** Translate the reference onto the pitch origin, scaling the translation consistently with the shape. Use the same transformation in the preview. Leave the original signature shape and its existing reference handling alone, avoiding a double adjustment.

   The consequences are:
   - **Stem attachment:** follows the translated stencil extent, as described. Thus “nothing else follows” cannot literally include the stem join. Check stem length and beam behaviour; translation is not proof that those remain correct.
   - **Ledgers:** remain at pitch-axis positions. That is intended.
   - **Repeat-mode heads:** each use of the variant gets the correction. Mixed-shape groups need each head’s own correction, not one translation of the whole group.
   - **Dots and collisions:** pitch anchors remain unchanged, but visible extents change. Whether the engine handles that correctly depends on its implementation; I cannot establish that from the supplied facts.
   - **Key signature:** keeps using its reference once, not twice.

   A new engine `y-offset` is not inherently safer. If it translates the same stencil, it has the same geometric consequences. If it moves an entire grob or group, it can affect additional placement. It adds coordination cost without a demonstrated need.

4. **Under a pitch-axis edit, the staff line should follow.** That is what “a line on semitone S” means in the current model, and it preserves Twinline.

   Refusing the edit unnecessarily restricts axis design. Leaving the line behind introduces independent line coordinates—a second layout model—not an optical-centre fix.

5. **The smallest useful fix is clearer axis controls plus shape-reference centring.** Preserve the map and existing saved nudges. Clarify their label and drag feedback; make the existing reference control available for optical adjustment; apply its vertical component in preview and exported notehead variants. No new rule field or engine field is needed.

   Before shipping, check asymmetric heads with stems, ledgers, dots and repeat groups. Any engine correction those tests reveal belongs in the coordinated session. Defer a general-purpose rule `y-offset` unless a concrete requirement emerges.

**Recommendation:** Keep staff lines attached to the pitch axis. Fix the misleading “nudge” presentation, and use the existing shape reference for optical centring, exported through notehead-only translated variants. This separates the two jobs with the least new machinery—while acknowledging that stem joins and extent-based layout still need verification.

## Argon (`gemini-4-argon`)

### 1. Are pitch position and optical centring two different concepts, and which should the UI nudge be?

Yes, they are two completely different concepts and must be kept apart:
* **Pitch axis (`pitchAxis`)** is **staff geometry**: where a semitone lives in vertical space. Staff lines, ledger lines, stems, dots, and collision handling *must* follow it, or compact notations like Twinline break.
* **Optical centring** is **glyph registration**: which point inside an asymmetric SVG shape (its visual center of mass) is pinned to that pitch's coordinate. Nothing else on the staff should move when you adjust a glyph's registration point.

The Pitch section’s "nudge" and canvas drag are already wired as the `pitchAxis` editor and are needed to express Twinline. Keep them as the pitch-axis tool, and clarify the UI label so the operator doesn't mistake them for a glyph-centering tool.

---

### 2. Should optical centring live on the shape, the notehead rule, or both?

**On the shape, reusing `shapes[name].reference`.**

Visual center of mass is a property of the *drawing* (a triangle or teardrop), not of the pitch class or duration. If a triangle looks bottom-heavy on E, it looks equally bottom-heavy on F and in the key signature. 
* Reusing `shapes[name].reference` (specifically its Y coordinate) means zero new JSON concepts, zero new UI pickers (you already click the enlarged symbol on import), and setting it once fixes the shape everywhere it is used.
* Putting `yOffset` on the notehead rule forces the designer to copy the same optical tweak across multiple pitch classes and durations. Supporting both is over-engineering.

---

### 3. How should it export, and what breaks with each option?

Export it as a **vertically translated shape variant** (baking the `-reference.y` shift into the exported notehead path alongside scale, e.g. `<shape>-h<H>-w<W>`), with **no engine change**.

* **What happens with a baked translated path (no engine change):**
  * **Staff and ledger lines:** Drawn at pitch positions, so they stay put while the notehead shifts onto them. *(Correct.)*
  * **Stems:** LilyPond attaches stems relative to the stencil's Y-extent (`-1 … 1`). Because the path coordinates shift, the stencil bounds shift with it, so the stem stays attached to the drawn notehead instead of hanging in empty space or poking through the shape. Stem length adjusts by that tiny optical offset, which looks right. *(Correct.)*
  * **Dots, collisions, and repeat-mode groups:** Dots sit at the pitch's staff space; collisions and repeat-mode groups use the shifted ink bounds, which matches what the eye sees. *(Correct.)*
  * **Key signature (watch out):** Key signatures *already* use `shapes[name].reference`. I am unsure whether key signatures in your exporter use the raw `<shape>` path or the sized `<shape>-h<H>-w<W>` variant paths. If you bake the translation only into the **notehead variant paths** (or if key signatures apply `reference` in the exporter rather than the engine), nothing breaks. If both share the same registered path and the engine shifts key signatures a second time, key signatures would double-offset.

* **What breaks with a new engine `y-offset` field:**
  * Costs a coordinated two-repo session for no gain.
  * If implemented in LilyPond by shifting the `NoteHead` grob's `Y-offset`, it will either throw off stem attachment, carry ledger lines with it, or confuse note-column collision math. To avoid that, the Scheme engine would have to translate the stencil inside the print callback—which produces the exact same result as translating the path in the exporter.

---

### 4. Under the pitch-axis nudge, what should happen when a pitch with a staff line is nudged?

**The line must follow the pitch (today's behavior).**

In your model, `staff.semitonePattern` says *which pitches carry a line*, not *where lines sit independently of pitches*. 
* In Twinline, D, F, and G♯ are nudged to map 12 pitches onto 7 positions, and the staff lines must sit on those nudged notes. 
* If you lock pitches that carry lines, you can't edit Twinline-style staffs whenever a line pitch isn't at its default 12-TET spot. 
* If lines stay behind when pitches move, you have to invent a separate coordinate system for staff lines, violating the no-over-engineering rule.

Today's behavior is mathematically right; it only surprised the operator because "nudge" sounded like an optical glyph tweak.

---

### 5. What is the smallest change that fixes the complaint now, and what should wait?

**Do now (configurator repo only):**
1. **Wire `shapes[name].reference.y` into noteheads:** Apply the shape's vertical reference offset when drawing noteheads on the preview canvas and when baking the scaled notehead variant paths in the `.ly` exporter (taking care not to double-shift key signatures).
2. **Allow editing a shape's reference point after import** (if the picker is currently import-only, let the operator re-open it for an existing shape so theydon't have to re-import an SVG just to tweak its center of mass).
3. **Clarify the Pitch UI:** Rename "Nudge" in the Pitch section to something like **"Pitch Axis Offset"** (with a brief tooltip/note: *"Moves the pitch, plus any staff/ledger line on it. To adjust how a shape sits on a line, set the shape's reference point."*).

**Wait (do not build now):**
* **No engine changes.**
* **No per-rule `yOffsetStaffSpaces`.** Only revisit this if a real notation ever requires the *exact same SVG shape* to be optically centered two different ways on two different pitches.

---

### Recommendation

Treat the operator's complaint as a **missing link between existing features**, not a flaw in `pitchAxis`. 

Keep `pitchAxis` (and its canvas drag / number fields) doing exactly what it does today so Twinline stays intact, and relabel it so its purpose is obvious. Satisfy the operator's need for center-of-mass positioning by making notehead preview and `.ly` path export honor the `shapes[name].reference` point you already have for key signatures. You will solve the exact use case in one repository, with no new data model concepts and no Scheme engine work.

## The brief

## Consult: should nudging a notehead move a staff line?

### Context

The Chromatic Notation Configurator is a browser tool (vanilla JS, no build)
for designing chromatic staff notations: staff lines, ledger lines, notehead
shapes and colours. It previews them and exports a LilyPond `.ly` config
that a companion LilyPond engine (Scheme) reads to engrave music. The
preview must match the engraving. One JSON config drives both. A strict
project rule: over-engineering is forbidden; the simplest design that meets
the need wins.

Pitch is measured in semitones (C = 0). Staff lines are given by pitch:
`staff.semitonePattern` lists the semitones within an octave that carry a
line (the default "4-8" staff: lines on E = 4 and G♯ = 8 in every octave,
4 semitones per staff space). Each notehead is drawn centred (its shape's
vertical centre, the SVG origin) on its pitch's position.

#### The pitch axis and nudges as they are today

An optional `pitchAxis` section maps each pitch class to a position on the
staff (`position(pc) + octave × octaveStride`). It exists for compact
notations such as Twinline (12 pitch classes on 7 positions per octave,
shared positions told apart by a horizontal side step). Staff lines,
ledger lines, stems, collision handling and the engine's notehead placement
all go through this map: a staff line on semitone S is drawn and exported at
position(S). The engine reads the map as a compiled procedure from semitone
to LilyPond staff position; the exporter computes `cnb:staff-line-positions`
itself from the map.

The editor's Pitch section presents the map as a **nudge** per pitch class,
−1…+1 semitone: position(pc) = pc + nudge(pc), written as a stride-12 map.
A notehead is nudged by dragging it up or down on the canvas or by a number
field. Nudges may make neighbours share a spot but never reorder them. A
stride-7 map such as Twinline reads as nudges too (rescaled to stride 12),
so Twinline is "the default staff with these nudges", and its staff lines
(on D, F, G♯) sit on its nudged noteheads, as they must.

#### The problem the operator found

"Nudging sometimes (but not always) results in a staff line moving. That
shouldn't happen." The cause: nudging a pitch class that carries a staff
line (E or G♯ on the default staff) moves that line with it, because lines
are placed through the same map. Nudging any other pitch class moves only
its notehead.

#### The operator's thought

"I was thinking that some shapes may lend themselves more to a
center-of-mass positioning, rather than vertical center. If that's the
case, then we would need to be able to nudge noteheads independent of staff
lines."

That is: for an asymmetric shape (a kite, a triangle, a teardrop) the
optical centre is not the box's vertical centre, so a designer wants to move
the drawn notehead up or down a little without moving the staff, and a
notehead on a line should still look centred on that line.

#### Facts that bear on the options

- The key signature already has a per-shape **reference point**
  (`shapes[name].reference`, native SVG units): the point a signature mark
  places on its pitch, picked by clicking an enlarged symbol on import.
  Notehead rules ignore it today.
- Notehead rules already carry an optional horizontal `xOffsetStaffSpaces`
  (axis-gated; the engine reads an `x-offset` field).
- Sized notehead variants are exported with no engine change by
  registering a scaled copy of the shape's path (`<shape>-h<H>-w<W>`), so a
  vertically translated copy could be registered the same way.
- LilyPond reads the stem attachment relative to the notehead stencil's
  extent (−1 … 1), so a translated path moves the stem attachment with it.
- Ledger lines are drawn at pitch positions, not from the notehead's path.
- Engine changes are possible but cost a coordinated session in a second
  repository.

### Questions (answer each, numbered, briefly; then a recommendation)

1. Are "where a pitch sits on the staff" (the pitch axis: lines, ledgers,
   stems, collisions follow it) and "where the notehead is drawn relative to
   its pitch" (an optical adjustment: nothing else follows) two different
   concepts that the editor should keep apart? Which one should the canvas
   drag and the Pitch section's "nudge" be?
2. If optical centring is wanted, should it live on the **shape** (a
   reference point / vertical offset in the shape, applied wherever the
   shape is drawn, reusing `shapes[name].reference`), on the **notehead
   rule** (a `yOffset` per pitch class / duration, like
   `xOffsetStaffSpaces`), or both? Which is simpler and covers the need?
3. How should it export: a vertically translated shape variant (no engine
   change), or a new engine `y-offset` field? What breaks with each (stem
   attachment and length, ledgers, repeat-mode groups of heads, dots,
   collisions, the key signature, which already uses the reference point)?
4. Under the pitch-axis nudge, what should happen when a pitch class that
   carries a staff line is nudged: the line follows (today), the nudge is
   refused (the note is locked to its line), or the line stays and the note
   leaves it (lines given positions of their own)? Twinline needs its lines
   on its nudged notes.
5. What is the smallest change that fixes the operator's complaint now, and
   what, if anything, should wait for a planned session?
