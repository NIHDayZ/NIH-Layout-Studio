# Phase 3K — Native single-axis Size To Content controls

## Why this is the next test

On 2026-11-02, Phase 3J passed **419/419** regression tests on the user's Windows workstation. The offline audit of the actual `P:\gui\layouts\new_ui\server_browser\pc\server_browser_tab_pages.layout` found:

| Source observation | Result |
|---|---:|
| All vanilla server-browser GridSpacers | 43 |
| Both content-sizing axes | 7 |
| Width-only content sizing | 28 |
| Height-only content sizing | 8 |
| New allocated-parent strategies activated | 2 |
| Rejected as single-axis-unsupported | 36 |
| Other rejected grids | 5 |
| Changed widget rectangles against legacy snapshot | 64 (17 local, 47 inherited) |

The only two activated grids were `right_area_buttons` and `filters_content`. The `filters_content` prototype changes its local rectangle from `(0,0,129.6,648)` to `(0,0,129.6,300)`. Its filter rows move in 30-unit increments. However, `right_area_root`, `filters_root`, `server_list_root`, and `server_list_content_root` remain outside this research prototype. The `129.6` width is a **Studio model measurement**, not independently verified native Workbench parent geometry. More controls becoming visible does not establish correct sizing or clipping.

Existing exact-parent native evidence: Phase 2K already captured single-axis RContentH and RContentV cases in tests/fixtures/workbench-grid/grid-relative-phase2k-native.json. RContentH measured a 145.5 by 100 parent; RContentV measured a 240 by 63 parent. These validate the existing pure planner for exact-size single-axis grids.

Phase 3K specifically measures the missing combination: single-axis Size To Content with relative-sized parent axes. It does not repeat the earlier exact-parent discovery.

**Decision:** Do not extend the new strategy to single-axis content sizing without independent native measurements. The existing pure planner contains potential single-axis rules, but the allocated-parent bridge explicitly requires both axes because the previous 8-case Workbench fixture only tested both-axis mode.

## New eight-case native fixture

File: `tests/fixtures/workbench-grid/NIH_Grid_SingleAxis_Content_Matrix.layout`.

Four columns vary the parent's authored size axes:

| Column | hexactsize | vexactsize | Starting dimensions from fixed slot |
|---|---:|---:|---|
| ExactBoth | 1 | 1 | 240×135 |
| RelativeWidth | 0 | 1 | 240×135 |
| RelativeHeight | 1 | 0 | 240×135 |
| RelativeBoth | 0 | 0 | 240×135 |

Two rows vary exactly one content-sizing axis:

| Row | Size To Content H | Size To Content V | Purpose |
|---|---:|---:|---|
| WidthOnly | 1 | 0 | Measure native width growth while height remains non-content sized |
| HeightOnly | 0 | 1 | Measure native height growth while width remains non-content sized |

Each case uses a fixed 420×450 slot, contrasting colorable background, descriptive label, and identical three-child grid: blue (70×28 exact), orange (0.45×0.35 relative), green (46×48 exact). Keep columns=2, rows=2, padding=12, margin=8 and Ignore invisible=1 throughout. Unlike the earlier Phase 3H fixture, **this test intentionally does not introduce an extra nested parent frame**, to isolate the single-axis behavior. A subsequent experiment can cross nesting if native evidence requires it.

Preserve the exact authored source. No positions should be manually adjusted after observing Workbench results.

### Native capture

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine
.\tests\fixtures\workbench-grid\runtime-mod\Prepare-GridProbe.ps1 -Overwrite
```

Expected new total: **423 tests**, pending local execution (419 validated + 4 new tests). The four new tests verify the eight native declarations and colorable swatches, equal initial parent sizes, intentional preview gating of six relative cases, and in-memory parse/serialize/reparse stability.

Open in Workbench:

```text
P:\NIH_GridMeasurementProbe\gui\layouts\NIH_Grid_SingleAxis_Content_Matrix.layout
```

Open the matching repository fixture in Studio:

```text
Z:\GitHub\NIH-Layout-Studio\tests\fixtures\workbench-grid\NIH_Grid_SingleAxis_Content_Matrix.layout
```

Both at a **1920×1080 root and 46% zoom**. Workbench first, then Studio with the existing three-flag Phase 3I experimental URL if desired:

```text
http://localhost:5173/?experimentalGeometrySnapshot=1&experimentalGridRelativeContent=1&experimentalAllocatedParentRelativeGrid=1
```

Note: the exact/exact parent cases may already activate the old native relative-grid planner, but the relative-parent cases should still remain unactivated. This is expected test gating, **not evidence of native correctness**. The native Workbench view is the reference.

## Frozen measurement plan

Measure each blue/orange/green swatch's pixel rectangle relative to its own colored background (not the entire application screenshot). For each content-sizing mode compare the four authored parent exact/relative combinations, checking second-column X placement, second-row Y placement, child width/height and any overflow beyond the nominal authored rectangle. Compare width-only against height-only to isolate which axis is allocated versus measured. Record screenshot root, zoom, color, parent and swatch bounds; preserve observed values before any model coefficients, guard conditions or fallback rules change.

The native swatch geometry alone does not reveal invisible GridSpacer final bounds or recursive parent allocation dependencies. If the screenshot cannot determine a key bound, obtain actual native widget rectangles through an existing proven DayZ probe rather than guessing.

## Promotion gate

Only after native evidence for both single-axis modes, test the **independent pure planner**, then introduce a separate experimental bridge. Do not remove the current content-both-axes restriction globally or change the default Canvas. The server browser's 28 width-only and 8 height-only grids are a priority, but many also have independently unsupported nested or managed children; a single-axis fix will not automatically resolve the entire screen.

This phase changes **one research-only .layout fixture, four tests, the staging manifest, and this documentation**. It makes no changes to existing parser, serializer, geometry algorithms, default UI behavior, or saved vanilla GUI files.
