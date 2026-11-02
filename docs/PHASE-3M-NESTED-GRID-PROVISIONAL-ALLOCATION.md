# Phase 3M — Native nested GridSpacer provisional allocation

## Status

Research-only implementation committed to `research/live-snapshot-bridge`. **Not production enabled.** Independent DayZ client `[NestedGridProbe]` post-update and post-settle logs were supplied at 1920×1080 and 1440×810; all 64 runtime widgets in each post-update/post-settle pair had stable coordinates. The 1920×1080 control dimensions were frozen in `tests/fixtures/workbench-grid/grid-nested-phase3m-runtime-screen-rects.json`.

The implementation and nine new test cases require local `npm run test:geometry-engine`, `npm run typecheck`, and `npm run build` confirmation. Do not mark accepted until all pass. The previous Phase 3L count was 442 **expected**, not a confirmed new Phase 3M run; if unchanged, the new expected count is 451.

## Native rule — two distinct allocations

The observed layout is consistent with a **provisional cell allocation followed by content reconciliation**. For each GridSpacer, using its authored resolved size:

1. Calculate native fixed column/row baselines from direct exact-size children plus inter-cell padding and outer margin.
2. Distribute leftover space to relative children, even when a child itself uses Size To Content. On an axis without Size To Content, allocate equal cells from the authored parent dimensions.
3. Measure nested GridSpacers **inside those provisional slots**, recursively, using the same shared `PlanNativeRelativeGrid` planner.
4. Reconcile each content-sized parent axis using its nested child's measured result. On a non-content parent axis, the nested child retains its allocated equal-cell dimension. Keep the nested descendant's original provisional arrangement—do not recompute its relative children after the outer parent shrinks.

This is an acyclic, bounded nested Grid-specific algorithm, not a general engine-wide layout solver.

### Exact native examples

The outer slot is 570×465. Outer authored relative size resolves to `399×334.8`.

**Width-only, two tiers.** The outer width baseline is `32 + 2×5 + 8 = 50`. The provisional inner width is `0.65 × (399 − 50) = 226.85`. Inner width baseline is `70 + 24 + 2×7 + 10 = 118`; the relative orange width is `0.45 × (226.85 − 118) = 48.9825`. Inner content width becomes `70 + 48.9825 + 24 = 142.9825`, and reconciled outer width is `142.9825 + 50 = 192.9825`, matching native `192.982` after its display rounding.

**Height-only, two tiers.** Outer width is not content-sized, so its two equal columns allocate `(399 − 2×5 − 8)/2 = 190.5` to Inner. Its relative orange child width is `0.45 × (190.5 − 118) = 32.625`. Inner height is `28 + 48 + 10 + 2×7 = 100`, outer content height becomes `100 + 2×5 = 110`. Native rectangle: Outer `399×110`, Inner `190.5×100`.

**Width-only, three tiers.** Outer assigns provisional Inner width `226.85`. Inner allocates provisional Leaf width `0.55 × (226.85 − (24 + 10 + 2×7)) = 98.3675`. Leaf exact-child width baseline is `70 + 10 + 2×7 = 94`, so relative orange width is `0.45 × (98.3675 − 94) = 1.965375`. Leaf width is `95.965375`; Inner becomes `95.965375 + 24 + 10 + 14 = 143.965375`; Outer becomes `193.965375`. All three correspond to the native `95.9654`, `143.965`, `193.965` readings.

For the height-only, three-tier case, provisional Leaf width is smaller than its 94-unit fixed baseline; its relative orange panel legitimately resolves to **zero width**. No minimum-width workaround is allowed.

## Implementation

- `src/renderer/engine/NativeNestedGrid.ts`: pure `ProbeNestedAllocatedGrid`, returns root and per-descendant plans; no persistent state, source changes, widget IDs, or new algorithms for per-cell arithmetic.
- `src/renderer/engine/GridRelativeBridge.ts`: new `nestedAllocatedGrid` result marker.
- `src/renderer/engine/GeometrySnapshot.ts`: one pass-local WeakMap for descendants. The root probe runs only without an existing parent-managed cell; its descendants reuse the provisional plans even when a parent allocates their final rectangle.
- `src/renderer/engine/LayoutArrangers.ts`: distinct strategy mode `grid-nested-allocation-prototype`; legacy modes unchanged.
- `src/components/Canvas.tsx`: new fifth chained research flag.
- `scripts/Analyze-NativeLayoutGeometry.mjs`: read-only five-flag comparison added **without renaming legacy `phase: 3F` or altering prior variants**.
- `tests/native-grid-nested-allocation-preview.test.mjs`: nine assertions for native rectangles, guard boundaries, preview, other resolution, independent Workbench screenshot and diagnostics.

### Conservative guards

The new probe requires finite positive parent allocations, known managed child selection, a content-sized GridSpacer parent with at least one nested GridSpacer descendant, supported nested GridSpacer-only managers, no unknown content-sized non-grid child, and at most eight manager levels. Non-grid ordinary siblings next to nested managers must be exact-size on both axes. Unsupported branches stay on the existing authored/native-gated fallback; source editing, default rendering, other manager types and other experimental flags are unchanged.

## Local test gate

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build
```

Expected **451** geometry tests if the pre-existing 442 Phase 3L cases all pass. The new tests compare **45 runtime widget rectangles** across six nested scenarios using a 0.025-unit tolerance to accommodate log rounding, plus 11 independently printed 1440×810 rectangles after the captured 0.75 scaling, and **27 Workbench screenshot components** with screenshot-pixel tolerance.

## Studio visual acceptance

Open the existing nested fixture from the repository in Studio. Use 1920×1080, 46% zoom and the **five-flag URL**:

```text
http://localhost:5173/?experimentalGeometrySnapshot=1&experimentalGridRelativeContent=1&experimentalAllocatedParentRelativeGrid=1&experimentalAllocatedParentSingleAxisGrid=1&experimentalNestedGridAllocation=1
```

Compare against the already captured native Workbench screenshot. The three bottom orange swatches can be invisible or subpixel-wide; that is expected and matches the native runtime, not a bug.

Then audit the original vanilla server-browser layout without editing the source:

```powershell
$layoutPath = 'P:\gui\layouts\new_ui\server_browser\pc\server_browser_tab_pages.layout'
$report = node scripts\Analyze-NativeLayoutGeometry.mjs $layoutPath --json | ConvertFrom-Json
$report.nestedSnapshotAppliedStrategies | Group-Object mode | Select-Object Name,Count
$report.nestedVsSingleAxis | Select-Object totalChanged,localRectChanged,inheritedOnly
$report.nestedSnapshotAppliedStrategies | Where-Object mode -eq 'grid-nested-allocation-prototype' | Select-Object name,mode
```

**Do not infer Workbench parity from the new strategy count or changed widget rectangles.** Follow with matched Workbench/Studio screenshot inspection of the server browser. Verify the server list and right-side filter ancestry specifically; if one remains unsupported, record the remaining manager topology before extending this probe.

## Out of scope

Unknown or mixed nested manager types, relative non-manager siblings next to nested managed children, text intrinsic dependencies, dynamic UI changes, scroll clipping, image/font parity, alpha and material styling, and native re-open acceptance. Revisit only with independent native evidence.
