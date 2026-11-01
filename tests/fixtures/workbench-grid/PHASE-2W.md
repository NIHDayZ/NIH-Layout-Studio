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


## Phase 2W completed — genuine unseen-alpha validation (2026-11-01)

The user confirmed **365/365** regression tests passed, TypeScript typecheck passed, Vite production build passed (89 modules, 1.01 s), and the prediction-only analysis returned the expected \`PREDICTION_ONLY_AWAITING_NATIVE_CAPTURE\` status prior to taking native measurements.

**Actual captures:** \`image(20261101-080956).png\` from Workbench (1919×1037 screenshot pixels), \`image(20261101-080950).png\` from Studio (1919×1030). Both display \`NIH_Panel_Heldout_Alpha_Matrix.layout\` with authored 1920×1080 viewport and 46% preview zoom.

All 90 native Workbench and 90 Studio RGB triplets were measured from uniform interior 7×7 patches. All actual readings, screen coordinates, and independently captured parent RGB controls are saved in \`panel-color-phase2w-native-observations.json\`. The native screenshot was captured **after** the predictions were frozen in commit \`70659eb137f347ce2381c7d4dd97c732e213e205\`. The original preregistration JSON and model coefficients were **not modified** after capturing the measurements.

### Independent measured results

The three opaque background controls exactly match the frozen predictions: Dark \`(90,90,90)\`, Light \`(231,231,231)\`, Chromatic \`(79,162,234)\`. All 15 RGB channels for each fully opaque source row and each fully transparent source row also match their original controls.

| Model | MAE across all 270 native RGB channels | MAE on 180 genuinely unseen-alpha RGB channels |
|---|---:|---:|
| **Pre-frozen PCHIP weighted-linear/sRGB candidate** | **0.7926** | **1.1889** |
| Pre-frozen piecewise linear weighted-linear/sRGB | 1.0704 | 1.6056 |
| Ordinary quantized-sRGB source-over | 5.4444 | 8.1667 |
| Real experimental Studio screenshot | 5.4074 | 8.1111 |

Breakdown by parent background, 90 channels per background including control rows:

| Background | PCHIP | Piecewise linear | CSS source-over |
|---|---:|---:|---:|
| Dark | 1.0444 | 1.1111 | 2.3333 |
| Light | 0.4667 | 1.0000 | 8.0556 |
| Chromatic | 0.8667 | 1.1000 | 5.9444 |

**Decision:** The preregistered smooth PCHIP curve predicts **previously unseen alpha levels across three background colors**, without refitting, approximately **6.87 times better than CSS source-over** on the intermediate-only data. The cubic curve also improves on simple linear interpolation, although both are much better than CSS on this fixture.

**Remaining error is real:** Maximum PCHIP channel error is **7 RGB levels**, at Chromatic backdrop / 37.5% authored alpha / Blue swatch / red channel (native 105 versus prediction 98). This residual persists despite exact backdrop and opaque foreground controls; the interpolation is not a perfect native shader equation.

### Reproducible real comparison

After fetching the commit containing the native observations, run:

\`\`\`powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine

node scripts\Analyze-NativePanelUnseenAlpha.mjs "tests\fixtures\workbench-grid\panel-color-phase2w-native-observations.json"
\`\`\`

The analysis must report \`HELD_OUT_ALPHA_COMPARISON\` and total / intermediate MAEs of \`0.7926 / 1.1889\` (PCHIP), \`1.0704 / 1.6056\` (linear), and \`5.4444 / 8.1667\` (CSS). The real-observation regression cases extend the anticipated suite total from 365 to **369**, pending local validation. There is no need to rerun the earlier native client flag probes.

### Interpretation and next research decision

This constitutes **strong independent predictive evidence** for a continuously varying pair of color weights followed by sRGB output transfer for the sampled opaque-white \`rover_sim_colorable\` PanelWidgets. It does **not** verify a unique GPU blend equation, texel sampling across styles, or all possible opacity values.

The conservative next step is to separate two goals:

1. **Preview parity:** Consider adding an explicitly opt-in, style-scoped PCHIP compositor experiment that can be compared visually and quantitatively against the native fixture. To render nested/translucent panels accurately, the experiment will need access to the true underlying linearized backdrop rather than blindly applying a CSS \`background-color\` fill. Do not alter production renderer or simply apply a screenshot-fitted alpha curve.
2. **Native mechanism:** In parallel, investigate actual widget blend state/shader source to identify why the source/destination weights sum to less than one at intermediate alpha. Only this can validate broader applicability to other styles and textured widgets.

Keep GridSpacer geometry, implicit \`blank\` PanelWidget rule, and the existing quantized-sRGB preview intact. No general panel-color change is warranted from this fixture alone.
