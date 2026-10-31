# Phase 2N — offline native geometry visual comparison

**Scope:** research evidence viewer, not a production editor option or screenshot parity claim.

The Phase 2M shared geometry snapshot was validated in the 2026-10-31 local run: 313 geometry tests passed, TypeScript typecheck passed, Vite production build passed, and working tree clean.

This phase adds `scripts/Generate-GridNativeVisualReport.mjs`, which invokes the actual shared engine with `{ constrainedGrid: true, gridRelativeContentPrototype: true }` and compares the resulting geometry with the independent DayZ getter fixture `grid-complex-phase2l-native.json`, using the original authored `.layout` as input.

## Generate and open

In Windows PowerShell 5.1:

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git switch research/live-snapshot-bridge
git pull --ff-only

npm run test:geometry-engine
npm run typecheck
npm run build

Invoke-Item ".geometry-engine-test-build\Phase2N-Native-Comparison.html"
git status --short
```

`npm run test:geometry-engine` runs `tests/grid-native-visual-report.test.mjs`. The test generates the HTML and requires 212 native rectangle comparisons across two captured root sizes (106 unique native rectangles per viewport, including grid parents). It rejects any difference above 0.00001. The native-excluded hidden child is marked *Excluded*, not claimed to have managed screen geometry.

You may regenerate the report directly after compiling tests:

```powershell
node .\scripts\Generate-GridNativeVisualReport.mjs
```

The report offers selectors for the 20 Phase 2L cases and both captured viewport sizes; separate native cyan and Studio amber outlines; exact rectangles and maximum deviations in a table; and explicit exclusions for hidden widgets with no native managed slot.

The report is self-contained, offline and generated inside the ignored `.geometry-engine-test-build` folder. No app route, Canvas toggle, normal editor setting, screenshot capture, external service or new globals are introduced.

## Remaining visual parity work

This report compares geometry returned by native DayZ getters with the Studio shared snapshot. It **does not** establish pixel-perfect Workbench/DayZ visual parity. Font rasterization/FNT5, clipping/scissor, scaling/DPI, textures, layered composition and other layout families remain separate research. The next visual acceptance activity is to compare actual Workbench renders to a controlled Studio preview, after choosing how to expose the experimental snapshot in a dedicated preview mode.

The experimental planner should remain **off by default** until independent rendered-image acceptance is achieved.
