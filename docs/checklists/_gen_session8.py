"""
Generates docs/checklists/session-8-checklist.xlsx
Session 8: Foundation modules — Config Schema (A), Music Theory (B), Semitone Grid (1)
Run once: python docs/checklists/_gen_session8.py
"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import os

rows = [
    # ── Columns ──────────────────────────────────────────────────────────────
    # [id, functional_area, subarea, expectation]

    # ── FA-01: Config Schema — Module Initialization ─────────────────────────
    ("FA-01.1", "Config Schema — Initialization",
     "ES module loads in browser",
     "Open test-grid.html in a browser; the browser console shows no import errors for cnb-config.js"),

    ("FA-01.2", "Config Schema — Initialization",
     "createDefault() independence",
     "Calling createDefault() twice produces two independent objects; mutating one does not affect the other"),

    ("FA-01.3", "Config Schema — Initialization",
     "Default version field",
     "CNBConfig.VERSION equals '1.0' and config.version equals '1.0'"),

    # ── FA-02: Config Schema — Validation (Errors) ───────────────────────────
    ("FA-02.1", "Config Schema — Validation",
     "Valid default config",
     "CNBConfig.validate(CNBConfig.createDefault()) returns valid:true and errors:[]"),

    ("FA-02.2", "Config Schema — Validation",
     "Fewer than 2 staff lines",
     "Config with staff.semitonePattern:[4] returns an error containing 'at least 2'"),

    ("FA-02.3", "Config Schema — Validation",
     "fileSuffix without leading hyphen",
     "Config with meta.fileSuffix:'Default48' (no hyphen) returns an error containing 'must begin with \"-\"'"),

    ("FA-02.4", "Config Schema — Validation",
     "Unknown shape in rule",
     "Config with a rule referencing shape 'ghost-shape' (not in config.shapes) returns an error containing 'unknown shape'"),

    ("FA-02.5", "Config Schema — Validation",
     "Invalid hex color in rule",
     "Config with rule apply.color:'red' (not #RRGGBB) returns an error containing 'invalid color hex'"),

    ("FA-02.6", "Config Schema — Validation",
     "Invalid hex in palette",
     "Config with palette.colors[{pc:0, hex:'xyz'}] returns an error containing 'invalid hex'"),

    ("FA-02.7", "Config Schema — Validation",
     "Missing PC coverage",
     "Config with noteheadRules:[] returns 12 errors (one per uncovered PC), not just one combined error"),

    ("FA-02.8", "Config Schema — Validation",
     "Invalid staff line color",
     "Config with staff.lineDefaults.color:'badcolor' returns an error about invalid hex"),

    # ── FA-03: Config Schema — Validation (Warnings) ─────────────────────────
    ("FA-03.1", "Config Schema — Warnings",
     "Empty notation label",
     "Default config (notationLabel:'Default 4-8 System') produces no 'label is empty' warning; config with notationLabel:'' does"),

    ("FA-03.2", "Config Schema — Warnings",
     "Missing lilypondPath",
     "Default config produces a warning containing 'fallback SVG conversion' for the crotchet-minim shape"),

    ("FA-03.3", "Config Schema — Warnings",
     "No palette, null color",
     "Default config (empty palette) produces a warning about pitch classes rendering black"),

    ("FA-03.4", "Config Schema — Warnings",
     "CB-safe palette smaller than primary",
     "Config with 3 primary colors and 1 CB-safe color produces a warning mentioning the count mismatch"),

    # ── FA-04: Config Schema — merge() ───────────────────────────────────────
    ("FA-04.1", "Config Schema — merge()",
     "Primitive field overwrite",
     "merge(default, {display:{pxPerSemi:32}}) returns config where display.pxPerSemi=32 and all other display fields are unchanged"),

    ("FA-04.2", "Config Schema — merge()",
     "Array replacement",
     "merge(default, {staff:{semitonePattern:[3,6,9]}}) replaces the pattern array entirely; result has 3 items, not 5"),

    ("FA-04.3", "Config Schema — merge()",
     "No mutation of base",
     "merge(base, partial) does not modify the base or partial objects"),

    ("FA-04.4", "Config Schema — merge()",
     "New keys in partial are added",
     "merge({a:1}, {b:2}) returns {a:1, b:2}"),

    # ── FA-05: Config Schema — resolveNotehead() ─────────────────────────────
    ("FA-05.1", "Config Schema — resolveNotehead()",
     "Natural note (PC 0)",
     "resolveNotehead(default, 0, 'crotchet', null) returns {shape:'crotchet-minim', hollow:false, color:null, offKeyMark:false}"),

    ("FA-05.2", "Config Schema — resolveNotehead()",
     "Sharp note (PC 1)",
     "resolveNotehead(default, 1, 'crotchet', null) returns hollow:true (sharps-are-hollow rule applies)"),

    ("FA-05.3", "Config Schema — resolveNotehead()",
     "Partial rule inherits",
     "Sharps rule sets only hollow:true; resolved shape is still 'crotchet-minim' from the default rule, not overwritten"),

    ("FA-05.4", "Config Schema — resolveNotehead()",
     "Priority order",
     "A rule with priority 5 overrides a matching rule at priority 2 for the same PC"),

    ("FA-05.5", "Config Schema — resolveNotehead()",
     "All 12 PCs resolve without error",
     "Calling resolveNotehead for PC 0–11 with default config produces no exceptions"),

    # ── FA-06: Config Schema — resolveColor() ────────────────────────────────
    ("FA-06.1", "Config Schema — resolveColor()",
     "Empty palette returns null",
     "resolveColor(defaultConfig, 0) returns null when palette.colors is empty"),

    ("FA-06.2", "Config Schema — resolveColor()",
     "CB-safe flag respected",
     "With useCBSafe:true, resolveColor uses cbSafeColors array; with false, uses colors array"),

    ("FA-06.3", "Config Schema — resolveColor()",
     "Missing PC in palette",
     "resolveColor returns null when palette has entries but none match the given PC"),

    # ── FA-07: Config Schema — pctToPx() ─────────────────────────────────────
    ("FA-07.1", "Config Schema — pctToPx()",
     "Basic conversion",
     "pctToPx(20, 16) returns 3.2 (20% of 16px)"),

    ("FA-07.2", "Config Schema — pctToPx()",
     "Zero percent",
     "pctToPx(0, 16) returns 0"),

    ("FA-07.3", "Config Schema — pctToPx()",
     "100 percent",
     "pctToPx(100, 16) returns 16 (100% = full semitone height)"),

    # ── FA-08: Music Theory — pitchClass() ───────────────────────────────────
    ("FA-08.1", "Music Theory — pitchClass()",
     "Zero",
     "pitchClass(0) = 0"),

    ("FA-08.2", "Music Theory — pitchClass()",
     "One octave up",
     "pitchClass(12) = 0"),

    ("FA-08.3", "Music Theory — pitchClass()",
     "Negative semitone",
     "pitchClass(-1) = 11 (not -1 or 11 via truncation)"),

    ("FA-08.4", "Music Theory — pitchClass()",
     "Negative multiple octaves",
     "pitchClass(-13) = 11"),

    ("FA-08.5", "Music Theory — pitchClass()",
     "High semitone",
     "pitchClass(23) = 11"),

    # ── FA-09: Music Theory — octave() ───────────────────────────────────────
    ("FA-09.1", "Music Theory — octave()",
     "Octave 0",
     "octave(0) = 0, octave(11) = 0"),

    ("FA-09.2", "Music Theory — octave()",
     "Octave 1",
     "octave(12) = 1, octave(23) = 1"),

    ("FA-09.3", "Music Theory — octave()",
     "Negative semitone",
     "octave(-1) = -1 (floor(-1/12) = -1)"),

    # ── FA-10: Music Theory — absoluteSemi() ─────────────────────────────────
    ("FA-10.1", "Music Theory — absoluteSemi()",
     "PC 0, octave 1",
     "absoluteSemi(0, 1) = 12"),

    ("FA-10.2", "Music Theory — absoluteSemi()",
     "PC 11, octave 0",
     "absoluteSemi(11, 0) = 11"),

    ("FA-10.3", "Music Theory — absoluteSemi()",
     "Negative octave",
     "absoluteSemi(0, -1) = -12"),

    # ── FA-11: Music Theory — pcLabel() ──────────────────────────────────────
    ("FA-11.1", "Music Theory — pcLabel()",
     "Natural note",
     "pcLabel(0) = {text:'C', sharp:false}; pcLabel(2) = {text:'D', sharp:false}"),

    ("FA-11.2", "Music Theory — pcLabel()",
     "Sharp note",
     "pcLabel(1) = {text:'C', sharp:true}; pcLabel(6) = {text:'F', sharp:true}"),

    ("FA-11.3", "Music Theory — pcLabel()",
     "Returns copy not reference",
     "Mutating the returned object (e.g., setting sharp=true) does not change the result of a subsequent pcLabel(0) call"),

    # ── FA-12: Music Theory — chromaticLabels() ──────────────────────────────
    ("FA-12.1", "Music Theory — chromaticLabels()",
     "Returns 13 labels",
     "chromaticLabels() returns an array of exactly 13 elements (C through C')"),

    ("FA-12.2", "Music Theory — chromaticLabels()",
     "First and last",
     "Index 0 = {text:'C', sharp:false}; index 12 = {text:'C', sharp:false}"),

    ("FA-12.3", "Music Theory — chromaticLabels()",
     "Returns copies",
     "Mutating the returned array does not affect a subsequent chromaticLabels() call"),

    # ── FA-13: Semitone Grid — create() ──────────────────────────────────────
    ("FA-13.1", "Semitone Grid — create()",
     "svgHeight calculation",
     "create(config, {minSemi:-4, maxSemi:28}) → svgHeight = (28-(-4)) × 16 = 512"),

    ("FA-13.2", "Semitone Grid — create()",
     "semiToY at extremes",
     "semiToY(28) = 0 (top); semiToY(-4) = 512 (bottom)"),

    ("FA-13.3", "Semitone Grid — create()",
     "semiToY / yToSemi roundtrip",
     "yToSemi(semiToY(s)) = s for any integer s in [minSemi, maxSemi]"),

    ("FA-13.4", "Semitone Grid — create()",
     "Label area heights",
     "With default label config (marginTop:14, fontSize:22, padding:6): topLabelHeight = 14+22+6 = 42; bottomLabelHeight = 42"),

    ("FA-13.5", "Semitone Grid — create()",
     "totalHeight",
     "totalHeight = topLabelHeight + svgHeight + bottomLabelHeight = 42+512+42 = 596 (for default config, range -4 to 28)"),

    ("FA-13.6", "Semitone Grid — create()",
     "pxPerSemi from config",
     "create() reads pxPerSemi from config.display.pxPerSemi; changing config to pxPerSemi:32 doubles svgHeight"),

    # ── FA-14: Semitone Grid — renderDebugOverlay() (visual) ─────────────────
    ("FA-14.1", "Semitone Grid — Debug Overlay (visual)",
     "Page loads without errors",
     "Open test-grid.html in a browser; no console errors or module-load failures appear"),

    ("FA-14.2", "Semitone Grid — Debug Overlay (visual)",
     "Staff lines are blue",
     "Lines at semitones 4, 8, 16, 20 are drawn in blue (#4488cc) and visually thicker than other lines"),

    ("FA-14.3", "Semitone Grid — Debug Overlay (visual)",
     "Octave boundaries are medium gray",
     "Lines at semitones 0, 12, 24 are drawn in medium gray (#888888), visually between the blue staff lines and the faint gray semitone lines"),

    ("FA-14.4", "Semitone Grid — Debug Overlay (visual)",
     "Faint semitone grid lines",
     "All other semitone rows show faint light-gray (#cccccc) horizontal lines across the full SVG width"),

    ("FA-14.5", "Semitone Grid — Debug Overlay (visual)",
     "Semitone number labels",
     "Each row is labeled with its semitone number in the left margin; staff-line rows show blue labels, others show gray labels"),

    ("FA-14.6", "Semitone Grid — Debug Overlay (visual)",
     "Lines span full SVG width",
     "All horizontal lines extend from x=0 to x=300 (the declared SVG width); no lines are clipped or shorter"),

    ("FA-14.7", "Semitone Grid — Debug Overlay (visual)",
     "Console verification values",
     "Browser console shows: 'semiToY(maxSemi) should be 0: 0' and 'semiToY(minSemi) should be 512: 512'"),

    ("FA-14.8", "Semitone Grid — Debug Overlay (visual)",
     "No staffPositions arg",
     "Calling renderDebugOverlay(svg, grid) with no third argument (omitting staffPositions) does not throw; renders only gray/gray lines"),

    # ── FA-15: Test Suite ─────────────────────────────────────────────────────
    ("FA-15.1", "Test Suite",
     "All new tests pass",
     "node cnb/tests/run-tests.js reports 107 passing and 0 failing"),

    ("FA-15.2", "Test Suite",
     "Legacy tests unaffected",
     "node legacy/run-tests.js reports 240 passing and 0 failing"),

    # ── FA-16: Edge Cases ─────────────────────────────────────────────────────
    ("FA-16.1", "Edge Cases",
     "Grid with minSemi = maxSemi",
     "create(config, {minSemi:0, maxSemi:0}) → svgHeight=0; semiToY(0)=0; no crash"),

    ("FA-16.2", "Edge Cases",
     "pitchClass at exact octave boundary",
     "pitchClass(12) = 0 and pitchClass(24) = 0 (not 12 or 24)"),

    ("FA-16.3", "Edge Cases",
     "resolveNotehead with no rules",
     "Config with noteheadRules:[] still returns a result using built-in defaults (first shape in config.shapes)"),

    ("FA-16.4", "Edge Cases",
     "resolveNotehead with empty shapes",
     "Config with shapes:{} and noteheadRules:[] returns shape:null (no crash)"),

    ("FA-16.5", "Edge Cases",
     "merge with null partial",
     "CNBConfig.merge(base, null) returns a deep clone of base without error"),

    ("FA-16.6", "Edge Cases",
     "Validation with null config sections",
     "CNBConfig.validate({}) does not throw; returns errors for missing staff pattern and uncovered PCs"),
]

# ── Styling constants ────────────────────────────────────────────────────────
HEADER_FILL   = PatternFill("solid", fgColor="1F3864")   # dark navy
HEADER_FONT   = Font(color="FFFFFF", bold=True, name="Calibri", size=11)
AREA_FILL     = PatternFill("solid", fgColor="D9E1F2")   # light blue
SUBAREA_FONT  = Font(bold=False, name="Calibri", size=10)
BODY_FONT     = Font(name="Calibri", size=10)
BORDER_SIDE   = Side(style="thin", color="CCCCCC")
THIN_BORDER   = Border(left=BORDER_SIDE, right=BORDER_SIDE,
                        top=BORDER_SIDE, bottom=BORDER_SIDE)

AREA_GROUPS = {
    "Config Schema — Initialization":       "FA-01",
    "Config Schema — Validation":           "FA-02",
    "Config Schema — Warnings":             "FA-03",
    "Config Schema — merge()":              "FA-04",
    "Config Schema — resolveNotehead()":    "FA-05",
    "Config Schema — resolveColor()":       "FA-06",
    "Config Schema — pctToPx()":            "FA-07",
    "Music Theory — pitchClass()":          "FA-08",
    "Music Theory — octave()":              "FA-09",
    "Music Theory — absoluteSemi()":        "FA-10",
    "Music Theory — pcLabel()":             "FA-11",
    "Music Theory — chromaticLabels()":     "FA-12",
    "Semitone Grid — create()":             "FA-13",
    "Semitone Grid — Debug Overlay (visual)": "FA-14",
    "Test Suite":                           "FA-15",
    "Edge Cases":                           "FA-16",
}

# Alternating row fills (light) for each functional area group
GROUP_FILLS = [
    PatternFill("solid", fgColor="EEF2FA"),
    PatternFill("solid", fgColor="FFFFFF"),
]

def make_sheet(wb):
    ws = wb.active
    ws.title = "Session 8 Checklist"

    # ── Headers ──────────────────────────────────────────────────────────────
    headers = ["Functional Area Id", "Functional Area", "Subarea",
               "Passes", "Expectation", "Feedback"]
    ws.append(headers)
    for col, _ in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col)
        cell.font   = HEADER_FONT
        cell.fill   = HEADER_FILL
        cell.border = THIN_BORDER
        cell.alignment = Alignment(horizontal="center", vertical="center",
                                   wrap_text=True)

    ws.row_dimensions[1].height = 28

    # ── Data rows ─────────────────────────────────────────────────────────────
    prev_area = None
    area_fill_idx = 0

    for data_row_idx, (id_, area, subarea, expectation) in enumerate(rows):
        if area != prev_area:
            area_fill_idx = (area_fill_idx + 1) % 2
            prev_area = area

        fill = GROUP_FILLS[area_fill_idx]
        row_num = data_row_idx + 2  # +2 because row 1 is header
        ws.append([id_, area, subarea, "", expectation, ""])

        for col in range(1, 7):
            cell = ws.cell(row=row_num, column=col)
            cell.border = THIN_BORDER
            cell.font   = BODY_FONT
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            if col not in (4, 6):  # leave Passes and Feedback uncolored
                cell.fill = fill

        ws.row_dimensions[row_num].height = 52

    # ── Column widths ─────────────────────────────────────────────────────────
    col_widths = [14, 32, 32, 10, 80, 30]
    for col, width in enumerate(col_widths, 1):
        ws.column_dimensions[get_column_letter(col)].width = width

    # ── Freeze header row ─────────────────────────────────────────────────────
    ws.freeze_panes = "A2"

    # ── Auto-filter ───────────────────────────────────────────────────────────
    ws.auto_filter.ref = f"A1:F{len(rows)+1}"


def main():
    wb = openpyxl.Workbook()
    make_sheet(wb)

    out_path = os.path.join(
        os.path.dirname(__file__),
        "session-8-checklist.xlsx"
    )
    wb.save(out_path)
    print(f"Saved: {out_path}")
    print(f"Rows: {len(rows)} checklist items")


if __name__ == "__main__":
    main()
