# FNT5 pipeline consolidation — step 3: atlas sampling and glyph rasterization

**Source branch:** `research/native-font-raster-pipeline`, based on `research/native-font-glyph-plan` at `a3017ae7`. The user completed the preceding local validation step; no new terminal transcript was supplied in that message, so results for the current commit remain unverified until rerun.

`RasterGlyph` previously contained source-rectangle selection, a conditional MetronBook24 TCRD fallback, cache-key calculation, and duplicated alpha-mode conditionals. The new pure `src/project/SdfGlyphRasterPlan.ts` owns these calculations only. Atlas loading, ImageData ownership, sprite caching, canvas creation, debug messages, MSDF source data, line-origin, glyph draw-plan, parent clipping, and ButtonWidget style are unchanged.

## Preserved behavior

- **Standalone FNT5** atlas origin+cell-size takes precedence whenever valid FNT5 pixel metadata and an origin are present, regardless of `experimentalFnt5Cells`.
- **Experimental TCRD** remains limited to the previously-tested `sdf_metronbook24` / nominal 24 / 1024×1024 atlas, and only when `experimentalFnt5Cells=1`. No new universal atlas assumption is introduced.
- **Legacy FSDF/SDF** fallback continues to use `SdfAtlasCell` with reference-to-cooked atlas scaling and the same out-of-bounds rejection.
- **Cache policy** remains code-point only except when median-MSDF and experimental smoothing or stroke are both enabled, where displayed size contributes to the key.
- **RGBA conversion** keeps red-channel SDF, optional inversion, median-channel MSDF, optional size-dependent smoothing, and optional bias=2. All glyph pixels become white with the original computed alpha. The transform works on the private `getImageData` buffer, not the atlas.
- **Diagnostics** preserve `origin`, `selected`, atlas rectangle, resource ID, and the `[FNT5 placement]` records exactly.

## New regression coverage

Ten tests cover legacy and FNT5 atlas precedence, book24-only TCRD restrictions, missing/invalid sources, all cache-key modes, red/inverted SDF alpha, median/inverted MSDF, smooth/stroke alpha, private-buffer mutation, and live renderer usage of the shared helpers.

No explicit Workbench pixel-rendering change is intended. If the accepted native-vs-Studio screenshots differ after this refactor, investigate the code rather than altering experimental calibration.

## Windows validation

```powershell
git fetch origin
git switch research/native-font-raster-pipeline
git pull --ff-only
npm run test:geometry-engine
npm run test:native-image-uv
npm run test:fnt5
npm run test:sdf-preview
npm run test:imageset
npm run typecheck
npm run build
```

The expected geometry test count is **333** (323 preceding + 10 new). This is an expectation, not a completed run. Verify the legacy/default and existing validated FNT5 URL against the saved `ABC`, `Hg9`, and clipping fixtures if a browser rendering discrepancy appears.

**Integration boundaries:** no default font mode promotion, no new unsupported native layout properties, no special-case widget offsets, no style changes. PR #47 remains draft.
