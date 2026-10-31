# Phase 2K native results: relative children in content-sized GridSpacer

Captured from the DayZ client on 2026-10-31 using `NIH_Grid_Relative_Matrix.layout`. Original source: `NIH-GridProbe-Phase2K.txt` supplied after running the probe. Canonical numeric observations live in `grid-relative-phase2k-native.json`. Regression replay: `tests/grid-native-relative-evidence.test.mjs`.

## Capture completeness

All three required relative phases completed, each containing 12 GridSpacer parents and 36 direct PanelWidget children. The parent and child rectangles were identical in `relative-after-create`, `relative-post-update`, and `relative-after-resize-1120x720`: 144 parent/child rectangles in total, zero changes. The root changed from 1920x1080 to 1120x720, but these grids have exact authored offsets and dimensions.

## Observed bounded model

This model is **only independently verified for the 2-column, 2-row, three-child fixture**: child 0 = exact 40x10 in cell (0,0), child 1 = relative `rw,rh` in cell (1,0), child 2 = exact 30x25 in cell (0,1), Padding = 3, Margin = 4.

For content width, the exact-child/spacing base is `Wbase = 40 + 3 + 8 = 51`. The relative column width is `Wrel = rw * (authoredWidth - Wbase)`. Parent width is `Wbase + Wrel`.

For content height, the exact-child/spacing base is `Hbase = 10 + 25 + 3 + 8 = 46`. The relative row request is `Hrel = rh * (authoredHeight - Hbase)`. The first row is `max(10, Hrel)`, and parent height is `8 + 3 + 25 + firstRowHeight`.

The fixture never exercises negative remaining space. No clamp, collapse, or overflow behavior is established for authored dimensions smaller than the fixed contributions.

For an axis **without** Size To Content, the native grid uses equal cell allocations: `(authoredAxis - 2*Margin - (count-1)*Padding)/count`; this applies to exact and relative children alike. The two axes resolve independently. Relative children occupy their calculated cell extent on the content axis; fixed-size children retain their exact extent on that axis.

At authored 240x100 with ratios 0.5/0.5, native parent = 145.5x63 and relative child = 94.5x27. Width ratio 0 produces a 51-wide grid and zero-wide relative child. Height ratio 0 produces a 46-high grid but a 10-high relative child, because the fixed first-row child establishes a 10-high minimum.

The bounded model reproduces all 12 native parent rectangles and all 36 native child rectangles; all three capture phases agree (144 rectangles total).

## Current implementation boundary

`GridNativeMeasurement.ProbeGridNativeMeasurement` rejects relative-size axes and `ArrangeMeasuredGridContent` relies on this guard. **Do not remove those guards on the basis of this fixture alone.** These results are research evidence, not a generalized implementation of native GridSpacer measurement and not a production renderer change. Existing fixed-child and constrained-grid paths remain unchanged.

## Required generalization tests

Before enabling an opt-in relative-content prototype in the shared engine, independently probe:

- Two or more relative children in the same column and different rows; likewise the same row and different columns
- Three columns, three rows, unused cells, and overflowing direct children
- Mixed exact/relative axes with relative values of zero, one, and greater than one
- Authored grid dimensions smaller than the sum of its fixed-size children and spacing
- Invisible/ignored managed children and stable compacted placement
- Nested content-sized containers and mutation/invalidation after creation

Keep source widget IDs optional; probe matching must not assume every native widget has an ID. Test generic axis/column/row constraints rather than implementing a 2x2 special-case renderer.
