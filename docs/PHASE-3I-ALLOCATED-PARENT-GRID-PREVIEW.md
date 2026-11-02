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
