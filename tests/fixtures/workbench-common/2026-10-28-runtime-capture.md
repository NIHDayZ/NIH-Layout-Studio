# Native DayZ common-geometry capture — October 28, 2026

## What actually ran

The user built the **standalone** `NIH_CommonGeometryProbe.pbo` through
DayZ Tools Addon Builder 1.0.240639 and launched the mod in DayZ gameplay.
The native `MissionGameplay` diagnostic generated both requested captures
with complete BEGIN/END markers. The user supplied filtered output from
`script_2026-10-28_12-25-16.log`:

- `viewport-1120x460`, capture at 12:25:56.661
- `viewport-1440x900`, capture at 12:25:58.050

In each phase the root `NIHCommonParity` reports its actual
`GetScreenPos/GetScreenSize` as `(0,0,1120,460)` or `(0,0,1440,900)`.
The probe also recorded native `GetPos/GetSize`, screen rectangles, widget
types, `IsVisible`, and `IsVisibleHierarchy` for **all 17 widgets**
(root + 16 descendants). No missing widget records or missing phase endpoints
were present in the submitted excerpt.

**Important provenance limitation:** The native DayZ client build/version
was not recorded; **Addon Builder 1.0.240639 is not the game build**. The
unfiltered client script log was not supplied. These are real independently
captured runtime getters, but they remain **unversioned**. The comparator
now checks all numeric values and reports `PENDING` rather than a formal,
version-pinned native `PASS` for an otherwise exact match.

## Common geometry observations

The independent getter values are stored under
[`capture.runtime.2026-10-28.json`](capture.runtime.2026-10-28.json).
The unit regressions call the shared `MeasureLayoutTree` and
`ArrangeMeasuredGeometry` functions with the **native observed root
rectangle as the constraint**; none of the model-predicted values were used
to populate the capture JSON.

| Widget / behavior | Native at 1120×460 | Native at 1440×900 |
|---|---|---|
| Root Frame screen rect | (0,0,1120,460) | (0,0,1440,900) |
| Fixed outer Frame | (20,20,330,210) | (20,20,330,210) |
| Relative nested Panel | (53,51.5,198,105) | Same |
| Exact child Text | (65,65.5,110,26) | Same |
| Right_ref Image | (197,57.5,40,40) | Same |
| Center_ref Button | (92,89,120,30) | Same |
| Right/bottom_ref Panel | (856,310,240,120) | (1176,750,240,120) |
| Relative nested Image | (904,340,72,48) | (1224,780,72,48) |
| Center_ref relative Panel | (420,161,280,138) | (540,315,360,270) |
| Relative nested Text | (448,188.6,168,55.2) | (576,369,216,108) |
| Plain right/bottom Button | (350,246,130,44) | Same |
| Negative-position Panel | (-12,-9,120,70) | Same |

The remaining four descendants (overhanging Frame and Button, bottom-ref
Text, hidden Panel and hidden descendant Text) are included with all 16
in the machine-readable JSON and tests. All **32 native descendant screen
rectangles** agree with the shared authored-coordinate engine within
`0.000001` units on each of X, Y, width and height under these two
controlled root sizes. No widget-class-specific positional corrections
were needed.

The native local getter values agree with the authored geometry
`position` and `size` values for all 16 descendants at both root sizes.
The resized root is intentionally excluded from that authoring check
because the test mod calls `SetScreenSize` to override it at runtime.

## Independent hierarchical visibility observation

For the authored invisible `Panel_Hidden`, native
`IsVisible()=0` and `IsVisibleHierarchy()=0`.
For its explicitly visible child `Text_HiddenDescendant`, native
`IsVisible()=1` but `IsVisibleHierarchy()=0`.
The shared geometry snapshot's effective `visible` value matches
`IsVisibleHierarchy()` for every captured descendant in both phases.
This supports inheritance of effective visibility, but does **not**
measure painted pixels or clipping.

## Current confidence boundary

**Confirmed for this fixture:** common exact/relative position and size,
plain/reference alignment, negative positions, fixed nested constraints,
and inherited visibility across Frame/Panel/Text/Image/Button at two
runtime-resized root rectangles.

**Not confirmed:** native scale-mode/DPI context and general screen
resolution differences, native scissor/clip bounds, actual text glyph
painting/metrics, image texture/UV content, size-to-content, rotation,
safe-zone, dynamic style/control state, interactive behavior, nested
Grid/Wrap/Scroll native arrangement, or data-driven specialized widgets.

The comparator's stricter provenance gate deliberately allows a
numeric result of **32/32 matched** with formal status **2 PENDING**
because the DayZ client build ID is unknown. A mismatched rectangle
would FAIL even without that build ID. An explicit `unit-test-double`
can never count as native PASS.

No production Canvas changes or PR merge follow from this test alone.
Continue common geometry/native measurement evidence collection in the
unified engine rather than widget-specific hacks.
