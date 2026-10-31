# Phase 2J — shared Grid content measurement and relative-child boundary

The opt-in Grid content arrangement now consumes the same measured column widths, occupied-row heights, and compacted child indices returned by `ProbeGridNativeMeasurement`. It no longer recomputes its own maxima. The historical `gridContentCandidateDiagnostics` lower-bound remains intentionally separate as a legacy diagnostic only; it must not be used as a source of native truth.

## Native relative-child evidence

In both independent client captures, the 2x2 Grid with second-child relative size 0.5 x 0.5 reported parent **145.5 x 63** and that child's screen size **94.5 x 27**, identical after Update and root resize. The measured fixed-child-only algorithm correctly rejects it.

Those observations establish actual geometry but are insufficient to identify a universal parent-child dependency or evaluation order. In particular, they do not determine whether native sizing uses original authored size, an intermediate cell size, iterative negotiation, or another native measurement context. Do not add a special-case numerical correction. An isolated multi-ratio/multi-parent-size native probe is necessary before enabling relative-child content measurement.

The experimental `gridContentArrangement` option remains off by default; PR #47 and the production renderer are unaffected.
