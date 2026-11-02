# Phase 3H — Native GridSpacer relative-parent sizing controls

## Why this experiment exists

The real native server-browser layout passed **402/402 tests** and contains 43 measured GridSpacer widgets. Every one is content-sized on at least one axis, and none has both parent-size axes authored as exact.

- Original relative-grid prototype: `parent-size-not-exact` on **43/43**.
- Original fixed-grid prototype: `content-size-requires-separate-strategy` on **43/43**.
- Second child-topology gate: 24 with no obvious blocker, 8 with unsupported nested content axes, 7 with unresolved managed children, 4 with nested relative parents.
- Content axes: 7 both, 28 width-only, 8 height-only.
- `filters_content`: 10 of 18 direct children participate, content-sized on both axes, authored relative width/height, no obvious secondary child blocker.
- `filters_root`: has an additional nested-parent exact-size blocker (its `filters_content` child).
- The two Studio model variants still differ on 105 widget rectangles; those differences are **not** independently measured Workbench errors.

These results narrow the next research question: **what coordinate space does native Workbench use when a content-sized GridSpacer has parent-relative authored dimensions?** It would be incorrect to remove the existing guard and pass raw fractional values into a planner expecting pixel dimensions.

## Eight controlled source cases

Added `tests/fixtures/workbench-grid/NIH_Grid_RelativeParent_Axis_Matrix.layout`. This is a native Workbench-readable research fixture, not a production or vanilla layout modification.

| Columns | Parent exact X/Y flags | Top-level frame start size | Nested frame start size |
|---|---|---|---|
| ExactBoth | 1 / 1 | 240 × 135 | 180 × 96 |
| RelativeWidth | 0 / 1 | 240 × 135 | 180 × 96 |
| RelativeHeight | 1 / 0 | 240 × 135 | 180 × 96 |
| RelativeBoth | 0 / 0 | 240 × 135 | 180 × 96 |

The first four live directly in a fixed 420 × 450 frame. The next four live inside a fixed 300 × 240 frame nested within the outer slot. Relative source fractions are selected to produce the same **starting resolved rectangle** as their exact counterparts in each row. Both content-sizing axes are ON for all eight tested GridSpacers.

Each GridSpacer has the same three styled, visibly colored panels: one fixed-size blue, one relative-size orange, and one fixed-size green. `"Columns" 2`, `"Rows" 2`, `"Padding" 12`, `"Margin" 8`, `"Ignore invisible" 1` remain constant. A contrasting background and case label identify each frame.

**Caveat:** Equal starting rectangles do not imply equal final Size To Content rectangles. The difference, if any, is what the native capture must measure.

## Stage, validate, and capture

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only

npm run test:geometry-engine

.\tests\fixtures\workbench-grid\runtime-mod\Prepare-GridProbe.ps1 -Overwrite
```

Expected: **405 passing tests**, pending local execution. The staging script only copies the isolated fixture into the disposable research mod tree and does not modify the actual vanilla GUI. A PBO build and DayZ client restart are not needed to open the staged `.layout` directly in Workbench.

**Workbench source:**

`P:\NIH_GridMeasurementProbe\gui\layouts\NIH_Grid_RelativeParent_Axis_Matrix.layout`

**Studio source:**

`Z:\GitHub\NIH-Layout-Studio\tests\fixtures\workbench-grid\NIH_Grid_RelativeParent_Axis_Matrix.layout`

Compare both at **1920 × 1080** authored size and **46% zoom**. For Studio, first capture the normal renderer (`http://localhost:5173`); optionally capture the existing `?experimentalGeometrySnapshot=1&experimentalGridRelativeContent=1` path as a second, clearly labeled experiment. Keep the vanilla `P:\gui` resources loaded as necessary.

If the native screenshots show sufficiently distinct rectangles, measure each colored swatch's outer bound in root-relative layout coordinates, not full screenshot coordinates. For higher confidence, record actual native runtime widget rectangles through an existing verified DayZ probe. Do not infer exact values from 46%-zoom screenshots when aliasing or clipping makes boundaries ambiguous.

## Offline model comparison

```powershell
$fixture = 'Z:\GitHub\NIH-Layout-Studio\tests\fixtures\workbench-grid\NIH_Grid_RelativeParent_Axis_Matrix.layout'
npm run audit:native-layout-geometry -- "$fixture" '--focus=Grid' '--max-focused=30'
```

On this fixture, two ExactBoth cases are eligible for the existing native-relative snapshot planner. The other six remain gated because one or both parent axes are authored relative. This **expected difference is only prototype eligibility**, not a declaration of Workbench layout correctness.

## Acceptance and next implementation

1. Determine whether native content-sized GridSpacer output is identical for same starting parent rectangle with different exact flags. Record observations separately from the code/fixture; do not change a prediction after seeing the native result.
2. Compare the direct-frame and nested-frame rows to learn whether a different parent reference space changes the result.
3. If evidence demonstrates that native relative sizes must be resolved to an allocated parent frame first, design a **bottom-up measurement / top-down allocation** experiment and test it in isolation before changing `GridRelativeBridge.ts`.
4. If nested content-sized GridSpacers behave differently, create a separate probe for the four `nested-parent-size-not-exact` cases (including `filters_root`). Do not silently flatten nested dependency cycles.
5. Preserve production Canvas and geometry code until multiple native cases and the vanilla acceptance corpus support the new rule.

No native pixel results are included in this document. This is a preregistered fixture and a planned independent capture—not a claim that the new relative-parent behavior has already been recovered.
