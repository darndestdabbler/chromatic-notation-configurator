# Lessons learned — `chromatic-notation-configurator`

Lessons harvested from the `change-log.md` of each session set under
`docs/session-sets/` (sets 001–013). Each names the set it came from; the
change log and the set's own records hold the detail.

## Audit before you build

A spec that says "build" may describe code that already exists. Set 001 found
that pre-Dabbler Session 9 had built all five Phase-2 modules, so both its
sessions ran as audits against the architecture plan, and the audits found
real defects: a ledger body drawn as a hollow outline, and stems that
computed the anchor's y offset but never applied it. Read the tree before
planning the work, and test what a module draws, not only what it returns.

## Ask the engine what it renders before deciding what to export

Unit tests against a spec cannot catch a spec that disagrees with the engine.
Set 007 rendered a Configurator export through the real engine and diffed it
against the golden baseline three ways, and found D1 (the missing
`cnb:use-procedure-model` flag, without which the engine silently ignores
Sections A and C), D2 (staff positions in whole rather than half staff
spaces) and D5 (anchors in the wrong unit). Sets 009, 010 and 013 each began
with an engine-capability discovery for the same reason: 009 and 010 found
no engine hook to drive, so their exporters emit nothing; 013 proved the
pitch-axis hook by a real render before any design was written.

## Store canonical units; convert at the boundary

Set 007's D5: anchors converted to staff-space units at import time went
stale whenever the staff changed afterwards. Shapes now store anchors in
semitone units and the exporter converts on export. Keep a value in the unit
that does not depend on other config, and convert where the dependency is
known.

## Default-off is proven by a byte-identical baseline, not argued

Every optional feature since set 009 (clef, key signature, pitch axis)
captured a pre-change export or geometry baseline under `cnb/fixtures/` and
pinned the disabled output byte-for-byte against it. The pitch-axis design
set 013 produced went further: with the feature off, the literal
pre-existing code path runs, not an equivalent re-derivation. A new optional section should arrive with its
baseline test in the same change.

## Open-keyed maps must be replaced on load, not merged

Set 006: loading a saved config through a key-by-key deep merge resurrects
default entries the user had deleted from open-keyed maps (`shapes`,
`lineOverrides`, `schemeSymbols`, ...). `CNBConfigIO.REPLACE_PATHS` replaces
those wholesale; set 009 added `clef.glyphs` to it. A new open-keyed map
needs a `REPLACE_PATHS` entry; a fixed-shape section or an array does not.

## Wire UI events as element properties so editors test in Node

Sets 004–006 attached handlers as element properties on plain
`createElement` nodes, which let every editor's `render()` run against a DOM
stub in the unit suite. The browser drivers under `cnb/uat/` then verify the
same flows in a real browser, including byte-comparing a captured download
with a Node-side `generate()`.

## Let the evidence amend the model

Set 008 started with three platform invariants; the operator's UAT review of
Note for Note, and Thumline's movable-Do axis, forced I4 and I5. Set 011's
reproductions then showed Express Stave also breaks I4, and the matrix was
corrected in place (§8). Record `unknown` rather than guess, and correct the
classification when a reproduction contradicts it.

## Visual claims need a human looking at a numbered frame

Set 009's clef attestation took three rounds and produced numbered-grid
frames before the operator could confirm placement. Set 010's separator was
first drawn at the columns' right edge from a misread engine comment, and was
corrected only against real engine renders during UAT. Measure against the
engine's output, and give the reviewer a frame with coordinates.

## Name a deviation instead of hiding it

Systems that cross an invariant (I3 proportional duration, I4 bounded staff)
were reproduced in set 011 as adaptations with the deviation named in the
reproduction report, not left out and not passed off as exact. The playbook
(set 012) carries that pattern into its guidance.
