# Phase 3I — Opt-in allocated-parent relative GridSpacer preview

## Native evidence (Phase 3H)

The eight-case user-supplied Workbench and Studio screenshots have been measured and preserved in `tests/fixtures/workbench-grid/grid-relative-parent-phase3h-native-pixels.json`.

- Four parent-size authored flag combinations: exact X/Y, relative X, relative Y, relative X/Y; repeated in a direct and nested exact frame.
- Workbench consistently arranges Blue and Orange on the first row and Green in the next row, independent of which parent axes were authored relative.
- Default Studio renders those swatches at authored child coordinates rather than native managed cell positions.
- Resolving authored GridSpacer size fractions against the allocated exact parent frame and reusing `PlanNativeRelativeGrid` predicts the 96 measured native rectangle coordinates with **0.4799 px mean absolute error and 1.394 px maximum absolute error** at 46% zoom.
- The pixel comparison was developed *after* seeing these screenshots; it is not a pre-registered blind holdout test or a proof of the invisible native GridSpacer content bounding box.

## Preview behavior

The repository includes `ProbeAllocatedParentRelativeGrid` in `src/renderer/engine/GridRelativeBridge.ts`, a separate `gridAllocatedParentRelativePrototype` option in `GeometrySnapshot.ts`/`LayoutArrangers.ts`, and a three-gate Canvas preview:

```
http://localhost:5173/?experimentalGeometrySnapshot=1&experimentalGridRelativeContent=1&experimentalAllocatedParentRelativeGrid=1
```

The new probe runs only for a GridSpacer with both Size To Content axes enabled, one or both parent-size axes relative, finite positive supplied parent dimensions, known eligible child visibility, and simple finite direct-child size requests. It rejects nested size-to-content children and other managed child layouts rather than guessing their allocations. The legacy native-derived exact-parent path runs first and is unchanged.

**Limitation:** Finite parent dimensions supplied by the snapshot do not, by themselves, prove that a *native* parent allocation is known. Any upstream parent Size To Content or unsupported manager may still provide a provisional rectangle; this preview is research-only. Do not claim its behavior is universally native-correct or enable it by default.

## Validate

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build
```

Expected suite: **416** regression tests (previous 405 target + five Phase 3H screenshot evidence cases + six Phase 3I scoped prototype cases), subject to local execution. A passing suite proves that the opt-in research behavior is internally consistent with the controlled source cases, not that the production editor matches all vanilla layouts.

## Workbench vs Studio capture

Use the same source as Phase 3H in both:

- Workbench: `P:\NIH_GridMeasurementProbe\gui\layouts\NIH_Grid_RelativeParent_Axis_Matrix.layout`.
- Studio: `Z:\GitHub\NIH-Layout-Studio\tests\fixtures\workbench-grid\NIH_Grid_RelativeParent_Axis_Matrix.layout`.
- Viewport 1920×1080, 46% zoom.

First retain the native screenshot. Then open the experimental URL above and reload the layout if the navigation clears browser source state. Capture one new Studio image. Verify that all eight groups now put Blue/Orange horizontally and Green on the following row, with widths visually close to native Workbench. Keep the normal renderer untouched for A/B.

## Next gate

After the eight-case preview, test the exact same experimental flag set on `P:\gui\layouts\new_ui\server_browser\pc\server_browser_tab_pages.layout` but treat visible improvements as directional only. This vanilla layout has 43 GridSpacers and 19 have additional managed/nested-child blockers. An upstream unresolved Size To Content parent may invalidate the current proposed allocation. Numeric Workbench runtime rectangles are still needed to identify the first generally correct parent measurement rule.

Do **not** promote experimental GridSpacer sizing into the normal Canvas renderer until cross-layout native geometry measurements, re-open behavior and the inherited/managed parent allocation cases are independently validated.
