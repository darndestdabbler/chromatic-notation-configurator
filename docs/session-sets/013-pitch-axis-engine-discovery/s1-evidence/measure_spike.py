#!/usr/bin/env python3
"""Measure the pitch-axis spike render against the intended compact map.

Expected staff position (half-staff-spaces from center):
    pos(semi) = oct*7 + PC_AXIS[pc] - 4      (pc = semi mod 12, euclidean oct)

True LilyPond position is derived from absolute SVG y using the staff
extremes: top staff line = position +8, bottom staff line = position -3
(11 half-spaces apart), y grows downward:
    pos(y) = 8 - 11 * (y - top_y) / (bottom_y - top_y)
data-midi is 60 + ly:pitch-semitones, so semi = midi - 60.
"""
import json, sys

PC_AXIS = [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6]
STRIDE = 7
ANCHOR = -4
XOFF_PCS = {1, 4, 6, 9, 11}
TOP_POS, BOTTOM_POS = 8, -3

def expected_pos(semi):
    pc = semi % 12
    octv = (semi - pc) // 12
    return octv * STRIDE + PC_AXIS[pc] + ANCHOR

path = sys.argv[1]
d = json.load(open(path, encoding="utf-8"))

staff = d["staff"]
top_y, bot_y = staff["top_line_y"], staff["bottom_line_y"]
span = TOP_POS - BOTTOM_POS  # 11 half-spaces
half_space = (bot_y - top_y) / span

def y_to_pos(y):
    return TOP_POS - (y - top_y) / half_space

heads = [e for e in d["elements"] if e["type"] == "notehead"]
stems = [e for e in d["elements"] if e["type"] == "stem"]
ledgers = [e for e in d["elements"] if e["type"] == "ledger-line"]

print(f"staff: top_y={top_y} bottom_y={bot_y} height={staff['staff_height']} "
      f"lines={staff['line_count']} half_space={half_space:.4f}")
print(f"noteheads={len(heads)} stems={len(stems)} ledger-lines={len(ledgers)}")
print()

print(f"{'id':26} {'semi':>4} {'pc':>2} {'exp':>4} {'meas':>8} {'delta':>7}"
      f"  {'x':>7}  shared")
fails = 0
by_id = {}
for e in sorted(heads, key=lambda e: (int(e['data']['measure']),
                                      e['data']['beat'], int(e['data']['midi']))):
    midi = int(e["data"]["midi"])
    semi = midi - 60
    exp = expected_pos(semi)
    meas = y_to_pos(e["absolute"]["y"])
    delta = meas - exp
    ok = abs(delta) < 0.05
    if not ok:
        fails += 1
    shared = "R-off" if (semi % 12) in XOFF_PCS else ""
    by_id[e["id"]] = e
    print(f"{e['id']:26} {semi:>4} {semi%12:>2} {exp:>4} {meas:>8.3f} {delta:>+7.3f}"
          f"  {e['absolute']['x']:>7.3f}  {shared}"
          + ("" if ok else "  <-- MISMATCH"))

print(f"\nnotehead placement: {len(heads)-fails}/{len(heads)} at expected "
      f"mapped position, {fails} mismatches")

print("\n--- shared-position chord pairs (same expected pos; dx should be ~ x-offset) ---")
pairs = [("nh-7-0.000-60-0", "nh-7-0.000-61-0"),   # <c' cis'>
         ("nh-7-0.250-68-0", "nh-7-0.250-69-0"),   # <gis' a'>
         ("nh-7-0.750-65-0", "nh-7-0.750-66-0")]   # <f' fis'>
for a, b in pairs:
    ea, eb = by_id.get(a), by_id.get(b)
    if not ea or not eb:
        print(f"  {a} / {b}: MISSING")
        continue
    dx = eb["absolute"]["x"] - ea["absolute"]["x"]
    dpos = y_to_pos(eb["absolute"]["y"]) - y_to_pos(ea["absolute"]["y"])
    print(f"  {a} vs {b}: dx={dx:+.3f} ({dx/(2*half_space):+.3f} staff-spaces) "
          f"dpos={dpos:+.3f}")

print("\n--- ledger lines ---")
for e in sorted(ledgers, key=lambda e: e["id"]):
    pos = y_to_pos(e["absolute"]["y"])
    print(f"  {e['id']:26} pos={pos:+.3f} x={e['absolute']['x']:.3f} "
          f"w={e['visual']['bbox']['w']:.3f}")

print("\n--- stems (extent in staff positions, vs matching heads) ---")
for e in sorted(stems, key=lambda e: (int(e['data']['measure']), e['data']['beat'])):
    m, b = e["data"]["measure"], e["data"]["beat"]
    mates = [h for h in heads if h["data"]["measure"] == m and h["data"]["beat"] == b]
    bb = e["visual"]["bbox"]
    pos_hi = y_to_pos(bb["y"])
    pos_lo = y_to_pos(bb["y"] + bb["h"])
    mate_desc = ", ".join(
        f"midi{h['data']['midi']}(pos {y_to_pos(h['absolute']['y']):+.1f}, x {h['absolute']['x']:.2f})"
        for h in sorted(mates, key=lambda h: int(h['data']['midi'])))
    print(f"  st-{m}-{b}: x={e['absolute']['x']:.3f} span=[{pos_lo:+.2f} .. {pos_hi:+.2f}]"
          f"  heads: {mate_desc}")
