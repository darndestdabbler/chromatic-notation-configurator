# Session 50 — the Clairnote signatures at concert size

## How the pages were made

`clairnote-sn-concert.ly` and `clairnote-dn-concert.ly` are each gallery
file's export (`CNBLilypond.generate` on
`cnb/assets/examples/gallery/clairnote-{sn,dn}.json`, loaded as the app loads
it), followed by a short score: two bars in each of C major, D and A major
(sharp keys) and F, E♭ and B♭ major (flat keys), every one a key change, over
three systems. The staff is LilyPond's default 20-point staff, which the engine
magnifies by the export's own `cnb:default-magnify` (7/4), as it does every
staff. Each page was engraved with LilyPond 2.24 and the engine (1.4.1) at
print resolution:

```
lilypond --png -dresolution=300 -I <engine repository> clairnote-sn-concert.ly
```

The PNGs (`clairnote-sn-concert.png`, `clairnote-dn-concert.png`, A4 at
300 dpi) were judged at 100%, one image pixel to one screen pixel, and again
at 4× to see each symbol's edges.

## The signatures

Each file's signature is Clairnote-style (design §4.1, §4.4): dots, a new
stack at each change of odd and even, the stacks going left in sharp keys, no
upper tonic, no gold stem, on the bottom line set. The dots follow the
noteheads' fill, solid in SN and alternating solid and hollow in DN.

## What the first engraving showed, and what changed

The first symbols were a dot with a one-sided tail, rising into it from the
lower left for a sharp and falling into it from the upper left for a flat, at
55°. At concert size:

- **Each tail met the next dot.** A stack holds whole steps, two semitones
  apart, and a 1.6-semitone dot leaves 0.4 semitones between neighbours. The
  steep tail ran into the dot below (above, for a flat), so the two read as
  one shape.
- **The balancing points showed.** The engine centres a mark's box on its
  stack, the canvas its origin, so each one-sided symbol carried an invisible
  sliver opposite its tail to centre its box on the dot. LilyPond strokes
  every path, if only 0.0001 staff spaces wide, so each sliver engraved as a
  faint pixel beside its dot, and any hidden geometry would.

At the operator's choice the symbols became a **dot with a slash through it**:
rising (/) for a sharp, falling (\\) for a flat, at 45°, 0.4 semitones thick
(0.1 staff spaces, near a stem's 0.13) and reaching 0.7 semitones past the dot
on each side. The slash is symmetric about the dot, so its box is centred on
the dot with no hidden geometry, and the engine and the canvas both put the
dot on its stack. At 45° it passes the dots a whole step above and below with
0.4 semitones to spare. Each half of the slash starts in the dot's solid ring,
so it never shows through a hollow dot's cut-out.

The engraving also showed that the engine sizes each signature ledger from its
own head's width, so a plain dot's ledger is shorter than a slashed dot's.
The canvas had drawn every ledger at the widest mark's width. It now draws
each head's ledgers at that head's own width and spaces the signature by its
true ink, as the engine does (`cnb/src/cnb-key-signature.js`). The sized
fixture and the Hass and Trilinear gallery files, whose ledgered heads are
narrower than their widest mark, now draw the ledger lengths they engrave.
A check against the engine gave 1.2 and 1.35 staff spaces for the sized
fixture in D major, where every ledger had been drawn at 1.35.

## The judgement

At 100% on both pages:

- **The dots read.** They are 0.4 staff spaces across, solid or hollow, and
  each stands apart from its neighbours in a stack.
- **The slashes read**, in every sharp and flat key, as a stroke through the
  dot, and their direction is plain: rising for a sharp, falling for a flat.
  No slash touches the next dot in its stack or in the next stack.
- **No stray marks**: no speck beside any dot, and no slash shows inside a
  hollow dot.
- **Where SN's ledgers are many**, as in its C and B♭ major signatures, a slash
  crosses a ledger and the stack is busier, but the slash still reads by its
  slant. DN's stacks carry fewer ledgers and are the clearer of the two.

An engine round trip (`cnb/tests/cnb-lilypond-tests.js`, "the Clairnote
gallery files' dot signatures") holds every engraved mark's full extent,
fill and colour, every stack's ledgers and the signature's ink to the canvas
within 0.001 staff spaces, in C, D, B♭, A and E♭ major, for both files.
