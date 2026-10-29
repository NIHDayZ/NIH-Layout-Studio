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
