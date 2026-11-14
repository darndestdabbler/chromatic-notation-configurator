/**
 * engine-probe.js — shared helper for the engine-backed tests: find
 * LilyPond and the CNB engine, and measure what the engine engraves.
 *
 * Engine-backed tests skip (with the reason logged) when lilypond is not on
 * PATH or the engine repository is not found — beside this repository as
 * lilypond-chromatic-notation-base, or wherever CNB_ENGINE_DIR points.
 */

import { execFile, spawnSync } from "child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const CNB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The LilyPond binary and engine directory for an engine-backed test, or { skip }. */
export function findEngine() {
  const probe = spawnSync("lilypond", ["--version"], { timeout: 60000, windowsHide: true });
  if (probe.error || probe.status !== 0) return { skip: "lilypond is not on PATH" };
  const dir = process.env.CNB_ENGINE_DIR || path.resolve(CNB_DIR, "..", "..", "lilypond-chromatic-notation-base");
  if (!existsSync(path.join(dir, "ChromaticNotationBase.ly"))) {
    return { skip: `engine not found at ${dir} (set CNB_ENGINE_DIR)` };
  }
  return { lilypond: "lilypond", dir };
}

// One chromatic octave of notes (quarter notes unless a duration is given;
// in repeat mode a longer note's stencil is the engine's repeated heads);
// each NoteHead prints its pitch
// class and its stencil's X and Y extents once laid out, in its own staff's
// staff spaces. The engine magnifies every staff by cnb:default-magnify
// (engine cnb/score-defaults.ly, its session 18), since engine 1.5.0 the
// value the exported config sets, as each staff is created (engine session
// 35), which scales the staff space and the notehead alike; dividing by the
// staff space measures the size relative to the staff, the unit the preview
// is drawn in.
const probeScore = (duration) => `\\version "2.24.2"
\\include "config.ly"
{
  \\override NoteHead.after-line-breaking = #(lambda (grob)
    (let ((stil (ly:grob-property grob 'stencil))
          (pitch (ly:event-property (event-cause grob) 'pitch))
          (space (ly:staff-symbol-staff-space grob)))
      (format #t "CNB-NOTEHEAD ~a ~a ~a\\n"
        (modulo (ly:pitch-semitones pitch) 12)
        (/ (interval-length (ly:stencil-extent stil X)) space)
        (/ (interval-length (ly:stencil-extent stil Y)) space))))
  ${["c'", "cis'", "d'", "dis'", "e'", "f'", "fis'", "g'", "gis'", "a'", "ais'", "b'"]
    .map(p => p + duration).join(" ")}
}
`;

/**
 * Compile an exported config (.ly text) with the engine under a score of
 * the twelve pitch classes (quarter notes by default), and return each engraved
 * notehead's size: { noteheads: [{ pc, width, height }] } in staff spaces,
 * or { error } with LilyPond's output when it fails or prints no notehead.
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @param {string} [duration="4"]  LilyPond duration token for every note
 *        ("2", "1", "\breve", …)
 * @returns {Promise<{noteheads?:{pc:number,width:number,height:number}[], error?:string}>}
 */
export function measureNoteheads(engine, ly, duration = "4") {
  return compile(engine, ly, probeScore(duration)).then(({ error, output }) => {
    const noteheads = [...output.matchAll(/^CNB-NOTEHEAD (\d+) (\S+) (\S+)$/gm)]
      .map(([, pc, w, h]) => ({ pc: Number(pc), width: Number(w), height: Number(h) }));
    if (error || noteheads.length === 0) {
      return { error: `${error ? error.message : "no notehead was measured"}\n${output}` };
    }
    return { noteheads };
  });
}

// One chromatic octave of breves (session 46). In repeat mode the engine's
// breve stencil holds its tie (engine 1.3.1, cnb:build-duration-stencil) as
// the one path not inside a color form: the heads are coloured, the tie is
// not. Each NoteHead prints its pitch class, the tie's two end points (the
// path's moveto and its first curveto's end, through the stencil's scale and
// translations) and the stencil's X and Y extents, in staff spaces, x from
// the grob's reference point (the first head's) and y from the head's
// centre line.
const tieScore = `\\version "2.24.2"
\\include "config.ly"
#(define (cnb-probe:ties e sx sy dx dy)
   (cond ((not (pair? e)) '())
         ((eq? (car e) 'color) '())
         ((eq? (car e) 'scale-stencil)
          (cnb-probe:ties (caddr e) (* sx (car (cadr e))) (* sy (cadr (cadr e))) dx dy))
         ((eq? (car e) 'translate-stencil)
          (cnb-probe:ties (caddr e) sx sy (+ dx (* sx (car (cadr e)))) (+ dy (* sy (cdr (cadr e))))))
         ((eq? (car e) 'combine-stencil)
          (append-map (lambda (x) (cnb-probe:ties x sx sy dx dy)) (cdr e)))
         ((eq? (car e) 'path)
          (let ((c (caddr e)))
            (list (map (lambda (v s d) (+ d (* s v)))
                       (list (list-ref c 1) (list-ref c 2) (list-ref c 8) (list-ref c 9))
                       (list sx sy sx sy) (list dx dy dx dy)))))
         (else '())))
{
  \\override NoteHead.after-line-breaking = #(lambda (grob)
    (let* ((stil (ly:grob-property grob 'stencil))
           (pitch (ly:event-property (event-cause grob) 'pitch))
           (space (ly:staff-symbol-staff-space grob))
           (ties (cnb-probe:ties (ly:stencil-expr stil) 1 1 0 0))
           (x (ly:stencil-extent stil X))
           (y (ly:stencil-extent stil Y)))
      (if (= (length ties) 1)
          (format #t "CNB-TIE ~a ~{~a ~}~a ~a ~a ~a\\n"
            (modulo (ly:pitch-semitones pitch) 12)
            (map (lambda (v) (/ v space)) (car ties))
            (/ (car x) space) (/ (cdr x) space) (/ (car y) space) (/ (cdr y) space)))))
  ${["c'", "cis'", "d'", "dis'", "e'", "f'", "fis'", "g'", "gis'", "a'", "ais'", "b'"]
    .map(p => p + "\\breve").join(" ")}
}
`;

