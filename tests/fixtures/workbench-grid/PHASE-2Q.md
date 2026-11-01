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


## Phase 2Q screenshot calibration — 2026-11-01

The user submitted three screenshots with the experimental flag in the Studio browser address: the Phase 2P complex color grid, the 30-panel Studio alpha matrix, and the **same** alpha matrix in native Workbench. Both canvases sampled at `rgb(130,130,130)`. Full 6x5 screenshot color matrices and the 7x7 median sampling coordinates are in `panel-color-phase2q-screenshot-evidence.json`.

| Opacity | Studio opaque/direct behavior | Workbench vs. simple gamma-encoded CSS alpha-over-gray, RGB-channel MAE |
|---|---|---:|
| 100% | Direct authored 8-bit RGB, **not** gamma-converted | 1.31 |
| 94% | Still near direct authored RGB | 1.23 |
| 75% | Not reliable evidence of gamma conversion | 7.25 |
| 50% | Not reliable evidence of gamma conversion | 7.61 |
| 25% | Drifts toward gray as expected | 3.24 |
| 0% | Exactly gray in both programs | 0 |

**Corrected rendering-pipeline diagnosis (2026-11-01):** Chrome DevTools confirmed that the *actual panel DOM background* for `QBlueAlpha100` was `rgb(136,199,220)` with the gamma experiment enabled. However, the visible screenshot still showed the direct RGB `(64,148,184)`. The gamma flag was **active**. Our earlier hypothesis that the Vite build/flag was stale was incorrect.

Source inspection located the issue: `Canvas.tsx` paints the CSS `GetPanelBackground` (gamma-encoded when experimental) **under** a `RenderStyleChrome` imageset. The chrome's `ModulatedImageSprite` uses original authored RGB, not gamma-encoded values. Both paint paths use the authored alpha, so the top imageset can completely obscure the CSS background at alpha=1 and compounds alpha at lower opacities.

The previous Studio screenshot is explained, for each RGB channel, by this two-layer composition:

```
gammaByte = round(255 * authoredChannel ^ (1 / 2.2))
directByte = round(255 * authoredChannel)
under = alpha * gammaByte + (1 - alpha) * backdropByte
visible = alpha * directByte + (1 - alpha) * under
```

That model matches **all 30 observed swatches**, 90 channel samples, at approximately **0.27 RGB levels mean absolute difference**. This independently supports the double-paint explanation far more strongly than guessing that the gamma feature had not loaded.

**Experimental single-layer correction:** While `experimentalNativeColorablePanel=1` is set **and only for leaf or container `PanelWidgetClass` widgets whose style is exactly `rover_sim_colorable`**, `RenderNode` now suppresses `RenderStyleChrome` for that panel. Its single CSS background remains gamma-encoded; all other styles, panels, widgets and default (flag-off) rendering continue unchanged. This isolates the gamma and native alpha hypothesis without altering texture, fonts or geometry. Because it bypasses imageset paint, it is **research-only** and not a general solution for styled textured panels.

After pulling and restarting Vite, the opaque blue swatch should **visibly** approach Workbench's `rgb(137,200,221)`, versus Studio CSS `rgb(136,199,220)`. A computed-style check alone is insufficient; compare a screenshot or DevTools' pixel paint overlay after this correction.

```js
const swatch = [...document.querySelectorAll('[data-layout-node-name]')]
	.find(el => el.dataset.layoutNodeName === 'QBlueAlpha100');
console.log({
	computed: swatch ? getComputedStyle(swatch).backgroundColor : null,
	styleChromeChildren: swatch ? swatch.querySelectorAll('.widget-style-chrome').length : null
});
```

With the flag active and after the correction, expect `computed: rgb(136, 199, 220)` and `styleChromeChildren: 0`. With the flag off, the prior imageset chrome behavior remains enabled where resources resolve.

**Native alpha remains independently unresolved.** At 50–75% opacity, a *single* gamma CSS fill is still predicted to disagree with Workbench by about 7–8 RGB levels per channel. We must recapture the corrected Studio alpha matrix before deciding whether a different native blending transfer, image modulation or alpha convention is required.

## Phase 2Q corrected screenshot — validated visible gamma fill

The user supplied `image(20261101-052910).png` after the experimental single-layer correction. The actual visible Studio panel colors now follow the gamma-encoded RGB candidate. All 30 central colors were measured from 7x7 screenshot patches and stored as `alphaCalibration.correctedSingleLayer` in `panel-color-phase2q-screenshot-evidence.json`.

| Authored alpha | Studio vs. Workbench screenshot RGB-channel MAE | Maximum absolute channel difference |
|---|---:|---:|
| 1.00 | 1.27 | 2 |
| 0.94 | 1.60 | 3 |
| 0.75 | 7.53 | 9 |
| 0.50 | 7.87 | 9 |
| 0.25 | 2.87 | 4 |
| 0.00 | 0.00 | 0 |
| **Overall** | **3.52** | **9** |

Thus the duplicate style chrome explanation is supported and the experimental single-fill RGB transfer produces a close match for opaque panels. **Do not claim accurate native alpha mixing at 50–75%.** These samples use one neutral gray backdrop and do not separate source-opacity processing from backdrop-dependent color-space conversion.

### Phase 2R — distinguish source alpha from backdrop color

A separate native visual fixture `NIH_Panel_Background_Calibration.layout` adds two fully opaque `rover_sim_colorable` parent panels, with authored neutral tints `0.10` and `0.80` respectively. **Each background contains the same 30 children:** five colors and the six authored alpha levels. This is 62 panels total, 60 swatches. Children have exact pixel positions and sizes; no GridSpacer or WrapSpacer is involved.

This fixture tests a new variable: whether the native versus CSS mixing error depends on the color underneath the same partially transparent panel. The parents themselves must be compared first to rule out different authored-gray rendering. Because native `rover_sim_colorable` parent backgrounds are also styled, this is still a **native shader/material observation**, not proof of a universal compositor formula.

After pulling and validating the branch:

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build
.\tests\fixtures\workbench-grid\runtime-mod\Prepare-GridProbe.ps1 -Overwrite
git status --short
```

Open the staged layout in **Workbench** from `P:\NIH_GridMeasurementProbe\gui\layouts\NIH_Panel_Background_Calibration.layout`. In **Studio**, load `Z:\GitHub\NIH-Layout-Studio\tests\fixtures\workbench-grid\NIH_Panel_Background_Calibration.layout` with `?experimentalNativeColorablePanel=1`. Keep 1920x1080 resolution, 46% zoom, no widget bounds, and the permanent gray canvas.

Capture screenshots for both programs. Compare parent background colors separately, then child centers. The alpha=0 row should exactly show the corresponding parent color; alpha=1 should show the same fully opaque child color over both parent colors. Differences in between will constrain native blend behavior.

**No PBO rebuild is necessary to open the staged layout in Workbench.** The new test `tests/native-colorable-background-calibration.test.mjs` checks layout structure and that the existing guarded GridSpacer model is not accidentally activated. The experiment will not change the normal renderer or promote the gamma candidate.

## Acceptance and safeguards

- Do not change `ParseColor`, text, buttons, controls or other widget rendering on this hypothesis.
- Do not change the source geometry matrix, native rectangle JSON or Canvas snapshot algorithm.
- Do not replace native `rover_sim_colorable` semantics with guessed style-wide behavior.
- No claim of complete material/color parity until both screenshots and alpha tests agree.
- Preserve the permanent neutral-gray `.canvas` default independently of this optional transformation.
