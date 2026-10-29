# Shared FNT5 default baseline: controlled experiment

The October 29 baseline diagnostic captured **60 FNT5 placement records** for 20 widgets: TextWidget `baseY=0`; ButtonWidget `baseY=-0.125×height`. The paired Workbench visual fixture, however, showed nearly equal default Text and Button glyph-top positions. A retrospective shared-origin hypothesis `baseY=-0.08×height` reduces mean 20-case screenshot top error from **4.155 to 1.502 logical px**. This is a fit to training glyphs `ABC`, **not** native rule recovery. See `tests/fixtures/native-font-default-baseline/capture.instrumentation.2026-10-29.json`.

Only when `experimentalFnt5LineOrigin=0.08` is supplied does this branch replace the *single-line standalone FNT5* line origin with `-0.08×height` for both families. Fonts without pixel FNT5 metrics, multiline rendering, invalid coefficients, and all default modes are unchanged. The placement diagnostic dedup key now includes `penX` to retain Text and Button records even with equal `baseY`. This is an opt-in trial, not a permanent renderer correction.

Run on `research/native-font-shared-line-origin`:
```powershell
git fetch origin
git switch research/native-font-shared-line-origin
git pull --ff-only
npm run test:geometry-engine
npm run test:native-image-uv
npm run typecheck
npm run build
npm run dev
```

Then load the *same* 1280×720 `NIH_NativeFontDefaultBaseline.layout`, plus an **independent holdout** fixture at `tests/fixtures/native-font-line-origin/NIH_NativeFontBaselineHoldout.layout` in both Workbench and Studio. The holdout replaces only the glyphs `ABC` with **Hg9** to test descenders and numerals. Keep Workbench 68% zoom and root DPI scaling off.

Studio URL:
```
http://localhost:5173/?experimentalStandaloneFnt5=1&experimentalMsdf=1&experimentalFnt5Placement=1&experimentalFnt5Fit=height&experimentalFnt5LineOrigin=0.08&debugFnt5Sampling=1
```

Verify `[FNT5 placement]` now records `baseY` near **-1.92 / -2.72 / -5.44 / -8.80px** for both widget families, and verify independent Holdout Workbench/Studio screenshots. No pixel accuracy claim, global font setting, or PR #47 change should be made without that holdout. Explicit native alignment, wrapping, and other font families remain open.

## 2026-10-29 Hg9 unseen-glyph holdout — paired native capture

The independent `Hg9` holdout has now been captured in **DayZ Workbench 1.30** and Studio 0.37.0 at 1280×720, displayed 68% zoom. Evidence is frozen in `capture.holdout.2026-10-29.json` with original PNG and log SHA-256s, both viewport root rectangles, all twenty per-control white-glyph ink widths/top offsets and the exact detection method. Original screenshots/log are conversation attachments, not repository assets. Workbench screenshot shows no new unknown-keyword errors for the holdout layout.

**RGB>170 threshold, cropped authored widgets:** the shared `baseY=-0.08×height` experiment produces **1.769 logical px** mean absolute glyph-top deviation from Workbench over all 20 controls. Reconstructing the legacy line origins from this exact experimental capture would produce **3.794 px** (about **53.4%** larger improvement on holdout). This legacy value is a counterfactual calculation, **not** an independently photographed legacy `Hg9` run. At the stricter RGB>190 threshold the new MAE is ≈1.912px and projected legacy ≈3.871px. All 20 ink widths are near native (mean absolute percent difference **2.18%**), but neither glyph alpha nor pixel-perfect matching is established.

The browser log independently confirms **60** FNT5 placement records with baseYs `-1.92/-2.72/-5.44/-8.80` for widget heights `24/34/68/110`, standalone FNT5 sources, median MSDF, bearing placement, height-sized fonts and separate Text/Button records. It also reports **20/20 `g` glyphs with raw `inkOutsideWidget:true`**, zero for `H` or `9`. Source logging checks raw ink extent, not actual visible HTML clipping. Both screenshots show a small edge effect at the bottom of the `g` samples; Workbench has a few white pixels in the first 1–2 screenshot rows near the rounded widget-bottom coordinate, while Studio has none. Those pixels are too few and close to the raster boundary to infer a fundamental native clipping/scissor rule.

**Disposition:** independent holdout supports the shared-origin experiment as a stronger general candidate, not as a recovered Enfusion constant. Default renderer stays unchanged. Do not introduce per-widget or per-font Y adjustments. Next isolate native descender clipping near fractional boundary coordinates and test other font families/explicit sizes before any production promotion.