/**
 * Compile an exported config (.ly text) in repeat mode with the engine
 * under a score of the twelve pitch classes as breves, and return each
 * engraved breve's tie (session 46): { ties: [{ pc, start, end, x, y }] },
 * start and end the tie's end points as [x, y], x and y the whole stencil's
 * extents as [min, max], in staff spaces (x from the first head's reference
 * point, y up from the head's centre line), or { error } with LilyPond's
 * output when it fails or prints no tie.
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @returns {Promise<{ties?:{pc:number, start:number[], end:number[], x:number[], y:number[]}[], error?:string}>}
 */
export function measureTies(engine, ly) {
  return compile(engine, ly, tieScore).then(({ error, output }) => {
    const ties = [...output.matchAll(/^CNB-TIE (\d+)((?: \S+){8})$/gm)].map(([, pc, rest]) => {
      const n = rest.trim().split(" ").map(schemeNumber);
      return { pc: Number(pc), start: [n[0], n[1]], end: [n[2], n[3]], x: [n[4], n[5]], y: [n[6], n[7]] };
    });
    if (error || ties.length === 0) {
      return { error: `${error ? error.message : "no tie was measured"}\n${output}` };
    }
    return { ties };
  });
}

// The same octave of quarter notes; each NoteHead prints its pitch class and
// its staff-position (half-staff-spaces from the middle line), and the staff
// prints its line-positions.
const positionScore = `\\version "2.24.2"
\\include "config.ly"
{
  \\override Staff.StaffSymbol.after-line-breaking = #(lambda (grob)
    (format #t "CNB-LINES ~a\\n" (ly:grob-property grob 'line-positions)))
  \\override NoteHead.after-line-breaking = #(lambda (grob)
    (let ((pitch (ly:event-property (event-cause grob) 'pitch)))
      (format #t "CNB-POSITION ~a ~a\\n"
        (modulo (ly:pitch-semitones pitch) 12)
        (ly:grob-property grob 'staff-position))))
  ${["c'", "cis'", "d'", "dis'", "e'", "f'", "fis'", "g'", "gis'", "a'", "ais'", "b'"]
    .map(p => p + "4").join(" ")}
}
`;

/** A Scheme number as printed: an integer, a decimal or an exact ratio "a/b". */
function schemeNumber(text) {
  const [n, d] = text.split("/");
  return d === undefined ? Number(n) : Number(n) / Number(d);
}

/**
 * Compile an exported config (.ly text) under the twelve-pitch-class score
 * and return where the engine puts each notehead and staff line:
 * { noteheads: [{ pc, position }], lines: number[] } in half-staff-spaces
 * from the middle of the staff (LilyPond staff positions), or { error } with
 * LilyPond's output when it fails or prints no notehead or staff.
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @returns {Promise<{noteheads?:{pc:number,position:number}[], lines?:number[], error?:string}>}
 */
export function measureStaffPositions(engine, ly) {
  return compile(engine, ly, positionScore).then(({ error, output }) => {
    const noteheads = [...output.matchAll(/^CNB-POSITION (\d+) (\S+)$/gm)]
      .map(([, pc, pos]) => ({ pc: Number(pc), position: schemeNumber(pos) }));
    const staff = output.match(/^CNB-LINES \((.*)\)$/m);
    if (error || noteheads.length === 0 || !staff) {
      return { error: `${error ? error.message : "no notehead or staff was measured"}\n${output}` };
    }
    return { noteheads, lines: staff[1].trim().split(/\s+/).map(schemeNumber) };
  });
}

/**
 * Whether a printed notehead stencil expression carries a hollow cutout.
 * The engine draws one of two ways (cnb/stencils.ly): a false hollow is a
 * white path laid over the shape, a true hollow one path whose command list
 * holds the shape and the cutout as two subpaths.
 */
