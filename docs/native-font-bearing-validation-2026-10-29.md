# Bearing-mode FNT5 placement test — October 29, 2026

**Branch:** `research/native-font-source-selection`, compare to median-MSDF/legacy baseline commit `f6ae5a05`. The user supplied browser console `Pasted text(20261029-195923).txt` and screenshot `image(20261029-195949).png`. Their SHA-256 hashes, the previous median-MSDF/legacy capture hashes, signed per-glyph coordinate errors and test conditions are stored in `tests/fixtures/native-font-route/capture.placement.2026-10-29.json`. Original PNGs and logs remain outside the repository.

The native source remains **Standalone FNT5 cell** for all three Metron fonts, median RGB/MSDF reconstruction remains on and only `experimentalFnt5Placement=1` changes placement to `bearing`.

For the same 18 unique glyphs (`ABC012` × 3 fonts), compare thresholded Studio ink origins with FNT5 metric expectations `penX + bearingX` and `baseY + nominalSize - bearingY`. For each glyph average absolute x/y displacement and then average all 18.

| Font | Legacy MSDF origin error | Bearing MSDF origin error |
|---|---:|---:|
| MetronBook24 | 10.667 px | 0.792 px |
| MetronLight24 | 10.750 px | 0.708 px |
| MetronBook72 | 24.333 px | 1.083 px |
| **All glyphs** | **15.250 px** | **0.861 px** |

These are **internal measured ink-to-metadata coordinates**, not native Workbench pixel positions. The screenshot appears better aligned and Book72's 68px button text is now contained, but its 34px-high TextWidget remains visibly clipped. The underlying 72px nominal font produces a 52px glyph at ink Y≈20, extending far below that widget. The bearing math is promising but cannot fix glyph size.

**Disposition:** close the *internal* bearing-origin test for the 18 observed glyphs; native Workbench font placement and size parity remain OPEN. The prior 278/278 geometry tests and TypeScript/Vite build passed on an earlier commit; **this evidence and regression assertion require a fresh local run**. No production Canvas or font defaults were changed.

## Next single-variable test

An **existing** opt-in `experimentalFnt5Fit` route in `src/components/Canvas.tsx` limits requested glyph size to `Math.min(nominalSize, widgetHeight * ratio)` for standalone FNT5 fonts without explicitly authored text size. Ratio `1` means **0.9**, an empirical research heuristic, not recovered native behavior.

Open the unchanged fixture after reindexing GUI resources with:

```
http://localhost:5173/?experimentalStandaloneFnt5=1&experimentalMsdf=1&experimentalFnt5Placement=1&experimentalFnt5Fit=1&debugFnt5Sampling=1
```

Expected request sizes: short Book72 **72→30.6**; tall Book72 **72** unchanged; button Book72 **72→61.2**; Book24/Light24 **24** unchanged. Compare visually with the recorded Workbench reference and previous bearing screenshot. Confirm `requestedFontSize` in the `[SDF widget]` logs, not only that text became visible. The 0.9 ratio is only a falsifiable hypothesis. Do not promote it or change native behavior until independent Workbench font-size/position evidence supports it.

Keep `experimentalFnt5Cells`, `experimentalFnt5Layout`, `experimentalMsdfSmoothing` and other experiments disabled to avoid mixing variables. PR #47 stays draft.
