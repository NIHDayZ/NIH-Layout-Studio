# Phase 2Q — rover_sim_colorable native color-space investigation

## Scope and findings

This is a **rendering-only hypothesis**, not a new GridSpacer geometry patch and not a proven DayZ shader implementation.

The Phase 2P colorable visual matrix provided actual screenshots of Workbench and Studio with matching geometry and neutral gray `rgb(130,130,130)` canvas backgrounds. Five large flat panel colors were sampled from the Workbench screenshot `image(20261031-082627).png` and the Studio gray screenshot `image(20261031-082944).png` supplied during the research conversation. The numeric samples, authored RGBA colors and screenshot provenance are frozen in `panel-color-phase2q-screenshot-evidence.json`.

| Panel | Authored linear RGB | Native Workbench screenshot RGB | Studio gray screenshot RGB |
|---|---|---|---|
| Blue | 0.25, 0.58, 0.72 | 136, 194, 213 | 64, 148, 184 |
| Orange | 0.75, 0.53, 0.27 | 216, 186, 139 | 191, 135, 69 |
| Green | 0.32, 0.66, 0.49 | 150, 204, 180 | 82, 168, 125 |
| Pink | 0.67, 0.41, 0.55 | 206, 167, 189 | 171, 105, 140 |
| Lavender | 0.46, 0.50, 0.70 | 175, 182, 210 | 117, 128, 178 |

All samples use authored alpha 0.94. Native Workbench appears to encode authored RGB before display (possible linear-to-gamma conversion). Under a **simple illustrative** alpha-over-gray model, a `channel ^ (1 / 2.2)` RGB transform has about **1.27 average absolute RGB channel error**, versus about **49.6** for direct RGB conversion. The actual shader transfer, texture/material modulation, premultiplication, GPU color management and native alpha-composite formula are **not established** from a screenshot. Do not interpret these fit numbers as proof of the native implementation.

## Opt-in approximation (not the production default)

`src/renderer/engine/NativeColorablePanelPreview.ts` contains a pure, bounded RGB transfer model. `Canvas.tsx` calls it **only** when BOTH the URL flag `experimentalNativeColorablePanel=1` is present and a panel's authored style is exactly `rover_sim_colorable` (case-insensitive). All other widget classes and panels continue to use the existing `ParseColor` path. Authored alpha passes through **unchanged**; the model does not pre-composite with the canvas gray or embed a learned alpha fudge factor.

To compare the 20-case matrix, load `NIH_Grid_Complex_Visual.layout` in Studio using:

`http://localhost:5173/?experimentalGeometrySnapshot=1&experimentalGridRelativeContent=1&experimentalNativeColorablePanel=1`

Control: the exact same URL without `&experimentalNativeColorablePanel=1`. Both use the permanent gray canvas. Compare the new experimental Studio screenshot with the existing native Workbench screenshot, at the same 1920x1080 layout and documented zoom.

## Independent alpha calibration — required before any production default change

The separate `NIH_Panel_Color_Alpha_Calibration.layout` fixture contains 30 leaf panels: five authored colors, six **alpha levels** in row order **1.0, 0.94, 0.75, 0.50, 0.25, 0.0**. Each uses exact screen positioning/size and `rover_sim_colorable`. There are no managed grids, widgets with complex backgrounds, text or additional child nodes. This isolates color/alpha compositing from the geometry research.

Stage only when testing in Workbench:

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build
.\tests\fixtures\workbench-grid\runtime-mod\Prepare-GridProbe.ps1 -Overwrite
git status --short
```

Then open `P:\NIH_GridMeasurementProbe\gui\layouts\NIH_Panel_Color_Alpha_Calibration.layout` in DayZ Workbench. Open the source version from `tests\fixtures\workbench-grid` in Studio at 1920x1080, using the URL with `?experimentalNativeColorablePanel=1`. **No geometry flags are necessary for the alpha fixture**, because it has no managed containers. Turn off widget bounds, ensure the gray background is in use and compare at the same zoom.

For a controlled baseline, load the identical alpha fixture in a second Studio tab without the alpha gamma flag. Record Workbench and Studio screenshots at identical root size and scale. For all 30 swatches, distinguish expected alpha transitions (opaque to fully transparent) from RGB transfer.

Suggested browser inspection of one swatch:

```js
const el = [...document.querySelectorAll('[data-layout-node-name]')].find(x => x.dataset.layoutNodeName === 'QBlueAlpha094');
console.log(el && getComputedStyle(el).backgroundColor);
```

Native Workbench lacks an equivalent CSS getter; screenshot sampling must be treated as visual evidence, not a native shader measurement. If alpha varies unexpectedly, establish its formula from the six controlled opacity rows before considering a production-level correction.

## Acceptance and safeguards

- Do not change `ParseColor`, text, buttons, controls or other widget rendering on this hypothesis.
- Do not change the source geometry matrix, native rectangle JSON or Canvas snapshot algorithm.
- Do not replace native `rover_sim_colorable` semantics with guessed style-wide behavior.
- No claim of complete material/color parity until both screenshots and alpha tests agree.
- Preserve the permanent neutral-gray `.canvas` default independently of this optional transformation.
