/**
 * pitch-panel.js — the Pitch section (session 28)
 *
 * The editor's two pitch variables (design
 * docs/planning/notehead-first-editor-design.md §3, mock-up 3), edited
 * through session 24's pitch model (pitch-model.js):
 *   - Middle of the staff: a select of the twelve pitch classes. A change
 *     moves the pitch by the shift from the current middle (shiftPitch), the
 *     same as dragging the label strip (§3.1, §4.2).
 *   - Staff spacing: semitones per staff space, a decimal (§3.4), written
 *     with the current nudges (writeNudges).
 *   - Nudges: one number field per pitch class, −1 to +1 semitone, limited
 *     by its neighbours (nudgeLimits), each framed so it reads as its
 *     notehead's own. A note on a neighbour's spot is marked "shares".
 *     Every pitch class has its own nudge, C included (session 43, §3.2).
 *     The sliders are gone (session 43): a notehead is also nudged by
 *     dragging it up or down on the canvas while this section is open
 *     (preview-display.js, CNBPitchModel.dragNudge).
 * When readNudges gives null the file has a custom pitch axis (§3.5): the
 * section says so, the spacing and nudge controls are disabled, and a
 * button opens Advanced › Pitch axis map. Drawing the section never writes
 * the config, so a stride-7 map stays as it is until a control changes.
 *
 * nudgeControl(host, { config, pc, onChange }) is one pitch class's nudge,
 * which the notehead panel reuses.
 *
 * Editor contract as the other cnb/ui modules: plain DOM through
 * document.createElement, events wired as element properties, so the
 * section runs in Node against a stub document. The host owns the config:
 * render() reads it through getConfig and reports each new config through
 * onChange.
 */

import { CNBMusic } from "../src/cnb-music.js";
import { CNBPitchModel as P } from "./pitch-model.js";

const PCS = [...Array(12).keys()];
const EPS = 1e-6;

const mod12 = (x) => ((x % 12) + 12) % 12;
const round4 = (x) => Math.round(x * 1e4) / 1e4 || 0;

/** A pitch class's name, C to B with ♯. */
function pcName(pc) {
  const l = CNBMusic.pcLabel(pc);
  return l.text + (l.sharp ? "♯" : "");
}

/** True when pc's spot (pc + nudge) is its lower or upper neighbour's. */
function shares(nudges, pc) {
  const at = pc + nudges[pc];
  const below = pc - 1 + nudges[mod12(pc - 1)];
  const above = pc + 1 + nudges[mod12(pc + 1)];
  return Math.abs(at - below) < EPS || Math.abs(at - above) < EPS;
}

