#!/usr/bin/env python3
"""Diff the x-offset spike render against the x-offset=0 control render.

Both harvested JSONs come from byte-identical .ly sources except
spike:x-offset (0.85 vs 0.0). For every notehead (matched by harvest id,
which encodes measure-beat-midi-voice) this prints the head's absolute-x
delta and its column stem's absolute-x delta, isolating exactly what the
stencil-translation disambiguation mechanism did.

Usage: python xoffset_control_diff.py pitch-axis-spike.harvested.json \
           pitch-axis-spike-ctrl.harvested.json
"""
import json
import sys

XOFF_PCS = {1, 4, 6, 9, 11}

def load(p):
    d = json.load(open(p, encoding='utf-8'))
    return {e['id']: e for e in d['elements']}

off = load(sys.argv[1])
ctl = load(sys.argv[2])

print(f"{'id':26} {'pc':>2} {'x(offset)':>9} {'x(control)':>10} "
      f"{'dx_head':>8} {'dx_stem':>8}  offset-pc?")
for i in sorted(off):
    if not i.startswith('nh-'):
        continue
    e, c = off[i], ctl.get(i)
    if not c:
        print(f"{i}: MISSING in control render")
        continue
    midi = int(e['data']['midi'])
    pc = (midi - 60) % 12
    dxh = e['absolute']['x'] - c['absolute']['x']
    stem_id = 'st-' + '-'.join(i.split('-')[1:3]) + '-' + i.split('-')[-1]
    es, cs = off.get(stem_id), ctl.get(stem_id)
    dxs = (f"{es['absolute']['x'] - cs['absolute']['x']:+8.3f}"
           if es and cs else '    none')
    print(f"{i:26} {pc:>2} {e['absolute']['x']:>9.3f} {c['absolute']['x']:>10.3f} "
          f"{dxh:>+8.3f} {dxs}  {'<== R-off pc' if pc in XOFF_PCS else ''}")

print()
print("chord-internal separations (head-to-head dx within one chord):")
CHORDS = [("<c' cis'>  (same diatonic step)", 'nh-7-0.000-60-0', 'nh-7-0.000-61-0'),
          ("<gis' a'>  (adjacent diatonic steps)", 'nh-7-0.250-68-0', 'nh-7-0.250-69-0'),
          ("<f' fis'>  (same diatonic step)", 'nh-7-0.750-65-0', 'nh-7-0.750-66-0')]
for label, a, b in CHORDS:
    so = off[b]['absolute']['x'] - off[a]['absolute']['x']
    sc = ctl[b]['absolute']['x'] - ctl[a]['absolute']['x']
    print(f"  {label:38} offset-render sep={so:+.3f}  control sep={sc:+.3f}  "
          f"offset effect={so - sc:+.3f}")
