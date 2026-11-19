# Brief: a repeated minim's stem on one of its noteheads

**For:** engine session 43, "A repeated minim's stem on one of its
noteheads" (`lilypond-chromatic-notation-base`), released as engine 1.9.0
by its session 44.
**From:** Configurator session 72, 2026-11-15.
**Mock-up:** [`repeat-minim-stem-mockups/`](repeat-minim-stem-mockups/)
(`shots/stems.png`).

**This brief was written after the engine session.** Session 72 was to
write it before engine session 43 ran, but by the operator's decision of
2026-11-14 the engine session ran first, naming the setting itself. Its
handoff, `docs/session-sets/043-repeat-minim-stem/configurator-handoff.md`
in the engine repository, is the engine-contract record. This brief records
the rule as the operator confirmed it from the mock-up, so the two
repositories say the same thing, and names the figures session 73's round
trip holds the preview to.

## The rule

In repeat mode a minim is two copies of its notehead. Its stem attaches to
**one head of the group, as a single head's stem does**: the **last** head
when the stem is up, the **first** when it is down. A **centred** stem
follows the same rule, standing on the chosen head's centre; no side is
chosen once (operator, 2026-11-14, confirmed from the mock-up 2026-11-15).
Before it, the attachment point was read across the whole group, so a
centred stem stood in the notch where the two heads meet, in the air
(session 69, rough edge 1).

The point used is the shape's minim point, as before; only where it lands
changes. The stem attaches at the same place on a notehead however the
minim is drawn (operator, 2026-11-15), so a shape's minim point is not set
to suit the group: the Kite 4-369 fixture's minim points, 0.73 semitones
off centre for the old placement, become its centred crotchet points.

Unchanged: crotchets, a single head (shape mode), the stem's length,
thickness and far end, the copies' overlap; semibreves and longer have no
stem.

## The setting

```lilypond
#(set! cnb:multinote-stem-on-head #t)
```

A boolean, default `#f` (the attachment across the group, as in engine
1.8.0). The Configurator writes it in Section B, after
`cnb:multinote-overlap`, whenever `durations.representationMode` is
`"repeat"`, and never in shape mode. **It needs engine 1.9.0**: on an
earlier engine the variable is unbound and LilyPond stops.

## The formula

The two copies are s apart, s = (1 − overlap) × w, w one head's width (or
w + `cnb:multinote-padding` when the overlap is `#f`), so the group is
s + w wide. The head's attachment point (x . y), relative to the head (±1
its edges), is placed on head k (k = 1, the last, stem up; k = 0, the
first, stem down) and handed to LilyPond relative to the group:

    x' = (2ks + w(1 + x)) / (s + w) − 1,    y' = y

A point at the head's outer edge stays at the group's (x = 1 up and
x = −1 down give x' = x), so a side stem lands where it did. For a
centred point the engine also cancels LilyPond's half-stem move toward the
head, so the minim's centred stem is centred on its head as the
crotchet's is.

The preview draws the same: `CNBStem.geometry` places the stem as a single
head's, centred on its anchor, on the chosen head's centre in the card's
repeated layout (`CNBCard.repeatLayout`'s offsets).

## The figures to measure

Each repeated minim's stem, up and down, at an overlap of 1/3, in staff
spaces from the first head's centre (x) and the head's centre line (y),
measured by engine session 43 on LilyPond 2.24.2 and 2.26.0 alike (its
handoff §2). Each minim's ends are its crotchet's.

| Notation | Stem | x | Ends y |
|---|---|---|---|
| Default notehead, 4 semitones a staff space, side points `(±1 . ±0.3157)` | up, last head | 0.8759 .. 1.0059 | 0.1075 .. 3.3333 |
| | down, first head | −0.4311 .. −0.3011 | −3.3333 .. −0.1075 |
| Kite 4-369, 3 semitones a staff space, centred minim points `(0 . ±0.9)` | up, last head | 0.8240 .. 0.9540 | 0.6001 .. 3.5 |
| | down, first head | −0.0650 .. 0.0650 | −3.5 .. −0.6001 |
| The tutorial's diamonds, 2 semitones a staff space, `(±0.0867 . ±0.9259)` | up, last head | 0.9351 .. 1.0651 | 0.4630 .. 3.5 |
| | down, first head | −0.0650 .. 0.0650 | −3.5 .. −0.4630 |

**Session 73** runs the engine round trip against engine 1.9.0: every
card's stem, crotchet and minim, up and down, in repeat mode, within 0.001
staff spaces of the preview, for the default notehead, Kite 4-369 and the
tutorial's diamonds.
