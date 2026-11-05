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

// One chromatic octave of quarter notes; each NoteHead prints its pitch
// class and its stencil's X and Y extents once laid out, in its own staff's
// staff spaces. The engine magnifies every staff by cnb:default-magnify
// (engine cnb/score-defaults.ly, its session 18), which scales the staff
// space and the notehead alike; dividing by the staff space measures the
// size relative to the staff, the unit the preview is drawn in.
const PROBE_SCORE = `\\version "2.24.2"
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
  c'4 cis'4 d'4 dis'4 e'4 f'4 fis'4 g'4 gis'4 a'4 ais'4 b'4
}
`;

/**
 * Compile an exported config (.ly text) with the engine under a score of
 * the twelve pitch classes as quarter notes, and return each engraved
 * notehead's size: { noteheads: [{ pc, width, height }] } in staff spaces,
 * or { error } with LilyPond's output when it fails or prints no notehead.
 *
 * @param {{lilypond:string, dir:string}} engine  from findEngine()
 * @param {string} ly  the exported config
 * @returns {Promise<{noteheads?:{pc:number,width:number,height:number}[], error?:string}>}
 */
export function measureNoteheads(engine, ly) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "cnb-probe-"));
  writeFileSync(path.join(dir, "config.ly"), ly, "utf8");
  writeFileSync(path.join(dir, "score.ly"), PROBE_SCORE, "utf8");
  return new Promise((resolve) => {
    execFile(engine.lilypond, ["-I", engine.dir, "-o", path.join(dir, "out"), "score.ly"],
      { cwd: dir, timeout: 120000, windowsHide: true },
      (error, stdout, stderr) => {
        rmSync(dir, { recursive: true, force: true });
        const output = `${stdout}\n${stderr}`;
        const noteheads = [...output.matchAll(/^CNB-NOTEHEAD (\d+) (\S+) (\S+)$/gm)]
          .map(([, pc, w, h]) => ({ pc: Number(pc), width: Number(w), height: Number(h) }));
        if (error || noteheads.length === 0) {
          resolve({ error: `${error ? error.message : "no notehead was measured"}\n${output}` });
        } else {
          resolve({ noteheads });
        }
      });
  });
}
