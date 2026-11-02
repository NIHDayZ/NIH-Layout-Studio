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

## Phase 3H native pixel evidence — screenshot comparisons completed

**WorkBench reference:** `Screenshot 2026-11-02 085807.png` (1919×1026). **Studio default:** `Screenshot 2026-11-02 085757.png` (1919×1031). Both preview the authored 1920×1080 fixture at nominal 46% zoom. Evidence consists only of native and Studio *measured RGB swatch rectangles* in `tests/fixtures/workbench-grid/grid-relative-parent-phase3h-native-pixels.json`. The original screenshots are retained in the conversation, not committed to the public repository.

Measured 24 Workbench and 24 Studio colored swatches using native/interior swatch RGB connected-pixel bounds, recorded as `[left, top, rightExclusive, bottomExclusive]`. Compare **relative to each colored background rectangle**, not full-application pixels; the two apps use different preview origins and colors.

### Workbench independent results

| Normalized against its slot background | Blue origin (px) | Orange origin (px) | Green origin (px) |
|---|---|---|---|
| Direct, exact/exact (and other three axis modes within 1 px) | (20,38) | (58,38) | (20,56) |
| Nested, exact/exact (and other three axis modes within 1 px) | (38,57) | (76,57) | (38,76) |

The two native rows preserve both column-2 placement and row-2 placement for **all four authored parent exact/relative axis modes**. Orange width changes from roughly 28–29 screenshot px in direct groups to 16 px in nested groups; this is consistent with the smaller available parent width. These are screenshot swatch bounds, **not measurements of invisible GridSpacer final rectangles**.

By contrast, normal Studio places orange near the first-column X coordinate. Across the eight cases, the orange second-column X difference relative to Workbench averages **42.125 screenshot px** (different app scaling may contribute small pixel-level differences, not the whole 42px shift).

### Preregistered independent candidate tested against native pixels

**Candidate:** resolve authored GridSpacer size fractions against its already allocated exact parent frame (420×450 direct or 300×240 nested) **before** invoking the existing Phase 2L `PlanNativeRelativeGrid` pure function. Do not pass source fractions such as 0.571428571 as pixel dimensions.

The eight GridSpacers then enter the *same already-tested cell planner* with resolved authored starting sizes of 240×135 (direct) or 180×96 (nested). The candidate predicts:

- Direct: first-column X = 35+8=43 authored units; second-column X = 35+90=125. Blue/Orange Y = 75+8=83; Green Y = 75+48=123.
- Nested: first-column X = 50+25+8=83; second-column X = 50+25+90=165. Blue/Orange Y = 70+45+8=123; Green Y = 70+45+48=163.
- Direct Orange width = 63.9 authored units; nested Orange width = 36.9 authored units. These result from available grid width after fixed maxima, margin and padding.

Measured at native 0.46 zoom, this candidate produces **0.4799 px mean absolute error** over **96 independent swatch rectangle coordinates** and **1.394 px maximum absolute error**. The screenshot's boundary anti-aliasing and rounding can account for errors around 1 pixel. This validates a useful *limited relative-parent resolution hypothesis*, but not the native final grid-size equation or general correctness for all content-sizing modes.

The evidence and `tests/native-grid-relative-parent-pixels.test.mjs` were committed **after** receipt of the native screenshot. They are an independent native comparison of an existing pure planner plus a newly specified relative-parent resolution step, **not a blind preregistered held-out forecast**. Preserve this distinction from the earlier Phase 2V–2W color tests.

### Current research boundaries

- No GridRelativeBridge, GeometrySnapshot, Canvas, geometry-core or production renderer behavior was changed.
- Eight source cases are content-sized on both axes and contain three plain PanelWidgets. They do not cover the 19 vanilla GridSpacers with secondary nested blockers or 28 width-only/8 height-only content-sized vanilla grids.
- The candidate requires an **independently resolved parent allocation**. If the parent itself is size-to-content, resolving it may require a top-down/bottom-up dependency pass and cannot be inferred from an authored fraction alone.
- The Workbench snapshot does not reveal invisible GridSpacer final rectangles. We should measure them with an existing native runtime geometry probe before claiming complete parent-size parity.

### Verify and move to scoped prototype

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine
```

**Expected count: 410 tests** (405 prior research target + five new measured-pixel cases), pending local execution. The five new cases independently check captured native evidence, cross-axis swatch invariance, resolved-parent pure-planner pixel error, default Studio's positioning discrepancy, and retained production safety guards.

After local regression confirmation, the next step is an opt-in, experimental *allocated-parent-relative Grid* path. It should activate only when the parent allocation is known and child topology passes existing gates, with the raw source fractions preserved. Validate it against the eight recorded native swatches and real vanilla layout subtrees before considering production promotion.
