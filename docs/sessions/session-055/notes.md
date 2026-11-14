# Session 55 — Clairnote's own signatures at concert size

## How the pages were made

`clairnote-sn-concert.ly` and `clairnote-dn-concert.ly` are each gallery
file's export (`CNBLilypond.generate` on
`cnb/assets/examples/gallery/clairnote-{sn,dn}.json`, loaded as the app loads
it), followed by session 50's score: two bars in each of C major, D and A major
(sharp keys) and F, E♭ and B♭ major (flat keys), every one a key change, over
three systems. The staff is LilyPond's default 20-point staff, which engine
1.6.0 magnifies by the export's own `cnb:default-magnify` (7/4). Each page was
engraved with LilyPond 2.24 and engine 1.6.0 at print resolution:

```
lilypond --png -dresolution=300 -I <engine repository> clairnote-sn-concert.ly
```

The PNGs (A4 at 300 dpi) were judged at 100%, one image pixel to one screen
pixel, and at 4×, for which the same files were also engraved at 1200 dpi
(not kept) so that each symbol's edges could be seen rather than its pixels.

## The signatures

Each file draws Clairnote's own signature (key-signature design §13.4): a dot
for each note of the key, a new stack at each change of odd and even, the
stacks going left in sharp keys, no upper tonic, no gold stem, on the bottom
line set (all as in session 50); and now a **tail** on each flat and sharp, an
added symbol (design §13.3). The dots are solid on a line or ledger and hollow
in a space: SN through the line and space looks, DN through its noteheads,
which alternate solid and hollow already.

The tails are filled shapes in the toolkit's SVG format,
`cnb/assets/examples/gallery/clairnote-symbols/clairnote-tail-up.svg` (flats)
and `clairnote-tail-down.svg` (sharps), imported through the SVG importer.
Each one's origin, its reference point, is the dot's centre, so the canvas and
the engine (through the mark table's `(at dx . dy)`) both put the dot's centre
on its pitch, with no hidden geometry (design §13.6, session 50's first
failure). Each takes no ledgers. The geometry (design §13.7):

- it leaves the dot to the left at 30° from the horizontal, up for a flat and
  down for a sharp;
- it starts 0.62 semitones from the centre, inside the dot's solid ring (a
  hollow dot's cut-out reaches 0.44), so it never shows through a hollow dot;
- its round tip is 1.6 semitones from the centre, about 0.77 semitones past
  the dot's side and 0.8 above or below its centre;
- it is 0.36 semitones (0.09 staff spaces) thick, near a stem's 0.13.

A dot a whole step away in its stack is 0.75 semitones from the tail at the
nearest, and the column step takes in the tail's reach (design §13.6), so no
tail can reach into the next stack.

## The judgement

At 4×, on both pages:

- **No tail touches another dot**, in its own stack or the next, in any of the
  six keys, the cautionary signatures at the ends of systems included. Session
  50's steep tail met the next dot; this one passes with room to spare.
- **No tail shows inside a hollow dot.** Each tail starts in the dot's ring,
  and the cut-out is clean in every hollow dot that has one (SN's notes in a
  space, DN's odd notes), C♯ in D and A major among them.
- **No stray marks**: no speck beside any dot, since no symbol carries
  balancing geometry.
- **Where a tail meets a line**, a staff line or a ledger (SN's C, D and F♯
  ledgers, its in-gap ledgers), it crosses it, as session 50's slashes did.
  The tail still reads by its slant.

At 100%:

- The dots read as before, solid or hollow, each apart from its neighbours.
- **The tails are small.** Each reads as a short tick off the dot's left side,
  rising or falling, and its direction can be told in every key, but it is a
  much finer mark than session 50's slash through the dot. That is the price
  of a tail shallow and short enough to clear a whole step's dot (design
  §13.7): one long enough to stand out at 30° would reach the next dot's
  height. The size, angle and offset are each the designer's to change: the
  tail is an ordinary shape, and session 56's editor drags its offset and
  size.

No tail was changed after the first engraving: it met each condition above as
first drawn.

An engine round trip (`cnb/tests/cnb-lilypond-tests.js`, "the Clairnote
gallery files' signatures, dots and tails") holds every dot and tail of both
files in C, D, B♭, A and E♭ major to the canvas within 0.001 staff spaces, by
its box, fill and colour, with every stack's ledgers and the ink; the spacing
round trip (`cnb/tests/cnb-key-signature-tests.js`, "gutter (engine)") holds
SN's spacing before and after its signature within 0.005.
