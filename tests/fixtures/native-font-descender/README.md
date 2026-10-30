# Native TextWidget/ButtonWidget descender versus parent clipping — controlled visual gate

This is **not** a change to the production font renderer. The completed `Hg9` holdout has 20/20 raw `g` glyphs marked `inkOutsideWidget` in Studio's **expanded diagnostic canvas**, but the corresponding default screenshot shows only a 1–2-raster-pixel discrepancy at the rounded widget boundary. The diagnostic flag alone cannot prove pixels actually escape the visible widget or parent scissor.

This new fixture makes the clipping decision independently observable. It uses only previously tested native layout fields: `FrameWidgetClass`, `TextWidgetClass`, `ButtonWidgetClass`, `font`, `text`, exact pixel size/position and `clipchildren`. **No** unsupported `"text valign"` field is authored.

## Fixture matrix

- Font sources: **MetronBook72**, **MetronBook24** (no special-case glyph offsets)
- Widget families: **TextWidget**, **ButtonWidget**
- Baseline texts: `H9` (no descender) versus `Hg9` (lowercase descender)
- Parent clipping: `clipchildren 0` vs `clipchildren 1`
- Clip depth: child widget height **68px** in all cases; parent height **66px** (near boundary, trims 2px) or **44px** (deep boundary, trims 24px)

This yields **32 cases**, arranged as eight rows and four columns at 1280×720. A near-boundary case tests the previously observed 1–2px ambiguity. The deep-boundary case acts as a positive control: if native and Studio disagree even across 24px of deliberate overhang, screenshot rounding alone cannot explain it. Each clipped/unclipped pair has identical child font/text/size; only parent x-position and `clipchildren` differ.

## Local verification

```powershell
git fetch origin
git switch research/native-font-descender-boundary
git pull --ff-only

npm run test:geometry-engine
npm run test:native-image-uv
npm run typecheck
npm run build
npm run dev
```

Expected geometry suite: **309 tests** if the four new fixture checks pass. This is not a claim that the new commit has passed on Windows.

Open `tests/fixtures/native-font-descender/NIH_NativeFontDescenderBoundary.layout` in **both** Workbench and Studio, root 1280×720, zoom 68%, Workbench DPI scaling unchecked. Studio URL (same working experiment):

```
http://localhost:5173/?experimentalStandaloneFnt5=1&experimentalMsdf=1&experimentalFnt5Placement=1&experimentalFnt5Fit=height&experimentalFnt5LineOrigin=0.08&debugFnt5Sampling=1
```

Ensure native Workbench has no unknown-property errors. Preserve original screenshots and Studio text-route/placement console logs. Before interpreting tiny outside-parent ink, first establish the **deep-boundary** on/off controls and exact physical root screenshot rectangles.

### Acceptance boundary

Record actual screen pixels *inside* and *outside* each known parent rectangle for paired cases, using Workbench/Studio independently. Restrict the comparison to white glyphs; Studio's ButtonWidget blue background is not native paint evidence. The fixture tests **visible parent clipping** for native text paints, not the inner text widget's own glyph atlas cropping. If the native on/off cases differ only by 1–2 raster pixels, mark near-boundary inference **inconclusive** and retain deep-boundary results separately. Do not change global `overflow`, font baseline, or glyph sampling from screenshot rounding alone.

## Status

**Pending paired native/Studio capture**. Existing baseline and `Hg9` holdout research stays frozen on `research/native-font-shared-line-origin`. PR #47 remains draft and unchanged.

## Completed Workbench and Studio comparison — October 29, 2026

Both images load the 32-control native-compatible fixture at 1280×720, 68% zoom. Full screenshot SHA-256s, measured viewport rectangles, all below-parent ink-pixel counts, methodology and threshold sensitivity are recorded in `capture.visual.2026-10-29.json`. Raw PNGs remain available in the conversation and are not committed.

For the **eight deep (24px) overhang cases**, the RGB>170 threshold detects **2361 white screenshot pixels below the unclipped parent in Workbench** and **1585 in Studio**. With `clipchildren=1`, these drop to **152 in Workbench** (entirely within the first 1–2 physical screenshot rows after the rounded parent boundary) and **0 in Studio**. Across all 16 clipped cases, Workbench has 170 such boundary-adjacent pixels, Studio 0, and **neither editor has white ink two or more physical rows beyond the parent bottom**. Thresholds 190 and 210 preserve this conclusion. Per-editor pixel counts must not be treated as comparable alpha coverage.

**Result: parent clipping behaves consistently at the controlled visual level, including both TextWidget and ButtonWidget and both tested Metron fonts.** The remaining 1–2-raster-pixel Workbench fringe could come from half-pixel boundaries, zoom, antialiasing or capture rounding. This evidence **does not justify changing generic CSS overflow, clipchildren, or the shared font line origin**. It also does not establish exact Enfusion raster scissor behavior or self-clipping of individual sprites.

Separate paint issue: Studio shows blue ButtonWidget backgrounds while Workbench's test buttons do not have matching blue backgrounds. That belongs in a button-style/defaults investigation, not text clipping.

This screenshot message did **not** include the Windows 309-test transcript or a fresh Studio console log. The fixture has been visually evaluated, not locally test-validated. No renderer code was changed.
