# Workbench ScrollWidget parity capture kit

**Status:** In-game native ScrollWidget getter observations collected on October 28, 2026.
The four independently measured child-viewport/context rectangles are still **PENDING**
in `capture.template.json`; native scale/context and clipping have not been captured.
See [2026-10-28-runtime-capture.md](2026-10-28-runtime-capture.md).

## Purpose

Compare the diagnostic engine against actual Workbench layout output for
horizontal/vertical scrollbar reservations, left-side vertical scrollbar,
scroll offsets and clipping. This is a small, entirely original, controlled
`.layout` fixture. It intentionally does not require proprietary UI assets
or any custom scripts.

The supplied DayZ GUI archive also includes Bohemia's larger existing example:
`gui/layouts/examples/ScrollTest.layout`. That example has vertical-only and
combined-axis ScrollWidgets; it provides independent context but should not
be copied into the public repository.

## Current Workbench capture status (October 28, 2026)

**Static capture completed.** See `2026-10-28-static-capture.md` and
`capture.visual.2026-10-28.json` for the user-supplied screenshots'
observations. All four panels load. Scrollbars appear on the expected sides,
and the lower overhang buttons are visibly partly obscured. The `ScrollLeft`
properties confirm `Clipchildren` and `Ignore invisible` checked.

The Layout Editor does **not** offer a usable interactive scroll test here, so
the prior capture steps below are now a reference procedure, **not another
request to repeat this Workbench test**. No more static Workbench screenshots
are needed for this fixture.

Crucially, `ScrollLeft` shows its widget `Scaled` box enabled even though
the top toolbar has Root DPI scaling disabled. The relation of these UI controls
to the native scrollbar thickness scaling path is unresolved. The unscaled
`10`-unit math in the numeric comparator remains a **hypothesis**.

**In-game runtime capture completed:** the disposable [runtime-mod/](runtime-mod/README.md)
compiled and ran successfully in a DayZ client session. The initial, halfway,
full-scroll and reset getter values have been recorded in
[`capture.runtime.2026-10-28.json`](capture.runtime.2026-10-28.json)
and checked by `tests/workbench-scroll-runtime.test.mjs`. Observed effective
scrollbar width was 10, content extents were 295×220, and native child
screen-space motion matched the recovered offset and left-scrollbar arithmetic.

This is **native getter and screen-coordinate evidence**, not a measured child
viewport/context rectangle, native DPI context or clipping region.
The engine has no production ScrollWidget strategy enabled.

**Numeric parity is now additionally gated by native scaling provenance.**
The unscaled 10-unit predictions remain visible as hypotheses, but a fixture
without independently established native scaling branch/context cannot PASS
even if observed rectangles happen to match. Any case that could PASS also
needs independent provenance for the actual native offsets, not just a
zero-offset guess. The comparator cannot independently authenticate an
evidence file or build identifier.

## Capture procedure on Windows

1. Copy `NIH_Scroll_Parity.layout` to a directory that Workbench can browse,
   such as `P:\\NIH_Scroll_Parity\\NIH_Scroll_Parity.layout`.
2. Open the file in **DayZ Tools → Workbench → Layout Editor**. If the editor
   requires a project resource path, open or import it using Workbench's
   Resource Browser. Do not change the original four ScrollWidget properties.
3. Set or note the preview resolution, UI/display scale, and Workbench/DayZ
   Tools version. Capture **one unmodified full-window screenshot** showing
   all four widgets at their initial positions.
4. Capture a screenshot zoomed to each named ScrollWidget:
   `ScrollNone`, `ScrollVertical`, `ScrollBoth`, `ScrollLeft`.
   Note whether the `ORIGIN` and `OVERHANG` buttons are fully visible,
   partially clipped, or invisible. If the preview supports scrolling, test
   the vertical wheel / scrollbar and horizontal scrollbar separately, and
   capture **before and after** images. If it doesn't support interactive
   scroll, note this; do not guess an offset.
5. Select the `ScrollLeft` widget in the editor and capture its property
   panel, with `Scrollbar H`, `Scrollbar V`, `Scrollbar V Left`,
   and any visible `Ignore invisible` setting.
6. Optionally open the stock `gui/layouts/examples/ScrollTest.layout` and
   capture its two scroll panels at their initial and scrolled positions.
   This is a separate observation, not a known pixel-correct golden fixture.

**Return:** screenshots in one ZIP, plus Workbench version, preview size,
UI scale, and a note indicating which panels could actually be scrolled.
Please do **not** send a proprietary Workbench executable again.

## Native numeric measurements (optional)

The comparison tool uses exact runtime rectangles only when those values are
**independently observed**. You do not need to manually derive them from a
screenshot. Leave `observed: null` in the template unless you have measured
the actual child viewport and child context, e.g. from a supported runtime
widget inspection tool. Each populated case must carry its actual build
version, capture method, and evidence file path.

The four template cases describe authored dimensions and scrollbar flags
only. Their initial offsets are a **zero-offset hypothesis**; change them if
native runtime observations show otherwise.

Run comparisons after installing project dependencies and building the
geometry test modules:

```powershell
npm run test:geometry-engine
npm run compare:workbench-scroll -- tests/fixtures/workbench-scroll/capture.template.json --allow-pending
```

The first command runs the synthetic/unit regressions. The second prints
`PENDING` for all four cases until actual observed values are filled in.
Without `--allow-pending`, the comparator exits code 2 when work remains.
Real observed mismatches exit code 1. This prevents a missing or synthetic
fixture from masquerading as successful Workbench parity.

## What this does NOT prove

This capture compares only the pinned Workbench build and specific viewport
conditions. Native child visibility eligibility, Scroll clip defaults,
scrollbar visual thickness under alternate scaling, setter clamping,
nested ScrollWidgets, and DPI-dependent behavior still need separate evidence.
There is no change to live Canvas rendering or saved layout serialization.