function stencilIsHollow(expr) {
  if (/\(color \(1\.0 1\.0 1\.0\)/.test(expr)) return true;
  return [...expr.matchAll(/\(path \S+ \(([^()]*)\)/g)]
    .some(([, commands]) => (commands.match(/\bmoveto\b/g) || []).length > 1);
}

/** A printed stencil expression's first colour, "(color (r g b) …", as "#rrggbb", or null. */
function stencilColor(expr) {
  const m = expr.match(/\(color \((\S+) (\S+) (\S+)\)/);
  return m ? "#" + m.slice(1).map(c => Math.round(Number(c) * 255).toString(16).padStart(2, "0")).join("") : null;
}

/**
 * Compile an exported config (.ly text) under a score of the given music
 * (e.g. "c'4 c'2") and report each engraved notehead in order:
 * { noteheads: [{ pc, durationLog, hollow, color }] }, where durationLog is
 * LilyPond's (2 = quarter, 1 = half, 0 = whole), hollow says whether its
 * stencil carries the hollow cutout and color is the stencil's first colour
 * as "#rrggbb" (null when it has none); or { error } with LilyPond's output
 * when it fails or prints no notehead.
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @param {string} music  LilyPond music for the score's one staff
 * @returns {Promise<{noteheads?:{pc:number,durationLog:number,hollow:boolean,color:string|null}[], error?:string}>}
 */
export function engraveNoteheads(engine, ly, music) {
  const score = `\\version "2.24.2"
\\include "config.ly"
{
  \\override NoteHead.after-line-breaking = #(lambda (grob)
    (let ((cause (event-cause grob)))
      (format #t "CNB-HEAD ~a ~a ~s\\n"
        (modulo (ly:pitch-semitones (ly:event-property cause 'pitch)) 12)
        (ly:duration-log (ly:event-property cause 'duration))
        (ly:stencil-expr (ly:grob-property grob 'stencil)))))
  ${music}
}
`;
  return compile(engine, ly, score).then(({ error, output }) => {
    const noteheads = [...output.matchAll(/^CNB-HEAD (\d+) (-?\d+) (.*)$/gm)]
      .map(([, pc, log, expr]) => ({ pc: Number(pc), durationLog: Number(log), hollow: stencilIsHollow(expr), color: stencilColor(expr) }));
    if (error || noteheads.length === 0) {
      return { error: `${error ? error.message : "no notehead was measured"}\n${output}` };
    }
    return { noteheads };
  });
}

/**
 * Compile an exported config (.ly text) under a score of the given music
 * (e.g. "\\stemUp c'2") and report each engraved stem in order:
 * { stems: [{ durationLog, direction, x, width, bottom, top }] }, where x is
 * the stem's centre minus the centre of its first notehead's stencil (in
 * repeat mode the whole repeated group), width the stem's, and bottom and
 * top its ends above the staff's middle line, all in staff spaces;
 * direction is 1 (up) or -1 (down). Or { error } with LilyPond's output
 * when it fails or prints no stem.
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @param {string} music  LilyPond music for the score's one staff
 * @returns {Promise<{stems?:{durationLog:number,direction:number,x:number,width:number,bottom:number,top:number}[], error?:string}>}
 */
export function measureStems(engine, ly, music) {
  const score = `\\version "2.24.2"
\\include "config.ly"
{
  \\override Stem.after-line-breaking = #(lambda (stem)
    (let* ((head (ly:grob-array-ref (ly:grob-object stem 'note-heads) 0))
           (common (ly:grob-common-refpoint stem head X))
           (s (ly:grob-extent stem common X))
           (h (ly:grob-extent head common X))
           (staff (ly:grob-object stem 'staff-symbol))
           (common-y (ly:grob-common-refpoint stem staff Y))
           (y (ly:grob-extent stem common-y Y))
           (middle (ly:grob-relative-coordinate staff common-y Y))
           (space (ly:staff-symbol-staff-space stem)))
      (format #t "CNB-STEM ~a ~a ~a ~a ~a ~a\\n"
        (ly:duration-log (ly:event-property (event-cause head) 'duration))
        (ly:grob-property stem 'direction)
        (exact->inexact (/ (- (interval-center s) (interval-center h)) space))
        (exact->inexact (/ (interval-length s) space))
        (exact->inexact (/ (- (car y) middle) space))
        (exact->inexact (/ (- (cdr y) middle) space)))))
  ${music}
}
`;
  return compile(engine, ly, score).then(({ error, output }) => {
    const stems = [...output.matchAll(/^CNB-STEM (-?\d+) (-?\d+) (\S+) (\S+) (\S+) (\S+)$/gm)]
      .map(([, log, dir, x, w, bottom, top]) => ({
        durationLog: Number(log), direction: Number(dir), x: Number(x), width: Number(w),
        bottom: Number(bottom), top: Number(top),
      }));
    if (error || stems.length === 0) {
      return { error: `${error ? error.message : "no stem was measured"}\n${output}` };
    }
    return { stems };
  });
}

/**
 * Compile an exported config (.ly text) under a score of the given music
 * (e.g. "<c' c''>4.") and report each engraved notehead's Y extent and each
 * dot's height (session 60): { heads: [{ semitone, durationLog, bottom, top }],
 * dots: [{ y }] }, in staff spaces above the staff's middle line, semitone the
 * engine's (middle C = 0), in engraving order. Or { error } with LilyPond's
 * output when it fails or prints no notehead.
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @param {string} music  LilyPond music for the score's one staff
 * @returns {Promise<{heads?:{semitone:number,durationLog:number,bottom:number,top:number}[], dots?:{y:number}[], error?:string}>}
 */
export function measureHeads(engine, ly, music) {
  const score = `\\version "2.24.2"
\\include "config.ly"
#(define (cnb-probe:above-middle grob)
   (let* ((staff (ly:grob-object grob 'staff-symbol))
          (common (ly:grob-common-refpoint grob staff Y))
          (y (ly:grob-extent grob common Y))
          (middle (ly:grob-relative-coordinate staff common Y))
          (space (ly:staff-symbol-staff-space grob)))
     (cons (exact->inexact (/ (- (car y) middle) space))
           (exact->inexact (/ (- (cdr y) middle) space)))))
{
  \\override NoteHead.after-line-breaking = #(lambda (grob)
    (let ((cause (event-cause grob))
          (y (cnb-probe:above-middle grob)))
      (format #t "CNB-HEAD-Y ~a ~a ~a ~a\\n"
        (ly:pitch-semitones (ly:event-property cause 'pitch))
        (ly:duration-log (ly:event-property cause 'duration))
        (car y) (cdr y))))
  \\override Dots.after-line-breaking = #(lambda (grob)
    (let ((y (cnb-probe:above-middle grob)))
      (format #t "CNB-DOT-Y ~a\\n" (/ (+ (car y) (cdr y)) 2))))
  ${music}
}
`;
  return compile(engine, ly, score).then(({ error, output }) => {
    const heads = [...output.matchAll(/^CNB-HEAD-Y (-?\d+) (-?\d+) (\S+) (\S+)$/gm)]
      .map(([, s, log, bottom, top]) => ({ semitone: Number(s), durationLog: Number(log), bottom: Number(bottom), top: Number(top) }));
    const dots = [...output.matchAll(/^CNB-DOT-Y (\S+)$/gm)].map(([, y]) => ({ y: Number(y) }));
    if (error || heads.length === 0) {
      return { error: `${error ? error.message : "no notehead was measured"}\n${output}` };
    }
    return { heads, dots };
  });
}

/**
 * Compile an exported config (.ly text) under a score of the given music
 * (e.g. "<c' c''>4") and report the engraved staff and ledger lines:
 * { staffLine, ledgers: [{ y, width, thickness }] }, where staffLine is the
 * staff lines' thickness, y each ledger's height above the middle line, and
 * width and thickness its size, all in staff spaces. Or { error } with
 * LilyPond's output when it fails or prints no staff.
 *
 * LilyPond shortens the ledgers of neighbouring notes at one height so they
 * do not touch; a score of one note or chord measures a ledger at full
 * length.
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @param {string} music  LilyPond music for the score's one staff
 * @returns {Promise<{staffLine?:number, ledgers?:{y:number,width:number,thickness:number}[], error?:string}>}
 */
export function measureLines(engine, ly, music) {
  const score = `\\version "2.24.2"
\\include "config.ly"
{
  \\override Staff.StaffSymbol.after-line-breaking = #(lambda (grob)
    (format #t "CNB-STAFF ~a ~a\\n"
      (exact->inexact (ly:staff-symbol-line-thickness grob))
      (exact->inexact (ly:staff-symbol-staff-space grob))))
  \\override Staff.LedgerLineSpanner.after-line-breaking = #(lambda (grob)
    (let ((stil (ly:grob-property grob 'stencil)))
      (if (ly:stencil? stil)
        (format #t "CNB-LEDGERS ~s\\n" (ly:stencil-expr stil)))))
  ${music}
}
`;
  return compile(engine, ly, score).then(({ error, output }) => {
    const staff = output.match(/^CNB-STAFF (\S+) (\S+)$/m);
    if (error || !staff) {
      return { error: `${error ? error.message : "no staff was measured"}\n${output}` };
    }
    const space = Number(staff[2]);
    const expr = (output.match(/^CNB-LEDGERS (.*)$/m) || [, ""])[1];
    // Each ledger: (translate-stencil (0.0 . y) (round-filled-box -left right
    // -bottom top blot)), LilyPond's Lookup::round_filled_box.
    const ledgers = [...expr.matchAll(/\(translate-stencil \(0\.0 \. (\S+)\) \(round-filled-box (\S+) (\S+) (\S+) (\S+) \S+\)\)/g)]
      .map(([, y, l, r, b, t]) => ({
        y: Number(y) / space,
        width: (Number(l) + Number(r)) / space,
        thickness: (Number(b) + Number(t)) / space,
      }));
    return { staffLine: Number(staff[1]) / space, ledgers };
  });
}

/**
 * Compile an exported config (.ly text) under a score of the given music
 * and report, for each note or chord in order, the staff positions of the
 * ledger lines engraved for it: { chords: [{ semitones, ledgers }] }, with
 * semitones the engine's (middle C = 0) and ledgers in half staff spaces
 * from the middle line, sorted. Or { error } with LilyPond's output when it
 * fails or prints no notehead.
 *
 * The score is kept on one system, whose one LedgerLineSpanner draws every
 * ledger; each is matched to the chord whose noteheads it is centred nearest
 * to, so the music should keep its chords apart (rests between them).
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @param {string} music  LilyPond music for the score's one staff
 * @returns {Promise<{chords?:{semitones:number[], ledgers:number[]}[], error?:string}>}
 */
export function measureLedgers(engine, ly, music) {
  const score = `\\version "2.24.2"
\\include "config.ly"
{
  \\override Score.NonMusicalPaperColumn.line-break-permission = ##f
  \\override NoteHead.after-line-breaking = #(lambda (grob)
    (let ((sys (ly:grob-system grob)))
      (format #t "CNB-LHEAD ~a ~a\\n"
        (ly:pitch-semitones (ly:event-property (event-cause grob) 'pitch))
        (exact->inexact (interval-center (ly:grob-extent grob sys X))))))
  \\override Staff.LedgerLineSpanner.after-line-breaking = #(lambda (grob)
    (let ((stil (ly:grob-property grob 'stencil))
          (staff (ly:grob-object grob 'staff-symbol)))
      (if (ly:stencil? stil)
        (format #t "CNB-LSPAN ~a ~a ~s\\n"
          (exact->inexact (ly:grob-relative-coordinate grob (ly:grob-system grob) X))
          (exact->inexact (ly:staff-symbol-staff-space staff))
          (ly:stencil-expr stil)))))
  ${music}
}
`;
  return compile(engine, ly, score).then(({ error, output }) => {
    const heads = [...output.matchAll(/^CNB-LHEAD (-?\d+) (\S+)$/gm)]
      .map(([, semi, x]) => ({ semi: Number(semi), x: Number(x) }));
    if (error || heads.length === 0) {
      return { error: `${error ? error.message : "no notehead was measured"}\n${output}` };
    }
    // Chords: heads at one x (to 0.01 staff space), in order of x.
    const chords = [];
    for (const h of [...heads].sort((a, b) => a.x - b.x)) {
      const last = chords[chords.length - 1];
      if (last && Math.abs(last.x - h.x) < 0.05) last.semitones.push(h.semi);
      else chords.push({ x: h.x, semitones: [h.semi], ledgers: [] });
    }
    const span = output.match(/^CNB-LSPAN (\S+) (\S+) (.*)$/m);
    if (span) {
      const [, spanX, space, expr] = span;
      // (translate-stencil (dx . 0.0) …(translate-stencil (0.0 . y)
      // (round-filled-box -left right -bottom top blot))…).
      const dx = Number((expr.match(/^\(translate-stencil \((\S+) \. \S+\)/) || [, 0])[1]);
      for (const [, y, l, r] of expr.matchAll(/\(translate-stencil \(0\.0 \. (\S+)\) \(round-filled-box (\S+) (\S+) \S+ \S+ \S+\)\)/g)) {
        const x = Number(spanX) + dx + (Number(r) - Number(l)) / 2;
        const nearest = chords.reduce((a, c) => (Math.abs(c.x - x) < Math.abs(a.x - x) ? c : a));
        nearest.ledgers.push(Math.round(2 * Number(y) / Number(space) * 1e4) / 1e4);
      }
    }
    return {
      chords: chords.map(c => ({ semitones: c.semitones.sort((a, b) => a - b), ledgers: [...new Set(c.ledgers)].sort((a, b) => a - b) })),
    };
  });
}

/**
 * Compile an exported config (.ly text) under a score of the given music
 * (e.g. "\\key g \\major c'4") and report where the staff starts and the
 * clef, the key signature and the first notehead lie across it:
 * { staffStart, clef, keySignature, firstNote }, each but staffStart a
 * { left, right } extent (null when not engraved), all in staff spaces
 * along the system. Or { error } with LilyPond's output when it fails.
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @param {string} music  LilyPond music for the score's one staff
 * @returns {Promise<{staffStart?:number, clef?:{left:number,right:number}|null,
 *   keySignature?:{left:number,right:number}|null, firstNote?:{left:number,right:number}|null, error?:string}>}
 */
export function measureSpacing(engine, ly, music) {
  const report = (grob, tag) => `\\override ${grob}.after-line-breaking = #(lambda (g)
    (let* ((sys (ly:grob-system g)) (x (ly:grob-extent g sys X)) (space (ly:staff-symbol-staff-space g)))
      (if (< (car x) (cdr x))
        (format #t "CNB-X ${tag} ~a ~a\\n" (exact->inexact (/ (car x) space)) (exact->inexact (/ (cdr x) space))))))`;
  const score = `\\version "2.24.2"
\\include "config.ly"
{
  ${report("Staff.StaffSymbol", "staff")}
  ${report("Staff.Clef", "clef")}
  ${report("Staff.KeySignature", "keysig")}
  ${report("NoteHead", "head")}
  ${music}
}
`;
  return compile(engine, ly, score).then(({ error, output }) => {
    if (error) return { error: `${error.message}\n${output}` };
    const found = {};
    for (const [, tag, l, r] of output.matchAll(/^CNB-X (\w+) (\S+) (\S+)$/gm)) {
      const e = { left: Number(l), right: Number(r) };
      if (!found[tag] || e.left < found[tag].left) found[tag] = e;   // the first notehead is the leftmost
    }
    if (!found.staff) return { error: `no staff was measured\n${output}` };
    return { staffStart: found.staff.left, clef: found.clef || null, keySignature: found.keysig || null, firstNote: found.head || null };
  });
}

/**
 * Compile an exported config (.ly text) under a one-note score and report
 * the engraved clef: { clef: { top, bottom } } in half-staff-spaces from the
 * middle line (LilyPond staff positions), or { clef: null } when the engine
 * engraved no clef stencil, or { error } with LilyPond's output when it
 * fails.
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @returns {Promise<{clef?:{top:number,bottom:number}|null, error?:string}>}
 */
export function measureClef(engine, ly) {
  const score = `\\version "2.24.2"
\\include "config.ly"
{
  \\override Staff.Clef.after-line-breaking = #(lambda (grob)
    (if (ly:stencil? (ly:grob-property grob 'stencil))
      (let* ((staff (ly:grob-object grob 'staff-symbol))
             (common (ly:grob-common-refpoint grob staff Y))
             (y (ly:grob-extent grob common Y))
             (middle (ly:grob-relative-coordinate staff common Y))
             (space (ly:staff-symbol-staff-space grob)))
        (format #t "CNB-CLEF ~a ~a\\n"
          (exact->inexact (/ (* 2 (- (cdr y) middle)) space))
          (exact->inexact (/ (* 2 (- (car y) middle)) space))))))
  c'4
}
`;
  return compile(engine, ly, score).then(({ error, output }) => {
    if (error) return { error: `${error.message}\n${output}` };
    const m = output.match(/^CNB-CLEF (\S+) (\S+)$/m);
    return { clef: m ? { top: Number(m[1]), bottom: Number(m[2]) } : null };
  });
}

/**
 * Compile an exported config (.ly text) under a one-note score in the given
 * key (e.g. "g \\major") and report the engraved key signature:
 * { keySignature: { top, bottom, bar } }, top and bottom in
 * half-staff-spaces from the middle line, and bar the separator, the
 * stencil's first line (the engine draws it beneath the marks), as
 * { color: [r, g, b] (0–1), thickness } with thickness in staff spaces;
 * { keySignature: null } when the engine engraved none; or { error } with
 * LilyPond's output when it fails.
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @param {string} key  LilyPond key, e.g. "g \\major"
 * @returns {Promise<{keySignature?:{top:number,bottom:number,bar:{color:number[],thickness:number}|null}|null, error?:string}>}
 */
export function measureKeySignature(engine, ly, key) {
  const score = `\\version "2.24.2"
\\include "config.ly"
{
  \\override Staff.KeySignature.after-line-breaking = #(lambda (grob)
    (let ((stil (ly:grob-property grob 'stencil)))
      (if (and (ly:stencil? stil) (not (ly:stencil-empty? stil)))
        (let* ((staff (ly:grob-object grob 'staff-symbol))
               (common (ly:grob-common-refpoint grob staff Y))
               (y (ly:grob-extent grob common Y))
               (middle (ly:grob-relative-coordinate staff common Y))
               (space (ly:staff-symbol-staff-space grob)))
          (format #t "CNB-KEYSIG ~a ~a ~a\\n"
            (exact->inexact (/ (* 2 (- (cdr y) middle)) space))
            (exact->inexact (/ (* 2 (- (car y) middle)) space))
            (exact->inexact space))
          (format #t "CNB-KEYSIG-EXPR ~s\\n" (ly:stencil-expr stil))))))
  \\key ${key} c'4
}
`;
  return compile(engine, ly, score).then(({ error, output }) => {
    if (error) return { error: `${error.message}\n${output}` };
    const m = output.match(/^CNB-KEYSIG (\S+) (\S+) (\S+)$/m);
    if (!m) return { keySignature: null };
    const expr = (output.match(/^CNB-KEYSIG-EXPR (.*)$/m) || [, ""])[1];
    const space = Number(m[3]);
    // The bar: (scale-stencil (s s) (color (r g b) (translate-stencil (…)
    // (draw-line thickness x1 y1 x2 y2)))), its thickness scaled by s.
    const b = expr.match(/\(scale-stencil \((\S+) \S+\) \(color \((\S+) (\S+) (\S+)\) \(translate-stencil \([^)]*\) \(draw-line (\S+)/);
    const bar = b && { color: [b[2], b[3], b[4]].map(Number), thickness: Number(b[5]) * Number(b[1]) / space };
    return { keySignature: { top: Number(m[1]), bottom: Number(m[2]), bar } };
  });
}

/**
 * Compile an exported config (.ly text) under a score of the given music
 * (e.g. "\\key g \\major c'1 \\key bes \\major c'1") and read each engraved
 * key signature's stencil, in order, under the engine's 'marks style
 * (session 49, engine handoff 030): the stencil expression is walked through
 * its scales and translations, and each path (a head; a true hollow is one
 * path with its cutout as a further subpath, a false hollow a white path
 * over it) reported with its exact extent, as LilyPond measures the path,
 * its subpaths and its colour, and each line (a bar, or a ledger) with its
 * ends, thickness and colour, and each font glyph (a sharp or a flat,
 * session 51) with its name, its origin and its extent as LilyPond measures
 * the glyph, and its colour (session 55: a sign may be coloured since engine
 * 1.6.0). Everything is in the staff's own staff spaces,
 * whatever the magnification, x from the signature's reference point and y
 * from the staff's middle line.
 *
 * Returns { signatures: [{ x: [left, right], paths: [{ x, y, subpaths,
 * color }], lines: [{ x1, y1, x2, y2, thickness, color }], glyphs: [{ name,
 * origin: [x, y], x, y, color }] }], warnings },
 * extents as [min, max], colours as [r, g, b] (0–1), and LilyPond's warnings
 * that name cnb:keysig-marks; or { error } with LilyPond's output when it
 * fails.
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @param {string} music  LilyPond music for the score's one staff
 */
export function measureKeySignatureMarks(engine, ly, music) {
  const score = `\\version "2.24.2"
\\include "config.ly"
#(define (cnb-probe:leaves e sx sy dx dy color)
   (cond ((not (pair? e)) '())
         ((eq? (car e) 'combine-stencil)
          (append-map (lambda (x) (cnb-probe:leaves x sx sy dx dy color)) (cdr e)))
         ((eq? (car e) 'translate-stencil)
          (cnb-probe:leaves (caddr e) sx sy (+ dx (* sx (car (cadr e)))) (+ dy (* sy (cdr (cadr e)))) color))
         ((eq? (car e) 'scale-stencil)
          (cnb-probe:leaves (caddr e) (* sx (car (cadr e))) (* sy (cadr (cadr e))) dx dy color))
         ((eq? (car e) 'color)
          (cnb-probe:leaves (caddr e) sx sy dx dy (cadr e)))
         ((eq? (car e) 'path)
          (let* ((cmds (caddr e))
                 (cmds (if (and (pair? cmds) (eq? (car cmds) 'quote)) (cadr cmds) cmds))
                 (stil (make-path-stencil cmds (cadr e) 1 1 (last e)))
                 (x (ly:stencil-extent stil X))
                 (y (ly:stencil-extent stil Y)))
            (list (list 'path (+ dx (* sx (car x))) (+ dx (* sx (cdr x)))
                              (+ dy (* sy (car y))) (+ dy (* sy (cdr y)))
                              (length (filter (lambda (c) (eq? c 'moveto)) cmds)) color))))
         ((eq? (car e) 'named-glyph)
          (let* ((stil (ly:font-get-glyph (cadr e) (caddr e)))
                 (x (ly:stencil-extent stil X))
                 (y (ly:stencil-extent stil Y)))
            (list (list 'glyph (caddr e) dx (+ dx (* sx (car x))) (+ dx (* sx (cdr x)))
                                         dy (+ dy (* sy (car y))) (+ dy (* sy (cdr y))) color))))
         ((eq? (car e) 'draw-line)
          (let ((a (cdr e)))
            (list (list 'line (+ dx (* sx (list-ref a 1))) (+ dy (* sy (list-ref a 2)))
                              (+ dx (* sx (list-ref a 3))) (+ dy (* sy (list-ref a 4)))
                              (* sx (list-ref a 0)) color))))
         ((symbol? (car e)) (cnb-probe:leaves (last e) sx sy dx dy color))
         (else '())))
{
  \\override Staff.KeySignature.after-line-breaking = #(lambda (grob)
    (let ((stil (ly:grob-property grob 'stencil)))
      (if (and (ly:stencil? stil) (not (ly:stencil-empty? stil)))
        (let* ((staff (ly:grob-object grob 'staff-symbol))
               (common (ly:grob-common-refpoint grob staff Y))
               (y0 (- (ly:grob-relative-coordinate grob common Y)
                      (ly:grob-relative-coordinate staff common Y)))
               (space (ly:staff-symbol-staff-space grob))
               (s (lambda (v) (exact->inexact (/ v space))))
               (x (ly:stencil-extent stil X)))
          (format #t "CNB-SIG ~a ~a\\n" (s (car x)) (s (cdr x)))
          (for-each
            (lambda (leaf)
              (let ((c (or (last leaf) '(0 0 0))))
                (cond
                  ((eq? (car leaf) 'glyph)
                    (format #t "CNB-GLYPH ~a ~a ~a ~a ~a ~a ~a ~a ~a ~a\\n" (list-ref leaf 1)
                      (s (list-ref leaf 2)) (s (list-ref leaf 3)) (s (list-ref leaf 4))
                      (s (+ y0 (list-ref leaf 5))) (s (+ y0 (list-ref leaf 6))) (s (+ y0 (list-ref leaf 7)))
                      (exact->inexact (car c)) (exact->inexact (cadr c)) (exact->inexact (caddr c))))
                  ((eq? (car leaf) 'path)
                    (format #t "CNB-PATH ~a ~a ~a ~a ~a ~a ~a ~a\\n"
                      (s (list-ref leaf 1)) (s (list-ref leaf 2))
                      (s (+ y0 (list-ref leaf 3))) (s (+ y0 (list-ref leaf 4))) (list-ref leaf 5)
                      (exact->inexact (car c)) (exact->inexact (cadr c)) (exact->inexact (caddr c))))
                  (else (format #t "CNB-LINE ~a ~a ~a ~a ~a ~a ~a ~a\\n"
                      (s (list-ref leaf 1)) (s (+ y0 (list-ref leaf 2)))
                      (s (list-ref leaf 3)) (s (+ y0 (list-ref leaf 4))) (s (list-ref leaf 5))
                      (exact->inexact (car c)) (exact->inexact (cadr c)) (exact->inexact (caddr c)))))))
            (cnb-probe:leaves (ly:stencil-expr stil) 1 1 0 0 #f))))))
  ${music}
}
`;
  return compile(engine, ly, score).then(({ error, output }) => {
    if (error) return { error: `${error.message}\n${output}` };
    const warnings = output.split(/\r?\n/).filter(l => /warning:.*cnb:keysig-marks/.test(l));
    const n = rest => rest.trim().split(" ").map(schemeNumber);
    const signatures = [];
    for (const line of output.split(/\r?\n/)) {
      let m;
      if ((m = /^CNB-SIG (\S+) (\S+)$/.exec(line))) {
        signatures.push({ x: [schemeNumber(m[1]), schemeNumber(m[2])], paths: [], lines: [], glyphs: [] });
      } else if ((m = /^CNB-GLYPH (\S+)((?: \S+){9})$/.exec(line)) && signatures.length > 0) {
        const v = n(m[2]);
        signatures[signatures.length - 1].glyphs.push({ name: m[1], origin: [v[0], v[3]], x: [v[1], v[2]], y: [v[4], v[5]],
          color: v.slice(6) });
      } else if ((m = /^CNB-PATH((?: \S+){8})$/.exec(line)) && signatures.length > 0) {
        const v = n(m[1]);
        signatures[signatures.length - 1].paths.push({ x: [v[0], v[1]], y: [v[2], v[3]], subpaths: v[4], color: v.slice(5) });
      } else if ((m = /^CNB-LINE((?: \S+){8})$/.exec(line)) && signatures.length > 0) {
        const v = n(m[1]);
        signatures[signatures.length - 1].lines.push({ x1: v[0], y1: v[1], x2: v[2], y2: v[3], thickness: v[4], color: v.slice(5) });
      }
    }
    return { signatures, warnings };
  });
}

/**
 * Read each engraved key signature's identity (session 48): a Staff
 * engraver acknowledges every KeySignature grob, at a key change and at each
 * system start, and prints the context's tonic, its note name (0 = C … 6 =
 * B) and alteration (1/2 a sharp, -1/2 a flat), and the key's seven pitch
 * classes, each step's natural pitch class plus twice its keyAlterations
 * alteration (0 when the step is not altered), mod 12, sorted. This is the
 * identity the key-signature design's mark table is keyed by (design §9).
 * Returns { keys: [{ notename, alteration, pitchClasses }] } in engraving
 * order, the alteration a number, or { error } with LilyPond's output.
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @param {string} music  the score's music, e.g. "\\key fis \\major c'1"
 * @returns {Promise<{keys?:{notename:number, alteration:number, pitchClasses:number[]}[], error?:string}>}
 */
export function readKeys(engine, ly, music) {
  const score = `\\version "2.24.2"
\\include "config.ly"
#(define (cnb-probe:key-engraver context)
   (make-engraver
     (acknowledgers
       ((key-signature-interface engraver grob source)
        (let* ((tonic (ly:context-property context 'tonic))
               (alts (ly:context-property context 'keyAlterations))
               (pcs (map (lambda (step)
                           (let ((alt (assv step alts)))
                             (modulo (+ (list-ref '(0 2 4 5 7 9 11) step)
                                        (* 2 (if alt (cdr alt) 0)))
                                     12)))
                         '(0 1 2 3 4 5 6))))
          (format #t "CNB-KEY ~a ~a ~{~a ~}\\n"
            (ly:pitch-notename tonic)
            (exact->inexact (ly:pitch-alteration tonic))
            (sort pcs <)))))))
\\layout { \\context { \\Staff \\consists #cnb-probe:key-engraver } }
{ ${music} }
`;
  return compile(engine, ly, score).then(({ error, output }) => {
    if (error) return { error: `${error.message}\n${output}` };
    const keys = [...output.matchAll(/^CNB-KEY (\d+) (\S+) ((?:\d+ ){7})$/gm)].map(([, n, a, pcs]) => ({
      notename: Number(n),
      alteration: schemeNumber(a),
      pitchClasses: pcs.trim().split(" ").map(Number),
    }));
    if (keys.length === 0) return { error: `no key signature was read\n${output}` };
    return { keys };
  });
}

/**
 * LilyPond's options for a compile whose measurements are read from what
 * it prints during layout: no pages are printed (session 45). Printing a
 * PDF hands the pages to Ghostscript, which now and then fails when many
 * compiles run at once (`gs … failed (1)`, one in 32 measured), and no
 * probe reads the pages.
 */
export const NO_PAGES = ["-dno-print-pages"];

/** Run LilyPond on the config and a score in a scratch directory: { error, output }. */
function compile(engine, ly, score) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "cnb-probe-"));
  writeFileSync(path.join(dir, "config.ly"), ly, "utf8");
  writeFileSync(path.join(dir, "score.ly"), score, "utf8");
  return new Promise((resolve) => {
    execFile(engine.lilypond, [...NO_PAGES, "-I", engine.dir, "-o", path.join(dir, "out"), "score.ly"],
      { cwd: dir, timeout: 120000, windowsHide: true },
      (error, stdout, stderr) => {
        rmSync(dir, { recursive: true, force: true });
        resolve({ error, output: `${stdout}\n${stderr}` });
      });
  });
}
