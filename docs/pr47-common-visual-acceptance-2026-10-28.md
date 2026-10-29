# PR #47 — paired Studio / Workbench visual acceptance: common geometry

**Captured by user:** 2026-10-28 local time (screenshots supplied in conversation).
**Source fixture:** `tests/fixtures/workbench-common/NIH_Common_Geometry_Parity.layout`
**Comparing:** NIH Layout Studio v0.37.0 and DayZ Tools Workbench Layout Editor.
**Both displayed root:** 1280 × 720; zoom controls read **68%**.
**Workbench root DPI scaling checkbox:** appears off in screenshot.
**Status:** **Common placement visually consistent; presentation parity NOT ACCEPTED.**
Do not confuse this screenshot comparison with pixel-accurate or native-C++ parity.
The original screenshots are user-provided conversation evidence; copies are not
committed to the repository.

## Observed matching geometry / structure

The fixture's corresponding samples appear in the same relative regions:
the nested upper-left `Frame_Exact / Panel_Relative / Text_Exact /
Button_CenterRef` group, `Button_PlainRight`, middle relative panel
and `Text_Relative`, and `Panel_RightBottom / Text_BottomRef` near the
bottom-right. Studio's hierarchy retains all authored nodes, and
`Panel_Hidden` / `Text_HiddenDescendant` is not painted as visible.
The `Frame_Overhang` clipping test does not show a clearly escaped CLIP
label in either screenshot.

This is **qualitative visual consistency**, not a new numeric result.
Previously captured native getters separately matched **32 / 32**
common descendant rectangles at **1120 × 460** and **1440 × 900**.
The 1280 × 720 screenshot has different root dimensions, and the
displayed 68% zoom controls do not independently establish exact
physical/DPI scaling equivalence between the applications.

## Evidence-backed default appearance mismatches

1. **No-resource ImageWidget:** `Image_RightRef` and
   `Image_Relative` have **no `image0` or `imageTexture` property**.
   Workbench paints solid white rectangles in this capture. Studio
   shows only diagnostic outlines/labels. In Studio's current
   `Canvas.tsx`, `RenderWidgetContent` returns `null` when
   `GetImageCandidates` is empty, except for a debug-name
   placeholder. Therefore this is a **known preview default
   difference**, not proof that the widgets' rectangles are wrong.

2. **Unstyled ButtonWidget:** `Button_CenterRef` and
   `Button_PlainRight` have text but **no authored style/color**.
   Workbench displays their text without Studio's filled blue-gray
   button panel. Studio's `BuildWidgetStyle` adds
   `rgba(50,68,86,0.78)` when the button's style is neither
   `empty` nor `blank`, including when no style was authored.
   This is another **editor fallback visual difference**, not an
   anchor/size regression.

3. **Unspecified font/text sizes:** the fixture does not load a
   project/vanilla font and does not author a `font` on these
   text/button widgets. Studio therefore uses the CSS fallback with
   `InferFontSize` (height-based, clamped to 10…32 px), whereas
   Workbench paints its native default font. Several labels,
   particularly `RELATIVE`, differ in apparent glyph size and
   weight. Exact font/glyph metrics cannot be certified from this
   fixture; inspect a font-resource-backed real layout separately.

4. **Editor backdrop:** Workbench's root area appears medium gray,
   Studio's standard canvas dark. The root Frame authors no `color`
   or `style`. This is not evidence that an authored widget fill is
   being ignored; the editor backdrop choices differ.
   Studio already offers a **diagnostic-only** URL flag
   `?experimentalWorkbenchBackdrop=1` which uses a neutral
   rgb(130,130,130) backing. Do not silently turn that on for
   production or claim it reproduces native rendered pixels.

## Acceptance disposition

- **Source/hierarchy:** visually present, no missing authored subtree seen.
- **Shared common geometry:** **provisional visual pass**, cross-checked
  against the independent earlier getter captures; no numeric screenshot
  measurement completed.
- **Default visual representation:** **gap recorded**, not passed.
- **Native font/image/style parity:** **pending**, requires a sample with
  loaded vanilla or project resources and deliberate styling.
- **No code change justified from one fallback fixture alone.**
  Avoid global white-image or transparent-button rules until
  independently testing affected style states and other widget
  families. Keep observations distinct from speculations about C++.

## Next local acceptance

For a comparison of *backdrop* without changing authored sources,
the user can optionally open
`http://127.0.0.1:5173/?experimentalWorkbenchBackdrop=1`.
For a clean screenshot turn **Widget Bounds** and **Widget Names**
off; the diagnostic overlays intentionally do not match Workbench's
normal drawing. That can test presentation clarity but does not
validate font or ImageWidget defaults.

Proceed to a representative actual DayZ/NIH layout with its
imagesets, fonts and style resources indexed in Studio and loaded
in Workbench. Compare the same viewport/root size, note widget
`Scaled` and Workbench root-DPI options, and capture one paired
view focused on actual rendering. Preserve the no-asset fixture as
a separate controlled default-appearance test.
