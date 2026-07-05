# Session 2 verification — round 1

**ISSUES FOUND**

### Issue → Required end-to-end legacy parity check was not completed
**Location** → `cnb/tests/cnb-lilypond-tests.js`, parity section; documented design decision 5.

**Fix** → Add the task-required comparison that:
- exports the default 4-8 config through **both** `legacy/configurator-core.js` and `CNBLilypond.generate(config)`,
- splits/compares the resulting `.ly` **section by section** for semantic equivalence,
- exercises `generate()` end to end, not just `sectionC()`.

The current submission only compares **Section C**, and explicitly states that **Sections A/B parity against legacy is not asserted**. That does not satisfy step 4 as written.

---

### Issue → Invalid duration mappings degrade into wildcard matches
**Location** → `cnb/src/cnb-lilypond.js`, `durationLyNumber()` + `sectionC()`:

```js
const lyNum = durationLyNumber(config, duration);
const durCond = lyNum !== null ? `(= duration ${lyNum})` : "#t";
```

**Fix** → Do not emit `#t` for an unknown LilyPond duration number. Instead:
- fail validation before generation, or
- throw from `sectionC()` / `generate()` when a referenced duration lacks a valid `lilypondDuration`.

As written, a duration-varying clause with a missing duration number becomes:

```scheme
(and <pc-cond> #t)
```

which is effectively duration-insensitive and can produce incorrect Section C behavior.

---

### Not defects
- Explicitly emitting `(repeat . #t/#f)` on every clause is acceptable.
- Grouping duration-uniform PCs into `memv` clauses and using compound `(and ...)` clauses for duration-varying PCs is aligned with the task.
- The legacy-style fallback with `(hollow . #f)` is not, by itself, a defect.
