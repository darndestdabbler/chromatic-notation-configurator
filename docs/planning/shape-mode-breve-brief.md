# Brief: the breve in shape mode, a double notehead or two tied semibreves

**For:** the engine session after Configurator session 74
(`lilypond-chromatic-notation-base`), released as an engine **minor**
version (1.10.0, after 1.9.0).
**From:** Configurator session 74, 2026-11-17.
**Design:** [`notehead-duration-design.md`](notehead-duration-design.md)
(B.i, §1 and §6.3). **Mock-up:**
[`notehead-duration-mockups/`](notehead-duration-mockups/)
(`shots/breves.png`).
**Then:** Configurator session 76 draws and exports it, and holds every
card's breve to the engraving.

## Why

The Configurator's Noteheads step gains three designs (the design §1). In
one, B.i (*hollows*), the designer's own notehead shows duration by fill:
a crotchet is the head solid with a stem, a minim the head hollow with a
stem, a semibreve the head hollow without one, all in **shape mode**
(`(repeat . #f)`, one head a note). For the breve the designer chooses:

- **a double notehead**: two copies of the hollow head side by side,
  overlapping as a repeated minim's two heads do; or
- **two tied semibreves**: two hollow heads 1 staff space apart, tied
  below them from the middle of the first to the middle of the second, as
  engine 1.7.0 ties a repeat-mode breve's two groups.

Today, in shape mode, the engine draws a breve as one head, so neither
reaches the engraving.

## The setting

```lilypond
#(set! cnb:breve-style 'tied)     % or 'double
```

A symbol, **`'single` by default**: one head, exactly as engine 1.9.0
draws a shape-mode breve, so every existing export engraves as before.

- **Read only for a breve (duration category 0) whose resolved notehead
  has `(repeat . #f)`.** In repeat mode a breve stays two tied groups of
  four (engine 1.3.0 to 1.7.0), whatever the setting.
- **`'double`**: two copies of the notehead's stencil (its cutout and colour
  included), the second starting (1 − overlap) × w after the first, w one
  head's width, the overlap `cnb:multinote-overlap` (or, when that is `#f`,
  the copies `w + cnb:multinote-padding` apart, as repeat mode spaces
  them). No tie. The Configurator writes `cnb:multinote-overlap` with
  `'double`.
- **`'tied`**: two copies of the stencil, the second's left edge 1 staff
  space after the first's right edge, and one tie, LilyPond's
  `(make-tie-stencil (cons xa y0) (cons xb y0) 0.12 DOWN)`, xa and xb the
  two heads' centres, y0 the heads' bottom (the stencil's lower Y edge),
  black, as the repeat-mode breve's tie is (engine 1.3.1, 1.7.0).
- **The breve stays one note**: one NoteHead grob, the setting changing
  only its stencil, as the repeat-mode breve's does. Dots, spacing,
  ledgers (each head's `cnb:ledgers-by-semitone` entry, 1.5 times the
  whole width, as LilyPond sizes them from the stencil) and the per-pitch
  fields behave as for any notehead.
- **A shape's reference point** (configurator LY spec §4.1e, the `-ref`
  registrations) moves both heads; the tie runs below the moved heads, as
  in repeat mode.
- **Unchanged:** every duration but the breve, repeat mode, the longa and
  maxima (the Configurator has neither), stems (a breve has none).
- **Validation:** an unknown symbol is an error naming the variable, as the
  engine's other style settings do.

The Configurator writes the setting in Section B among the engine
settings, when `durations.breveStyle` is `"double"` or `"tied"` and the
mode is shape, and never otherwise (LY spec 1.3.24, session 76). **It needs
this release**: on engine 1.9.0 the variable is unbound and LilyPond stops.

## The figures to measure

The preview lays the breve out with `CNBCard.repeatLayout` and draws the
tie with `CNBCard.tiePath`; the figures below are what it gives, in staff
spaces, the x from the breve's centre and the y from the pitch, at an
overlap of 1/3. The engine session measures the engraved breve against
them on LilyPond 2.24.2 and 2.26.0, records what it measures in its
handoff, and says where the two differ (as each engraved head is about
0.0002 staff spaces wider than the preview's, since the export writes path
coordinates to 4 places).

| Notation | Head w × h | `'double` width, heads' centres | `'tied` width, tie's ends x, ends y | Tie's bow, lowest ink | `'tied` height, top of the heads to the tie's ink |
|---|---|---|---|---|---|
| Default notehead (`crotchet-minim`), 4 semitones a staff space | 0.8621 × 0.681 | 1.4369, ±0.2874 | 2.7243, ±0.9311, −0.3405 | 0.4887, −0.8792 | 1.2197 |
| The tutorial's diamond, 2 semitones a staff space | 1.5 × 1 | 2.5, ±0.5 | 4, ±1.25, −0.5 | 0.5816, −1.1316 | 1.6316 |

Measure also, for each notation, both styles:

- each head's box, fill (the cutout) and colour, with the tutorial's red on
  an accidental (C♯) and black elsewhere, and the tie black on both;
- the ledgers of a breve on a ledger (C and D on the default 4-8 staff; B
  and C♯ on the tutorial's 3-5-7-9), their positions as
  `cnb:ledgers-by-semitone` gives them and their length 1.5 times the whole
  width;
- a dotted breve's dot, placed after the whole stencil;
- that `'single`, and either style in repeat mode, engrave byte for byte as
  engine 1.9.0 does (the engine's golden files unchanged).

**Session 76** then runs the round trip from this repository
(`cnb/tests/cnb-card-tests.js`, through `cnb/tests/engine-probe.js`):
every card's breve, double and tied, its heads, width, height and tie, on
the default notehead and the tutorial's diamond, within 0.001 staff spaces
of the preview, and again at an overlap of 0.25.
