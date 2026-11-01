# Phase 2W — Pre-registered unseen-alpha validation

## Research question

Phase 2V predicted a third chromatic backdrop at known alpha levels with 0.7111 RGB MAE (ordinary CSS source-over: 5.7222). Phase 2W tests whether the preexisting weight curves predict **four never-measured alpha values** on all three backgrounds. No Phase 2W pixels enter model fitting.

| New authored alpha | Percent | Native 8-bit alpha |
|---|---:|---:|
| 0.875 | 87.5% | 223 / 255 |
| 0.625 | 62.5% | 159 / 255 |
| 0.375 | 37.5% | 96 / 255 |
| 0.125 | 12.5% | 32 / 255 |

Each of the three backgrounds (Dark, Light, Chromatic) contains these four rows plus opaque and transparent endpoint controls, with five identical foreground colors in each row. There are **90 panels, 270 RGB channels**, including **60 panels / 180 channels at genuinely unseen alpha levels**.

## Frozen predictions and model

The preregistered file is `tests/fixtures/workbench-grid/panel-color-phase2w-frozen-predictions.json`. Its **pre-capture immutable GitHub commit is `70659eb137f347ce2381c7d4dd97c732e213e205`**. It was committed **before native Phase 2W screenshots** and must never be retroactively edited to improve the blind comparison.

The only fitted weights originate in the preexisting Phase 2V frozen file, originally derived from Phase 2R Dark and Light observations. The Phase 2V Chromatic native samples were **not used for fitting**. Alpha knot positions are quantized with `round(alpha * 255) / 255`, in agreement with native GetAlpha observations.

The primary candidate is shape-preserving piecewise cubic Hermite interpolation (PCHIP/Fritsch–Carlson) of the independently fitted source and backdrop linear-light weight sequences. The second, simpler candidate is piecewise linear interpolation of exactly those same knots. There are **no new fit parameters** and neither method uses native pixels from the new experiment. The third baseline is ordinary 8-bit-quantized sRGB CSS source-over.

| Alpha | PCHIP source weight | PCHIP backdrop weight |
|---|---:|---:|
| 1.000 | 1.0000 | 0.0000 |
| 0.875 | about 0.8027 | about 0.1140 |
| 0.625 | about 0.5255 | about 0.2968 |
| 0.375 | about 0.3359 | about 0.4870 |
| 0.125 | about 0.1299 | about 0.7850 |
| 0.000 | 0.0000 | 1.0000 |

The predicted linear RGB channel is `weightSource * quantizedSource + weightBackground * quantizedBackground`, clamped to 0–1, encoded with the standard sRGB transfer, and rounded to an 8-bit display value. At alpha 1 and 0, exact previously confirmed opaque/transparent rules replace the interpolation. This is a **descriptive candidate, not recovered DayZ shader code**.

## Native visual fixture

- File: `tests/fixtures/workbench-grid/NIH_Panel_Heldout_Alpha_Matrix.layout`.
- Root authored 1920 × 1080, containing three side-by-side opaque `rover_sim_colorable` parents.
- Parents: Dark at (38,65), Light at (667,65), Chromatic at (1296,65), each 580 × 650.
- Authored background RGBA: Dark `(0.10,0.10,0.10,1)`, Light `(0.80,0.80,0.80,1)`, Chromatic `(0.08,0.36,0.82,1)`.
- Opaque native RGB control predictions: `(90,90,90)`, `(231,231,231)`, `(79,162,234)` respectively.
- Each parent has 30 `PanelWidgetClass` leaves, with the same five RGB colors used in Phase 2R, at alpha rows `1,0.875,0.625,0.375,0.125,0`.
- Each leaf has exact position `(18 + column*110, 26 + row*99)` and size 96 × 70; every child uses `style rover_sim_colorable`.
- Widget name suffixes use rounded percentage codes (e.g., `Alpha088` means exact authored 0.875, not 0.88); rely on the layout's `color` property for measured alpha.
- No widget IDs, spacers, fonts, geometry experiments or production changes.

## Local validation / prediction-only analysis

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build
npm run analyze:native-panel-unseen-alpha
```

Expected **365** regression tests, pending local execution. Without an observation file, the analysis must report `PREDICTION_ONLY_AWAITING_NATIVE_CAPTURE`, `nativeMeasurementsAvailable=false`, and `validatedHeldOutAlphas=false`. The script recomputes all predictions from frozen knots, fails if a forecast changes, and never reads Phase 2W native observations in this mode. The regression suite also tests the optional evaluator using **synthetic** data that are explicitly not native evidence.

## Workbench and Studio comparison

Stage the new layout:

```powershell
.\tests\fixtures\workbench-grid\runtime-mod\Prepare-GridProbe.ps1 -Overwrite
```

Workbench file: `P:\NIH_GridMeasurementProbe\gui\layouts\NIH_Panel_Heldout_Alpha_Matrix.layout`

Studio source file: `Z:\GitHub\NIH-Layout-Studio\tests\fixtures\workbench-grid\NIH_Panel_Heldout_Alpha_Matrix.layout`

Studio URL: `http://localhost:5173/?experimentalNativeColorablePanel=1&experimentalNativeColorableSRGB=1`

Keep both at authored root 1920 × 1080 and preview zoom approximately 46%. Avoid selection outlines and cursor overlays. Capture one clean Workbench screenshot and one Studio screenshot. Measure 7 × 7 pixel median patches **inside** the panels, not at boundaries.

A new PBO build, client restart, and native EnScript probe are **not necessary**: Workbench can directly open the newly staged layout.

## Unbiased comparison once native screenshots exist

Only **after** the native screenshot is measured, create an observations JSON with three entries:

```json
{
  "backgrounds": [
    {"name":"Dark","backdropRGB":[90,90,90],"swatchesRGB":[]},
    {"name":"Light","backdropRGB":[231,231,231],"swatchesRGB":[]},
    {"name":"Chromatic","backdropRGB":[79,162,234],"swatchesRGB":[]}
  ]
}
```

The empty arrays above are deliberately **not valid measurements**. Replace the backdrop values with independently measured native pixels, and provide six rows × five measured RGB triples for each background, ordered by alpha descending and Blue, Orange, Green, Pink, Lavender. Do **not** fill observations from the frozen forecasts.

Evaluate the real capture with:

```powershell
node scripts\Analyze-NativePanelUnseenAlpha.mjs "path\to\actual-native-phase2w-observations.json"
```

The evaluator reports mean absolute RGB errors for frozen PCHIP, frozen linear interpolation, and ordinary CSS source-over: by backdrop, by alpha, across all 270 channels, and across **only the 180 unseen-alpha channels**. It cannot refit coefficients. Check opaque backdrop and endpoint controls before interpreting intermediate error.

## Decision gate

- If PCHIP beats both piecewise linear and ordinary CSS blending on the unseen alpha rows, it supports a smooth reusable alpha-weight approximation.
- If PCHIP and linear are indistinguishable, prefer the simpler description pending more evidence.
- If neither generalizes, retain the failed frozen predictions; do not retrofit weights into this preregistered comparison.
- Even a successful prediction does **not** prove the native GPU blend equation or applicability to all widget/image styles. Do not promote empirical alpha behavior to production until that broader behavior is established.

## Scope

Phase 2W adds only an isolated `.layout` fixture, pre-capture prediction snapshot, read-only analysis script, tests, staging and documentation. No changes to Canvas, geometry, production color parsing, native assets, or prior research fixtures.
