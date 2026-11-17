#!/usr/bin/env python3
"""Extract every individual ledger line from the spike SVG's LedgerLineSpanner.

The LedgerLineSpanner is ONE spanner grob per system, so the harvester reports
it as a single element; the individual ledger lines are <rect>s inside its
stencil. This script walks the tagged spanner subtree accumulating translate
transforms and prints each rect with its true LilyPond staff position
(rect center = rect top y + half the rect height; top staff line = +8 at
y=5.35, half-staff-space = 0.5 SVG units, y grows downward):

    pos(y_center) = 8 - (y_center - 5.35) / 0.5

Usage: python extract_ledgers.py pitch-axis-spike.svg
"""
import re
import sys
import xml.etree.ElementTree as ET

TOP_POS, TOP_Y, HALF = 8, 5.35, 0.5

def pos_of(y):
    return TOP_POS - (y - TOP_Y) / HALF

root = ET.parse(sys.argv[1]).getroot()

count = 0
def walk(el, tx=0.0, ty=0.0, in_ledger=False):
    global count
    tag = el.tag.split('}')[-1]
    m = re.search(r'translate\(([-\d.]+)\s*,\s*([-\d.]+)\)', el.get('transform', ''))
    if m:
        tx, ty = tx + float(m.group(1)), ty + float(m.group(2))
    if el.get('id', '').startswith('ll-'):
        in_ledger = True
    if in_ledger and tag == 'rect':
        count += 1
        x = float(el.get('x', 0)) + tx
        y_top = float(el.get('y', 0)) + ty
        h = float(el.get('height', 0))
        y_center = y_top + h / 2
        print(f"ledger rect {count}: x={x:.3f} w={el.get('width')} "
              f"y_top={y_top:.3f} h={h:.3f} y_center={y_center:.3f} "
              f"staff_position={pos_of(y_center):+.3f}")
    for c in el:
        walk(c, tx, ty, in_ledger)

walk(root)
print(f"total ledger rects: {count}")