function element(tag, className, text) {
  const e = globalThis.document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

const valueOf = (e, input) => (e && e.target && e.target.value !== undefined ? e.target.value : input.value);

export const CNBPitchPanel = {

  shares,

  /**
   * One pitch class's nudge: its name, "shares" when it sits on a
   * neighbour's spot, and a number field limited to the range its
   * neighbours allow, in a frame. A change is clamped to that range and
   * reported as writeNudges(config, …) through onChange. Disabled for a map
   * nudges can't show.
   * @param {HTMLElement} host
   * @param {{config: object, pc: number, onChange: (config: object) => void}} opts
   * @returns {HTMLElement} the div.cnb-pp-nudge appended to host
   */
  nudgeControl(host, { config, pc, onChange = () => {} }) {
    const read = P.readNudges(config);
    const nudges = read ? read.nudges : PCS.map(() => 0);
    const value = nudges[pc];
    const { min, max } = P.nudgeLimits(nudges, pc);
    const disabled = !read;

    const wrap = element("div", "cnb-pp-nudge" + (disabled ? " disabled" : ""));
    wrap.setAttribute("data-pc", String(pc));
    const head = element("div", "cnb-pp-nudge-head");
    head.appendChild(element("span", "cnb-pp-nudge-name", pcName(pc)));
    if (read && shares(nudges, pc)) head.appendChild(element("span", "cnb-pp-nudge-shares", "shares"));
    wrap.appendChild(head);

    const commit = (raw) => {
      const v = Number(raw);
      if (!read || !Number.isFinite(v)) return;
      const next = nudges.slice();
      next[pc] = round4(Math.min(max, Math.max(min, v)));
      if (next[pc] === value) return;
      onChange(P.writeNudges(config, next, read.staffSpacing));
    };

    const field = element("input", "cnb-pp-nudge-field");
    field.type = "number";
    field.min = String(min);
    field.max = String(max);
    field.step = "0.01";
    field.value = String(value);
    field.disabled = disabled;
    field.title = `${pcName(pc)}'s nudge, ${round4(min)} to ${round4(max)} semitones`;
    field.onchange = (e) => commit(valueOf(e, field));
    wrap.appendChild(field);

    host.appendChild(wrap);
    return wrap;
  },

  /**
   * Render the Pitch section into a container.
   * @param {HTMLElement} container
   * @param {{getConfig: () => object, onChange?: (config: object) => void,
   *          onOpenAdvanced?: () => void}} opts
   * @returns {{root: HTMLElement, redraw: () => void}}
   */
  render(container, opts = {}) {
    if (typeof opts.getConfig !== "function") {
      throw new Error("CNBPitchPanel.render requires opts.getConfig — the host owns config state");
    }
    const getConfig = opts.getConfig;
    const onChange = opts.onChange || (() => {});
    const onOpenAdvanced = opts.onOpenAdvanced || (() => {});

    const root = element("div", "cnb-pitch-panel");
    let error = "";

    function report(config) {
      error = "";
      onChange(config);
      draw();
    }

    function drawMiddle(config) {
      const group = element("div", "cnb-pp-group cnb-pp-middle-group");
      group.appendChild(element("p", "cnb-pp-label", "Middle of the staff"));
      const mid = config.staff && config.staff.midpoint;
      const current = Number.isFinite(mid) ? mod12(Math.round(mid)) : 0;
      const select = element("select", "cnb-pp-middle");
      for (const pc of PCS) {
        const option = element("option", "", pcName(pc));
        option.value = String(pc);
        if (pc === current) option.selected = true;
        select.appendChild(option);
      }
      select.value = String(current);
      select.onchange = (e) => {
        const pc = Number(valueOf(e, select));
        if (!Number.isInteger(pc) || pc === current) return;
        report(P.shiftPitch(getConfig(), P.renameDelta(current, pc)));
      };
      group.appendChild(select);
      group.appendChild(element("p", "cnb-pp-hint",
        "The same as dragging the labels: the noteheads keep their looks and move with their names."));
      return group;
    }

    function drawSpacing(config, read) {
      const group = element("div", "cnb-pp-group cnb-pp-spacing-group");
      group.appendChild(element("p", "cnb-pp-label", "Staff spacing"));
      const row = element("div", "cnb-pp-spacing-row");
      const spacing = read ? read.staffSpacing : (config.staff || {}).semitonesPerStaffSpace;
      const input = element("input", "cnb-pp-spacing");
      input.type = "number";
      input.min = "0.01";
      input.step = "0.01";
      input.value = String(spacing);
      input.disabled = !read;
      input.onchange = (e) => {
        const raw = String(valueOf(e, input)).trim();
        const v = Number(raw);
        if (raw === "" || !Number.isFinite(v) || v <= 0) {
          error = "The staff spacing must be a number above 0.";
          draw();
          return;
        }
        const now = P.readNudges(getConfig());
        if (!now || round4(v) === now.staffSpacing) return;
        report(P.writeNudges(getConfig(), now.nudges, round4(v)));
      };
      row.appendChild(input);
      row.appendChild(element("span", "cnb-pp-unit", "semitones per staff space"));
      group.appendChild(row);
      if (Number.isFinite(spacing) && spacing > 0) {
        group.appendChild(element("p", "cnb-pp-hint",
          `An octave takes ${round4(12 / spacing)} staff spaces.`));
      }
      if (error) group.appendChild(element("p", "cnb-pp-error", error));
      return group;
    }

    function drawCustom() {
      const box = element("div", "cnb-pp-custom");
      box.appendChild(element("p", "cnb-pp-custom-text",
        "This file uses a custom pitch axis that nudges can't show. " +
        "Its map is edited in Advanced › Pitch axis map; the rest of the editor works as usual."));
      const open = element("button", "cnb-pp-open-advanced", "Open the pitch axis map");
      open.type = "button";
      open.onclick = () => onOpenAdvanced();
      box.appendChild(open);
      return box;
    }

    function drawNudges(config) {
      const group = element("div", "cnb-pp-group cnb-pp-nudges-group");
      group.appendChild(element("p", "cnb-pp-label", "Nudges"));
      group.appendChild(element("p", "cnb-pp-hint",
        "Each pitch class can sit up to a semitone above or below its own place. " +
        "Drag a notehead up or down on the canvas, or type its nudge here. Neighbours may meet, never cross."));
      const list = element("div", "cnb-pp-nudges");
      for (const pc of PCS) {
        CNBPitchPanel.nudgeControl(list, { config, pc, onChange: report });
      }
      group.appendChild(list);
      return group;
    }

    function draw() {
      root.textContent = "";
      const config = getConfig();
      const read = P.readNudges(config);
      const top = element("div", "cnb-pp-top");
      top.appendChild(drawMiddle(config));
      top.appendChild(drawSpacing(config, read));
      root.appendChild(top);
      if (!read) root.appendChild(drawCustom());
      root.appendChild(drawNudges(config));
    }

    draw();
    container.appendChild(root);
    return { root, redraw: draw };
  },
};
