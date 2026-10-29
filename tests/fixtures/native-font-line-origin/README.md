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
