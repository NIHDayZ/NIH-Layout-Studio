# Native Metron FNT5 font route and glyph paint parity — evidence gate

**Status: pending native/Studio observations.** This branch is independent of the closed Frame/Panel visual clipping gate and contains **no production Canvas, resource loader or font-rasterizer changes**.

## Why this experiment

The previously supplied vanilla `day_z_hud.layout` debug capture showed that affected `ActionListItem` text using `gui/fonts/sdf_MetronBook72` took Studio's **CSS fallback** path (`resolvedSdf: null`, `resolvedBitmap: null`), causing nominal 72px text to be clipped inside small labels. `FitUnresolvedCssFontSize` is already a bounded legibility fallback, but does not fix missing font resolution or prove Workbench glyph metrics.

The existing `ParseStandaloneFnt5` parser is available behind `experimentalStandaloneFnt5=1`. It requires a corresponding decoded `.edds` atlas; parsing/font geometry remains experimental. No new font algorithm should be promoted until we see which routes actually resolve and compare Workbench glyph pixels.

## The reproducible layout

`NIH_NativeFontRoute_Parity.layout` is a **1280×720 exact-size root** with seven controls, all using the text **ABC012**:

- TextWidget Book72 at 34px high and 110px high (to isolate glyph clipping from resource resolution)
- TextWidget Book24 and Light24 at 44px high
- ButtonWidget Book72 and Book24, to test a second widget family using the same font references
- TextWidget without an authored font, retained as a default-font control

No exact text-size overrides, custom style, or font raster files are introduced. Button chrome may differ across editors and must not be mistaken for glyph rendering differences.

## Perform two isolated Studio captures and one Workbench capture

1. **Workbench:** open the fixture with vanilla `P:\gui` resources available, root/preview **1280×720**, DPI scaling off. Capture a screenshot showing the seven controls. Confirm the named native font resources resolve (or record explicit errors).
2. **Studio baseline:** load the same fixture with `P:\gui` indexed, root 1280×720; use `http://localhost:5173/?debugFnt5Sampling=1`. Reload/reindex vanilla resources if needed. Capture screenshot and DevTools console entries filtered by `[NIH Layout Studio][Text route]` for `Text_Book72_Short`, `Text_Book72_Tall`, `Text_Book24`, `Text_Light24`, `Button_Book72`, `Button_Book24`. Record `route`, `fontPath`, `resolvedSdf`, `availableSdfFonts` and font size.
3. **Studio standalone FNT5:** restart/reload Studio using **only** `http://localhost:5173/?experimentalStandaloneFnt5=1&debugFnt5Sampling=1`. The URL switch is checked while vanilla assets are indexed, so ensure the workspace is reindexed after switching modes. Capture screenshot plus the **same route logs**. If it resolves `SDF`, collect `[FNT5 sampling]` and `[FNT5 placement]` for **ABC012**. Do **not** enable `experimentalFnt5Placement`, `experimentalMsdf`, `experimentalFnt5Fit` or `experimentalFnt5Layout` during this first comparison.
4. Preserve original PNGs and console text. Log effective zoom in both editors, Workbench version, browser DPR and whether all three `.fnt` + matching `.edds` resources were actually indexed. If either mode has missing resources, record the missing keys and keep paint-parity acceptance **PENDING**, rather than attributing fallback text to glyph layout.

## What qualifies as progress

- **Routing gate:** experimental Studio reports `route: "SDF"` for the named Metron fonts, backed by loaded atlas resources. If it still reports CSS fallback, inspect font file/atlas matching and `ParseStandaloneFnt5` failure before altering the paint code.
- **Glyph gate:** separately verify matched glyph identity, legibility, advance, baseline, clipping, and layout at equal logical viewport and effective zoom. A better-looking sample is not automatically a native-parity PASS.
- **No regressions:** existing geometry, UV, native font parsing, typecheck, and production build remain green. Do not infer success from the fixture unit tests; they verify only authored layout geometry and an intentionally empty evidence template.

### Local validation commands

```powershell
git fetch origin
git switch research/native-font-resource-parity
git pull --ff-only
npm run test:geometry-engine
npm run test:native-image-uv
npm run typecheck
npm run build
```

Expected geometry suite: **276** tests if the four new fixture assertions pass, versus previously validated **272**. Actual script output takes precedence. The isolated `tests/fnt5-standalone.test.mjs` and `tests/fnt5-sibling-paths.test.mjs` are additional, independent font-parser coverage and can be run using `node --test` once dependencies are installed.

**PR #47 stays draft and unchanged.** Any resource-loading fix should be generalized across all FNT5 files; do not add special-case handling for `ActionListItem` or `sdf_MetronBook72`.
