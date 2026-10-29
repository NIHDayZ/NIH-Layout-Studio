# Common native widget geometry comparison (M1/M2 cross-family gate)

**Status (2026-10-28):** The authored-geometry compatibility regression passed
and a separate DayZ client probe captured 32 actual descendant screen
rectangles across both root sizes. **All 32 match** shared authored geometry
with zero numeric delta. See
[2026-10-28-runtime-capture.md](2026-10-28-runtime-capture.md)
and [capture.runtime.2026-10-28.json](capture.runtime.2026-10-28.json).
The native client build was not captured, so the stricter version-pinned
comparator still reports **2 PENDING**, each with 16/16 numeric matches.

## Purpose

This is a general hierarchy geometry experiment, **not another special-case
ScrollWidget fix**. The original `NIH_Common_Geometry_Parity.layout` contains
five common Workbench widget families:

- Frame, Panel, Text, Image, Button
- Exact, relative, and mixed-axis sizes and positions
- Right/bottom reference alignment; center reference; plain right/bottom
- Nested frame/panel layout, zero/negative offsets, clipping and hidden subtree
- A relative root and responsive children, tested under two root sizes

The fixture only probes authored geometry. It deliberately excludes
size-to-content, Grid, Wrap, Scroll, text measurement, 9-slice, UVs,
image resolution, styles, rotation, safe-zone, and unknown DPI transforms.
Those are important but separate feature gates.

`tests/shared-cross-family-geometry.test.mjs` parses the actual `.layout`
through the project parser, prepares one measured hierarchy, and compares it
across four root configurations with the **frozen pre-refactor** geometry
oracle. This protects compatibility with the existing Studio implementation,
**not** pixel-level/native placement parity.

## Native capture option (when required)

The independent [test-only runtime mod](runtime-mod/README.md) loads the
same layout in an actual DayZ client. It uses `GetChildren()/GetSibling()`
to collect every widget, not a hardcoded list of widget classes. It calls
`GetPos/GetSize/GetScreenPos/GetScreenSize` and the native visibility
getters, at explicitly requested **1120×460** and **1440×900** root screen
sizes. It does not collect clipping/scissor bounds, binary scale context,
glyph/image intrinsic bounds or user interaction.

The probe has now **compiled and run successfully in DayZ**. The user supplied
filtered native getter output from `script_2026-10-28_12-25-16.log`.
The client build and complete unfiltered log were not included, so those
fields are not invented. The earlier ScrollWidget runtime capture remains
independent and valid.

## Numeric comparison contract

`scripts/compare-workbench-common.mjs` reads a native capture JSON and the
actual parsed `.layout`, then compares screen-space rectangles against
`ArrangeMeasuredGeometry`, keyed by the widget **names** from the fixture.
It applies the same shared geometry to all supported ordinary widget classes,
without per-type coordinate exceptions.

The comparator accepts the **native observed test root's screen rectangle**
`{x,y,width,height}` as its `viewport`, a dictionary of native
`screenRect` values for **all 16 descendants**, tolerance, and provenance
containing `captureMethod`, `nativeBuild`, `evidenceFile`, and
`viewportSource`. The root is deliberately excluded from comparison
because the runtime harness uses `SetScreenSize` to override its authored
relative size. This compares the reusable authored geometry behavior of
its descendants under the **actual root size**, rather than incorrectly
assuming the runtime-resized root still fills the physical workspace.
A root rectangle inferred from Studio's predicted output is not
independent evidence. The captured root sizes alone do not prove which
native DPI scale branch was used.

The comparator reports `PENDING` for missing observations, the root
viewport, **or an unknown client build** (even with 16/16 numeric matches),
`FAIL` for mismatched/invalid rectangles, `PASS` for all matched
rectangles with a complete versioned evidence record, and `SYNTHETIC`
for explicitly synthetic or unit-test-double samples. Provenance is user-supplied and not
cryptographically authenticated. The test suite's mock passes are **only
comparator unit tests**, never native measurements.

After `npm run test:geometry-engine`:

```powershell
npm run compare:workbench-common -- tests/fixtures/workbench-common/capture.template.json --allow-pending
```

The untouched template remains **2 PENDING**. The **separate** recorded
runtime capture is compared as follows:

```powershell
npm run compare:workbench-common -- tests/fixtures/workbench-common/capture.runtime.2026-10-28.json --allow-pending
```

It reports `PENDING (16/16)` twice: real observed geometry was fully
compared, but the native client build was not recorded. A real mismatch
still produces a `FAIL` instead of being hidden by missing provenance.

## Next gate before production Canvas integration

Independent native geometry at the same captured root conditions must
validate the shared Frame/Panel/Text/Image/Button arrangement. Workbench
clipping, scaling, content negotiation and nested managed containers require
additional evidence; a successful cross-family placement comparison does not
validate those features. Continue using the current Canvas preview and
authoring behavior until these gates are met.
