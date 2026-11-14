# Drawing the notehead (draft)

*A draft of the tutorial's notehead-drawing chapter (step-by-step design
§7.2), written in session 67 for the operator to follow while drawing the
tutorial's diamonds. Session 68 folds it into
`docs/playbook/tutorial/index.html`, corrected by what the drawing showed.*

The tutorial's notehead is a diamond, 2 semitones tall and 3 wide, with a
hollow for its minims. You draw it once in Inkscape, at any size, and the
Music Glyph Toolkit gives it its height, centres it and adds its stems. The
file you save is the one you import in step 5.

The optional section near the end draws a second diamond, 2 semitones tall
and 4 wide, for the key signature's custom symbol.

If you would rather not draw, take the finished `diamond.svg` (and
`diamond-wide.svg`) from the downloads and go on at step 1.

## Before you start

- **Inkscape** 1.x.
- **The Music Glyph Toolkit**: copy `music_glyph_toolkit.inx` and
  `music_glyph_toolkit.py` into Inkscape's user extensions folder
  (Edit › Preferences › System › User extensions names it) and restart
  Inkscape. It is under Extensions › Music Typography › Music Glyph
  Toolkit….

## The idea: draw the head and its hollow together, then turn them together

A notehead is two filled shapes: the **head**, and the **hollow**, a
smaller shape inside it that minims show as white. Draw both upright and
centred on each other, where they are easy to line up. Then group them and
turn or stretch the group, so the hollow keeps its place inside the head.

For a traditional, slanted notehead, start from **flat ovals**: an ellipse
for the head and a flatter one inside it for the hollow (a rounded
rectangle also serves for the hollow). Centre one on the other, group them,
rotate the group about 20° anticlockwise, and ungroup it. The diamond below
is the same recipe with squares.

## The diamond, 2 × 3 semitones

1. **The head.** Draw a square with the Rectangle tool (R), holding Ctrl
   to keep it square. Give it a black fill and no stroke.
2. **The hollow.** Draw a smaller square inside it, about half as wide.
   In the Rectangle tool's bar, round its corners a little (Rx and Ry, about
   a tenth of its width). Give it a white fill and no stroke.
3. **Centre the hollow on the head.** Select both, open Align and
   Distribute (Shift+Ctrl+A), align relative to the biggest object, and
   centre on both axes.
4. **Make them paths.** With both selected, Path › Object to Path
   (Shift+Ctrl+C).
5. **Group, turn and stretch.** Group them (Ctrl+G). Open Object ›
   Transform (Shift+Ctrl+M):
   - Rotate: 45°, Apply. The squares are now diamonds.
   - Scale: untick *Scale proportionally*, set the width to 150% and the
     height to 100%, Apply. The diamond is now 1.5 times as wide as tall,
     and the hollow is stretched with it.
6. **Ungroup** (Shift+Ctrl+G).
7. **Name them.** Open Object Properties (Shift+Ctrl+O). Select the head
   and set its ID to `notehead`, then the hollow and set its ID to
   `hollow`, pressing Set after each.
8. **Run the toolkit in Notehead mode, with a semitone height of 2.**
   Extensions › Music Typography › Music Glyph Toolkit…, the **Notehead
   Formatter** tab:
   - Notehead Height (Semitones): **2**
   - Stem placemarkers: ticked
   - Action: **Update SVG Canvas**
   - Include LilyPond path data: ticked

   Apply. The toolkit bakes the rotation and the stretch into the paths,
   centres the head on 0,0, scales it to 2 semitones tall (so 3 wide), and
   adds the two stem rectangles, `stem-up` at the right point and
   `stem-down` at the left, with dashed semitone guidelines in their own
   layer.
9. **The stems.** The rectangles mark where each stem's centre meets the
   head. The toolkit's places suit the diamond; move a rectangle only if
   you want a stem elsewhere, then run Update SVG Canvas again.
10. **Save** as `diamond.svg` (File › Save As…, Inkscape SVG or Plain SVG).

## Where the reference point goes

A notehead sits on its pitch by its **reference point**: the point placed
on the pitch's height. It belongs on the head's visual centre. For a
symmetric shape like the diamond that is its middle, where the toolkit
already centred it, which is the default: there is nothing to set. For a
lopsided shape (a teardrop, or a head heavier on one side) it is the centre
of mass, where the eye puts the note.

You pick it in step 5, after the import, by clicking on the enlarged shape
(Pick the point that sits on the pitch, then Done). The head moves; the
staff lines stay where they are.

## Optional: the key signature's diamond, 2 × 4 semitones

Draw it as above, with one change: in step 5 of the recipe, scale the
width to **200%**, so the diamond is twice as wide as tall. Run the
toolkit with the same height, 2, and save it as `diamond-wide.svg`. Its
stems are not used: a key-signature symbol has none.
