# Phase 3I — Opt-in allocated-parent-relative GridSpacer preview

## Validation basis

Phase 3H passed **410/410** local regression tests, TypeScript typecheck and Vite production build. The original **eight direct/nested cases** of Workbench-native GridSpacer content sizing include relative parent width, relative parent height and both relative. A pure candidate—resolve parent-authored fractions against the already allocated containing frame, then call the existing native-derived cell planner—predicts 24 independently measured swatch rectangles with **0.4799 px mean** and **1.394 px maximum** screenshot-coordinate error across 96 rectangle coordinates. The original Studio default second-column X placement differs from Workbench by about **42.125 screenshot pixels**.

Evidence remains at `tests/fixtures/workbench-grid/grid-relative-parent-phase3h-native-pixels.json` and `docs/PHASE-3H-GRID-RELATIVE-PARENT-SIZING.md`.

## Implementation (strictly experimental)

New opt-in function: `ProbeAllocatedParentRelativeGrid` in `src/renderer/engine/GridRelativeBridge.ts`. It does not change the existing `ProbeMeasuredRelativeGrid` exact-size implementation.

- Requires a GridSpacer content-sized on **both** axes; current native evidence does not justify single-axis expansion.
- Requires at least one **relative** parent axis. Exact/exact parents continue to use the original validated planner.
- Requires finite, positive, **already allocated parent dimensions**; rejects unknown, zero and invalid parent allocations.
- Resolves source sizes: exact axes use authored absolute values, relative axes use authored fraction × allocated parent width/height. Source properties are not rewritten.
- Reuses the pure `PlanNativeRelativeGrid` with its established cell arithmetic and compact eligible-child ordering.
- Rejects unsupported nested content-sized children, other managed children and invalid child sizes. No recursive parent/content dependency guessing.
- Is never invoked on a child whose rectangle has already been assigned by an enclosing managed arrangement.
- Reports successful arrangement with distinct strategy mode `grid-allocated-parent-relative-prototype` so the original exact-size strategy is not conflated with this experiment.

The shared `ArrangeMeasuredGeometry` snapshot activates this path **only** with `constrainedGrid: true`, `gridRelativeContentPrototype: true`, and `gridAllocatedParentRelativePrototype: true`. It first calls the unchanged exact-size bridge and attempts this fallback only when the old bridge has no plan.

### Browser preview

The normal Studio URL and all other experimental previews remain unchanged. To activate the new candidate, use **all three**:

```text
http://localhost:5173/?experimentalGeometrySnapshot=1&experimentalGridRelativeContent=1&experimentalAllocatedParentRelativeGrid=1
```

A page navigation can clear browser-only loaded workspace state. Reopen the vanilla source folder and source `.layout` if needed.

First test against **`NIH_Grid_RelativeParent_Axis_Matrix.layout`** at 1920×1080, 46% preview zoom, keeping the previous Workbench screenshot. It should display two-column, two-row swatch placement for all eight cases rather than the default top-left stack. Then test the same three-flag URL with the actual `P:\gui\layouts\new_ui\server_browser\pc\server_browser_tab_pages.layout` and compare to the prior baseline. The real layout contains additional nested and single-axis GridSpacer cases that this prototype **intentionally does not support**; it may remain visually incorrect.

## Validation

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only

npm run test:geometry-engine
npm run typecheck
npm run build
```

**Expected geometry suite: 416 tests** (410 validated baseline + 6 new Phase 3I tests), pending local confirmation. The new tests cover:

1. All six previously excluded relative parents opt in without changing the two exact-size cases or default snapshot.
2. Screenshot-space parent-relative rectangles of **all 24 swatches** match independently captured Workbench bounds within a 2 px max and 1 px mean tolerance.
3. Invalid parent allocations are rejected, without editing source input.
4. The new strategy cannot activate if either earlier snapshot/grid gate is disabled.
5. Nested content-sized GridSpacer dependencies remain unresolved rather than being guessed.
6. The Canvas option requires three explicit URL flags and does not change default behavior.

## Non-goals and limitations

This is **not production GridSpacer parity**. It does not assert a recovered general Workbench geometry algorithm for single-axis content sizing, scrolling, mixed managed children, nested relative-content cycles, or widget visibility/clipping. It does not add new global state, change the existing test fixture, or change FNT5, image rendering, fonts, colors, defaults or editor serialization.

After the 8-case visual A/B, evaluate how many native server-browser GridSpacers meet these evidence-based guards and identify one remaining native mismatch. Do not widen the prototype gate simply because it improves a screenshot; obtain independent Workbench measurements for the new configuration.


## Phase 3I controlled visual A/B — confirmed in Studio

User screenshot captured on **2026-11-02**: \`image(20261102-174115).png\`, **1918 × 1029** full screenshot pixels, 1920×1080 authored root, 46% zoom. Browser query includes all three experimental flags. The source is the same unmodified \`NIH_Grid_RelativeParent_Axis_Matrix.layout\` used in Workbench and the Phase 3H native capture.

Measured eight background-panel rectangles and 24 exact-RGB swatch rectangles; stored as half-open screen-pixel bounds in \`tests/fixtures/workbench-grid/grid-relative-parent-phase3i-preview-pixels.json\`. Compared each swatch to the independently measured Workbench rectangles in \`grid-relative-parent-phase3h-native-pixels.json\` **relative to its containing background**, since Workbench's preview origin differs.

| Metric | Studio default (earlier) | Phase 3I experimental |
|---|---:|---:|
| Mean absolute rectangle-coordinate error, all 96 x/y/w/h comparisons | 9.1875 screenshot px | **0.9479 screenshot px** |
| Maximum absolute rectangle-coordinate error | 43 screenshot px | **2 screenshot px** |
| First/second column and second row correctly arranged in all 8 cases | No | **Yes** |

Per-coordinate-axis new mean absolute error: **X 0.9167 px; Y 0.6667 px; width 0.9583 px; height 1.25 px.** Relative parent width, height and both-axis cases visually match the exact-size controls to screenshot-pixel tolerance, including nested parent frames.

This is a substantial geometry improvement in an independent browser rendering, not merely a pure-function numerical prediction. The new result also remains slightly less precise than the earlier **0.4799 px** pure planner/native comparison, plausibly because browser rasterization and layout/zoom boundaries introduce additional rounding. Do not conflate those two measurements.

### Remaining acceptance gate

This confirms the 8-case simple PanelWidget-child scenario **only**. Workbench uses noticeably different background/panel tint and typography in the screenshots; those issues are separate from this geometry result. The fixture does not establish parity for nested content-sized GridSpacers, single-axis Size To Content, scroll clipping or all 43 native server-browser grids.

Next capture with the **same three URL flags**: reopen \`P:\gui\layouts\new_ui\server_browser\pc\server_browser_tab_pages.layout\` at 1920×1080, 46% zoom and compare with the existing native Workbench server-browser capture. Keep \`VANILLA P:\gui\` indexed. This will show how far the experimentally supported subset carries into a real interface. If it does not materially improve, investigate the first unresolved managed/nested Grid parent rather than broadening safety guards without native evidence.

Production GridSpacer placement, default renderer and the previously validated exact-size strategy remain unchanged. The user's latest screenshot did not include an accompanying 416-test log; retain **410** as the last locally confirmed suite count until a new run is provided.
