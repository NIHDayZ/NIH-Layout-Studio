# Phase 2P — native colorable GridSpacer visual acceptance

## Evidence carried forward

- Phase 2L native geometry: 21 grid parents and 86 participating child slots matched exactly in the recovered model.
- Phase 2M local tests: 313 passed, typecheck/build passed.
- Phase 2N local viewer: five challenging cases visually checked in the browser, all zero-axis differences.
- Phase 2O local tests: 316 passed, typecheck/build passed, clean tree. Independent Chrome DOM comparison: 9/9 sampled rectangles match native values to roughly 0.0001 layout px at about 45.185% effective zoom.

These are **native getter geometry** findings, not native-rendered material or font parity. The original authoritative measurement file has not been modified.

## Files

- `NIH_Grid_Complex_Matrix.layout` — **authoritative measurement fixture; unchanged**.
- `NIH_Grid_Complex_Visual.layout` — separate 20-case, 21-grid, 86-leaf-panel colorable **render-only** fixture.
- `tests/grid-visual-fixture-parity.test.mjs` — strict comparison: visual fixture changes only `style` and `color` on leaf PanelWidgets, every panel uses `rover_sim_colorable` with a tint, and both fixtures arrange to identical local and absolute geometry at 1920×1080 and 1120×720.
- `runtime-mod/Prepare-GridProbe.ps1` now stages the **visual** fixture in addition to the existing measurement fixtures; this does not change the native probe's current startup/capture paths.

## Commands (PowerShell 5.1)

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build
git status --short

# Stage the two independent layouts into the existing disposable Workbench probe folder.
.\tests\fixtures\workbench-grid\runtime-mod\Prepare-GridProbe.ps1 -Overwrite
```

Open `P:\NIH_GridMeasurementProbe\gui\layouts\NIH_Grid_Complex_Visual.layout` in DayZ Workbench (using the project/workdrive mapping). No PBO rebuild is necessary solely to open the staged `.layout` in Workbench.

Open the **same** `NIH_Grid_Complex_Visual.layout` from `Z:\GitHub\NIH-Layout-Studio\tests\fixtures\workbench-grid` in the Studio editor with both experimental flags:

`http://localhost:5173/?experimentalGeometrySnapshot=1&experimentalGridRelativeContent=1`

Replace the host/port with the actual Vite URL if different. Select 1920×1080, match the Workbench viewport and UI zoom/DPI when comparing captured pixels.

### Two deliberate passes

1. **Filled panels / rendering:** Turn OFF Studio's editor widget-bounds overlay, and compare colored panel fills, transparency, overlap and clipping with Workbench's actual rendered view. `style rover_sim_colorable` is included because color tint on unstyled PanelWidgets may not be visible natively.
2. **Geometry diagnosis:** Turn ON the Studio bounds overlay if anything looks misaligned. Numeric native getter rectangles from Phase 2L remain authoritative; do not adjust the measurement fixture to make the visuals align.

**Permanent Studio background (October 31, 2026):** the editor's `.canvas` now defaults to Workbench-matched neutral gray `rgb(130, 130, 130)` (`#828282`), for all layout previews, with no query parameter. The former `experimentalWorkbenchBackdrop=1` flag has been retired. The surrounding editor, resource panes, and viewport grid remain dark. This reduces background-compositing differences; it does not by itself establish color-space or `rover_sim_colorable` material parity.

Capture a Workbench screenshot and a Studio screenshot at the same layout resolution, with zoom and OS DPI documented. Differences must be classified as placement, sizing, native material/color, alpha/composition, clipping/scissor, or scaling; an outline-only browser report is not a renderer acceptance test.

### Safeguards

- Never edit the `NIH_Grid_Complex_Matrix.layout` baseline or the golden native JSON when working on paint.
- Never move `style`/`color` to parents or insert decorative children to force a visual appearance; that would alter the measurement input and invalidate the independent comparison.
- `NIH_Grid_Complex_Visual.layout` is intended only for visual research. Do not promote to a production UI or assume material color, alpha, clipping, or font fidelity without Workbench screenshots.
- If some panels do not render or a nested child disappears after adding style, treat that as new **native layout-loader/material evidence**; record it and investigate instead of attributing it to geometry.
