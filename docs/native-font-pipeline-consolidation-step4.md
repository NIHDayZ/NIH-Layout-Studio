# FNT5 pipeline consolidation — step 4: resource contract and atlas context reuse

This research-only branch is based on `research/native-font-raster-pipeline` at `31a9a8f1`. The user requested continuation of the integration cleanup. No terminal output confirming Phase 3's 333 tests was supplied with that request; Phase 4 still requires a local run.

## Changes

1. **Renderer-independent resource type.** Move `SdfFontResource` to `src/project/SdfFontResource.ts`. Both the FNT5 parser and the project indexer import this data-only type rather than referencing a React canvas module. `SdfTextCanvas.tsx` continues re-exporting the type to avoid breaking older type consumers.
2. **Source context reuse.** `LoadAtlas` obtains a 2D context, validates its availability and retains it with the atlas source canvas. `RasterGlyph` calls `atlas.sourceContext.getImageData` rather than repeating `atlas.source.getContext` on every uncached glyph. This avoids redundant context lookup, but does **not** eliminate the pixel-readback itself, rasterization work, or glyph caching.

**Unchanged:** FNT5 parser algorithms, standalone-versus-sidecar precedence, reference cell mapping, MSDF/legacy sample math, glyph cache keys, draw rectangles, line origin, widget-height fit, canvas dimensions, visual diagnostics, parent clipping and ButtonWidget appearance.

## Review of remaining performance/functional risks

- The per-resource atlas source and glyph-sprite cache already avoid most repeated ImageData sampling for the same code point, except explicitly size-dependent smoothing/stroke modes. Keep the existing cache semantics.
- `LogFnt5Placement` still scans up to 120 diagnostic sprite images when `debugFnt5Sampling=1`. This is research-only; it does not affect the default render path. Treat separately before optimizing logging or screenshot measurements.
- Atlas decoding and glyph sprites remain browser Canvas-dependent; `SdfFontResource` and `Fnt5Standalone` no longer need type imports from React.
- This is a **structural optimization**. Its five tests check module boundaries, lifetime and compatibility wiring. They are not a pixel-comparison test or a benchmark. Avoid claiming measurable speedups without profiling.

## Validation

```powershell
git fetch origin
git switch research/native-font-resource-cache
git pull --ff-only

npm run test:geometry-engine
npm run test:native-image-uv
npm run test:fnt5
npm run test:sdf-preview
npm run test:imageset
npm run typecheck
npm run build
```

Expected geometry suite: **338 tests** (prior branch expected 333, plus five new). This is an expected count, not a confirmed result. For visual smoke testing, reuse the previously captured ABC and Hg9 fixtures with the existing research URL and compare to retained Workbench evidence. No new native capture is necessary if output is unchanged.

PR #47 remains draft. No production font path is promoted by this branch.
