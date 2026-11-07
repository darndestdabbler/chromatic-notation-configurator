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
