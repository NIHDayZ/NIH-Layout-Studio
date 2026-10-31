# Phase 2L — captured native GridSpacer measurement and arrangement

Captured on **2026-10-31** from the running DayZ client (uploaded file `NIH-GridProbe-Phase2L.txt`). Research branch: `research/live-snapshot-bridge`.

## Capture integrity

- Three complete phases: `complex-after-create`, `complex-post-update`, `complex-after-resize-1120x720`
- **108 native widget getter records per phase**: one root Frame, 21 GridSpacers (20 top-level plus one nested), and 86 PanelWidgets. Across the 21 grid child lists there are 87 child slots (including the nested GridSpacer as a child); 86 participate in managed layout and one hidden PanelWidget is excluded with screen rect 0,0,0,0
- Only root screen size changes: 1920x1080 to 1120x720. All 107 non-root screen rectangles, visible flags, and child counts are unchanged
- No errors, duplicate widget names, missing phases, or partial widget subtrees

Exact frozen **native** parent and child rectangles from the capture are in `grid-complex-phase2l-native.json`, deliberately separate from the authored configuration manifest `grid-complex-phase2l-cases.json`. The native JSON gives each grid its [width,height] and child screen rectangles relative to that grid; excluded children are null, an included hidden child retains visible=0.

## Recovered bounded generic model

The same algorithm reproduces all **21 grid sizes and 86 participating child rectangles** (zero differences across Phase 2L). This independently extends Phase 2K across multiple relative children, nested content, 3x3 cases, mixed H/V content axes, invisible-child selection, and over-capacity grids.

For each measured axis:

1. Compact managed children in source order according to the already recovered `Ignore invisible` policy.
2. Enumerate the configured **column count** and all **occupied rows** (`ceil(participatingChildCount / columns)`), even if occupancy exceeds configured row count.
3. Compute fixed child maxima per column/occupied row. Content-sized child containers can contribute concrete measured outer dimensions after bottom-up measurement.
4. Subtract the fixed maxima, edge margins and inter-cell gaps from the **authored parent dimension**. Clamp *negative remaining space* to zero.
5. For each relative child, multiply its authored ratio by this remaining space. Raise its column/row maximum to that contribution if larger. Multiple relative children share the final column/row maximum rather than adding their ratios together.
6. For content-sized axes, parent extent is the sum of final column/row widths/heights plus margins and gaps. Exact-sized children retain exact dimensions, while relative children fill the **entire final column/row** (regardless of their own smaller ratio).
7. On axes without `Size To Content`, equal native cell dimensions apply using the configured counts and the authored outer size.
8. Arrange children in compact row-major order with the calculated offsets; children that were excluded from native layout are not given managed slots.

The pure planner `src/renderer/engine/GridRelativeContent.ts` implements that rule without widget IDs, source mutation, tree traversal or global state. It accepts already prepared eligible children and already resolved nested child dimensions. The frozen evidence and `tests/grid-native-relative-generalized.test.mjs` assert exact native parent/child dimensions in all cases.

## Representative native measurements

| Case | Native outer size | Crucial observation |
|---|---|---|
| LBaseline | 145.5 x 63 | Reproduces Phase 2K baseline independently |
| LSameRow | 198 x 68 | Two relative columns share available space based on fixed-child maxima |
| LSameColumn | 192.75 x 65 | Distinct ratios in same column both occupy larger column maximum |
| LSplitColumns | 130.5 x 78.5 | Relative requests compete with exact sizes in both axes |
| LRatioOne | 240 x 90 | A 100% relative width consumes available space; not necessarily authored height |
| LRatioOver | 287.25 x 117 | Ratios over 100% expand beyond authored outer size |
| LWidthDeficit | 51 x 63 | Negative horizontal free space collapses relative width to zero |
| LHeightDeficit | 145.5 x 46 | Negative vertical free space collapses relative request, retains row fixed-height minimum |
| LBothDeficit | 51 x 46 | Both axes independently collapse |
| LThreeSparse | 162 x 91 | 3-column grid with unoccupied cells |
| LThreeFull | 209.75 x 97 | 3x3 row and column maxima |
| LThreeOverflow | 209.75 x 100 | Tenth child allocated to a fourth row with zero height |
| LSingleColumn | 104 x 88 | Multiple relative rows share exact fixed-row baseline |
| LSingleRow | 201.75 x 58.25 | Multiple relative columns share exact fixed-column baseline |
| LMixedH | 209.75 x 100 | Width content, height equal fixed cells |
| LMixedV | 240 x 63 | Width equal fixed cells, height content |
| LHiddenSkip | 98.25 x 49.5 | Hidden child excluded and subsequent children compacted |
| LHiddenInclude | 170.25 x 76.5 | `Ignore invisible 0` includes hidden child in layout |
| LNested | 155.75 x 57.5 | Nested measured 60.5 x 21.5 grid contributes to outer measurement |
| LTwoOverflow | 145.5 x 73.5 | Fifth child creates third occupied row |

## Evidence and implementation limits

- This is **DayZ client observed geometry**, not a claim that the complete native C++ implementation was recovered. Separate Workbench scale/DPI behavior and many widget classes remain unverified.
- Overflow under a **fixed-height** (non-content) axis, arbitrary nested containers with unresolved content, invalid/negative child sizes, and runtime visibility changes have not been verified by this matrix. The pure planner rejects unverified fixed-height overflow and invalid inputs.
- Existing `GridNativeMeasurement` and `LayoutArrangers` fixed-child code remains unchanged and **no new planner path is production-enabled**.
- This project must continue to support widget declarations **without IDs**; the new native planner only uses compact child indices and numeric measurements, never source IDs.
- An appropriate next stage is an **explicit opt-in bridge** using this planner in the shared geometry snapshot, with native regression tests for all 20 cases plus the nested container, followed by local `npm run test:geometry-engine`, `npm run typecheck`, and `npm run build` before activation in Canvas.

## Reproducibility

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git switch research/live-snapshot-bridge
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build
```

The capture itself is complete. There is no need to rebuild the Phase 2L native PBO or repeat this native probe for the captured 20 cases.
