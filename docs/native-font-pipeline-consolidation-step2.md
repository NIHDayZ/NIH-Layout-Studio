# FNT5 pipeline consolidation — step 2: shared glyph draw plan

**Research-only branch:** `research/native-font-glyph-plan`, based on opt-in FNT5 configuration consolidation at `21b43e8f`.

The original `SdfTextCanvas.tsx` had three copies of `ink.drawImage` and debug `LogFnt5Placement`: legacy FSDF/SDF, experimental FNT5 full-cell, and experimental FNT5 bearing placement.

This slice moves **only rectangle planning** into the pure `src/project/SdfGlyphDrawPlan.ts`. It delegates to the existing `Fnt5Placement` method and retains all three modes, mode precedence, cooked-atlas scaling for legacy fonts, FNT5 nominal-cell scaling, and **null (no draw)** behavior for invalid bearing data. The live Canvas renders and logs the resolved plan once. Source selection, MSDF alpha, advance/line height, experimental 0.08 baseline, font fitting, shadow, canvas clipping, and button backgrounds remain untouched.

The independent unit tests cover legacy portrait and non-square sprite math, cell and bearing modes, competing switches, missing/native-metric fallback, invalid bearing data, fractional baselines and the live single-render path. These are **functional regression tests**, not an automatic Workbench pixel comparison.

## Windows validation

```powershell
git fetch origin
git switch research/native-font-glyph-plan
git pull --ff-only
npm run test:geometry-engine
npm run test:native-image-uv
npm run test:fnt5
npm run test:sdf-preview
npm run typecheck
npm run build
```

The previous configuration slice expected 314 geometry tests. This adds **9 tests**; expected count **323** if that previous baseline was green. Do not treat the expected number as actual test results until it runs locally.

**Visual regression acceptance:** the original `NIH_NativeFontRoute_Parity.layout`, `NIH_NativeFontBaselineHoldout.layout`, and 32-case descender fixture should remain visually unchanged when loaded with the previously validated research URL. A new Workbench capture isn't required for an intended no-op refactor; keep the previous evidence files authoritative unless the output changes.

**Do not promote by default** or merge PR #47 from this source-only refactor. Future slices should also retain standalone font atlas source precedence and legacy sidecar behavior.
