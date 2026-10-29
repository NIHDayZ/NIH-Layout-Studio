# Native Frame/Panel clipping — paired visual gate

**Current status:** paired Workbench/Studio screenshots support a **visual PASS in all six authored Frame/Panel and nested clipping cases**, but native internal scissor and exact pixel parity are unverified. The unmodified capture template remains deliberately PENDING for strict pixel readback. Parent branch `research/native-image-pixel-parity` has passing 278 selected tests and four visually matching U/V orientations. This new fixture does **not** edit the production renderer.

## Purpose and fixture

`NIH_NativeClip_Parity.layout` creates a **1280×720 exact-size root** matching the size already available in both Workbench and Studio. Its six cases share the same candidate `image0 "set:dayz_gui image:DayZLogo"` already shown to resolve in both editors on October 29.

Top row pairs four controls: `Frame_NoClip` versus `Frame_Clip`, and `Panel_NoClip` versus `Panel_Clip`. Each parent is 210×170 and contains two textured images: one extends beyond the right edge, the other beyond the left and bottom edges. The only behavioral difference in each pair is `clipchildren 0` vs `clipchildren 1`.

Bottom row compares `Nested_NoClip` versus `Nested_Clip`: both have a clipping outer Panel with an inner Frame containing an overhanging ImageWidget. Only the **inner Frame's** `clipchildren` value differs. This distinguishes correct ancestor-intersection behavior from a one-level CSS hide. The child is deliberately contained within the outer Panel but extends beyond the inner Frame.

All images are intentionally asymmetric texture samples, so a missing image or white error placeholder must not count as a pass. The fixture changes no Font, Grid, Wrap, Scroll or DPI behavior; they require separate evidence.

## Acceptance procedure

1. Fetch and switch to `research/native-clipping-visual-gate`; run `npm run test:geometry-engine`, `npm run test:native-image-uv`, `npm run typecheck`, `npm run build`.
2. Open **the same fixture** in DayZ Tools Workbench and NIH Layout Studio. Ensure vanilla imageset resources resolve in both, and each image is visibly textured. Use editor preview/root **1280×720** in both. Root DPI scaling off in Workbench.
3. Compare at the **same effective zoom** if possible; if not, record both zoom percentages, Windows display scaling and browser DPR. Turn Studio bounds/names off. Keep both editor windows fully visible and capture original lossless PNG screenshots.
4. Confirm the no-clip cases allow an image to paint beyond the parent rectangle while the clipped cases truncate it at the parent's bounds. Also check the left/top/negative extents are treated correctly. At the nested cases, confirm outer clipping remains active while inner Frame clips only in the `Nested_Clip` variant.
5. Record side-by-side native and Studio paint outcomes, including clipping edge positions, the image resource, zoom, and any unexpected fill/empty region. Do **not** claim native parity from the shared `InspectAuthoredVisibility` calculation alone: its `intersectionCandidate` is geometric prediction, not engine scissor readback.

If a visual mismatch occurs, inspect whether it comes from the parent `clipchildren` flag, nested DOM stacking, CSS `overflow`, editor viewport clipping, or native draw order. Avoid patching isolated widgets before checking common clipping behavior.

## Scope boundary

This fixture is a visual comparison of Frame/Panel clipping with textured ImageWidget children. It does not prove all native scissor/clip behavior, managed Scroll clipping, rounded masks, alpha blending, or FNT5 glyph clipping. Preserve `tests/fixtures/native-clip-visual/capture.template.json` as **pending** for strict-pixel/native-scissor evidence. A separate observed-visual JSON records the paired screenshots, without populating unmeasured native scissor fields. PR #47 remains draft and unchanged.

## 2026-10-29 observed paired screenshot results

The user provided `image(20261029-181740).png` (Workbench, SHA-256 `392437c4599591b62b74fc8d228b82bede4f4cc17b290c33480b3eba18181420`) and `image(20261029-181752).png` (Studio, SHA-256 `0e65426f1b3f5bc0b3ba200a987b32b0c42462253959664ac6161913299769ff`). Both use preview root **1280×720** and displayed **68%** zoom; Workbench root DPI scaling is unchecked.

**All six cases visually match**: Frame and Panel un-clipped/clipped controls and both nested cases. Five separately selected overhang regions show positive white-logo pixel counts without clipping, while corresponding exterior regions with clipping enabled each show **zero white pixels in both screenshots**. The nested case confirms that enabled clipping on the inner Frame masks parts of the image even when the surrounding outer Panel permits that part of the region.

For a secondary diagnostic, screenshot-local root crops were rescaled to logical 1280×720, white pixels defined by RGB channels all >=210, and the full white-logo silhouette intersection-over-union was **0.9118**. This diagnostic normalizes displayed zoom but is not a pixel-perfect/alpha raster agreement score. [Observed measurement metadata](capture.visual.2026-10-29.json) includes ten sampled logical regions, both screenshots' SHA-256 hashes and the exact crop rectangles. Original screenshots remain outside the repository.

The user's local validation completed **271/271 geometry tests**, **11/11 UV tests**, TypeScript and Vite production build on `d60631d1` before this evidence and its new regression test. **Disposition:** close the tested **Frame/Panel visual clipping** gate only. Native scissor internals, alternate paint modes, Scroll managed clipping and font clipping remain independent. Re-run geometry tests after these new evidence tests are committed.
