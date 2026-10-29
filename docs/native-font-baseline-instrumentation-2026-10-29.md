# Baseline instrumentation fix — research only

The `2026-10-29` 20-control comparison found that Workbench's TextWidget and ButtonWidget glyph-top positions are nearly identical for matching fonts/heights, while Studio's top-vs-centered line behavior differs. The companion Studio console has 20 `[SDF widget]` records but only **36 unique `[FNT5 placement]` records**, all with `baseY=0`.

Source confirmed the cause: `LogFnt5Placement` deduplicates by font resource, glyph, mode, requested size and widget rectangle, but **omits `baseY`**. The TextWidget (top) renders first. A later ButtonWidget with the same font/height uses a different `baseY` but is suppressed by the old log key. Thus earlier evidence must NOT be interpreted as ButtonWidget rendering with `baseY=0`.

This branch makes the **minimum diagnostic-only change**:
- Include `baseY` in the placement-log deduplication key.
- Include `hAlign` and `vAlign` in the `[SDF widget]` record.
- Keep the resource, alpha shader, glyph drawing, size, text alignment defaults, DOM and production Canvas **unchanged**.

## Acceptance

```powershell
git fetch origin
git switch research/native-font-baseline-instrumentation
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build
npm run dev
```

Expected geometry test count is **297**, assuming both latest evidence tests and the new diagnostic guard pass. The count is not a claim of local validation.

Open the **unchanged** `NIH_NativeFontDefaultBaseline.layout` with GUI assets reindexed at:

```
http://localhost:5173/?experimentalStandaloneFnt5=1&experimentalMsdf=1&experimentalFnt5Placement=1&experimentalFnt5Fit=height&debugFnt5Sampling=1
```

At 1280×720 and 68% zoom, send the full console `[FNT5 placement]` and `[SDF widget]` entries, not only a screenshot. Expect approximately **60 unique placement records**: 5 rows × 4 heights × 3 glyphs, since TextBook72 and ButtonBook72 and TextBook24 and ButtonBook24 now have distinct baseY values. The placement limit of 120 permits the full fixture. All sampled results should still be on `Standalone FNT5 cell`, `experimentalMsdf: true`, `mode: "bearing"`. No visual change is expected: this branch modifies diagnostic logging only.

After that, compare **actual Studio text/control baseY values** against Workbench's paired screenshot ink-top positions. A consistent native baseline rule should be derived from source font metrics and repeated native observations, not a Book72/Book24 special-case adjustment. Leave all production changes and PR #47 on hold.

## 2026-10-29 diagnostic confirmation and shared-origin model proposal

The rerun log `Pasted text(20261029-215826).txt` (SHA-256 `438700d2af570cee3cc57f4c313ff3823b6fe219d08a1545f1555c2277786068`) confirms the deduplication fix: **60/60 FNT5 glyph placements** with 36 TextWidget and 24 ButtonWidget placements. The screenshot `image(20261029-215837).png` SHA-256 is `57c96a727626b8fe87af2ce462e7183a318c208cd718b1f2748e214a52e162a1`. All resources remain available, 20/20 widgets use SDF and 203 EDDS decode without failures. The original files remain conversation attachments, not committed.

TextWidget uses **baseY 0** at all four heights, whereas ButtonWidget uses **-0.125×height** (-3, -4.25, -8.5, -13.75px), exactly as the code's 1.25 font-size line-height/centering calculation predicts. Native screenshot evidence already recorded on this branch shows the matching native default TextWidget/ButtonWidget ink tops within 0.851 logical pixel for all eight Book72 and Book24 height pairs, in contrast with Studio's divergent defaults. These are concrete findings about the renderer path, not proof of Enfusion's internal line-height implementation.

A retrospective cross-font fit using all 20 saved native/Studio screenshot rectangles yields existing MAE **4.155 logical px**. Replacing BOTH widget families' default line-origin with `baseY=-0.08×height` predicts **1.502 px** MAE (about **63.9%** lower); 0.10 predicts **1.591 px**. This is a **training-set fit** on the original ABC screenshots, not independent visual verification of a native constant. It can be explored only as a separate opt-in, with holdout glyphs and other native widget sizes required before any promotion.

The new evidence and regression test have not received a fresh user-side automated run. This research branch does not change glyph rendering.
