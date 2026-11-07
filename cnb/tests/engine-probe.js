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
// (engine cnb/score-defaults.ly, its session 18), which scales the staff
// space and the notehead alike; dividing by the staff space measures the
// size relative to the staff, the unit the preview is drawn in.
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

/**
 * Compile an exported config (.ly text) under a score of the given music
 * (e.g. "c'4 c'2") and report each engraved notehead in order:
 * { noteheads: [{ pc, durationLog, hollow }] }, where durationLog is
 * LilyPond's (2 = quarter, 1 = half, 0 = whole) and hollow says whether its
 * stencil carries the hollow cutout; or { error } with LilyPond's output
 * when it fails or prints no notehead.
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @param {string} music  LilyPond music for the score's one staff
 * @returns {Promise<{noteheads?:{pc:number,durationLog:number,hollow:boolean}[], error?:string}>}
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
      .map(([, pc, log, expr]) => ({ pc: Number(pc), durationLog: Number(log), hollow: stencilIsHollow(expr) }));
    if (error || noteheads.length === 0) {
      return { error: `${error ? error.message : "no notehead was measured"}\n${output}` };
    }
    return { noteheads };
  });
}

/**
 * Compile an exported config (.ly text) under a score of the given music
 * (e.g. "\\stemUp c'2") and report each engraved stem in order:
 * { stems: [{ durationLog, direction, x, width }] }, where x is the stem's
 * centre minus the centre of its first notehead's stencil (in repeat mode
 * the whole repeated group), and width the stem's, both in staff spaces;
 * direction is 1 (up) or -1 (down). Or { error } with LilyPond's output
 * when it fails or prints no stem.
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @param {string} music  LilyPond music for the score's one staff
 * @returns {Promise<{stems?:{durationLog:number,direction:number,x:number,width:number}[], error?:string}>}
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
           (space (ly:staff-symbol-staff-space stem)))
      (format #t "CNB-STEM ~a ~a ~a ~a\\n"
        (ly:duration-log (ly:event-property (event-cause head) 'duration))
        (ly:grob-property stem 'direction)
        (exact->inexact (/ (- (interval-center s) (interval-center h)) space))
        (exact->inexact (/ (interval-length s) space)))))
  ${music}
}
`;
  return compile(engine, ly, score).then(({ error, output }) => {
    const stems = [...output.matchAll(/^CNB-STEM (-?\d+) (-?\d+) (\S+) (\S+)$/gm)]
      .map(([, log, dir, x, w]) => ({ durationLog: Number(log), direction: Number(dir), x: Number(x), width: Number(w) }));
    if (error || stems.length === 0) {
      return { error: `${error ? error.message : "no stem was measured"}\n${output}` };
    }
    return { stems };
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

/** Run LilyPond on the config and a score in a scratch directory: { error, output }. */
function compile(engine, ly, score) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "cnb-probe-"));
  writeFileSync(path.join(dir, "config.ly"), ly, "utf8");
  writeFileSync(path.join(dir, "score.ly"), score, "utf8");
  return new Promise((resolve) => {
    execFile(engine.lilypond, ["-I", engine.dir, "-o", path.join(dir, "out"), "score.ly"],
      { cwd: dir, timeout: 120000, windowsHide: true },
      (error, stdout, stderr) => {
        rmSync(dir, { recursive: true, force: true });
        resolve({ error, output: `${stdout}\n${stderr}` });
      });
  });
}
